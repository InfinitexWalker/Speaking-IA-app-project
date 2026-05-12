import { GoogleGenerativeAI } from "@google/generative-ai";

// Modelos de Gemini optimizados para ANÁLISIS, RAZONAMIENTO Y JSON
const MODELS_TO_TRY = [
  "gemini-2.5-flash", // Prioridad: Excelente equilibrio entre velocidad y razonamiento
  "gemini-1.5-pro",   // Respaldo 1: Modelo más pesado, ideal para análisis profundo
  "gemini-1.5-flash"  // Respaldo 2: Rápido y confiable
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.GEMINI_API_KEY) {
       throw new Error("Falta la GEMINI_API_KEY");
    }

    const contents = req.body.contents;
    if (!contents) return res.status(400).json({ error: 'Contents is required' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    let jsonResponse = null;
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                temperature: 0.2 // Temperatura baja para que el análisis sea estricto y el JSON no se rompa
            }
        });
        
        // Pasamos el historial/prompt que mandó el frontend
        const result = await model.generateContent({ contents });
        const response = await result.response;
        const generatedText = response.text();
        
        // Formateamos la respuesta para que el frontend (writing.html) 
        // no note la diferencia y siga funcionando igual que antes.
        jsonResponse = {
          candidates: [
            { 
              content: { 
                parts: [{ text: generatedText }] 
              } 
            }
          ]
        };
        
        break; // Si el modelo funciona correctamente, salimos del bucle
      } catch (error) {
        console.warn(`Modelo ${modelName} falló en WRITING, intentando el siguiente...`, error.message);
        lastError = error;
      }
    }

    if (!jsonResponse) {
        throw new Error("Servicio de IA temporalmente no disponible: " + (lastError?.message || "Error desconocido"));
    }

    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Server Error en writing.js:", error);
    res.status(500).json({ error: error.message || 'Error procesando la solicitud' });
  }
}