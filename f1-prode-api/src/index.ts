import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { generateOracleRoast } from './groqOracle';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// --- Mock Database (In-Memory for now) ---
// In a real scenario, this would connect to PostgreSQL via `pg`.
let mockPredictions = [
    { player: 'Colorado', winner: 'Piastri', team: 'McLaren', top5: ['Piastri', 'Norris', 'Verstappen', 'Russell', 'Leclerc'] },
    { player: 'MrKazter', winner: 'Norris', team: 'McLaren', top5: ['Norris', 'Piastri', 'Russell', 'Leclerc', 'Verstappen'] },
    { player: 'Eliana', winner: 'Verstappen', team: 'McLaren', top5: ['Verstappen', 'Norris', 'Piastri', 'Leclerc', 'Sainz'] },
];

let mockLeaderboard = [
    { name: 'Colorado', pts: 19 },
    { name: 'MrKazter', pts: 16 },
    { name: 'Eliana', pts: 11 },
];

// --- API Routes ---

app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'F1 Prode Backend is running fast!' });
});

// Get predictions for the upcoming race
app.get('/api/predictions', (req: Request, res: Response) => {
    res.json(mockPredictions);
});

// Submit a new prediction
app.post('/api/predictions', (req: Request, res: Response) => {
    const newPrediction = req.body;
    // TODO: Add validation
    mockPredictions.push(newPrediction);
    res.status(201).json({ message: 'Prediction saved successfully', prediction: newPrediction });
});

// Get Leaderboard
app.get('/api/leaderboard', (req: Request, res: Response) => {
    // Sort leaderboard by points descending
    const sorted = [...mockLeaderboard].sort((a, b) => b.pts - a.pts);
    res.json(sorted);
});

// Get 'The Oracle' analysis (Groq AI)
app.get('/api/oracle/roast', async (req: Request, res: Response) => {
    try {
        const roast = await generateOracleRoast(mockPredictions);
        res.json({ analysis: roast });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate Oracle Analysis' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`🏎️ F1 Prode Backend running on http://localhost:${port}`);
});
