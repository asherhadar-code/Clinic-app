// api/wa-setup.js — TEMPORARY. Delete after running once.
// Subscribes the app to the clinic's WhatsApp Business Account, then confirms.
//
// Run:  https://clinic-app-ten-drab.vercel.app/api/wa-setup?key=<WHATSAPP_VERIFY_TOKEN>

const GRAPH = "https://graph.facebook.com/v27.0";
const WABA_ID = "1673196954155975";

async function graph(path, token, method = "GET") {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, { method });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data.error, data, error: data.error?.message };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.WHATSAPP_VERIFY_TOKEN || req.query.key !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(403).json({ error: "Forbidden: missing or wrong ?key=" });
  }

  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return res.status(500).json({ error: "WHATSAPP_TOKEN is not set in Vercel" });

  try {
    const sub = await graph(`${WABA_ID}/subscribed_apps`, token, "POST");
    const check = await graph(`${WABA_ID}/subscribed_apps`, token);

    return res.status(200).json({
      waba_id: WABA_ID,
      subscribe: { ok: sub.ok, response: sub.data, error: sub.error },
      confirm: {
        ok: check.ok,
        apps: (check.data?.data || []).map((a) => ({
          id: a.whatsapp_business_api_data?.id,
          name: a.whatsapp_business_api_data?.name,
        })),
        error: check.error,
      },
      result: sub.ok ? "✅ Subscribed" : "❌ Subscribe failed",
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
