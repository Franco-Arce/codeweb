import { Pool } from 'pg';
import * as xlsx from 'xlsx';
import 'dotenv/config';

// Conexión a Supabase (Postgres)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const importMedia = async () => {
    try {
        console.log('Creando tablas...');
        // Crear las tablas necesarias
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_series (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                recommender VARCHAR(100),
                name VARCHAR(255),
                genre VARCHAR(100),
                description TEXT,
                rating VARCHAR(100),
                type VARCHAR(50) DEFAULT 'serie',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS media_movies (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                recommender VARCHAR(100),
                name VARCHAR(255),
                genre VARCHAR(100),
                description TEXT,
                rating VARCHAR(100),
                type VARCHAR(50) DEFAULT 'película',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS media_boardgames (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                name VARCHAR(255),
                game_type VARCHAR(100),
                players VARCHAR(50),
                duration VARCHAR(50),
                difficulty VARCHAR(50),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Tablas creadas/verificadas con éxito.');

        console.log('Leyendo Excel...');
        // Cargar el excel, la ruta relativa es un nivel arriba de f1-prode-api
        const wb = xlsx.readFile('../../Excel al cubo.xlsx');

        // Hoja 1: Series
        if (wb.SheetNames.includes('Series')) {
            const seriesData: any[] = xlsx.utils.sheet_to_json(wb.Sheets['Series']);
            console.log(`Importando ${seriesData.length} series...`);
            for (const item of seriesData) {
                // Adaptar nombres de columnas
                const row = {
                    recommender: String(item['Columna 1'] || ''),
                    name: String(item['Nombre'] || ''),
                    genre: String(item['genero'] || ''),
                    description: String(item['De que trata'] || ''),
                    rating: String(item['Recomendación'] || '')
                };
                if (!row.name || row.name === 'undefined') continue; // Saltar vacíos

                await pool.query(
                    `INSERT INTO media_series (recommender, name, genre, description, rating, type) VALUES ($1, $2, $3, $4, $5, 'serie')`,
                    [row.recommender, row.name, row.genre, row.description, row.rating]
                );
            }
        }

        // Hoja 2: animes (Lo meteremos en media_series con type anime)
        if (wb.SheetNames.includes('animes')) {
            const animeData: any[] = xlsx.utils.sheet_to_json(wb.Sheets['animes']);
            console.log(`Importando ${animeData.length} animes...`);
            for (const item of animeData) {
                const row = {
                    recommender: String(item['Columna 1'] || ''),
                    name: String(item['Nombre'] || ''),
                    genre: String(item['genero'] || ''),
                    description: String(item['De que trata'] || ''),
                    rating: String(item['Recomendación'] || '')
                };
                if (!row.name || row.name === 'undefined') continue;

                await pool.query(
                    `INSERT INTO media_series (recommender, name, genre, description, rating, type) VALUES ($1, $2, $3, $4, $5, 'anime')`,
                    [row.recommender, row.name, row.genre, row.description, row.rating]
                );
            }
        }

        // Hoja 3: Peliculas
        if (wb.SheetNames.includes('Peliculas')) {
            const moviesData: any[] = xlsx.utils.sheet_to_json(wb.Sheets['Peliculas']);
            console.log(`Importando ${moviesData.length} películas...`);
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
        }

        // Hoja 4: Peliculas_por_ver (Opcional, omitimos por ahora o las metemos igual)
        // Hoja 5: Juegos de Mesa
        if (wb.SheetNames.includes('Juegos de Mesa')) {
            const gamesData: any[] = xlsx.utils.sheet_to_json(wb.Sheets['Juegos de Mesa']);
            console.log(`Importando ${gamesData.length} juegos de mesa...`);
            for (const item of gamesData) {
                const row = {
                    name: String(item['Nombre'] || ''),
                    game_type: String(item['Tipo de juego'] || ''),
                    players: String(item['Número de jugadores'] || ''),
                    duration: String(item['Duración'] || ''),
                    difficulty: String(item['Dificultad'] || ''),
                    notes: String(item['Notas'] || '')
                };
                if (!row.name || row.name === 'undefined') continue;

                await pool.query(
                    `INSERT INTO media_boardgames (name, game_type, players, duration, difficulty, notes) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [row.name, row.game_type, row.players, row.duration, row.difficulty, row.notes]
                );
            }
        }

        console.log('✅ Toda la data ha sido migrada existosamente.');
        pool.end();
    } catch (e) {
        console.error('❌ Error migrando data:', e);
        pool.end();
    }
}

importMedia();
