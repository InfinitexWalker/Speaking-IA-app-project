import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. Verificamos que sea una petición POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Obtenemos el texto que envió el frontend
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // 3. Conectamos con Gemini usando la variable de entorno (segura)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Configuramos el modelo (puedes cambiarlo si quieres)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 4. El Prompt para la IA
    const prompt = `
      Analiza la palabra/frase: "${text}".
      Responde SOLO un JSON con este formato exacto (sin bloques de código, solo el json raw):
      {
          "ipa": "IPA standard",
          "spanish_sound": "pronunciación figurada (ej: chiis)",
          "tip": "Un consejo corto y práctico para pronunciarlo bien en español. Ejemplo: 'Pon la boca como diciendo O pero di A'"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Limpieza básica por si la IA manda markdown
    let cleanText = response.text().replace(/```json|```/g, '').trim();
    const jsonResponse = JSON.parse(cleanText);

    // 5. Devolvemos la respuesta al frontend
    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Error en el backend:", error);
    res.status(500).json({ error: 'Error processing request' });
  }
}