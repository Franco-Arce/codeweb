import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import crypto from 'crypto';
import { generateOracleRoast, RaceContext } from './groqOracle';
import { sendWhatsAppMessage, startWhatsAppCron } from './whatsappAlerts';

const JWT_SECRET = process.env.JWT_SECRET || 'f1prode_secret_key_2026';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'https://codeweb-f1.vercel.app'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json());

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
});

// Oracle cache constants
const ORACLE_NEAR_RACE_WINDOW = 3 * 60 * 60 * 1000;   // 3h before session → refresh by time
const ORACLE_NEAR_RACE_REFRESH = 30 * 60 * 1000;       // refresh every 30min when near race
const ORACLE_MAX_DAILY_CALLS = 80;                      // ~100k TPD / ~1250 tokens per call

// In-memory Groq rate-limit backoff: don't retry until this timestamp
let groqRateLimitedUntil = 0;

function hashStr(s: string): string {
    return crypto.createHash('md5').update(s).digest('hex');
}

function isNearRace(nextRace: any, races2026: any[]): boolean {
    const race = races2026.find(r => r.round === nextRace.round);
    if (!race) return false;
    const now = Date.now();
    const dates = [race.qualy_date, race.date, race.sprint_date].filter(Boolean) as string[];
    return dates.some(d => {
        const t = new Date(d).getTime();
        return t > now && (t - now) < ORACLE_NEAR_RACE_WINDOW;
    });
}

// --- Simple Auth Middleware ---
const requireAuth = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number, username: string, isAdmin?: boolean };
        (req as any).user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const requireAdmin = async (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized.' });
    try {
        const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [user.userId]);
        if (!result.rows[0]?.is_admin) {
            return res.status(403).json({ error: 'Acceso denegado. Solo admins.' });
        }
        next();
    } catch {
        return res.status(500).json({ error: 'Error verificando permisos.' });
    }
};

// --- Postges Database Connection ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Session types for the prode
export type SessionType = 'race' | 'qualifying' | 'sprint' | 'sprint_qualifying';

// New scoring: winner(10) + team(5) + top5(3 in top5 + 2 exact) + bonus(10)
function scoreSession(pred: any, official: any): number {
    let scored = 0;
    const officialTop5 = [official.p1, official.p2, official.p3, official.p4, official.p5].filter(Boolean) as string[];
    const predDrivers = [pred.p1, pred.p2, pred.p3, pred.p4, pred.p5] as (string | null)[];

    // 1. Winner exact: +10
    if (pred.p1 && pred.p1 === official.p1) scored += 10;

    // 2. Best team exact: +5
    if (pred.predicted_team && official.winning_team &&
        pred.predicted_team.toLowerCase().trim() === official.winning_team.toLowerCase().trim()) scored += 5;

    // 3. Top 5 drivers: +3 if in top5 (any position) +2 if exact position
    for (let i = 0; i < 5; i++) {
        const d = predDrivers[i];
        if (!d) continue;
        if (officialTop5.includes(d)) scored += 3;
        if (d === officialTop5[i]) scored += 2;
    }

    // 4. Bonus: all 5 exact + winner + team
    const allTop5Exact = predDrivers.every((d, i) => d && d === officialTop5[i]);
    const winnerCorrect = pred.p1 === official.p1;
    const teamCorrect = !official.winning_team ||
        (pred.predicted_team && pred.predicted_team.toLowerCase().trim() === official.winning_team.toLowerCase().trim());
    if (allTop5Exact && winnerCorrect && teamCorrect) scored += 10;

    return scored;
}

// Shared: process and score a session result (used by admin endpoint + auto-score cron)
async function processSessionResult(
    pool: Pool,
    race_id: string,
    session_type: string,
    p1: string, p2: string, p3: string, p4: string, p5: string,
    winning_team: string = ''
): Promise<{ player: string; scored: number }[]> {
    await pool.query(
        `INSERT INTO race_results (race_id, session_type, p1, p2, p3, p4, p5, winning_team)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (race_id, session_type)
         DO UPDATE SET p1=$3, p2=$4, p3=$5, p4=$6, p5=$7, winning_team=$8, created_at=CURRENT_TIMESTAMP`,
        [race_id, session_type, p1, p2, p3, p4, p5, winning_team || null]
    );
    const predsResult = await pool.query(
        'SELECT * FROM predictions WHERE race_id = $1 AND session_type = $2',
        [race_id, session_type]
    );
    const official = { p1, p2, p3, p4, p5, winning_team };
    const scoreUpdates: { player: string; scored: number }[] = [];
    for (const pred of predsResult.rows) {
        const scored = scoreSession(pred, official);
        if (scored > 0) {
            scoreUpdates.push({ player: pred.player, scored });
            await pool.query(
                'INSERT INTO leaderboard (name, pts) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET pts = leaderboard.pts + $2',
                [pred.player, scored]
            );
        }
    }
    return scoreUpdates;
}

// Create and migrate tables
const initDb = async () => {
    try {
        // Core tables (idempotent)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS predictions (
                id SERIAL PRIMARY KEY,
                player VARCHAR(100) NOT NULL,
                race_id VARCHAR(50) NOT NULL DEFAULT 'current',
                session_type VARCHAR(30) NOT NULL DEFAULT 'race',
                p1 VARCHAR(100),
                p2 VARCHAR(100),
                p3 VARCHAR(100),
                p4 VARCHAR(100),
                p5 VARCHAR(100),
                pole_position VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                pts INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS race_results (
                id SERIAL PRIMARY KEY,
                race_id VARCHAR(50) NOT NULL,
                session_type VARCHAR(30) NOT NULL DEFAULT 'race',
                p1 VARCHAR(100),
                p2 VARCHAR(100),
                p3 VARCHAR(100),
                p4 VARCHAR(100),
                p5 VARCHAR(100),
                pole_position VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_profiles (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                avatar_seed VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Ensure media_boardgames has rating and recommender
            ALTER TABLE media_boardgames ADD COLUMN IF NOT EXISTS rating VARCHAR(50);
            ALTER TABLE media_boardgames ADD COLUMN IF NOT EXISTS recommender VARCHAR(100);

            CREATE TABLE IF NOT EXISTS oracle_cache (
                race_id TEXT PRIMARY KEY,
                analysis TEXT NOT NULL,
                generated_at TIMESTAMPTZ DEFAULT NOW(),
                predictions_hash TEXT,
                jolpica_hash TEXT
            );

            CREATE TABLE IF NOT EXISTS oracle_usage (
                day DATE PRIMARY KEY DEFAULT CURRENT_DATE,
                call_count INTEGER DEFAULT 0
            );
        `);

        // --- Non-destructive migrations ---

        // 1. Add session_type to predictions if it doesn't exist
        await pool.query(`
            ALTER TABLE predictions ADD COLUMN IF NOT EXISTS session_type VARCHAR(30) NOT NULL DEFAULT 'race';
        `);

        // 2. Add session_type to race_results if it doesn't exist
        await pool.query(`
            ALTER TABLE race_results ADD COLUMN IF NOT EXISTS session_type VARCHAR(30) NOT NULL DEFAULT 'race';
        `);

        // New scoring: add predicted_team to predictions and winning_team to race_results
        await pool.query(`
            ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_team VARCHAR(100);
            ALTER TABLE race_results ADD COLUMN IF NOT EXISTS winning_team VARCHAR(100);
        `);

        // 3. Fix unique constraint on predictions: (player, race_id, session_type)
        await pool.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'predictions_player_race_id_key'
                ) THEN
                    ALTER TABLE predictions DROP CONSTRAINT predictions_player_race_id_key;
                END IF;
            END $$;
        `);
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'predictions_player_race_session_unique'
                ) THEN
                    ALTER TABLE predictions ADD CONSTRAINT predictions_player_race_session_unique
                    UNIQUE (player, race_id, session_type);
                END IF;
            END $$;
        `);

        // 4. Fix unique constraint on race_results: (race_id, session_type)
        await pool.query(`
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'race_results_race_id_key'
                ) THEN
                    ALTER TABLE race_results DROP CONSTRAINT race_results_race_id_key;
                END IF;
            END $$;
        `);
        await pool.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'race_results_race_id_session_unique'
                ) THEN
                    ALTER TABLE race_results ADD CONSTRAINT race_results_race_id_session_unique
                    UNIQUE (race_id, session_type);
                END IF;
            END $$;
        `);
        // 5a. Add is_admin column to users if not exists
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
        `);

        // 5. Add created_by_user_id to media tables
        await pool.query(`
            ALTER TABLE media_series ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
            ALTER TABLE media_movies ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
            ALTER TABLE media_boardgames ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);
        `);

        // 6. Create media_ratings table for multi-user voting (media_id is TEXT to support UUIDs)
        // If the table exists with media_id INTEGER (old schema), drop and recreate with TEXT
        await pool.query(`
            DO $$
            DECLARE col_type TEXT;
            BEGIN
                SELECT data_type INTO col_type
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'media_ratings' AND column_name = 'media_id';

                IF col_type = 'integer' THEN
                    DROP TABLE IF EXISTS media_ratings;
                END IF;
            END $$;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_ratings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                media_type VARCHAR(20) NOT NULL,
                media_id TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, media_type, media_id)
            );
        `);

        // 7. Add explicit constraints to link players and profiles to users

        console.log('--- Limpiando datos huérfanos y normalizando ---');
        // Step 7a: Normalize casing
        await pool.query(`
            UPDATE users SET username = LOWER(TRIM(username));
            UPDATE user_profiles SET username = LOWER(TRIM(username));
            UPDATE leaderboard SET name = LOWER(TRIM(name));
            UPDATE predictions SET player = LOWER(TRIM(player));
        `);

        // Step 7b: Clean orphans that prevent FK creation
        await pool.query(`
            DELETE FROM user_profiles WHERE username NOT IN (SELECT username FROM users);
            DELETE FROM leaderboard WHERE name NOT IN (SELECT username FROM users);
            DELETE FROM predictions WHERE player NOT IN (SELECT username FROM users);
        `);

        console.log('--- Aplicando resticciones de llave foránea ---');
        // Step 7c: Link tables
        await pool.query(`
            DO $$ BEGIN
                -- Link user_profiles to users
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profile_user_status') THEN
                    ALTER TABLE user_profiles 
                    ADD CONSTRAINT fk_profile_user_status
                    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE;
                END IF;

                -- Link leaderboard to users
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_leaderboard_user') THEN
                    ALTER TABLE leaderboard 
                    ADD CONSTRAINT fk_leaderboard_user
                    FOREIGN KEY (name) REFERENCES users(username) ON DELETE CASCADE;
                END IF;

                -- Link predictions to users
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_predictions_user') THEN
                    ALTER TABLE predictions 
                    ADD CONSTRAINT fk_predictions_user
                    FOREIGN KEY (player) REFERENCES users(username) ON DELETE CASCADE;
                END IF;
            END $$;
        `);

        // Media user status table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_user_status (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                media_type VARCHAR(30) NOT NULL,
                media_id TEXT NOT NULL,
                status VARCHAR(20) NOT NULL CHECK (status IN ('watched','in_progress','pending')),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, media_type, media_id)
            )
        `);

        // Media comments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_comments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                media_type VARCHAR(30) NOT NULL,
                media_id TEXT NOT NULL,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Grant admin to kazter and mrforii
        await pool.query(`UPDATE users SET is_admin = true WHERE username IN ('kazter', 'mrforii')`);

        // Seed Australia 2026 qualifying predictions (3 positions, already happened)
        await pool.query(`
            INSERT INTO predictions (player, race_id, session_type, p1, p2, p3)
            SELECT u.username, 'round_1', 'qualifying', data.p1, data.p2, data.p3
            FROM (VALUES
                ('lu',       'George Russell',  'Lewis Hamilton',  'Oscar Piastri'),
                ('eliana',   'Oscar Piastri',   'Max Verstappen',  'Charles Leclerc'),
                ('guille',   'Charles Leclerc', 'Lando Norris',    'Max Verstappen'),
                ('nestor',   'Charles Leclerc', 'Lando Norris',    'Max Verstappen'),
                ('davisote', 'George Russell',  'Charles Leclerc', 'Max Verstappen')
            ) AS data(username, p1, p2, p3)
            JOIN users u ON u.username = data.username
            ON CONFLICT (player, race_id, session_type) DO NOTHING
        `);

        // Rebuild leaderboard from scratch so seeded/late predictions are always scored correctly
        const [rebuildResults, rebuildPreds] = await Promise.all([
            pool.query('SELECT * FROM race_results'),
            pool.query('SELECT * FROM predictions'),
        ]);
        if (rebuildResults.rows.length > 0) {
            await pool.query('UPDATE leaderboard SET pts = 0');
            for (const result of rebuildResults.rows) {
                const matching = rebuildPreds.rows.filter(
                    (p: any) => p.race_id === result.race_id && p.session_type === result.session_type
                );
                for (const pred of matching) {
                    const scored = scoreSession(pred, result);
                    if (scored > 0) {
                        await pool.query(
                            'INSERT INTO leaderboard (name, pts) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET pts = leaderboard.pts + $2',
                            [pred.player, scored]
                        );
                    }
                }
            }
            console.log('✅ Leaderboard reconstruido desde predicciones y resultados');
        }

        console.log('✅ Base de datos inicializada y migrada');
    } catch (error) {
        console.error('❌ Error configurando base de datos:', error);
    }
};

