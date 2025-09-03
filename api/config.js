// /api/config.js
module.exports = async (req, res) => {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Soporta nombres distintos (Upstash/KV)
  const BASE =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL;
  const TOKEN =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!BASE || !TOKEN) {
    return res.status(500).json({ error: "Faltan variables de Upstash (REST_URL/REST_TOKEN)." });
  }

  // Helper para llamar a Upstash REST
  const doFetch = (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

  if (req.method === "GET") {
    const r = await doFetch(`/hgetall/app:whatsapp`);
    const j = await r.json();
    let number, message;
    const out = j.result;

    if (Array.isArray(out)) {
      for (let i = 0; i < out.length; i += 2) {
        if (out[i] === "number") number = out[i + 1];
        if (out[i] === "message") message = out[i + 1];
      }
    } else if (out && typeof out === "object") {
      number = out.number; message = out.message;
    }

    return res.status(200).json({
      number: number || "543821450244",
      message: message || "¡Buen4s! Me gust4rí4 cre4r un usu4rio. Mi nombre es:",
    });
  }

  if (req.method === "POST") {
    const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!auth || auth !== process.env.ADMIN_TOKEN)
      return res.status(401).json({ error: "Unauthorized" });

    try {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body);
      const { number, message } = body || {};

      if (!number || !/^\d{8,16}$/.test(number))
        return res.status(400).json({ error: "Número inválido. Formato internacional sin +." });
      if (!message || typeof message !== "string" || message.length < 4)
        return res.status(400).json({ error: "Mensaje inválido." });

      // Guardar ambos campos en una pipeline
      const r = await doFetch(`/pipeline`, {
        method: "POST",
        body: JSON.stringify({
          commands: [
            ["HSET", "app:whatsapp", "number", number],
            ["HSET", "app:whatsapp", "message", message],
          ],
        }),
      });

      if (!r.ok) return res.status(500).json({ error: "Upstash error", detail: await r.text() });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Server error", detail: String(e) });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
};
