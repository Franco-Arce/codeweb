import Groq from 'groq-sdk';
import 'dotenv/config';

export interface RaceContext {
    circuitName: string;
    weather?: string;
    lastResults?: string; // e.g. "P3: Norris 1°, Verstappen 2°, Leclerc 3°"
}

/**
 * The Oracle (powered by Groq AI)
 * Analyzes predictions with real race context — circuit, weather, last session results.
 */
export async function generateOracleRoast(predictions: any[], raceContext?: RaceContext, leaderboard?: any[]): Promise<string> {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    try {
        const contextBlock = raceContext ? `
CONTEXTO REAL DEL GP:
- Circuito: ${raceContext.circuitName}
- Clima esperado: ${raceContext.weather || 'Sin datos confirmados'}
- Resultados última sesión (P3/Qualy): ${raceContext.lastResults || 'Sin datos disponibles'}
` : '';

        const driverContext = `
GRILLA F1 2026 (contexto actualizado — NO tratés a estos pilotos como rookies si ya tienen experiencia):
- Max Verstappen (Red Bull) — 4x campeón mundial, favorito histórico
- Lando Norris (McLaren) — subcampeón 2024, ritmo de carrera excepcional
- Oscar Piastri (McLaren) — ganador de múltiples GPs, piloto de top 3 del campeonato. NO es rookie.
- Charles Leclerc (Ferrari) — pole position especialista, 3+ temporadas top
- Carlos Sainz (Ferrari) — consistente, ganador de GPs
- Lewis Hamilton (Ferrari) — 7x campeón mundial, llegó a Ferrari en 2025
- George Russell (Mercedes) — ganador de GPs, piloto top
- Fernando Alonso (Aston Martin) — 2x campeón mundial, +23 años en F1
- Lance Stroll (Aston Martin) — piloto de midfield
- Yuki Tsunoda (Red Bull) — 4+ temporadas en F1, ya no es rookie
- Isack Hadjar (Racing Bulls) — ROOKIE real en 2026, muy prometedor
- Nico Hülkenberg (Sauber) — veterano, 13+ temporadas en F1
- Gabriel Bortoleto (Sauber) — ROOKIE en 2026, campeón F2 2024
- Esteban Ocon (Haas) — piloto experimentado, 6+ temporadas
- Oliver Bearman (Haas) — segundo año en F1, joven pero no rookie
- Pierre Gasly (Alpine) — piloto experimentado, ganador de GPs
- Jack Doohan (Alpine) — ROOKIE en 2026
- Alexander Albon (Williams) — piloto experimentado
- Andrea Kimi Antonelli (Mercedes) — ROOKIE en 2026, primera temporada
- Franco Colapinto (Alpine) — piloto argentino, segunda temporada
`;


        const leaderboardContext = leaderboard && leaderboard.length > 0 ? `
POSICIONES ACTUALES DEL CAMPEONATO (F1 PRODE):
${leaderboard.map((lb: any, i: number) => `${i + 1}. ${lb.name} - ${lb.pts} pts`).join('\n')}
` : '';

        const prompt = `
${driverContext}
${contextBlock}
${leaderboardContext}
PREDICCIONES DE LOS USUARIOS:
${JSON.stringify(predictions, null, 2)}

INSTRUCCIONES PARA "EL ORÁCULO":
1. Personalidad: Sos un analista técnico de F1, soberbio y sarcástico. Acento argentino (porteño/cordobés fluido). Sin sobreactuar los modismos.
2. Análisis Técnico: No digas "este es malo". Decí: "Colorado mandó a Verstappen de primero cuando Red Bull está sufriendo con la degradación térmica en el eje trasero, ¡un poco de telemetría, por favor!". Usá la info de la grilla para hacer referencias precisas sobre el estado de cada piloto.
3. Utilidad: Compará las apuestas con lo que pasó en las prácticas reales (si hay contexto). Si alguien apostó por un rookie real (Hadjar, Bortoleto, Doohan, Antonelli) destacá la audacia.
4. Mencioná a los jugadores por nombre (Colorado, MrKazter, Eliana, etc.) para burlarte directamente o alabarlos según la elección. OBLIGATORIO: Búrlate ferozmente de los que van últimos en la tabla general y halaga o presiona al líder actual.
5. El Remate: Tirá tu predicción basada en el "ritmo de carrera" (race pace) y el contexto de sesiones que tenés.

RESTRICCIONES: Máximo 3 párrafos medianos. Nada de fútbol ni comparaciones ajenas al automovilismo. 100% enfocado en "los fierros". No tratés como rookies a pilotos experimentados.
`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Eres "El Oráculo", la IA definitiva de F1. Tu sarcasmo se basa en datos técnicos reales, no en insultos vacíos. Usas jerga como: undercut, porpoising, graining, stint, parque cerrado, degradación térmica, balanceo aerodinámico.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.65,
            max_tokens: 500,
        });

        return chatCompletion.choices[0]?.message?.content || 'La telemetría está caída, pibe.';
    } catch (error) {
        console.error("Error asking Groq Oracle:", error);
        return "El Oráculo entró en boxes. Reintentá luego.";
    }
}