initDb();

app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Logged out' });
});

// Get current user info (including is_admin)
app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user;
    try {
        const result = await pool.query('SELECT id, username, is_admin FROM users WHERE id = $1', [user.userId]);
        if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching user info' });
    }
});

app.get('/api/auth/session', requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    res.json({ authenticated: true, user: user.username });
});

// --- User List Endpoint for Dropdowns ---
app.get('/api/users/list', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT username FROM users ORDER BY username ASC');
        res.json(result.rows.map(r => r.username));
    } catch (e) {
        console.error('Error fetching users:', e);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// --- Official 2026 F1 Calendar ---
const races2026 = [
    {
        "round": 1,
        "country": "Australia",
        "city": "Melbourne",
        "name": "GP de Australia",
        "qualy_date": "2026-03-07T05:00:00Z",
        "date": "2026-03-08T04:00:00Z",
        "circuit": "Albert Park",
        "sprint": false
    },
    {
        "round": 2,
        "country": "China",
        "city": "Shanghai",
        "name": "GP de China",
        "sprint_qualy_date": "2026-03-13T03:30:00Z",
        "sprint_date": "2026-03-14T03:00:00Z",
        "qualy_date": "2026-03-14T07:00:00Z",
        "date": "2026-03-15T07:00:00Z",
        "circuit": "Shanghai International Circuit",
        "sprint": true
    },
    {
        "round": 3,
        "country": "Japón",
        "city": "Suzuka",
        "name": "GP de Japón",
        "qualy_date": "2026-03-28T06:00:00Z",
        "date": "2026-03-29T05:00:00Z",
        "circuit": "Suzuka Circuit",
        "sprint": false
    },
    {
        "round": 4,
        "country": "Bahréin",
        "city": "Sakhir",
        "name": "GP de Bahréin",
        "qualy_date": "2026-04-11T16:00:00Z",
        "date": "2026-04-12T15:00:00Z",
        "circuit": "Bahrain International Circuit",
        "sprint": false
    },
    {
        "round": 5,
        "country": "Arabia Saudita",
        "city": "Jeddah",
        "name": "GP de Arabia Saudita",
        "qualy_date": "2026-04-18T17:00:00Z",
        "date": "2026-04-19T17:00:00Z",
        "circuit": "Jeddah Corniche Circuit",
        "sprint": false
    },
    {
        "round": 6,
        "country": "Estados Unidos",
        "city": "Miami",
        "name": "GP de Miami",
        "sprint_qualy_date": "2026-05-01T16:30:00Z",
        "sprint_date": "2026-05-02T16:00:00Z",
        "qualy_date": "2026-05-02T20:00:00Z",
        "date": "2026-05-03T20:00:00Z",
        "circuit": "Miami International Autodrome",
        "sprint": true
    },
    {
        "round": 7,
        "country": "Canadá",
        "city": "Montreal",
        "name": "GP de Canadá",
        "qualy_date": "2026-05-23T20:00:00Z",
        "date": "2026-05-24T18:00:00Z",
        "circuit": "Circuit Gilles Villeneuve",
        "sprint": true,
        "sprint_date": "2026-05-23T16:00:00Z",
        "sprint_qualy_date": "2026-05-22T20:00:00Z"
    },
    {
        "round": 8,
        "country": "Mónaco",
        "city": "Mónaco",
        "name": "GP de Mónaco",
        "qualy_date": "2026-06-06T14:00:00Z",
        "date": "2026-06-07T13:00:00Z",
        "circuit": "Circuit de Monaco",
        "sprint": false
    },
    {
        "round": 9,
        "country": "España",
        "city": "Barcelona",
        "name": "GP de España",
        "qualy_date": "2026-06-13T14:00:00Z",
        "date": "2026-06-14T13:00:00Z",
        "circuit": "Circuit de Barcelona-Catalunya",
        "sprint": false
    },
    {
        "round": 10,
        "country": "Austria",
        "city": "Spielberg",
        "name": "GP de Austria",
        "qualy_date": "2026-06-27T14:00:00Z",
        "date": "2026-06-28T13:00:00Z",
        "circuit": "Red Bull Ring",
        "sprint": false
    },
    {
        "round": 11,
        "country": "Reino Unido",
        "city": "Silverstone",
        "name": "GP de Reino Unido",
        "sprint_qualy_date": "2026-07-03T16:30:00Z",
        "sprint_date": "2026-07-04T11:00:00Z",
        "qualy_date": "2026-07-04T15:00:00Z",
        "date": "2026-07-05T14:00:00Z",
        "circuit": "Silverstone Circuit",
        "sprint": true
    },
    {
        "round": 12,
        "country": "Bélgica",
        "city": "Spa-Francorchamps",
        "name": "GP de Bélgica",
        "qualy_date": "2026-07-18T14:00:00Z",
        "date": "2026-07-19T13:00:00Z",
        "circuit": "Circuit de Spa-Francorchamps",
        "sprint": false
    },
    {
        "round": 13,
        "country": "Hungría",
        "city": "Budapest",
        "name": "GP de Hungría",
        "qualy_date": "2026-07-25T14:00:00Z",
        "date": "2026-07-26T13:00:00Z",
        "circuit": "Hungaroring",
        "sprint": false
    },
    {
        "round": 14,
        "country": "Países Bajos",
        "city": "Zandvoort",
        "name": "GP de Países Bajos",
        "sprint_qualy_date": "2026-08-21T14:30:00Z",
        "sprint_date": "2026-08-22T10:00:00Z",
        "qualy_date": "2026-08-22T14:00:00Z",
        "date": "2026-08-23T13:00:00Z",
        "circuit": "Circuit Zandvoort",
        "sprint": true
    },
    {
        "round": 15,
        "country": "Italia",
        "city": "Monza",
        "name": "GP de Italia",
        "qualy_date": "2026-09-05T14:00:00Z",
        "date": "2026-09-06T13:00:00Z",
        "circuit": "Autodromo Nazionale Monza",
        "sprint": false
    },
    {
        "round": 16,
        "country": "España",
        "city": "Madrid",
        "name": "GP de Madrid",
        "qualy_date": "2026-09-12T14:00:00Z",
        "date": "2026-09-13T13:00:00Z",
        "circuit": "Madrid Street Circuit",
        "sprint": false
    },
    {
        "round": 17,
        "country": "Azerbaiyán",
        "city": "Bakú",
        "name": "GP de Azerbaiyán",
        "qualy_date": "2026-09-26T12:00:00Z",
        "date": "2026-09-27T11:00:00Z",
        "circuit": "Baku City Circuit",
        "sprint": false
    },
    {
        "round": 18,
        "country": "Singapur",
        "city": "Singapur",
        "name": "GP de Singapur",
        "sprint_qualy_date": "2026-10-09T13:30:00Z",
        "sprint_date": "2026-10-10T09:00:00Z",
        "qualy_date": "2026-10-10T13:00:00Z",
        "date": "2026-10-11T12:00:00Z",
        "circuit": "Marina Bay Street Circuit",
        "sprint": true
    },
    {
        "round": 19,
        "country": "Estados Unidos",
        "city": "Austin",
        "name": "GP de Estados Unidos",
        "qualy_date": "2026-10-24T21:00:00Z",
        "date": "2026-10-25T20:00:00Z",
        "circuit": "Circuit of the Americas",
        "sprint": false
    },
    {
        "round": 20,
        "country": "México",
        "city": "CDMX",
        "name": "GP de Ciudad de México",
        "qualy_date": "2026-10-31T21:00:00Z",
        "date": "2026-11-01T20:00:00Z",
        "circuit": "Autódromo Hermanos Rodríguez",
        "sprint": false
    },
    {
        "round": 21,
        "country": "Brasil",
        "city": "São Paulo",
        "name": "GP de Brasil",
        "qualy_date": "2026-11-07T18:00:00Z",
        "date": "2026-11-08T17:00:00Z",
        "circuit": "Autódromo José Carlos Pace",
        "sprint": false
    },
    {
        "round": 22,
        "country": "Estados Unidos",
        "city": "Las Vegas",
        "name": "GP de Las Vegas",
        "qualy_date": "2026-11-21T06:00:00Z",
        "date": "2026-11-22T04:00:00Z",
        "circuit": "Las Vegas Strip Circuit",
        "sprint": false
    },
    {
        "round": 23,
        "country": "Qatar",
        "city": "Lusail",
        "name": "GP de Qatar",
        "qualy_date": "2026-11-28T18:00:00Z",
        "date": "2026-11-29T16:00:00Z",
        "circuit": "Lusail International Circuit",
        "sprint": false
    },
    {
        "round": 24,
        "country": "Abu Dhabi",
        "city": "Yas Marina",
        "name": "GP de Abu Dabi",
        "qualy_date": "2026-12-05T13:00:00Z",
        "date": "2026-12-06T13:00:00Z",
        "circuit": "Yas Marina Circuit",
        "sprint": false
    }
];

function getNextRace() {
    const now = new Date();
    const RACE_DURATION_MS = 4 * 60 * 60 * 1000; // 4h window after race start
    // A race is "current or upcoming" if its start time + 4h is still in the future
    return races2026.find(r => new Date(r.date).getTime() + RACE_DURATION_MS > now.getTime())
        || races2026[races2026.length - 1];
}

// --- API Routes (Protected) ---

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'F1 Prode Backend is running fast!' });
});

