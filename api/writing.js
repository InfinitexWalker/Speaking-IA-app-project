import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-1.5-flash"];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { contents } = req.body;
    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (!process.env.GEMINI_API_KEY) throw new Error("Falta la GEMINI_API_KEY");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.2,      // Temperatura baja para análisis riguroso y JSON estricto
            maxOutputTokens: 800,  // Margen amplio para las correcciones de texto largo
          }
        });

        const result = await model.generateContent({ contents });
        const response = await result.response;
        const text = response.text();

        return res.status(200).json({
          candidates: [{ content: { parts: [{ text }] } }]
        });

      } catch (error) {
        console.warn(`Modelo ${modelName} falló en WRITING:`, error.message);
        lastError = error.message;
      }
    }

    throw new Error(lastError || "No hay modelos disponibles");
  } catch (error) {
    console.error("Error en /api/writing:", error);
    res.status(500).json({ error: error.message });
  }
}