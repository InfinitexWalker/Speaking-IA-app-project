// analyze.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: 'Text is required' });

  // Modelos gratuitos optimizados para lógica y extracción de datos
  const ANALYZE_MODELS = [
    "openai/gpt-oss-20b:free",          // Prioridad: Muy estable para JSON
    "liquid/lfm2.5-1.2b-thinking:free", // Respaldo: Especializado en razonamiento
    "google/gemma-2-9b-it:free"         // Respaldo final
  ];

  let lastError = null;

  for (const model of ANALYZE_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Speaking Pro Coach"
        },
        body: JSON.stringify({
          "model": model,
          "messages": [
            {
              "role": "system",
              "content": "Eres un experto en fonética inglesa. Responde únicamente con este formato JSON: {\"ipa\": \"...\", \"spanish_sound\": \"...\", \"tip\": \"...\"}"
            },
            { "role": "user", "content": `Analiza: "${text}"` }
          ],
          "response_format": { "type": "json_object" }
        })
      });

      const data = await response.json();

      if (response.ok && data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        return res.status(200).json(JSON.parse(content));
      }
      lastError = data.error?.message || "Error en el modelo";
    } catch (error) {
      lastError = error.message;
      continue; 
    }
  }

  res.status(500).json({ error: `Fallo en todos los modelos: ${lastError}` });
}