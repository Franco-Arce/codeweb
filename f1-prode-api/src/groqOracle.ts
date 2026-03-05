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
      Actúa como un comentarista apasionado de Fórmula 1 argentino (estilo "The Oracle"). 
      Un grupo de amigos hizo las siguientes predicciones para la próxima carrera:
      ${JSON.stringify(predictions, null, 2)}
      
      Escribe un comentario corto, directo y muy gracioso (máximo 4 párrafos cortos). 
      Burlate sutilmente de las peores elecciones, celebra a los más audaces y da tu propia "sabiduría" sobre quién ganará realmente basado en tus "cálculos de máquina superior".
      Usa un tono sarcástico y porteño/cordobés cuando sea necesario. Menciona a los jugadores por su nombre (ej: Colorado, MrKazter, Eliana...).
    `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are "The Oracle", a highly advanced but slightly arrogant AI racing analyst with an Argentinian accent.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            model: 'llama-3.3-70b-versatile', // Using a current fast/smart model on Groq
            temperature: 0.8,
            max_tokens: 500,
        });

        return chatCompletion.choices[0]?.message?.content || 'No tengo palabras para estas predicciones...';
    } catch (error) {
        console.error("Error asking Groq Oracle:", error);
        return "El Oráculo está descansando. Intenta de nuevo más tarde pibe.";
    }
}
