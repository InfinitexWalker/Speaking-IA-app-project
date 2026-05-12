// /api/writing.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  // Modelos optimizados para ANÁLISIS, RAZONAMIENTO Y JSON
  const ANALYZE_MODELS = [
    "openai/gpt-oss-20b:free",          // Prioridad: Muy estable para JSON
    "liquid/lfm2.5-1.2b-thinking:free", // Respaldo: Especializado en razonamiento
    "google/gemma-2-9b-it:free"         // Respaldo final
  ];

  try {
    const messages = req.body.contents.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: typeof m.parts[0].text === 'string' ? m.parts[0].text : JSON.stringify(m.parts[0].text)
    }));

    let lastError = null;

    for (const model of ANALYZE_MODELS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 segundos (el análisis toma más tiempo)

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Speaking Pro Writing"
          },
          signal: controller.signal,
          body: JSON.stringify({
            "model": model,
            "messages": messages,
            "temperature": 0.2 // Baja temperatura para análisis preciso y JSON estricto
          })
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        
        if (response.ok && data.choices?.[0]?.message?.content) {
          return res.status(200).json({
            candidates: [{ content: { parts: [{ text: data.choices[0].message.content }] } }]
          });
        }
        lastError = data.error?.message || "Error de respuesta";
      } catch (e) {
        clearTimeout(timeoutId);
        lastError = e.name === 'AbortError' ? `Modelo ${model} tardó demasiado` : e.message;
        console.warn(`Saltando modelo ${model} en WRITING: ${lastError}`);
        continue;
      }
    }
    throw new Error(lastError || "No hay modelos disponibles");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}