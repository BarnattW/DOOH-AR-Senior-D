export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const backend = process.env.DETECT_API_BACKEND;
  if (!backend) {
    return res.status(500).json({ error: "DETECT_API_BACKEND env var not set" });
  }

  const url = `${backend.replace(/\/$/, "")}/detect`;

  try {
    const headers = { ...req.headers };
    delete headers.host;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: req,
      duplex: "half",
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    console.error("Detect proxy error:", e);
    res.status(502).json({ error: "Proxy request failed" });
  }
}
