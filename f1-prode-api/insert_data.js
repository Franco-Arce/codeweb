require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();

  await client.query(`
    INSERT INTO predictions (player, race_id, session_type, p1, p2, p3, p4, p5)
    VALUES ('guille', 'round_6', 'sprint_qualifying', 'Franco Colapinto', 'Andrea Kimi Antonelli', 'Oscar Piastri', 'George Russell', 'Max Verstappen')
    ON CONFLICT (player, race_id, session_type) DO UPDATE SET
    p1 = EXCLUDED.p1, p2 = EXCLUDED.p2, p3 = EXCLUDED.p3, p4 = EXCLUDED.p4, p5 = EXCLUDED.p5;
  `);
  console.log('Prediction for guille inserted');

  await client.query(`
    INSERT INTO race_results (race_id, session_type, p1, p2, p3, p4, p5)
    VALUES ('round_6', 'sprint_qualifying', 'Lando Norris', 'Andrea Kimi Antonelli', 'Oscar Piastri', 'Charles Leclerc', 'Max Verstappen')
    ON CONFLICT (race_id, session_type) DO UPDATE SET
    p1 = EXCLUDED.p1, p2 = EXCLUDED.p2, p3 = EXCLUDED.p3, p4 = EXCLUDED.p4, p5 = EXCLUDED.p5;
  `);
  console.log('Results for sprint_qualifying inserted');

  await client.end();
}

run().catch(console.error);
