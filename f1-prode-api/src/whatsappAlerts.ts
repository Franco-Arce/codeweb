import cron from 'node-cron';
import { Pool } from 'pg';

const GREEN_API_URL = "https://7103.api.greenapi.com/waInstance7103523905/sendMessage/31a3b591e91b48e0adef98fb205b06f64e25920d7cbe402dbe";
const GROUP_ID = "5493516009843-1633467350@g.us";

export function startWhatsAppCron(pool: Pool, getNextRace: () => any, races2026: any[]) {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        try {
            console.log("🏁 Running WhatsApp Reminder Cron Job...");

            const nextRace = getNextRace();
            if (!nextRace) return;

            const round = nextRace.round;
            const raceId = `round_${round}`;

            // Fetch race data from Jolpica to get exact session times
            let jolpicaData: any = null;
            try {
                const resp = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${round}.json`);
                if (resp.ok) jolpicaData = await resp.json();
            } catch { /* use fallback */ }

            const raceInfo = jolpicaData?.MRData?.RaceTable?.Races?.[0];
            const sessions: { type: string; date_utc: string | null; label: string }[] = [];

            // Qualifying
            const qualyDate = raceInfo?.Qualifying
                ? `${raceInfo.Qualifying.date}T${raceInfo.Qualifying.time || '00:00:00Z'}`
                : nextRace.qualy_date;
            sessions.push({ type: 'qualifying', date_utc: qualyDate, label: 'Clasificación' });

            if (nextRace.sprint) {
                const sqDate = raceInfo?.SprintQualifying
                    ? `${raceInfo.SprintQualifying.date}T${raceInfo.SprintQualifying.time || '00:00:00Z'}`
                    : null;
                sessions.push({ type: 'sprint_qualifying', date_utc: sqDate, label: 'Sprint Qualifying' });

                const sprintDate = raceInfo?.Sprint
                    ? `${raceInfo.Sprint.date}T${raceInfo.Sprint.time || '00:00:00Z'}`
                    : null;
                sessions.push({ type: 'sprint', date_utc: sprintDate, label: 'Sprint Race' });
            }

            // Race
            const raceDate = raceInfo?.date
                ? `${raceInfo.date}T${raceInfo.time || '00:00:00Z'}`
                : nextRace.date;
            sessions.push({ type: 'race', date_utc: raceDate, label: 'Carrera' });

            const now = Date.now();
            const THREE_HOURS = 3 * 60 * 60 * 1000;
            const FIFTEEN_MINUTES = 15 * 60 * 1000;

            for (const session of sessions) {
                if (!session.date_utc) continue;

                const sessionTime = new Date(session.date_utc).getTime();
                const timeDiff = sessionTime - now;

                // Check if session is exactly between 3h and 3h15m away
                if (timeDiff >= THREE_HOURS && timeDiff < (THREE_HOURS + FIFTEEN_MINUTES)) {
                    console.log(`⏱️ Session ${session.label} is starting in 3 hours! Identifying missing users...`);

                    // 1. Get all known users (from leaderboard)
                    const usersResult = await pool.query('SELECT name FROM leaderboard');
                    const allUsers = usersResult.rows.map(r => r.name);

                    if (allUsers.length === 0) continue;

                    // 2. Get users who already predicted
                    const predictedResult = await pool.query(
                        'SELECT player FROM predictions WHERE race_id = $1 AND session_type = $2',
                        [raceId, session.type]
                    );
                    const predictedUsers = new Set(predictedResult.rows.map(r => r.player));

                    // 3. Find missing users
                    const missingUsers = allUsers.filter(u => !predictedUsers.has(u));

                    if (missingUsers.length > 0) {
                        const mentions = missingUsers.map(u => `*${u}*`).join(', ');
                        const message = `⚠️ *¡ALERTA F1 PRODE!* ⚠️\n\nFaltan solo 3 HORAS para que cierre la carga de pronósticos para la *${session.label}* del *${nextRace.name}*.\n\nLos siguientes pilotos aún no han cargado su pronóstico y podrían quedar descalificados:\n${mentions}\n\n¡Aceleren y carguen ya mismo! 🏎️💨`;

                        try {
                            const res = await fetch(GREEN_API_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chatId: GROUP_ID,
                                    message: message
                                })
                            });

                            if (res.ok) {
                                console.log(`✅ WhatsApp Reminder sent to group for ${session.label}`);
                            } else {
                                console.error('❌ Failed to send WhatsApp message', await res.text());
                            }
                        } catch (err) {
                            console.error('❌ Error sending WhatsApp message', err);
                        }
                    } else {
                        console.log(`✅ Todos los pilotos ya cargaron para ${session.label}`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error in WhatsApp Reminder cron job:', error);
        }
    });
}
