const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/franc/OneDrive/Escritorio/Formula1Prode/codeweb/f1-prode-api/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkMedia() {
    try {
        const tables = ['media_series', 'media_movies', 'media_boardgames', 'media_animes'];
        for (const table of tables) {
            try {
                const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`${table}: ${res.rows[0].count} records`);
            } catch (e) {
                console.log(`${table}: Table might not exist or error (${e.message})`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkMedia();
