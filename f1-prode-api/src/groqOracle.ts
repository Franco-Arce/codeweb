import Groq from 'groq-sdk';
import 'dotenv/config';

export interface RaceContext {
    circuitName: string;
    weather?: string;
    lastResults?: string; // e.g. "P3: Norris 1°, Verstappen 2°, Leclerc 3°"
}

const driverContext = `
GRILLA F1 2026 (contexto actualizado):
- Max Verstappen (Red Bull) — 4x campeón mundial, favorito histórico
- Lando Norris (McLaren) — subcampeón 2024, ritmo de carrera excepcional
- Oscar Piastri (McLaren) — ganador de múltiples GPs
- Charles Leclerc (Ferrari) — pole position especialista
- Carlos Sainz (Williams) — consistente
- Lewis Hamilton (Ferrari) — 7x campeón mundial, llegó a Ferrari en 2025
- George Russell (Mercedes) — piloto top
- Fernando Alonso (Aston Martin) — 2x campeón mundial, +23 años en F1
- Lance Stroll (Aston Martin)
- Yuki Tsunoda (Racing Bulls)
- Isack Hadjar (Racing Bulls) — ROOKIE real en 2026, muy prometedor
- Nico Hülkenberg (Sauber)
- Gabriel Bortoleto (Sauber) — ROOKIE en 2026, campeón F2 2024
- Esteban Ocon (Haas)
- Oliver Bearman (Haas)
- Pierre Gasly (Alpine)
- Jack Doohan (Alpine) — ROOKIE en 2026
- Alexander Albon (Williams)
- Andrea Kimi Antonelli (Mercedes) — ROOKIE en 2026
- Franco Colapinto (Alpine) — piloto argentino, segunda temporada
- Liam Lawson (Red Bull)
`;

export async function generateAutoFill(raceContext?: RaceContext): Promise<{ pole_position: string, predicted_team: string, p1: string, p2: string, p3: string, p4: string, p5: string }> {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    try {
        const prompt = `
${driverContext}
CONTEXTO REAL DEL GP: ${raceContext?.circuitName || 'Desconocido'}.

Sos un experto analista de F1. Quiero que me des un JSON VÁLIDO con una predicción altamente probable (pero no aburrida) para los top 5 de esta carrera, quién hará la pole, y el mejor equipo del fin de semana.
Solo devolvé el JSON puro. Sin formato markdown ni texto extra. Las keys deben ser exactamente: pole_position, predicted_team, p1, p2, p3, p4, p5.
Ejemplo de valores para equipos: "Red Bull Racing", "McLaren", "Ferrari", "Mercedes", "Aston Martin", "Alpine", "Williams", "Racing Bulls", "Haas", "Sauber".
Ejemplo de valores para pilotos: usar solo el nombre y apellido completos como aparecen en la grilla ("Max Verstappen").
`;
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You only reply with valid JSON.' },
                { role: 'user', content: prompt }
            ],
            model: 'llama3-8b-8192', // Fast model for JSON
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const content = chatCompletion.choices[0]?.message?.content || '{}';
        return JSON.parse(content);
    } catch (e) {
        console.error("Error auto-filling:", e);
        return {
            pole_position: "Lando Norris",
            predicted_team: "McLaren",
            p1: "Lando Norris",
            p2: "Max Verstappen",
            p3: "Charles Leclerc",
            p4: "Oscar Piastri",
            p5: "George Russell"
        };
    }
}

export async function generatePersonalRoast(playerName: string, prediction: any, raceContext?: RaceContext): Promise<string> {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    try {
        const prompt = `
${driverContext}
CONTEXTO REAL DEL GP: ${raceContext?.circuitName || 'Desconocido'}.

El jugador "${playerName}" acaba de armar este Prode:
Pole: ${prediction.pole_position || 'Nadie'}
Equipo: ${prediction.predicted_team || 'Nadie'}
1ro: ${prediction.p1}
2do: ${prediction.p2}
3ro: ${prediction.p3}
4to: ${prediction.p4}
5to: ${prediction.p5}

INSTRUCCIONES:
Sos un ingeniero de pista argentino extremadamente sarcástico y directo (estilo Toto Wolff mezclado con un cordobés enojado).
Dame 1 solo párrafo corto (máximo 40 palabras) bardeando/juzgando esta predicción específica. 
Si es muy obvia (Verstappen/Norris) decile aburrido. Si puso un rookie o alguien malo muy arriba, decile que deje de tomar fernet.
Hablale directamente a "${playerName}". No uses hashtags ni emojis excesivos.
`;
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama3-8b-8192',
            temperature: 0.8,
            max_tokens: 150,
        });

        return chatCompletion.choices[0]?.message?.content || 'Un prode tan malo que me quedé sin palabras.';
    } catch (e) {
        return 'El servidor de boxes se cayó, pero asumo que tu prode es un desastre igual.';
    }
}

export async function generateOracleRoast(predictions: any[], raceContext?: RaceContext, leaderboard?: any[]): Promise<string> {
    // Keep this one around just in case
    return "El Oráculo global está temporalmente desactivado. Usa el Oráculo personal.";
}