// Get full 2026 Calendar
app.get('/api/races/calendar', requireAuth, (req: Request, res: Response) => {
    res.json(races2026);
});

// Get the next upcoming race — DB-aware: only advances past a GP when race result is confirmed
app.get('/api/races/next', requireAuth, async (req: Request, res: Response) => {
    try {
        // Find current/next race by time (with 4h buffer)
        const byTime = getNextRace();
        // Check if its race result is already in our DB (auto-imported from Jolpica)
        const raceId = `round_${byTime.round}`;
        const raceResult = await pool.query(
            "SELECT id FROM race_results WHERE race_id = $1 AND session_type = 'race'",
            [raceId]
        );
        if (raceResult.rows.length > 0) {
            // Race is confirmed finished → advance to next round
            const next = races2026.find(r => r.round === byTime.round + 1) || byTime;
            return res.json({ ...next, previous: byTime });
        }
        res.json(byTime);
    } catch {
        res.json(getNextRace());
    }
});

// Sprint Qualifying results from OpenF1 (Jolpica doesn't have this session)
app.get('/api/races/:round/sprint-qualifying-results', requireAuth, async (req: Request, res: Response) => {
    try {
        const round = parseInt(req.params.round as string);
        if (isNaN(round)) return res.status(400).json({ error: 'Invalid round' });

        const race = races2026.find(r => r.round === round);
        if (!race || !race.sprint) return res.status(404).json({ error: 'No sprint qualifying for this round' });

        // 1. Find the OpenF1 session_key for sprint qualifying of this round
        const sessRes = await fetch('https://api.openf1.org/v1/sessions?year=2026&session_name=Sprint+Qualifying');
        if (!sessRes.ok) return res.status(502).json({ error: 'OpenF1 unavailable' });
        const sessions: any[] = await sessRes.json();

        // Match by date proximity to our sprint_qualy_date
        const targetDate = new Date((race as any).sprint_qualy_date).getTime();
        const session = sessions
            .map(s => ({ ...s, diff: Math.abs(new Date(s.date_start).getTime() - targetDate) }))
            .sort((a, b) => a.diff - b.diff)[0];

        if (!session) return res.status(404).json({ error: 'Session not found on OpenF1' });

        const sessionKey = session.session_key;

        // 2. Fetch laps and driver info in parallel
        const [lapsRes, driversRes] = await Promise.all([
            fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`),
            fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
        ]);
        if (!lapsRes.ok || !driversRes.ok) return res.status(502).json({ error: 'OpenF1 data unavailable' });

        const laps: any[] = await lapsRes.json();
        const drivers: any[] = await driversRes.json();

        // 3. Best lap per driver (ignore null durations)
        const bestLaps = new Map<number, number>();
        for (const lap of laps) {
            if (!lap.lap_duration || lap.lap_duration <= 0) continue;
            const prev = bestLaps.get(lap.driver_number);
            if (prev === undefined || lap.lap_duration < prev) {
                bestLaps.set(lap.driver_number, lap.lap_duration);
            }
        }

        // 4. Sort ascending and take top 5
        const sorted = [...bestLaps.entries()].sort((a, b) => a[1] - b[1]);
        const driverMap = new Map(drivers.map((d: any) => [d.driver_number, d.full_name || `#${d.driver_number}`]));

        const top5 = sorted.slice(0, 5).map(([num, time], i) => ({
            pos: i + 1,
            driver: driverMap.get(num) || `#${num}`,
            number: num,
            best_lap: time.toFixed(3),
        }));

        res.json({ session_key: sessionKey, results: top5 });
    } catch (err) {
        console.error('Sprint qualifying OpenF1 error:', err);
        res.status(500).json({ error: 'Error fetching sprint qualifying from OpenF1' });
    }
});

// Full results from Jolpica for any round (qualifying + race + sprint)
app.get('/api/races/:round/full-results', requireAuth, async (req: Request, res: Response) => {
    try {
        const round = parseInt(req.params.round as string);
        if (isNaN(round)) return res.status(400).json({ error: 'Invalid round' });

        const fetchJolpica = async (endpoint: string) => {
            try {
                const r = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}/${endpoint}.json`);
                return r.ok ? await r.json() : null;
            } catch { return null; }
        };

        const mapResults = (rows: any[]) => rows.map((r: any, i: number) => ({
            pos: i + 1,
            driver: `${r.Driver?.givenName} ${r.Driver?.familyName}`,
            team: r.Constructor?.name || '',
            number: r.Driver?.permanentNumber || '',
        }));

        const [qualyData, raceData, sprintData] = await Promise.all([
            fetchJolpica('qualifying'),
            fetchJolpica('results'),
            fetchJolpica('sprint'),
        ]);

        const result: any = {};

        const qualyRows = qualyData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
        if (qualyRows.length) result.qualifying = mapResults(qualyRows);

        const raceRows = raceData?.MRData?.RaceTable?.Races?.[0]?.Results || [];
        if (raceRows.length) result.race = mapResults(raceRows);

        const sprintRows = sprintData?.MRData?.RaceTable?.Races?.[0]?.SprintResults || [];
        if (sprintRows.length) result.sprint = mapResults(sprintRows);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching results from Jolpica' });
    }
});

// Get predictions for a race+session (defaults to next race, 'race' session)
app.get('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        if (!nextRace) {
            console.error('[API_PREDICTIONS] nextRace is undefined!');
            return res.status(500).json({ error: 'Calendar error' });
        }

        const raceId = (req.query.race_id as string) || `round_${nextRace.round}`;
        const sessionType = (req.query.session_type as string) || null;

        console.log(`[API_PREDICTIONS] Fetching for ${raceId}, session: ${sessionType}`);

        let query: string;
        let params: any[];
        if (sessionType) {
            query = "SELECT * FROM predictions WHERE race_id = $1 AND session_type = $2 ORDER BY created_at DESC";
            params = [raceId, sessionType];
        } else {
            query = "SELECT * FROM predictions WHERE race_id = $1 ORDER BY created_at DESC";
            params = [raceId];
        }

        const result = await pool.query(query, params);
        // Ensure player names are handled consistently if needed (backend already stores lowercase)
        res.json(result.rows);
    } catch (error) {
        console.error('[API_PREDICTIONS] Error criticality:', error);
        res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) });
    }
});

// Submit a prediction — supports all session types
app.post('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        const { player, p1, p2, p3, p4, p5, pole_position, session_type = 'race' } = req.body;
        const nextRace = getNextRace();
        const race_id = `round_${nextRace.round}`;

        const lowerPlayer = String(player || '').toLowerCase().trim();

        const result = await pool.query(
            `INSERT INTO predictions (player, race_id, session_type, p1, p2, p3, p4, p5, pole_position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (player, race_id, session_type)
             DO UPDATE SET p1 = $4, p2 = $5, p3 = $6, p4 = $7, p5 = $8, pole_position = $9, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [lowerPlayer, race_id, session_type, p1, p2, p3, p4, p5, pole_position]
        );
        res.status(201).json({ message: 'Prediction saved', prediction: result.rows[0] });

        // Fire-and-forget: send WhatsApp reminder to whoever is still missing
        (async () => {
            try {
                const SESSION_LABELS: Record<string, string> = {
                    race: 'Carrera', qualifying: 'Clasificación',
                    sprint: 'Sprint Race', sprint_qualifying: 'Sprint Qualifying',
                };
                // Active players = everyone registered in the leaderboard
                const activePreds = await pool.query('SELECT name FROM leaderboard');
                const activePlayers = activePreds.rows.map((r: any) => r.name);

                // Who already predicted this session
                const sessionPreds = await pool.query(
                    'SELECT player FROM predictions WHERE race_id = $1 AND session_type = $2',
                    [race_id, session_type]
                );
                const submitted = new Set(sessionPreds.rows.map((r: any) => r.player.toLowerCase()));
                const missing = activePlayers.filter((p: string) => !submitted.has(p.toLowerCase()));

                if (missing.length === 0) return;

                const mentions = missing.map((u: string) => `*${u}*`).join(', ');
                const sessionLabel = SESSION_LABELS[session_type] || session_type;
                const msg = `🏎️ *${lowerPlayer}* acaba de cargar su pronóstico para la *${sessionLabel}* de *${nextRace.name}*.\n\nTodavía faltan: ${mentions}\n\n¡No se queden afuera! ⏱️\nhttps://codeweb-f1.vercel.app/`;
                await sendWhatsAppMessage(msg);
            } catch (err) {
                console.error('WhatsApp auto-remind error:', err);
            }
        })();
    } catch (error) {
        console.error('Error saving prediction', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Leaderboard
app.get('/api/leaderboard', requireAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM leaderboard ORDER BY pts DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leaderboard', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- AUTH ROUTES ---

app.post('/api/auth/register', authLimiter, async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const lowerUsername = username.toLowerCase().trim();
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [lowerUsername, hashedPassword]
        );

        // Also create an initial profile
        await pool.query('INSERT INTO user_profiles (username, avatar_seed) VALUES ($1, $2) ON CONFLICT DO NOTHING', [lowerUsername, lowerUsername]);

        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err: any) {
        if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
        console.error('Register error:', err);
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const lowerUsername = username.toLowerCase().trim();
        console.log(`[DEBUG_AUTH] Intento login: "${lowerUsername}"`);
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [lowerUsername]);
        const user = result.rows[0];

        if (!user) {
            console.log(`[DEBUG_AUTH] Usuario NO encontrado: "${lowerUsername}"`);
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        console.log(`[DEBUG_AUTH] Usuario encontrado. Comprando hash...`);
        const isMatch = await bcrypt.compare(password, user.password_hash);
        console.log(`[DEBUG_AUTH] Password match: ${isMatch ? 'SÍ' : 'NO'}`);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username });
    } catch (err) {
        console.error('[DEBUG_AUTH] Error crítico en login:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/update-password', requireAuth, async (req: Request, res: Response) => {
    const { password } = req.body;
    const userId = (req as any).user.userId;

    if (!password) return res.status(400).json({ error: 'Password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);
        res.json({ success: true, message: 'Password updated' });
    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({ error: 'Error updating password' });
    }
});

app.delete('/api/auth/account', requireAuth, async (req: Request, res: Response) => {
    const { password } = req.body;
    const userId = (req as any).user.userId;

    if (!password) return res.status(400).json({ error: 'Password required' });

    try {
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

        // NULL out created_by_user_id (no ON DELETE CASCADE on these columns)
        await pool.query('UPDATE media_series SET created_by_user_id = NULL WHERE created_by_user_id = $1', [userId]);
        await pool.query('UPDATE media_movies SET created_by_user_id = NULL WHERE created_by_user_id = $1', [userId]);
        await pool.query('UPDATE media_boardgames SET created_by_user_id = NULL WHERE created_by_user_id = $1', [userId]);

        // Delete user — cascades to user_profiles, leaderboard, predictions, media_ratings
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        res.json({ success: true });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Error deleting account' });
    }
});

app.post('/api/auth/update-username', requireAuth, async (req: Request, res: Response) => {
    const { newUsername } = req.body;
    const userId = (req as any).user.userId;

    if (!newUsername || typeof newUsername !== 'string') return res.status(400).json({ error: 'New username required' });

    const lowerNew = newUsername.toLowerCase().trim();
    if (lowerNew.length < 3 || lowerNew.length > 30) return res.status(400).json({ error: 'Username must be 3-30 characters' });
    if (!/^[a-z0-9_]+$/.test(lowerNew)) return res.status(400).json({ error: 'Only lowercase letters, numbers and underscores' });

    try {
        const current = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const oldUsername = current.rows[0].username;

        if (oldUsername === lowerNew) return res.status(400).json({ error: 'Same username' });

        const existing = await pool.query('SELECT id FROM users WHERE username = $1', [lowerNew]);
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Username already taken' });

        await pool.query('UPDATE users SET username = $1 WHERE id = $2', [lowerNew, userId]);
        await pool.query('UPDATE user_profiles SET username = $1 WHERE username = $2', [lowerNew, oldUsername]);
        await pool.query('UPDATE leaderboard SET name = $1 WHERE name = $2', [lowerNew, oldUsername]);
        await pool.query('UPDATE predictions SET player = $1 WHERE player = $2', [lowerNew, oldUsername]);

        const token = jwt.sign({ userId, username: lowerNew }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, username: lowerNew });
    } catch (err) {
        console.error('Update username error:', err);
        res.status(500).json({ error: 'Error updating username' });
    }
});

// Get context for AI Oracle
app.get('/api/oracle/context', requireAuth, async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        const raceId = `round_${nextRace.round}`;

        // Fetch all predictions (all sessions) for this race
        const result = await pool.query(
            'SELECT * FROM predictions WHERE race_id = $1 ORDER BY session_type, created_at DESC', [raceId]
        );
        const predictions = result.rows;

        // Build race context — try to get qualifying results from Jolpica
        const raceContext = {
            circuitName: `${nextRace.circuit} (${nextRace.city})`,
            weather: undefined as string | undefined,
            lastResults: undefined as string | undefined,
        };

        try {
            const jolpicaRes = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${nextRace.round}/qualifying.json`);
            if (jolpicaRes.ok) {
                const jData = await jolpicaRes.json();
                const qual = jData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults;
                if (qual && qual.length > 0) {
                    const top3 = qual.slice(0, 3).map((r: any, i: number) =>
                        `Q${i + 1}: ${r.Driver.givenName} ${r.Driver.familyName}`
                    ).join(', ');
                    raceContext.lastResults = `Qualifying: ${top3}`;
                }
            }
        } catch { /* no context available, oracle proceeds without it */ }

        // Fetch current leaderboard
        const lbResult = await pool.query('SELECT name, pts FROM leaderboard ORDER BY pts DESC');
        const leaderboard = lbResult.rows;

        const roast = await generateOracleRoast(predictions, raceContext, leaderboard);
        res.json({ analysis: roast, race: nextRace.name });
    } catch (error) {
        console.error('Error en Oracle:', error);
        res.status(500).json({ error: 'Failed to generate Oracle Analysis' });
    }
});

// --- Session schedule — fetches times from Jolpica (UTC→ARG)
app.get('/api/races/:round/schedule', requireAuth, async (req: Request, res: Response) => {
    try {
        const round = parseInt(String(req.params.round));
        const local = races2026.find(r => r.round === round);
        if (!local) return res.status(404).json({ error: 'Round not found' });

        const ARG_OFFSET_MS = -3 * 60 * 60 * 1000;
        const toArg = (utcStr?: string | null): string | null => {
            if (!utcStr) return null;
            const d = new Date(utcStr);
            if (isNaN(d.getTime())) return null;
            return new Date(d.getTime() + ARG_OFFSET_MS).toISOString().replace('Z', '-03:00');
        };
        const isOpen = (utcStr?: string | null): boolean => {
            if (!utcStr) return false;
            const sessionTime = new Date(utcStr).getTime();
            const now = Date.now();
            return now < sessionTime - 60000; // open until 1 min before session
        };

        // Fetch race data from Jolpica
        let jolpicaData: any = null;
        try {
            const resp = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}.json`);
            if (resp.ok) jolpicaData = await resp.json();
        } catch { /* use fallback */ }

        const raceInfo = jolpicaData?.MRData?.RaceTable?.Races?.[0];

        // Build the session list
        const sessions: any[] = [];

        // Qualifying (always) — fallback to hardcoded calendar if Jolpica has no data yet
        const qualyDate = raceInfo?.Qualifying
            ? `${raceInfo.Qualifying.date}T${raceInfo.Qualifying.time || '00:00:00Z'}`
            : local.qualy_date || null;
        sessions.push({
            type: 'qualifying',
            label: '🏎️ Clasificación',
            date_utc: qualyDate,
            date_arg: toArg(qualyDate),
            isOpen: isOpen(qualyDate),
            points_per_pick: 10,
            picks: ['p1', 'p2', 'p3', 'p4', 'p5'],
        });

        // Sprint weekend?
        if (local.sprint) {
            const sqDate = raceInfo?.SprintQualifying
                ? `${raceInfo.SprintQualifying.date}T${raceInfo.SprintQualifying.time || '00:00:00Z'}`
                : local.sprint_qualy_date || null;
            sessions.push({
                type: 'sprint_qualifying',
                label: '⚡ Sprint Qualifying',
                date_utc: sqDate,
                date_arg: toArg(sqDate),
                isOpen: isOpen(sqDate),
                points_per_pick: 5,
                picks: ['p1', 'p2', 'p3', 'p4', 'p5'],
            });

            const sprintDate = raceInfo?.Sprint
                ? `${raceInfo.Sprint.date}T${raceInfo.Sprint.time || '00:00:00Z'}`
                : local.sprint_date || null;
            sessions.push({
                type: 'sprint',
                label: '🏃 Sprint Race',
                date_utc: sprintDate,
                date_arg: toArg(sprintDate),
                isOpen: isOpen(sprintDate),
                points_per_pick: 8,
                picks: ['p1', 'p2', 'p3', 'p4', 'p5'],
            });
        }

        // Main race
        const raceDate = raceInfo?.date
            ? `${raceInfo.date}T${raceInfo.time || '00:00:00Z'}`
            : local.date;
        sessions.push({
            type: 'race',
            label: '🏁 Carrera',
            date_utc: raceDate,
            date_arg: toArg(raceDate),
            isOpen: isOpen(raceDate),
            points_per_pick: 10,
            picks: ['p1', 'p2', 'p3', 'p4', 'p5'],
        });

        res.json({
            round,
            name: local.name,
            circuit: local.circuit,
            city: local.city,
            isSprint: local.sprint,
            sessions,
        });
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Error fetching session schedule' });
    }
});

// --- TMDB Poster Search (proxy to avoid CORS) ---
app.get('/api/tmdb/search', requireAuth, async (req: Request, res: Response) => {
    try {
        const { query, type = 'multi' } = req.query as { query: string; type?: string };
        if (!query) return res.status(400).json({ error: 'Missing query' });
        const apiKey = process.env.TMDB_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'TMDB_API_KEY not configured' });

        const performSearch = async (q: string) => {
            const endpoint = type === 'tv'
                ? `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=es-AR`
                : type === 'movie'
                    ? `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=es-AR`
                    : `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=es-AR`;
            const resp = await fetch(endpoint);
            if (!resp.ok) return [];
            const data = await resp.json();
            return data.results || [];
        };

        let results = await performSearch(query);

        // Fallback: If no results, try cleaning the query
        if (results.length === 0) {
            // 1. Separate camelCase or PascalCase words (e.g. "TheWalkingDead" -> "The Walking Dead")
            let cleanQuery = query.replace(/([a-z])([A-Z])/g, '$1 $2');

            // 2. Clear special characters
            cleanQuery = cleanQuery.replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim();

            if (cleanQuery && cleanQuery !== query) {
                results = await performSearch(cleanQuery);
            }

            // 3. If still no results, search only the first 2 words if it's long
            if (results.length === 0) {
                const words = cleanQuery.split(' ');
                if (words.length > 2) {
                    const shortQuery = words.slice(0, 2).join(' ');
                    results = await performSearch(shortQuery);
                }
            }
        }

        // Fetch genre list for mapping ids → names
        const genreEndpoint = (type === 'movie')
            ? `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}&language=es-AR`
            : `https://api.themoviedb.org/3/genre/tv/list?api_key=${apiKey}&language=es-AR`;
        let genreMap: Record<number, string> = {};
        try {
            const genreResp = await fetch(genreEndpoint);
            if (genreResp.ok) {
                const genreData = await genreResp.json();
                genreMap = Object.fromEntries((genreData.genres || []).map((g: any) => [g.id, g.name]));
            }
        } catch {}

        const formattedResults = results.slice(0, 5).map((r: any) => ({
            id: r.id,
            title: r.title || r.name,
            media_type: r.media_type || (type === 'multi' ? (r.name ? 'tv' : 'movie') : type),
            year: (r.release_date || r.first_air_date || '').slice(0, 4),
            poster: r.poster_path ? `https://image.tmdb.org/t/p/w300${r.poster_path}` : null,
            overview: r.overview,
            genres: (r.genre_ids || []).map((id: number) => genreMap[id]).filter(Boolean).join(', '),
        }));
        res.json(formattedResults);
    } catch (error) {
        console.error('TMDB error:', error);
        res.status(500).json({ error: 'Error fetching from TMDB' });
    }
});

// --- BoardGameGeek search proxy ---
app.get('/api/bgg/search', requireAuth, async (req: Request, res: Response) => {
    try {
        const { query } = req.query as { query: string };
        if (!query) return res.status(400).json({ error: 'Missing query' });

        // Search BGG XML API
        const searchResp = await fetch(`https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame&limit=5`);
        if (!searchResp.ok) return res.json([]);
        const xml = await searchResp.text();

        // Simple regex parse for ids and names (avoids xml2js dependency)
        const items: { id: string; name: string }[] = [];
        const itemMatches = xml.matchAll(/<item type="boardgame" id="(\d+)"[\s\S]*?<name[^>]*value="([^"]+)"/g);
        for (const m of itemMatches) {
            items.push({ id: m[1], name: m[2] });
            if (items.length >= 5) break;
        }

        if (items.length === 0) return res.json([]);

        // Fetch details for each game
        const ids = items.map(i => i.id).join(',');
        const detailResp = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${ids}&stats=1`);
        const detailXml = detailResp.ok ? await detailResp.text() : '';

        const results = items.map(item => {
            // Extract thumbnail
            const thumbMatch = detailXml.match(new RegExp(`<item[^>]*id="${item.id}"[\\s\\S]*?<thumbnail>([^<]+)<\\/thumbnail>`));
            const thumb = thumbMatch ? thumbMatch[1].trim() : null;
            // Extract description snippet
            const descMatch = detailXml.match(new RegExp(`<item[^>]*id="${item.id}"[\\s\\S]*?<description>([\\s\\S]*?)<\\/description>`));
            const desc = descMatch ? descMatch[1].replace(/&amp;#10;/g, ' ').replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim().slice(0, 300) : '';
            // Extract categories
            const cats: string[] = [];
            const catRe = /link type="boardgamecategory"[^>]*value="([^"]+)"/g;
            const itemBlock = detailXml.match(new RegExp(`<item[^>]*id="${item.id}"[\\s\\S]*?(?=<item |$)`))?.[0] || '';
            let catMatch;
            while ((catMatch = catRe.exec(itemBlock)) !== null && cats.length < 3) cats.push(catMatch[1]);

            return { id: item.id, name: item.name, thumbnail: thumb, description: desc, categories: cats.join(', ') };
        });

        res.json(results);
    } catch (err) {
        console.error('BGG error:', err);
        res.json([]);
    }
});

// --- Admin: Submit official race results and calculate scores ---
app.post('/api/admin/results', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { race_round, session_type = 'race', p1, p2, p3, p4, p5, winning_team } = req.body;
        const race_id = `round_${race_round}`;

        const scoreUpdates = await processSessionResult(pool, race_id, session_type, p1, p2, p3 || '', p4 || '', p5 || '', winning_team || '');

        if (scoreUpdates.length > 0) {
            const raceName = races2026.find(r => r.round === Number(race_round))?.name || race_id;
            const sessionLabel: Record<string, string> = {
                race: 'Carrera', qualifying: 'Clasificación',
                sprint: 'Sprint Race', sprint_qualifying: 'Sprint Qualifying'
            };
            const breakdown = scoreUpdates.sort((a, b) => b.scored - a.scored)
                .map(u => `  • *${u.player}*: +${u.scored} pts`).join('\n');
            sendWhatsAppMessage(`🏁 *Resultados de ${sessionLabel[session_type] || session_type} — ${raceName}*\n\n${breakdown}\n\n¡El leaderboard fue actualizado!\nhttps://codeweb-f1.vercel.app/`).catch(() => {});
        }

        res.json({ message: `Resultados de ${session_type} procesados para ${race_id}`, scoreUpdates });
    } catch (error) {
        console.error('Error processing results:', error);
        res.status(500).json({ error: 'Error processing race results' });
    }
});

