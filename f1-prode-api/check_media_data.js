const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    try {
        const series = await pool.query("SELECT count(*) FROM media_series");
        const movies = await pool.query("SELECT count(*) FROM media_movies");
        const boardgames = await pool.query("SELECT count(*) FROM media_boardgames");
        const users = await pool.query("SELECT count(*) FROM users");
        
        console.log('--- Data Counts ---');
        console.log('Series/Animes:', series.rows[0].count);
        console.log('Movies:', movies.rows[0].count);
        console.log('Boardgames:', boardgames.rows[0].count);
        console.log('Users:', users.rows[0].count);

        const sample = await pool.query("SELECT * FROM media_series LIMIT 2");
        console.log('Sample Series:', sample.rows);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

checkData();
