import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';
import { generateOracleRoast } from './groqOracle';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
                winner VARCHAR(100),
                team VARCHAR(100),
                top5 JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// --- API Routes ---

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'F1 Prode Backend is running fast!' });
});

// Get predictions for the upcoming race
app.get('/api/predictions', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM predictions ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching predictions', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Submit a new prediction
app.post('/api/predictions', async (req: Request, res: Response) => {
    try {
        const { player, winner, team, top5 } = req.body;
        // top5 is an array, we store as JSONB
        const result = await pool.query(
            'INSERT INTO predictions (player, winner, team, top5) VALUES ($1, $2, $3, $4) RETURNING *',
            [player, winner, team, JSON.stringify(top5 || [])]
        );
        res.status(201).json({ message: 'Prediction saved successfully', prediction: result.rows[0] });
    } catch (error) {
        console.error('Error saving prediction', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Leaderboard
app.get('/api/leaderboard', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM leaderboard ORDER BY pts DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leaderboard', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get 'The Oracle' analysis (Groq AI)
app.get('/api/oracle/roast', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 10');
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
