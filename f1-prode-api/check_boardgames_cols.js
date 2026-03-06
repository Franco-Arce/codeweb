const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/franc/OneDrive/Escritorio/Formula1Prode/codeweb/f1-prode-api/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkCols() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'media_boardgames'
    `);
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkCols();
