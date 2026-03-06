const fetch = require('node-fetch');

async function testApi() {
    try {
        // We'll try to hit the backend directly. Since it's local, we'll try localhost:3001
        // Actually, I'll just check if I can run the SQL query that I think is failing.
        const { Pool } = require('pg');
        require('dotenv').config({ path: 'c:/Users/franc/OneDrive/Escritorio/Formula1Prode/codeweb/f1-prode-api/.env' });
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });

        console.log('Testing SQL query for media_series...');
        try {
            const res = await pool.query(`
        SELECT m.*, 
               COALESCE(AVG(r.rating), m.rating::float) as avg_rating,
               COUNT(r.id) as total_votes
        FROM media_series m
        LEFT JOIN media_ratings r ON r.media_id = m.id AND r.media_type = 'series'
        WHERE type = 'serie'
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `);
            console.log('Query success! (Wait, did it really work?) Rows:', res.rows.length);
        } catch (e) {
            console.error('Query FAILED as expected:', e.message);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
testApi();
