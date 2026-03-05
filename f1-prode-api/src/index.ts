import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';
import { generateOracleRoast } from './groqOracle';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*', // Permitir Vercel y local
}));
app.use(express.json());

// --- Simple Auth Middleware ---
const requireAuth = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === 'Bearer f1_pepe_logged_in_token') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please login.' });
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

            INSERT INTO leaderboard (name, pts) SELECT 'Colorado', 19 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'Colorado');
            INSERT INTO leaderboard (name, pts) SELECT 'MrKazter', 16 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'MrKazter');
            INSERT INTO leaderboard (name, pts) SELECT 'Eliana', 11  WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'Eliana');
            INSERT INTO leaderboard (name, pts) SELECT 'NestorMcNestor', 0 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'NestorMcNestor');
            INSERT INTO leaderboard (name, pts) SELECT 'GuilleGb', 0 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'GuilleGb');
            INSERT INTO leaderboard (name, pts) SELECT 'Rubiola', 0  WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'Rubiola');
            INSERT INTO leaderboard (name, pts) SELECT 'MrFori', 0   WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'MrFori');

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
                    SELECT 1 FROM pg_constraint WHERE conname = 'race_results_race_session_unique'
                ) THEN
                    ALTER TABLE race_results ADD CONSTRAINT race_results_race_session_unique
                    UNIQUE (race_id, session_type);
                END IF;
            END $$;
        `);

        console.log('✅ Base de datos inicializada y migrada');
    } catch (error) {
        console.error('❌ Error configurando base de datos:', error);
    }
};

initDb();

// --- Auth Routes ---
app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (username === 'pepe' && password === 'pepon') {
        // En lugar de Cookie, devolvemos un Token estático para el MVP
        res.json({
            success: true,
            message: 'Welcome to the Paddock',
            token: 'f1_pepe_logged_in_token',
            user: { username: 'pepe', role: 'admin' }
        });
    } else {
        res.status(401).json({ success: false, message: 'Bandera negra: Credenciales inválidas' });
    }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Logged out' });
});

app.get('/api/auth/session', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === 'Bearer f1_pepe_logged_in_token') {
        res.json({ authenticated: true, user: 'pepe' });
    } else {
        res.json({ authenticated: false });
    }
});

// --- Official 2026 F1 Calendar ---
const races2026 = [
    { round: 1, country: "Australia", city: "Melbourne", name: "GP de Australia", date: "2026-03-08T03:00:00Z", circuit: "Albert Park", sprint: false },
    { round: 2, country: "China", city: "Shanghai", name: "GP de China", date: "2026-03-15T04:00:00Z", circuit: "Shanghai International Circuit", sprint: true },
    { round: 3, country: "Japón", city: "Suzuka", name: "GP de Japón", date: "2026-03-29T05:00:00Z", circuit: "Suzuka Circuit", sprint: false },
    { round: 4, country: "Bahréin", city: "Sakhir", name: "GP de Bahréin", date: "2026-04-12T15:00:00Z", circuit: "Bahrain International Circuit", sprint: false },
    { round: 5, country: "Arabia Saudita", city: "Jeddah", name: "GP de Arabia Saudita", date: "2026-04-19T17:00:00Z", circuit: "Jeddah Corniche Circuit", sprint: false },
    { round: 6, country: "Estados Unidos", city: "Miami", name: "GP de Miami", date: "2026-05-03T20:00:00Z", circuit: "Miami International Autodrome", sprint: true },
    { round: 7, country: "Canadá", city: "Montreal", name: "GP de Canadá", date: "2026-05-24T18:00:00Z", circuit: "Circuit Gilles Villeneuve", sprint: true },
    { round: 8, country: "Mónaco", city: "Mónaco", name: "GP de Mónaco", date: "2026-06-07T13:00:00Z", circuit: "Circuit de Monaco", sprint: false },
    { round: 9, country: "España", city: "Barcelona", name: "GP de España", date: "2026-06-14T13:00:00Z", circuit: "Circuit de Barcelona-Catalunya", sprint: false },
    { round: 10, country: "Austria", city: "Spielberg", name: "GP de Austria", date: "2026-06-28T13:00:00Z", circuit: "Red Bull Ring", sprint: false },
    { round: 11, country: "Reino Unido", city: "Silverstone", name: "GP de Reino Unido", date: "2026-07-05T14:00:00Z", circuit: "Silverstone Circuit", sprint: true },
    { round: 12, country: "Bélgica", city: "Spa-Francorchamps", name: "GP de Bélgica", date: "2026-07-19T13:00:00Z", circuit: "Circuit de Spa-Francorchamps", sprint: false },
    { round: 13, country: "Hungría", city: "Budapest", name: "GP de Hungría", date: "2026-07-26T13:00:00Z", circuit: "Hungaroring", sprint: false },
    { round: 14, country: "Países Bajos", city: "Zandvoort", name: "GP de Países Bajos", date: "2026-08-23T13:00:00Z", circuit: "Circuit Zandvoort", sprint: true },
    { round: 15, country: "Italia", city: "Monza", name: "GP de Italia", date: "2026-09-06T13:00:00Z", circuit: "Autodromo Nazionale Monza", sprint: false },
    { round: 16, country: "España", city: "Madrid", name: "GP de Madrid", date: "2026-09-13T13:00:00Z", circuit: "Madrid Street Circuit", sprint: false },
    { round: 17, country: "Azerbaiyán", city: "Bakú", name: "GP de Azerbaiyán", date: "2026-09-27T11:00:00Z", circuit: "Baku City Circuit", sprint: false },
    { round: 18, country: "Singapur", city: "Singapur", name: "GP de Singapur", date: "2026-10-11T12:00:00Z", circuit: "Marina Bay Street Circuit", sprint: true },
    { round: 19, country: "Estados Unidos", city: "Austin", name: "GP de Estados Unidos", date: "2026-10-25T19:00:00Z", circuit: "Circuit of the Americas", sprint: false },
    { round: 20, country: "México", city: "CDMX", name: "GP de Ciudad de México", date: "2026-11-01T20:00:00Z", circuit: "Autódromo Hermanos Rodríguez", sprint: false },
    { round: 21, country: "Brasil", city: "São Paulo", name: "GP de Brasil", date: "2026-11-08T17:00:00Z", circuit: "Autódromo José Carlos Pace", sprint: false },
    { round: 22, country: "Estados Unidos", city: "Las Vegas", name: "GP de Las Vegas", date: "2026-11-21T06:00:00Z", circuit: "Las Vegas Strip Circuit", sprint: false },
    { round: 23, country: "Qatar", city: "Lusail", name: "GP de Qatar", date: "2026-11-29T17:00:00Z", circuit: "Lusail International Circuit", sprint: false },
    { round: 24, country: "Abu Dhabi", city: "Yas Marina", name: "GP de Abu Dabi", date: "2026-12-06T13:00:00Z", circuit: "Yas Marina Circuit", sprint: false },
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
        const raceId = (req.query.race_id as string) || `round_${nextRace.round}`;
        const sessionType = (req.query.session_type as string) || null;
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
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching predictions', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Submit a prediction — supports all session types
app.post('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        const { player, p1, p2, p3, p4, p5, pole_position, session_type = 'race' } = req.body;
        const nextRace = getNextRace();
        const race_id = `round_${nextRace.round}`;

        const result = await pool.query(
            `INSERT INTO predictions (player, race_id, session_type, p1, p2, p3, p4, p5, pole_position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (player, race_id, session_type)
             DO UPDATE SET p1 = $4, p2 = $5, p3 = $6, p4 = $7, p5 = $8, pole_position = $9, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [player, race_id, session_type, p1, p2, p3, p4, p5, pole_position]
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

// Get 'The Oracle' analysis (Groq AI)
app.get('/api/oracle/roast', requireAuth, async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        const raceId = `round_${nextRace.round}`;
        const result = await pool.query("SELECT * FROM predictions WHERE race_id = $1 ORDER BY created_at DESC LIMIT 10", [raceId]);
        const predictions = result.rows;
        const roast = await generateOracleRoast(predictions);
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

        // Qualifying (always)
        const qualyDate = raceInfo?.Qualifying
            ? `${raceInfo.Qualifying.date}T${raceInfo.Qualifying.time || '00:00:00Z'}`
            : null;
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
                : null;
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
                : null;
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

// --- Admin: Submit official race results and calculate scores ---
app.post('/api/admin/results', requireAuth, async (req: Request, res: Response) => {
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
app.get('/api/admin/results/:round', requireAuth, async (req: Request, res: Response) => {
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

// --- Media Vault API Routes ---

// GET Media by type (series, movies, boardgames)
app.get('/api/media/:type', requireAuth, async (req: Request, res: Response) => {
    try {
        const type = req.params.type;
        let query = '';
        if (type === 'series') query = "SELECT * FROM media_series WHERE type = 'serie' ORDER BY created_at DESC";
        else if (type === 'animes') query = "SELECT * FROM media_series WHERE type = 'anime' ORDER BY created_at DESC";
        else if (type === 'movies') query = "SELECT * FROM media_movies ORDER BY created_at DESC";
        else if (type === 'boardgames') query = "SELECT * FROM media_boardgames ORDER BY created_at DESC";
        else return res.status(400).json({ error: 'Invalid media type' });

        const result = await pool.query(query);
        res.json(result.rows);
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
        let result;

        if (type === 'series' || type === 'animes') {
            const mType = type === 'animes' ? 'anime' : 'serie';
            result = await pool.query(
                `INSERT INTO media_series (recommender, name, genre, description, rating, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [body.recommender, body.name, body.genre, body.description, body.rating, mType]
            );
        } else if (type === 'movies') {
            result = await pool.query(
                `INSERT INTO media_movies (recommender, name, genre, description, rating) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [body.recommender, body.name, body.genre, body.description, body.rating]
            );
        } else if (type === 'boardgames') {
            result = await pool.query(
                `INSERT INTO media_boardgames (name, game_type, players, duration, difficulty, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [body.name, body.game_type, body.players, body.duration, body.difficulty, body.notes]
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

// Start Server
app.listen(port, () => {
    console.log(`🏎️ F1 Prode Backend running on http://localhost:${port}`);
});
