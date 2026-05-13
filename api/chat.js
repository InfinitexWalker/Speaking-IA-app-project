// /api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  // Modelos optimizados para CONVERSACIÓN RÁPIDA
  const CHAT_MODELS = [
  "inclusionai/ring-2.6-1t:free",
  "baidu/cobuddy:free",      
  "openrouter/owl-alpha", 
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",            
  "poolside/laguna-xs.2:free"   
  ];

  try {
    const messages = req.body.contents.map(m => ({
      role: m.role === 'model' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
      content: typeof m.parts[0].text === 'string' ? m.parts[0].text : JSON.stringify(m.parts[0].text)
  }));

    let lastError = null;

    for (const model of CHAT_MODELS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos para chat (queremos velocidad)

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Speaking Pro Chat"
          },
          signal: controller.signal,
          body: JSON.stringify({
            "model": model,
            "messages": messages,
            "temperature": 0.7 // Un poco de creatividad para la charla
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
        console.warn(`Saltando modelo ${model} en CHAT: ${lastError}`);
        continue;
      }
    }
    throw new Error(lastError || "No hay modelos disponibles");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}