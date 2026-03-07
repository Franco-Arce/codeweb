import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { generateOracleRoast } from './groqOracle';
import { sendWhatsAppMessage } from './whatsappAlerts';

const JWT_SECRET = process.env.JWT_SECRET || 'f1prode_secret_key_2026';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

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

// Oracle in-memory cache: race_id -> { result, timestamp }
const oracleCache = new Map<string, { result: string; ts: number }>();
const ORACLE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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

// Points per session type
const SESSION_POINTS: Record<SessionType, { pick: number; pole?: number }> = {
    race: { pick: 10, pole: 5 },
    qualifying: { pick: 10 },
    sprint: { pick: 8 },
    sprint_qualifying: { pick: 5 },
};

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
    return races2026.find(r => new Date(r.date) > now) || races2026[races2026.length - 1];
}

// --- API Routes (Protected) ---

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'F1 Prode Backend is running fast!' });
});

// Get full 2026 Calendar
app.get('/api/races/calendar', requireAuth, (req: Request, res: Response) => {
    res.json(races2026);
});

// Get the next upcoming race
app.get('/api/races/next', requireAuth, (req: Request, res: Response) => {
    const next = getNextRace();
    res.json(next);
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
            picks: ['q1', 'q2', 'q3'],
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
                picks: ['p1'],
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
                picks: ['p1', 'p2', 'p3'],
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
            points_pole: 5,
            picks: ['pole_position', 'p1', 'p2', 'p3', 'p4', 'p5'],
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

        const formattedResults = results.slice(0, 5).map((r: any) => ({
            id: r.id,
            title: r.title || r.name,
            media_type: r.media_type || (type === 'multi' ? (r.name ? 'tv' : 'movie') : type),
            year: (r.release_date || r.first_air_date || '').slice(0, 4),
            poster: r.poster_path ? `https://image.tmdb.org/t/p/w300${r.poster_path}` : null,
            overview: r.overview,
        }));
        res.json(formattedResults);
    } catch (error) {
        console.error('TMDB error:', error);
        res.status(500).json({ error: 'Error fetching from TMDB' });
    }
});

