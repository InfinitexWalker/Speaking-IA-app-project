import { GoogleGenerativeAI } from "@google/generative-ai";

// Lista de modelos para probar (Orden de prioridad)
// Si el primero falla, intenta el segundo, etc.
const MODELS_TO_TRY = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest", 
  "gemini-1.5-flash-001",
  "gemini-pro"
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const prompt = `
      Analiza la palabra/frase: "${text}".
      Responde SOLO un JSON con este formato exacto (sin bloques de código, solo el json raw):
      {
          "ipa": "IPA standard",
          "spanish_sound": "pronunciación figurada (ej: chiis)",
          "tip": "Un consejo corto y práctico para pronunciarlo bien en español. Ejemplo: 'Pon la boca como diciendo O pero di A'"
      }
    `;

    // --- LÓGICA DE INTENTOS (RETRY) ---
    let jsonResponse = null;
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        console.log(`Intentando conectar con modelo: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // Limpiamos la respuesta
        let cleanText = response.text().replace(/```json|```/g, '').trim();
        jsonResponse = JSON.parse(cleanText);
        
        // Si llegamos aquí, ¡funciona! Rompemos el ciclo
        break; 
      } catch (error) {
        console.warn(`Falló el modelo ${modelName}:`, error.message);
        lastError = error;
        // Continuamos al siguiente modelo en la lista...
      }
    }

    if (!jsonResponse) {
      throw lastError || new Error("Ningún modelo respondió correctamente.");
    }

    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Error fatal en backend:", error);
    // Le enviamos el detalle del error para que sepas qué pasó
    res.status(500).json({ 
        error: 'Error processing request', 
        details: error.message 
    });
  }
}