// Get official results for a specific race
app.get('/api/admin/results/:round', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const raceId = `round_${req.params.round}`;
        const result = await pool.query("SELECT * FROM race_results WHERE race_id = $1", [raceId]);
        if (result.rows.length === 0) {
            return res.json({ exists: false });
        }
        res.json({ exists: true, result: result.rows[0] });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- Manual WhatsApp reminder for missing predictions ---
app.post('/api/admin/whatsapp/remind', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { session_type = 'race' } = req.body;
        const nextRace = getNextRace();
        const raceId = `round_${nextRace.round}`;

        const SESSION_LABELS: Record<string, string> = {
            race: 'Carrera', qualifying: 'Clasificación',
            sprint: 'Sprint Race', sprint_qualifying: 'Sprint Qualifying',
        };

        // Get all registered players from leaderboard
        const allPredsResult = await pool.query('SELECT name FROM leaderboard');
        const activePlayers = allPredsResult.rows.map(r => r.name);

        if (activePlayers.length === 0) {
            return res.json({ sent: false, message: 'No hay jugadores registrados en el leaderboard.' });
        }

        // Get who already predicted for the requested session
        const sessionPredsResult = await pool.query(
            'SELECT player FROM predictions WHERE race_id = $1 AND session_type = $2',
            [raceId, session_type]
        );
        const submittedPlayers = new Set(sessionPredsResult.rows.map(r => r.player.toLowerCase()));
        const missingPlayers = activePlayers.filter(p => !submittedPlayers.has(p.toLowerCase()));

        if (missingPlayers.length === 0) {
            return res.json({ sent: false, message: 'Todos los jugadores ya cargaron su pronóstico.' });
        }

        const mentions = missingPlayers.map(u => `*${u}*`).join(', ');
        const sessionLabel = SESSION_LABELS[session_type] || session_type;
        const message = `⚠️ *¡ALERTA F1 PRODE!* ⚠️\n\nFaltan pronósticos para la *${sessionLabel}* del *${nextRace.name}*.\n\nLos siguientes pilotos aún no cargaron:\n${mentions}\n\n¡Carguen ya antes de que cierre! 🏎️💨\nhttps://codeweb-f1.vercel.app/`;

        await sendWhatsAppMessage(message);
        res.json({ sent: true, missing: missingPlayers, message: `Mensaje enviado. Faltan: ${missingPlayers.join(', ')}` });
    } catch (error) {
        console.error('WhatsApp remind error:', error);
        res.status(500).json({ error: 'Error enviando mensaje' });
    }
});

