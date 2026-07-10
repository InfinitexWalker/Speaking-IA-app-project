import { GoogleGenerativeAI } from "@google/generative-ai";

// Sistema de cascada: Si el principal falla, entra el de respaldo instantáneamente
const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-1.5-flash"];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { contents } = req.body;
    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: 'Invalid request: contents must be an array' });
    }

    if (!process.env.GEMINI_API_KEY) throw new Error("Falta la GEMINI_API_KEY");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            maxOutputTokens: 300, // Limita la respuesta para máxima velocidad en la charla
            temperature: 0.7,     // Creatividad ideal para conversación
          }
        });

        // Tu frontend ya manda el array en el formato perfecto de Gemini
        const result = await model.generateContent({ contents });
        const response = await result.response;
        const text = response.text();

        // Devolvemos la estructura exacta que espera tu frontend
        return res.status(200).json({
          candidates: [{ content: { parts: [{ text }] } }]
        });

      } catch (error) {
        console.warn(`Modelo ${modelName} falló:`, error.message);
        lastError = error.message;
      }
    }

    throw new Error(lastError || "Todos los modelos fallaron.");

  } catch (error) {
    console.error("Error en /api/chat:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
}