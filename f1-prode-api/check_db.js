const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    console.log('--- DB Check ---');
    try {
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', tables.rows.map(r => r.table_name));

        if (tables.rows.some(r => r.table_name === 'predictions')) {
            const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'predictions'");
            console.log('Predictions Columns:', cols.rows.map(r => r.column_name));

            const count = await pool.query("SELECT count(*) FROM predictions");
            console.log('Predictions Count:', count.rows[0].count);
        }

        console.log('--- Env Check ---');
        console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
        console.log('TMDB_API_KEY present:', !!process.env.TMDB_API_KEY);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

check();
