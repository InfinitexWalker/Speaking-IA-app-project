// /api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Modelos ordenados por velocidad y estabilidad
  // Los primeros son los más confiables para conversación rápida
  const CHAT_MODELS = [
    "poolside/laguna-xs.2:free",
    "baidu/cobuddy:free",
    "inclusionai/ring-2.6-1t:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "openrouter/owl-alpha",
  ];

  const TIMEOUT_MS = 8000; // 8 segundos por modelo

  try {
    // Validar y convertir el formato de mensajes
    const rawContents = req.body?.contents;
    if (!Array.isArray(rawContents) || rawContents.length === 0) {
      return res.status(400).json({ error: 'Invalid request: contents must be a non-empty array' });
    }

    const messages = rawContents.map(m => {
      const roleMap = { model: 'assistant', system: 'system', user: 'user' };
      const role = roleMap[m.role] || 'user';
      const rawText = m.parts?.[0]?.text;
      const content = typeof rawText === 'string' ? rawText : JSON.stringify(rawText ?? '');
      return { role, content };
    });

    let lastError = null;

    for (const model of CHAT_MODELS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000",
            "X-Title": "Speaking Pro Chat"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 600,  // Limitar tokens para respuestas más rápidas
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          lastError = errBody.error?.message || `HTTP ${response.status}`;
          console.warn(`Modelo ${model} falló con status ${response.status}: ${lastError}`);
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (content) {
          return res.status(200).json({
            candidates: [{ content: { parts: [{ text: content }] } }]
          });
        }

        lastError = "Respuesta vacía del modelo";

      } catch (e) {
        clearTimeout(timeoutId);
        lastError = e.name === 'AbortError'
          ? `Modelo ${model} superó el tiempo límite (${TIMEOUT_MS / 1000}s)`
          : e.message;
        console.warn(`Saltando modelo ${model}: ${lastError}`);
      }
    }

    // Todos los modelos fallaron
    res.status(503).json({ error: lastError || "Todos los modelos no disponibles. Inténtalo de nuevo." });

  } catch (error) {
    console.error("Error interno en /api/chat:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
}
