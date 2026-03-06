const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testQuery() {
    try {
        const raceId = 'round_1';
        const sessionType = 'race';
        const query = "SELECT * FROM predictions WHERE race_id = $1 AND session_type = $2 ORDER BY created_at DESC";
        const params = [raceId, sessionType];

        console.log('Running query:', query);
        console.log('Params:', params);

        const result = await pool.query(query, params);
        console.log('Result rows length:', result.rows.length);

        process.exit(0);
    } catch (e) {
        console.error('Query Failed:', e);
        process.exit(1);
    }
}

testQuery();
