const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/franc/OneDrive/Escritorio/Formula1Prode/codeweb/f1-prode-api/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTypes() {
    try {
        const res = await pool.query(`SELECT type, COUNT(*) FROM media_series GROUP BY type`);
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkTypes();