const SESSION_LABEL_MAP: Record<string, string> = {
    qualifying: 'Qualy',
    race: 'Carrera',
    sprint: 'Sprint',
    sprint_qualifying: 'Sprint Q',
};

// --- Score History per race (for Chart.js) ---
app.get('/api/leaderboard/history', requireAuth, async (req: Request, res: Response) => {
    try {
        const resultsQuery = await pool.query('SELECT DISTINCT race_id FROM race_results ORDER BY race_id ASC');
        const raceIds = resultsQuery.rows.map((r: any) => r.race_id);

        if (raceIds.length === 0) return res.json([]);

        const history: any[] = [];

        for (const raceId of raceIds) {
            const rr = await pool.query('SELECT * FROM race_results WHERE race_id = $1 ORDER BY session_type ASC', [raceId]);
            if (rr.rows.length === 0) continue;

            const raceScores: Record<string, number> = {};
            const sessions: { type: string; label: string; scores: Record<string, number>; official: any }[] = [];

            for (const official of rr.rows) {
                const preds = await pool.query(
                    'SELECT * FROM predictions WHERE race_id = $1 AND session_type = $2',
                    [raceId, official.session_type]
                );
                const sessionScores: Record<string, number> = {};
                for (const pred of preds.rows) {
                    const scored = scoreSession(pred, official);
                    sessionScores[pred.player] = scored;
                    raceScores[pred.player] = (raceScores[pred.player] || 0) + scored;
                }
                sessions.push({
                    type: official.session_type,
                    label: SESSION_LABEL_MAP[official.session_type] || official.session_type,
                    scores: sessionScores,
                    official: {
                        p1: official.p1, p2: official.p2, p3: official.p3,
                        p4: official.p4, p5: official.p5,
                        winning_team: official.winning_team,
                    },
                });
            }

            const roundNum = parseInt(raceId.replace('round_', ''));
            const raceInfo = races2026.find(r => r.round === roundNum);

            history.push({
                race_id: raceId,
                race_name: raceInfo ? raceInfo.name.replace('Gran Premio de ', 'GP ').replace('Grand Prix', 'GP') : raceId,
                scores: raceScores,   // total per GP (for chart)
                sessions,             // per-session breakdown
            });
        }

        res.json(history);
    } catch (error) {
        console.error('Error fetching score history:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- The Oracle (Groq AI) ---
// Shared function to build oracle context and generate analysis
async function buildOracleAnalysis(nextRace: any): Promise<{ analysis: string; predsHash: string; jolpicaHash: string }> {
    const raceId = `round_${nextRace.round}`;

    const [predsRes, lbRes] = await Promise.all([
        pool.query('SELECT * FROM predictions WHERE race_id = $1', [raceId]),
        pool.query('SELECT * FROM leaderboard ORDER BY pts DESC'),
    ]);

    const sessionResults: string[] = [];

    const fetchJolpica = async (round: number, endpoint: string): Promise<any> => {
        try {
            const r = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}/${endpoint}.json`);
            return r.ok ? await r.json() : null;
        } catch { return null; }
    };

    const formatTop5 = (results: any[]): string =>
        results.slice(0, 5).map((r: any, i: number) =>
            `P${i + 1}: ${r.Driver?.givenName} ${r.Driver?.familyName}`
        ).join(', ');

    // DB race results
    try {
        const dbResults = await pool.query(
            'SELECT * FROM race_results ORDER BY race_id DESC, session_type ASC LIMIT 10'
        );
        for (const row of dbResults.rows) {
            const race = races2026.find(r => `round_${r.round}` === row.race_id);
            const raceName = race?.name || row.race_id;
            const positions = [row.p1, row.p2, row.p3, row.p4, row.p5].filter(Boolean)
                .map((d: string, i: number) => `P${i + 1}: ${d}`).join(', ');
            if (positions) sessionResults.push(`[Oficial] ${raceName} — ${row.session_type}: ${positions}`);
        }
    } catch { /* no race_results yet */ }

    // Jolpica previous round
    const prevRound = nextRace.round - 1;
    if (prevRound >= 1) {
        const [prevQualy, prevRaceData] = await Promise.all([
            fetchJolpica(prevRound, 'qualifying'),
            fetchJolpica(prevRound, 'results'),
        ]);
        const prevQual = prevQualy?.MRData?.RaceTable?.Races?.[0];
        if (prevQual?.QualifyingResults?.length) {
            sessionResults.push(`Clasificación ${prevQual.raceName || `Round ${prevRound}`}: ${formatTop5(prevQual.QualifyingResults)}`);
        }
        const prevR = prevRaceData?.MRData?.RaceTable?.Races?.[0];
        if (prevR?.Results?.length) {
            sessionResults.push(`Carrera ${prevR.raceName || `Round ${prevRound}`}: ${formatTop5(prevR.Results)}`);
        }
    }

    // Jolpica current round qualifying
    const currentQualy = await fetchJolpica(nextRace.round, 'qualifying');
    const currentQualData = currentQualy?.MRData?.RaceTable?.Races?.[0];
    if (currentQualData?.QualifyingResults?.length) {
        sessionResults.push(`Clasificación ${nextRace.name}: ${formatTop5(currentQualData.QualifyingResults)}`);
    }

    const predsHash = hashStr(JSON.stringify(predsRes.rows.map((r: any) => ({
        player: r.player, p1: r.p1, p2: r.p2, p3: r.p3, p4: r.p4, p5: r.p5, session_type: r.session_type
    }))));
    const jolpicaHash = hashStr(JSON.stringify(sessionResults));

    const raceCtx: RaceContext = {
        circuitName: `${nextRace.name} — ${nextRace.circuit || ''}`,
        lastResults: sessionResults.length > 0 ? sessionResults.join(' | ') : undefined,
    };

    let analysis: string;
    try {
        analysis = await generateOracleRoast(predsRes.rows, raceCtx, lbRes.rows);
    } catch (err: any) {
        // Parse retry-after from Groq 429 and set backoff
        if (err?.status === 429) {
            const retryAfterSec = parseInt(err?.headers?.['retry-after'] || '1800', 10);
            groqRateLimitedUntil = Date.now() + retryAfterSec * 1000;
            console.log(`⏸️ Groq rate limited. Backing off until ${new Date(groqRateLimitedUntil).toISOString()}`);
        }
        throw err;
    }
    return { analysis, predsHash, jolpicaHash };
}

app.get('/api/oracle/roast', async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        const raceId = `round_${nextRace.round}`;
        const nearRace = isNearRace(nextRace, races2026);

        // Check existing cache
        const cached = await pool.query('SELECT * FROM oracle_cache WHERE race_id = $1', [raceId]);

        if (cached.rows.length > 0) {
            const c = cached.rows[0];
            const age = Date.now() - new Date(c.generated_at).getTime();

            if (nearRace) {
                // Near race: use cache only if <30min old AND jolpica data unchanged
                // We need jolpica hash to compare — fetch it quickly
                const sessionResults: string[] = [];
                try {
                    const dbResults = await pool.query('SELECT * FROM race_results ORDER BY race_id DESC LIMIT 10');
                    for (const row of dbResults.rows) {
                        const race = races2026.find(r => `round_${r.round}` === row.race_id);
                        const positions = [row.p1, row.p2, row.p3, row.p4, row.p5].filter(Boolean).join(',');
                        if (positions) sessionResults.push(`${race?.name || row.race_id}-${row.session_type}:${positions}`);
                    }
                } catch { /* ok */ }
                const quickHash = hashStr(JSON.stringify(sessionResults));

                if (age < ORACLE_NEAR_RACE_REFRESH && c.jolpica_hash === quickHash) {
                    const u = await pool.query('SELECT call_count FROM oracle_usage WHERE day = CURRENT_DATE');
                    const dc = u.rows[0]?.call_count || 0;
                    return res.json({ analysis: c.analysis, cached: true, generated_at: c.generated_at, daily_calls: dc, remaining: Math.max(0, ORACLE_MAX_DAILY_CALLS - dc) });
                }
            } else {
                // Far from race: use cache if predictions unchanged
                const predsRes = await pool.query('SELECT player,p1,p2,p3,p4,p5,session_type FROM predictions WHERE race_id = $1', [raceId]);
                const predsHash = hashStr(JSON.stringify(predsRes.rows));
                if (c.predictions_hash === predsHash) {
                    const u = await pool.query('SELECT call_count FROM oracle_usage WHERE day = CURRENT_DATE');
                    const dc = u.rows[0]?.call_count || 0;
                    return res.json({ analysis: c.analysis, cached: true, generated_at: c.generated_at, daily_calls: dc, remaining: Math.max(0, ORACLE_MAX_DAILY_CALLS - dc) });
                }
            }
        }

        // If Groq is rate-limited, serve stale cache immediately without attempting
        if (Date.now() < groqRateLimitedUntil) {
            if (cached.rows.length > 0) {
                return res.json({ analysis: cached.rows[0].analysis, cached: true, stale: true, generated_at: cached.rows[0].generated_at, remaining: 0 });
            }
            return res.status(429).json({ error: 'El Oráculo está en boxes. Reintentá en unos minutos.', remaining: 0 });
        }

        // Generate fresh analysis
        let analysis: string, predsHash: string, jolpicaHash: string;
        try {
            ({ analysis, predsHash, jolpicaHash } = await buildOracleAnalysis(nextRace));
        } catch (groqErr: any) {
            // If Groq fails (429 rate limit etc), serve stale cache if available
            if (cached.rows.length > 0) {
                const u = await pool.query('SELECT call_count FROM oracle_usage WHERE day = CURRENT_DATE');
                const dc = u.rows[0]?.call_count || 0;
                return res.json({ analysis: cached.rows[0].analysis, cached: true, stale: true, generated_at: cached.rows[0].generated_at, daily_calls: dc, remaining: 0 });
            }
            throw groqErr;
        }

        await pool.query(
            `INSERT INTO oracle_cache (race_id, analysis, generated_at, predictions_hash, jolpica_hash)
             VALUES ($1, $2, NOW(), $3, $4)
             ON CONFLICT (race_id) DO UPDATE SET analysis=$2, generated_at=NOW(), predictions_hash=$3, jolpica_hash=$4`,
            [raceId, analysis, predsHash, jolpicaHash]
        );

        // Increment daily usage counter
        const usageRes = await pool.query(
            `INSERT INTO oracle_usage (day, call_count) VALUES (CURRENT_DATE, 1)
             ON CONFLICT (day) DO UPDATE SET call_count = oracle_usage.call_count + 1
             RETURNING call_count`
        );
        const dailyCalls = usageRes.rows[0]?.call_count || 1;
        const remaining = Math.max(0, ORACLE_MAX_DAILY_CALLS - dailyCalls);

        res.json({ analysis, cached: false, generated_at: new Date().toISOString(), daily_calls: dailyCalls, remaining });
    } catch (err) {
        console.error('Oracle error:', err);
        res.status(500).json({ error: 'El oráculo se quedó sin nafta.' });
    }
});

// Force refresh oracle (manual "Actualizar contexto" button)
app.post('/api/oracle/roast/refresh', requireAuth, async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        const raceId = `round_${nextRace.round}`;

        // Check Groq backoff before calling
        if (Date.now() < groqRateLimitedUntil) {
            const waitMin = Math.ceil((groqRateLimitedUntil - Date.now()) / 60000);
            return res.status(429).json({ error: `El Oráculo está en boxes. Reintentá en ~${waitMin} minutos.`, remaining: 0 });
        }

        // Check daily limit before calling Groq
        const usageCheck = await pool.query(
            `SELECT call_count FROM oracle_usage WHERE day = CURRENT_DATE`
        );
        const todayCalls = usageCheck.rows[0]?.call_count || 0;
        if (todayCalls >= ORACLE_MAX_DAILY_CALLS) {
            return res.status(429).json({
                error: 'Límite diario de tokens alcanzado. El Oráculo descansa hasta mañana.',
                daily_calls: todayCalls,
                remaining: 0
            });
        }

        let analysis: string, predsHash: string, jolpicaHash: string;
        try {
            ({ analysis, predsHash, jolpicaHash } = await buildOracleAnalysis(nextRace));
        } catch (groqErr: any) {
            // On Groq failure, serve stale cache if available
            const staleCache = await pool.query('SELECT * FROM oracle_cache WHERE race_id = $1', [raceId]);
            if (staleCache.rows.length > 0) {
                return res.status(429).json({
                    error: 'Groq sin tokens por ahora. Mostrando análisis anterior.',
                    analysis: staleCache.rows[0].analysis,
                    cached: true,
                    stale: true,
                    generated_at: staleCache.rows[0].generated_at,
                    remaining: 0
                });
            }
            return res.status(429).json({ error: 'Límite de tokens alcanzado. Reintentá en unos minutos.', remaining: 0 });
        }

        await pool.query(
            `INSERT INTO oracle_cache (race_id, analysis, generated_at, predictions_hash, jolpica_hash)
             VALUES ($1, $2, NOW(), $3, $4)
             ON CONFLICT (race_id) DO UPDATE SET analysis=$2, generated_at=NOW(), predictions_hash=$3, jolpica_hash=$4`,
            [raceId, analysis, predsHash, jolpicaHash]
        );

        const usageRes = await pool.query(
            `INSERT INTO oracle_usage (day, call_count) VALUES (CURRENT_DATE, 1)
             ON CONFLICT (day) DO UPDATE SET call_count = oracle_usage.call_count + 1
             RETURNING call_count`
        );
        const dailyCalls = usageRes.rows[0]?.call_count || 1;
        const remaining = Math.max(0, ORACLE_MAX_DAILY_CALLS - dailyCalls);

        res.json({ analysis, cached: false, generated_at: new Date().toISOString(), daily_calls: dailyCalls, remaining });
    } catch (err) {
        console.error('Oracle refresh error:', err);
        res.status(500).json({ error: 'El oráculo se quedó sin nafta.' });
    }
});

// --- User Profiles ---
app.get('/api/profiles', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT username, avatar_seed FROM user_profiles');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching profiles:', err);
        res.status(500).json({ error: 'Error fetching profiles' });
    }
});

app.post('/api/profiles', async (req: Request, res: Response) => {
    const { username, avatar_seed } = req.body;
    if (!username || !avatar_seed) return res.status(400).json({ error: 'Missing fields' });

    try {
        await pool.query(`
            INSERT INTO user_profiles (username, avatar_seed)
            VALUES ($1, $2)
            ON CONFLICT (username) DO UPDATE SET avatar_seed = $2
        `, [username, avatar_seed]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving profile:', err);
        res.status(500).json({ error: 'Error saving profile' });
    }
});

// --- Media Vault API Routes ---

// GET Media by type (series, movies, boardgames)
app.get('/api/media/:type', requireAuth, async (req: Request, res: Response) => {
    try {
        const type = req.params.type;
        let baseTable = '';
        let extraFilter = '';

        if (type === 'series') { baseTable = 'media_series'; extraFilter = "WHERE type = 'serie'"; }
        else if (type === 'animes') { baseTable = 'media_series'; extraFilter = "WHERE type = 'anime'"; }
        else if (type === 'movies') { baseTable = 'media_movies'; }
        else if (type === 'boardgames') { baseTable = 'media_boardgames'; }
        else return res.status(400).json({ error: 'Invalid media type' });

        const userId = (req as any).user.userId;

        // Query joining with average ratings and personal vote
        // m.id is UUID but media_ratings.media_id is TEXT — explicit cast required
        const mediaWithRatings = await pool.query(`
            SELECT m.*,
                   COALESCE(AVG(r.rating), 0) as avg_rating,
                   COUNT(r.id) as total_votes,
                   (SELECT rating FROM media_ratings WHERE user_id = $2 AND media_id = m.id::text AND media_type = $1) as user_rating,
                   (SELECT string_agg(u.username, ', ')
                    FROM media_ratings mr
                    JOIN users u ON u.id = mr.user_id
                    WHERE mr.media_id = m.id::text AND mr.media_type = $1) as voters
            FROM ${baseTable} m
            LEFT JOIN media_ratings r ON r.media_id = m.id::text AND r.media_type = $1
            ${extraFilter}
            GROUP BY m.id
            ORDER BY m.created_at DESC
        `, [type, userId]);

        res.json(mediaWithRatings.rows);
    } catch (e) {
        console.error('Error fetching media:', e);
        res.status(500).json({ error: 'Database error fetching media collection' });
    }
});

// --- Media Status bulk fetch (for card badges) — must be before /:type/:id routes ---
app.get('/api/media/:type/my-statuses', requireAuth, async (req: Request, res: Response) => {
    const { type } = req.params;
    const userId = (req as any).user.userId;
    try {
        const result = await pool.query(
            'SELECT media_id, status FROM media_user_status WHERE user_id = $1 AND media_type = $2',
            [userId, type]
        );
        const map: Record<string, string> = {};
        result.rows.forEach((r: any) => { map[r.media_id] = r.status; });
        res.json(map);
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// POST new Media Item
app.post('/api/media/:type', requireAuth, async (req: Request, res: Response) => {
    try {
        const type = req.params.type;
        const body = req.body;
        const userId = (req as any).user.userId;
        let result;

        if (type === 'series' || type === 'animes') {
            const mType = type === 'animes' ? 'anime' : 'serie';
            result = await pool.query(
                `INSERT INTO media_series (recommender, name, genre, description, rating, type, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [body.recommender, body.name, body.genre, body.description, body.rating, mType, userId]
            );
        } else if (type === 'movies') {
            result = await pool.query(
                `INSERT INTO media_movies (recommender, name, genre, description, rating, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [body.recommender, body.name, body.genre, body.description, body.rating, userId]
            );
        } else if (type === 'boardgames') {
            result = await pool.query(
                `INSERT INTO media_boardgames (name, game_type, players, duration, difficulty, notes, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [body.name, body.game_type, body.players, body.duration, body.difficulty, body.notes, userId]
            );
        } else {
            return res.status(400).json({ error: 'Invalid media type' });
        }

        res.status(201).json({ message: 'Saved successfully', item: result.rows[0] });
    } catch (e) {
        console.error('Error posting new media:', e);
        res.status(500).json({ error: 'Database error saving new media item' });
    }
});

// POST Vote/Rate an Item
app.post('/api/media/:type/:id/rate', requireAuth, async (req: Request, res: Response) => {
    try {
        const { type, id } = req.params;
        const { rating } = req.body;
        const userId = (req as any).user.userId;

        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Invalid rating' });

        await pool.query(`
            INSERT INTO media_ratings (user_id, media_type, media_id, rating)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET rating = $4
        `, [userId, type, id, rating]);

        res.json({ success: true, message: 'Rating saved' });
    } catch (err) {
        console.error('Error rating media:', err);
        res.status(500).json({ error: 'Error saving rating' });
    }
});

// GET per-user ratings for a specific media item
app.get('/api/media/:type/:id/ratings', requireAuth, async (req: Request, res: Response) => {
    try {
        const { type, id } = req.params;
        const result = await pool.query(`
            SELECT u.username, r.rating
            FROM media_ratings r
            JOIN users u ON u.id = r.user_id
            WHERE r.media_id = $1 AND r.media_type = $2
            ORDER BY r.rating DESC
        `, [id, type]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching item ratings:', err);
        res.status(500).json({ error: 'Error fetching ratings' });
    }
});

// PUT update Media Item
app.put('/api/media/:type/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { type, id } = req.params;
        const body = req.body;
        const userId = (req as any).user.userId;
        let table = '';
        if (type === 'series' || type === 'animes') table = 'media_series';
        else if (type === 'movies') table = 'media_movies';
        else if (type === 'boardgames') table = 'media_boardgames';
        else return res.status(400).json({ error: 'Invalid media type' });

        // Check ownership
        const current = await pool.query(`SELECT created_by_user_id FROM ${table} WHERE id = $1`, [id]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        // MVP: Only owner can edit (if owner is NULL, anyone can take it over for now or it's legacy)
        if (current.rows[0].created_by_user_id && current.rows[0].created_by_user_id !== userId) {
            return res.status(403).json({ error: 'No tienes permiso para editar esta recomendación.' });
        }

        let result;
        if (type === 'series' || type === 'animes') {
            result = await pool.query(
                `UPDATE media_series SET recommender = $1, name = $2, genre = $3, description = $4, rating = $5, created_by_user_id = $7 WHERE id = $6 RETURNING *`,
                [body.recommender, body.name, body.genre, body.description, body.rating, id, userId]
            );
        } else if (type === 'movies') {
            result = await pool.query(
                `UPDATE media_movies SET recommender = $1, name = $2, genre = $3, description = $4, rating = $5, created_by_user_id = $7 WHERE id = $6 RETURNING *`,
                [body.recommender, body.name, body.genre, body.description, body.rating, id, userId]
            );
        } else if (type === 'boardgames') {
            result = await pool.query(
                `UPDATE media_boardgames SET name = $1, game_type = $2, players = $3, duration = $4, difficulty = $5, notes = $6, created_by_user_id = $8 WHERE id = $7 RETURNING *`,
                [body.name, body.game_type, body.players, body.duration, body.difficulty, body.notes, id, userId]
            );
        }

        res.json({ message: 'Updated successfully', item: result?.rows[0] });
    } catch (e) {
        console.error('Error updating media:', e);
        res.status(500).json({ error: 'Database error updating media item' });
    }
});

// DELETE Comment — must be before /:type/:id to avoid route conflict
app.delete('/api/media/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;
    const { commentId } = req.params;
    try {
        const result = await pool.query('DELETE FROM media_comments WHERE id = $1 AND user_id = $2 RETURNING id', [commentId, userId]);
        if (result.rows.length === 0) return res.status(403).json({ error: 'Not your comment' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// DELETE Media Item
app.delete('/api/media/:type/:id', requireAuth, async (req: Request, res: Response) => {
    try {
        const { type, id } = req.params;
        const userId = (req as any).user.userId;
        let table = '';
        if (type === 'series' || type === 'animes') table = 'media_series';
        else if (type === 'movies') table = 'media_movies';
        else if (type === 'boardgames') table = 'media_boardgames';
        else return res.status(400).json({ error: 'Invalid media type' });

        // Check ownership
        const current = await pool.query(`SELECT created_by_user_id FROM ${table} WHERE id = $1`, [id]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        if (current.rows[0].created_by_user_id && current.rows[0].created_by_user_id !== userId) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta recomendación.' });
        }

        let query = `DELETE FROM ${table} WHERE id = $1`;
        const result = await pool.query(query, [id]);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (e) {
        console.error('Error deleting media:', e);
        res.status(500).json({ error: 'Database error deleting media item' });
    }
});

// Start WhatsApp Cron Job
startWhatsAppCron(pool, getNextRace, races2026);

// --- Auto-score cron: fetch Jolpica results and score automatically ---
cron.schedule('*/30 * * * *', async () => {
    try {
        const nextRace = getNextRace();
        // Also check the previous race (in case it just finished)
        const prevRound = nextRace ? nextRace.round - 1 : null;
        const roundsToCheck = [prevRound, nextRace?.round].filter(Boolean) as number[];

        for (const round of roundsToCheck) {
            const race_id = `round_${round}`;
            const sessions: { type: string; jolpicaEndpoint: string }[] = [
                { type: 'qualifying', jolpicaEndpoint: 'qualifying' },
                { type: 'race', jolpicaEndpoint: 'results' },
                { type: 'sprint', jolpicaEndpoint: 'sprint' },
            ];

            for (const session of sessions) {
                // Skip if already in our DB
                const existing = await pool.query(
                    'SELECT id FROM race_results WHERE race_id = $1 AND session_type = $2',
                    [race_id, session.type]
                );
                if (existing.rows.length > 0) continue;

                // Fetch from Jolpica
                const resp = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}/${session.jolpicaEndpoint}.json`);
                if (!resp.ok) continue;
                const data = await resp.json();

                let positions: string[] = [];
                let winningTeam = '';
                if (session.type === 'qualifying') {
                    const results = data?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
                    positions = results.slice(0, 5).map((r: any) => `${r.Driver.givenName} ${r.Driver.familyName}`);
                    winningTeam = results[0]?.Constructor?.name || '';
                } else if (session.type === 'race') {
                    const results = data?.MRData?.RaceTable?.Races?.[0]?.Results || [];
                    positions = results.slice(0, 5).map((r: any) => `${r.Driver.givenName} ${r.Driver.familyName}`);
                    winningTeam = results[0]?.Constructor?.name || '';
                } else if (session.type === 'sprint') {
                    const results = data?.MRData?.RaceTable?.Races?.[0]?.SprintResults || [];
                    positions = results.slice(0, 5).map((r: any) => `${r.Driver.givenName} ${r.Driver.familyName}`);
                    winningTeam = results[0]?.Constructor?.name || '';
                }

                if (positions.length < 3) continue; // Results not available yet

                const [p1, p2, p3, p4, p5] = positions;
                console.log(`🤖 Auto-scoring ${race_id} ${session.type}: ${positions.join(', ')}`);

                const scoreUpdates = await processSessionResult(pool, race_id, session.type, p1, p2, p3 || '', p4 || '', p5 || '', winningTeam);

                // Notify via WhatsApp
                if (scoreUpdates.length > 0) {
                    const raceName = races2026.find(r => r.round === round)?.name || race_id;
                    const sessionLabel: Record<string, string> = { race: 'Carrera', qualifying: 'Clasificación', sprint: 'Sprint Race' };
                    const breakdown = scoreUpdates.sort((a, b) => b.scored - a.scored)
                        .map(u => `  • *${u.player}*: +${u.scored} pts`).join('\n');
                    sendWhatsAppMessage(
                        `🤖 *Resultados AUTO-importados — ${sessionLabel[session.type] || session.type} ${raceName}*\n\n${breakdown}\n\n¡El leaderboard fue actualizado!\nhttps://codeweb-f1.vercel.app/`
                    ).catch(() => {});
                    console.log(`✅ Auto-scored ${race_id} ${session.type}:`, scoreUpdates);
                }
            }
        }
    } catch (err) {
        console.error('❌ Auto-score cron error:', err);
    }
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('💥 UNHANDLED ERROR:', err);
    res.status(500).json({
        error: 'Critical server error',
        message: err.message || 'Unknown error'
    });
});

// --- Public: Official results for a round (for grid comparison) ---
app.get('/api/races/:round/results', requireAuth, async (req: Request, res: Response) => {
    try {
        const raceId = `round_${req.params.round}`;
        const sessionType = req.query.session_type as string | undefined;
        let result;
        if (sessionType) {
            result = await pool.query('SELECT * FROM race_results WHERE race_id = $1 AND session_type = $2', [raceId, sessionType]);
        } else {
            result = await pool.query('SELECT * FROM race_results WHERE race_id = $1', [raceId]);
        }
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// --- Public: Personal prediction history ---
app.get('/api/predictions/history/:username', requireAuth, async (req: Request, res: Response) => {
    try {
        const username = (req.params.username as string).toLowerCase();
        const preds = await pool.query(
            'SELECT * FROM predictions WHERE player = $1 ORDER BY race_id ASC, session_type ASC',
            [username]
        );
        const raceIds = [...new Set(preds.rows.map((r: any) => r.race_id))];
        const results: any[] = [];
        for (const raceId of raceIds) {
            const rr = await pool.query('SELECT * FROM race_results WHERE race_id = $1', [raceId]);
            const roundNum = parseInt(raceId.replace('round_', ''));
            const raceInfo = races2026.find(r => r.round === roundNum);
            results.push({
                race_id: raceId,
                race_name: raceInfo?.name || raceId,
                round: roundNum,
                predictions: preds.rows.filter((p: any) => p.race_id === raceId),
                official_results: rr.rows,
            });
        }
        res.json(results);
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// --- Media User Status ---
app.get('/api/media/:type/:id/status', requireAuth, async (req: Request, res: Response) => {
    const { type, id } = req.params;
    const userId = (req as any).user.userId;
    try {
        const result = await pool.query(
            'SELECT status FROM media_user_status WHERE user_id = $1 AND media_type = $2 AND media_id = $3',
            [userId, type, id]
        );
        res.json({ status: result.rows[0]?.status || null });
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// All users' statuses for a single media item
app.get('/api/media/:type/:id/all-statuses', requireAuth, async (req: Request, res: Response) => {
    const { type, id } = req.params;
    try {
        const result = await pool.query(
            `SELECT u.username, s.status
             FROM media_user_status s
             JOIN users u ON u.id = s.user_id
             WHERE s.media_type = $1 AND s.media_id = $2
             ORDER BY s.status ASC, u.username ASC`,
            [type, id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/media/:type/:id/status', requireAuth, async (req: Request, res: Response) => {
    const { type, id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.userId;
    if (status && !['watched', 'in_progress', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try {
        if (!status) {
            // Clear status
            await pool.query(
                'DELETE FROM media_user_status WHERE user_id = $1 AND media_type = $2 AND media_id = $3',
                [userId, type, id]
            );
        } else {
            await pool.query(`
                INSERT INTO media_user_status (user_id, media_type, media_id, status)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, media_type, media_id) DO UPDATE SET status = $4, updated_at = NOW()
            `, [userId, type, id, status]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// --- Media Comments ---
app.get('/api/media/:type/:id/comments', requireAuth, async (req: Request, res: Response) => {
    const { type, id } = req.params;
    try {
        const result = await pool.query(`
            SELECT c.id, u.username, c.comment, c.created_at
            FROM media_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.media_type = $1 AND c.media_id = $2
            ORDER BY c.created_at ASC
        `, [type, id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/media/:type/:id/comments', requireAuth, async (req: Request, res: Response) => {
    const { type, id } = req.params;
    const { comment } = req.body;
    const userId = (req as any).user.userId;
    if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });
    try {
        const result = await pool.query(`
            INSERT INTO media_comments (user_id, media_type, media_id, comment)
            VALUES ($1, $2, $3, $4)
            RETURNING id, comment, created_at
        `, [userId, type, id, comment.trim()]);
        const username = (req as any).user.username;
        res.json({ ...result.rows[0], username });
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// --- Personal Stats ---
app.get('/api/stats/:username', requireAuth, async (req: Request, res: Response) => {
    const username = req.params.username as string;
    try {
        const resultsQuery = await pool.query('SELECT * FROM race_results ORDER BY created_at ASC');
        const allResults = resultsQuery.rows;

        const predsQuery = await pool.query('SELECT * FROM predictions WHERE player = $1', [username.toLowerCase()]);
        const allPreds = predsQuery.rows;

        const SESSION_PTS: Record<string, number> = { race: 10, qualifying: 10, sprint: 8, sprint_qualifying: 5 };
        const posFields = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;

        let totalHits = 0, totalPossible = 0, totalPts = 0;
        const statsBySession: Record<string, { hits: number; possible: number }> = {};
        const driverFreq: Record<string, number> = {};

        for (const result of allResults) {
            const pred = allPreds.find(p => p.race_id === result.race_id && p.session_type === result.session_type);
            if (!pred) continue;

            const pts = SESSION_PTS[result.session_type] || 10;
            const sess = result.session_type;
            if (!statsBySession[sess]) statsBySession[sess] = { hits: 0, possible: 0 };

            for (const pos of posFields) {
                if (pred[pos]) {
                    driverFreq[pred[pos]] = (driverFreq[pred[pos]] || 0) + 1;
                    totalPossible++;
                    statsBySession[sess].possible++;
                    if (pred[pos] === result[pos]) {
                        totalHits++;
                        totalPts += pts;
                        statsBySession[sess].hits++;
                    }
                }
            }
        }

        const favoriteDriver = Object.entries(driverFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const accuracy = totalPossible > 0 ? Math.round((totalHits / totalPossible) * 100) : 0;

        res.json({ totalHits, totalPossible, totalPts, accuracy, statsBySession, favoriteDriver, totalRaces: allResults.length, totalPredictions: allPreds.length });
    } catch (err) { res.status(500).json({ error: 'DB error' }); }
});

// Start Server
app.listen(port, () => {
    console.log(`🏎️ F1 Prode Backend running on http://localhost:${port}`);
});
