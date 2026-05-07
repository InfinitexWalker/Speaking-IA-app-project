// chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  // Usamos los modelos más rápidos que encontraste para evitar esperas largas
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

    // FIX: Cambiado de CHAT_MODELS a ANALYZE_MODELS
    for (const model of ANALYZE_MODELS) {
      // 1. Creamos un controlador para abortar la petición si tarda mucho
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos máximo por modelo

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Speaking Pro Chat"
          },
          signal: controller.signal, // 2. Conectamos la señal de aborto
          body: JSON.stringify({
            "model": model,
            "messages": messages,
            "temperature": 0.8
          })
        });

        clearTimeout(timeoutId); // Limpiamos el timeout si respondió a tiempo

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
        console.warn(`Saltando modelo ${model}: ${lastError}`);
        continue; // Pasa al siguiente modelo si este falló o tardó mucho
      }
    }
    throw new Error(lastError || "No hay modelos disponibles");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}