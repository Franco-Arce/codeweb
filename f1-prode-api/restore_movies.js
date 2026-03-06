const { Pool } = require('pg');
const xlsx = require('xlsx');
require('dotenv').config({ path: 'c:/Users/franc/OneDrive/Escritorio/Formula1Prode/codeweb/f1-prode-api/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function restoreMovies() {
    try {
        console.log('Reading Excel...');
        const wb = xlsx.readFile('c:/Users/franc/OneDrive/Escritorio/Formula1Prode/Excel al cubo.xlsx');

        if (wb.SheetNames.includes('Peliculas')) {
            const moviesData = xlsx.utils.sheet_to_json(wb.Sheets['Peliculas']);
            console.log(`Found ${moviesData.length} movies in Excel. Restoring to DB...`);

            // Clear existing empty or potential partial data to avoid messy state
            await pool.query('DELETE FROM media_movies');

            for (const item of moviesData) {
                const row = {
                    recommender: String(item['Columna 1'] || ''),
                    name: String(item['Nombre'] || ''),
                    genre: String(item['genero'] || ''),
                    description: String(item['De que trata'] || ''),
                    rating: String(item['Recomendación'] || '')
                };
                if (!row.name || row.name === 'undefined') continue;

                await pool.query(
                    `INSERT INTO media_movies (recommender, name, genre, description, rating) VALUES ($1, $2, $3, $4, $5)`,
                    [row.recommender, row.name, row.genre, row.description, row.rating]
                );
            }
            console.log('✅ Movies restored successfully.');
        } else {
            console.error('❌ "Peliculas" sheet not found in Excel.');
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during restoration:', err);
        process.exit(1);
    }
}

restoreMovies();
