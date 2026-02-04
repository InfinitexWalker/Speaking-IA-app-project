import { GoogleGenerativeAI } from "@google/generative-ai";

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

    // Verificamos API Key
    if (!process.env.GEMINI_API_KEY) {
       throw new Error("Falta la GEMINI_API_KEY en Vercel");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const prompt = `
      Analiza la palabra/frase: "${text}".
      Responde SOLO un JSON con este formato exacto (sin bloques de código markdown, solo el json plano):
      {
          "ipa": "IPA standard",
          "spanish_sound": "pronunciación figurada (ej: chiis)",
          "tip": "Un consejo corto y práctico para pronunciarlo bien en español."
      }
    `;

    let jsonResponse = null;
    let lastError = null;

    // Intentamos conectar con los modelos disponibles
    for (const modelName of MODELS_TO_TRY) {
      try {
        console.log(`Intentando modelo: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Limpiar respuesta
        let cleanText = response.text().replace(/```json|```/g, '').trim();
        
        // Extracción segura de JSON
        const firstBracket = cleanText.indexOf('{');
        const lastBracket = cleanText.lastIndexOf('}');
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        }

        jsonResponse = JSON.parse(cleanText);
        console.log(`¡Éxito con ${modelName}!`);
        break; 
      } catch (error) {
        console.warn(`Falló ${modelName}: ${error.message}`);
        lastError = error;
      }
    }

    if (!jsonResponse) {
      throw new Error(`Todos los modelos fallaron. Revisa los logs.`);
    }

    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Error FATAL en backend:", error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}