// --- Admin: Submit official race results and calculate scores ---
app.post('/api/admin/results', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { race_round, session_type = 'race', p1, p2, p3, p4, p5, pole_position } = req.body;
        const race_id = `round_${race_round}`;
        const pts = SESSION_POINTS[session_type as SessionType] || SESSION_POINTS.race;

        // Save official results
        await pool.query(
            `INSERT INTO race_results (race_id, session_type, p1, p2, p3, p4, p5, pole_position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (race_id, session_type)
             DO UPDATE SET p1 = $3, p2 = $4, p3 = $5, p4 = $6, p5 = $7, pole_position = $8, created_at = CURRENT_TIMESTAMP`,
            [race_id, session_type, p1, p2, p3, p4, p5, pole_position]
        );

        // Score predictions for this race+session
        const predictionsResult = await pool.query(
            "SELECT * FROM predictions WHERE race_id = $1 AND session_type = $2",
            [race_id, session_type]
        );

        const officialResult = { p1, p2, p3, p4, p5, pole_position };
        const posFields = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;
        const scoreUpdates: { player: string; scored: number }[] = [];

        for (const pred of predictionsResult.rows) {
            let scored = 0;
            for (const pos of posFields) {
                if (pred[pos] && pred[pos] === (officialResult as any)[pos]) scored += pts.pick;
            }
            if (pts.pole && pred.pole_position && pred.pole_position === officialResult.pole_position) {
                scored += pts.pole;
            }
            if (scored > 0) scoreUpdates.push({ player: pred.player, scored });
        }

        for (const update of scoreUpdates) {
            await pool.query(
                `INSERT INTO leaderboard (name, pts) VALUES ($1, $2)
                 ON CONFLICT (name) DO UPDATE SET pts = leaderboard.pts + $2`,
                [update.player, update.scored]
            );
        }

        // Send WhatsApp notification with score breakdown
        if (scoreUpdates.length > 0) {
            const raceName = races2026.find(r => r.round === Number(race_round))?.name || race_id;
            const sessionLabel: Record<string, string> = {
                race: 'Carrera', qualifying: 'Clasificación',
                sprint: 'Sprint Race', sprint_qualifying: 'Sprint Qualifying'
            };
            const breakdown = scoreUpdates
                .sort((a, b) => b.scored - a.scored)
                .map(u => `  • *${u.player}*: +${u.scored} pts`)
                .join('\n');
            const msg = `🏁 *Resultados de ${sessionLabel[session_type] || session_type} — ${raceName}*

${breakdown}

¡El leaderboard fue actualizado!`;
            sendWhatsAppMessage(msg).catch(() => {});
        }

        res.json({
            message: `Resultados de ${session_type} procesados para ${race_id}`,
            scoreUpdates,
            totalPredictions: predictionsResult.rows.length,
        });
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

// --- Score History per race (for Chart.js) ---
app.get('/api/leaderboard/history', requireAuth, async (req: Request, res: Response) => {
    try {
        // Get all official results that have been processed
        const resultsQuery = await pool.query('SELECT race_id FROM race_results ORDER BY created_at ASC');
        const raceIds = resultsQuery.rows.map((r: any) => r.race_id);

        if (raceIds.length === 0) return res.json([]);

        const history: any[] = [];

        for (const raceId of raceIds) {
            // Get official result for this race
            const rr = await pool.query('SELECT * FROM race_results WHERE race_id = $1', [raceId]);
            const official = rr.rows[0];
            if (!official) continue;

            // Get all predictions for this race
            const preds = await pool.query('SELECT * FROM predictions WHERE race_id = $1', [raceId]);

            const raceScores: Record<string, number> = {};

            for (const pred of preds.rows) {
                let scored = 0;
                for (const pos of ['p1', 'p2', 'p3', 'p4', 'p5'] as const) {
                    if (pred[pos] && pred[pos] === official[pos]) scored += 10;
                }
                if (pred.pole_position && pred.pole_position === official.pole_position) scored += 5;
                raceScores[pred.player] = scored;
            }

            // Get race name from calendar
            const roundNum = parseInt(raceId.replace('round_', ''));
            const raceInfo = races2026.find(r => r.round === roundNum);

            history.push({
                race_id: raceId,
                race_name: raceInfo ? raceInfo.name.replace('Gran Premio de ', 'GP ').replace('Grand Prix', 'GP') : raceId,
                scores: raceScores,
            });
        }

        res.json(history);
    } catch (error) {
        console.error('Error fetching score history:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// --- The Oracle (Groq AI) ---
app.get('/api/oracle/roast', async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        const raceId = `round_${nextRace.round}`;

        const predsRes = await pool.query('SELECT * FROM predictions WHERE race_id = $1 OR race_id = \'current\'', [raceId]);
        const lbRes = await pool.query('SELECT * FROM leaderboard ORDER BY pts DESC');

        // Contexto opcional (podría hidratarse desde el front o de una tabla de clima)
        const raceCtx = { circuitName: nextRace.name || 'Próximo GP' };

        const roast = await generateOracleRoast(predsRes.rows, raceCtx, lbRes.rows);
        res.json({ analysis: roast });
    } catch (err) {
        console.error('Oracle error:', err);
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
import { startWhatsAppCron } from './whatsappAlerts';
startWhatsAppCron(pool, getNextRace, races2026);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('💥 UNHANDLED ERROR:', err);
    res.status(500).json({
        error: 'Critical server error',
        message: err.message || 'Unknown error'
    });
});

// Start Server
app.listen(port, () => {
    console.log(`🏎️ F1 Prode Backend running on http://localhost:${port}`);
});
