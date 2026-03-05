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

// Create tables if they don't exist
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS predictions (
                id SERIAL PRIMARY KEY,
                player VARCHAR(100) NOT NULL,
                race_id VARCHAR(50) NOT NULL DEFAULT 'current',
                p1 VARCHAR(50),
                p2 VARCHAR(50),
                p3 VARCHAR(50),
                p4 VARCHAR(50),
                p5 VARCHAR(50),
                pole_position VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player, race_id)
            );

            CREATE TABLE IF NOT EXISTS leaderboard (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                pts INTEGER DEFAULT 0
            );

            -- Insert some initial leaderboard data if empty
            INSERT INTO leaderboard (name, pts)
            SELECT 'Colorado', 19 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'Colorado');
            INSERT INTO leaderboard (name, pts)
            SELECT 'MrKazter', 16 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'MrKazter');
            INSERT INTO leaderboard (name, pts)
            SELECT 'Eliana', 11 WHERE NOT EXISTS (SELECT 1 FROM leaderboard WHERE name = 'Eliana');

            CREATE TABLE IF NOT EXISTS race_results (
                id SERIAL PRIMARY KEY,
                race_id VARCHAR(50) UNIQUE NOT NULL,
                p1 VARCHAR(50),
                p2 VARCHAR(50),
                p3 VARCHAR(50),
                p4 VARCHAR(50),
                p5 VARCHAR(50),
                pole_position VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Base de datos inicializada');
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

// Get predictions for a race (defaults to next race)
app.get('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        const nextRace = getNextRace();
        const raceId = (req.query.race_id as string) || `round_${nextRace.round}`;
        const result = await pool.query("SELECT * FROM predictions WHERE race_id = $1 ORDER BY created_at DESC", [raceId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching predictions', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Submit a new prediction (linked to next race round)
app.post('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        const { player, p1, p2, p3, p4, p5, pole_position } = req.body;
        const nextRace = getNextRace();
        const race_id = `round_${nextRace.round}`;

        const result = await pool.query(
            `INSERT INTO predictions (player, race_id, p1, p2, p3, p4, p5, pole_position) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             ON CONFLICT (player, race_id) 
             DO UPDATE SET p1 = $3, p2 = $4, p3 = $5, p4 = $6, p5 = $7, pole_position = $8, created_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [player, race_id, p1, p2, p3, p4, p5, pole_position]
        );
        res.status(201).json({ message: 'Prediction saved successfully', prediction: result.rows[0] });
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

// --- Admin: Submit official race results and calculate scores ---
app.post('/api/admin/results', requireAuth, async (req: Request, res: Response) => {
    try {
        const { race_round, p1, p2, p3, p4, p5, pole_position } = req.body;
        const race_id = `round_${race_round}`;

        // Save official results
        await pool.query(
            `INSERT INTO race_results (race_id, p1, p2, p3, p4, p5, pole_position)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (race_id)
             DO UPDATE SET p1 = $2, p2 = $3, p3 = $4, p4 = $5, p5 = $6, pole_position = $7, created_at = CURRENT_TIMESTAMP`,
            [race_id, p1, p2, p3, p4, p5, pole_position]
        );

        // Fetch all predictions for this race
        const predictionsResult = await pool.query(
            "SELECT * FROM predictions WHERE race_id = $1", [race_id]
        );

        const officialResult = { p1, p2, p3, p4, p5, pole_position };
        const positionFields = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;
        const scoreUpdates: { player: string; scored: number }[] = [];

        for (const pred of predictionsResult.rows) {
            let scored = 0;
            for (const pos of positionFields) {
                if (pred[pos] && pred[pos] === (officialResult as any)[pos]) {
                    scored += 10;
                }
            }
            if (pred.pole_position && pred.pole_position === officialResult.pole_position) {
                scored += 5;
            }
            if (scored > 0) {
                scoreUpdates.push({ player: pred.player, scored });
            }
        }

        // Update leaderboard scores
        for (const update of scoreUpdates) {
            await pool.query(
                `INSERT INTO leaderboard (name, pts) VALUES ($1, $2)
                 ON CONFLICT (name) DO UPDATE SET pts = leaderboard.pts + $2`,
                [update.player, update.scored]
            );
        }

        res.json({
            message: `Resultados procesados para ${race_id}`,
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
