import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';
import { generateOracleRoast } from './groqOracle';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.VITE_FRONTEND_URL || '*', // Ajustaremos esto en producción para que acepte Vercel
    credentials: true,
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

// --- API Routes (Protected) ---

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'F1 Prode Backend is running fast!' });
});

// Get predictions for the upcoming race
app.get('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT * FROM predictions WHERE race_id = 'current' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching predictions', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Submit a new prediction (o actualizar si ya existe para este jugador y carrera)
app.post('/api/predictions', requireAuth, async (req: Request, res: Response) => {
    try {
        // race_id hardcoded temporalmente hasta conectar un calendario de F1
        const { player, p1, p2, p3, p4, p5, pole_position } = req.body;
        const race_id = 'current';

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
        const result = await pool.query("SELECT * FROM predictions WHERE race_id = 'current' ORDER BY created_at DESC LIMIT 10");
        const predictions = result.rows;
        const roast = await generateOracleRoast(predictions);
        res.json({ analysis: roast });
    } catch (error) {
        console.error('Error en Oracle:', error);
        res.status(500).json({ error: 'Failed to generate Oracle Analysis' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`🏎️ F1 Prode Backend running on http://localhost:${port}`);
});
