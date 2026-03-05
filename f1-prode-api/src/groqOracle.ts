import Groq from 'groq-sdk';
import 'dotenv/config';

// Initialize Groq Client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * The Oracle (powered by Groq AI)
 * Analyzes predictions and generates funny/roast commentary in an Argentinian accent.
 */
export async function generateOracleRoast(predictions: any[]): Promise<string> {
    try {
        const prompt = `
      Actúa como "El Oráculo", un analista experto, ácido y un poco arrogante de Fórmula 1, con un fuerte acento argentino (mezcla de porteño sarcástico y cordobés pícaro).
      Olvídate de hacer comparaciones con el fútbol (no menciones a Messi ni a River), enfócate estrictamente en el automovilismo con jerga de F1 (boxes, rebufo, DRS, undercut, degradación de neumáticos).
      
      Un grupo de jugadores de un Prode hizo estas predicciones para la próxima carrera:
      ${JSON.stringify(predictions, null, 2)}
      
      Tu objetivo:
      Escribe un comentario incisivo, filoso y directo (máximo 3 párrafos medianos). 
      - Evita repetir muletillas como "che, che, che". Sé más elegante en tu sarcasmo.
      - Destruye sutilmente las peores elecciones argumentando problemas de telemetría, estrategia de neumáticos o historial del piloto.
      - Celebra la audacia de quien apostó por una sorpresa, pero advirtiéndole que los fierros se rompen.
      - Nombra a algunos de los jugadores (ej: Colorado, MrKazter, Eliana...) para burlarte directamente de ellos o alabarlos.
      - Remata revelando quién crees VOS, basado en tus "algoritmos de telemetría de la NASA", que va a ganar realmente de forma indiscutida.
    `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Eres "El Oráculo", la inteligencia artificial definitiva de Fórmula 1. Eres soberbio, sarcástico, con un vocabulario riquísimo en automovilismo y un inconfundible acento argentino impecable (sin sobreactuar los modismos). Destruyes con argumentos técnicos.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 450,
        });

        return chatCompletion.choices[0]?.message?.content || 'No tengo palabras para estas predicciones...';
    } catch (error) {
        console.error("Error asking Groq Oracle:", error);
        return "El Oráculo está descansando. Intenta de nuevo más tarde pibe.";
    }
}
