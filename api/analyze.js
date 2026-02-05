import { GoogleGenerativeAI } from "@google/generative-ai";

// MEJORA 1: Usamos modelos estables y probados.
// 'gemini-1.5-flash' es actualmente el más rápido y eficiente para tareas simples.
// LISTA ACTUALIZADA (Basada en tu JSON de 2026)
const MODELS_TO_TRY = [
  "gemini-2.5-flash",      // El modelo estándar actual
  "gemini-2.0-flash",      // Versión anterior estable
  "gemini-flash-latest",   // Alias que siempre apunta al más nuevo
  "gemini-1.5-flash-latest" // Por si acaso queda algún soporte legacy
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    if (!process.env.GEMINI_API_KEY) {
       throw new Error("Falta la GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // MEJORA 2: Prompt reforzado para asegurar JSON válido siempre
    const prompt = `
      Actúa como un profesor de fonética experto.
      Analiza la palabra o frase en inglés: "${text}".
      
      Responde EXCLUSIVAMENTE con un objeto JSON (sin markdown, sin explicaciones extra).
      Formato requerido:
      {
          "ipa": "Transcrpción IPA estándar",
          "spanish_sound": "Transcrpción figurada para un hispanohablante (ej: 'bitch' -> 'bich')",
          "tip": "Consejo técnico sobre la posición de la lengua o labios para pronunciar esto bien."
      }
    `;

    let jsonResponse = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let cleanText = response.text().replace(/```json|```/g, '').trim();
        
        // Extracción de JSON a prueba de balas
        const firstBracket = cleanText.indexOf('{');
        const lastBracket = cleanText.lastIndexOf('}');
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        }

        jsonResponse = JSON.parse(cleanText);
        break; // Si funciona, salimos del loop
      } catch (error) {
        console.warn(`Modelo ${modelName} falló, intentando siguiente...`);
      }
    }

    if (!jsonResponse) throw new Error("Servicio de IA temporalmente no disponible");

    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: 'Error procesando la solicitud' });
  }
}