// api/wa-setup.js — TEMPORARY. Delete after running once.
//
// 1. Inspects WHATSAPP_TOKEN with debug_token and reads granular_scopes
//    to find the WhatsApp Business Account (WABA) IDs it can access.
// 2. Finds the WABA that owns our phone number (WHATSAPP_PHONE_NUMBER_ID).
// 3. POST /{WABA_ID}/subscribed_apps, then reads the list back to confirm.
//
// Run:  https://clinic-app-ten-drab.vercel.app/api/wa-setup?key=<WHATSAPP_VERIFY_TOKEN>
//
// Needs env vars: WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID

const GRAPH = "https://graph.facebook.com/v27.0";

async function graph(path, token, options = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data.error, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Simple protection — this URL is public
  if (!process.env.WHATSAPP_VERIFY_TOKEN || req.query.key !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(403).json({ error: "Forbidden: missing or wrong ?key=" });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1492392977283786";
  const fallbackWaba = "1739632388174337";
  if (!token) return res.status(500).json({ error: "WHATSAPP_TOKEN is not set in Vercel" });

  const report = { steps: [] };

  try {
    // Step 1: debug_token → granular_scopes
    const dbg = await graph(`debug_token?input_token=${encodeURIComponent(token)}`, token);
    const info = dbg.data?.data || {};
    const scopes = info.granular_scopes || [];
    report.steps.push({
      step: "debug_token",
      ok: dbg.ok,
      is_valid: info.is_valid,
      type: info.type,
      app_id: info.app_id,
      expires_at: info.expires_at === 0 ? "never" : info.expires_at,
      scopes: info.scopes,
      granular_scopes: scopes,
      error: dbg.data?.error?.message,
    });
    if (!dbg.ok || info.is_valid === false) {
      return res.status(200).json({ ...report, result: "Token is invalid — stop here" });
    }

    // Collect WABA IDs from whatsapp_* scopes
    const candidates = new Set();
    for (const s of scopes) {
      if (String(s.scope).startsWith("whatsapp_")) (s.target_ids || []).forEach((id) => candidates.add(String(id)));
    }
    if (candidates.size === 0) candidates.add(fallbackWaba); // token not restricted → try the known ID
    report.candidate_waba_ids = [...candidates];

    // Step 2: find the WABA that owns our phone number
    let wabaId = null;
    const checked = [];
    for (const id of candidates) {
      const acc = await graph(`${id}?fields=id,name`, token);
      const phones = await graph(`${id}/phone_numbers?fields=id,display_phone_number,verified_name`, token);
      const list = phones.data?.data || [];
      const hasOurNumber = list.some((p) => String(p.id) === String(phoneId));
      checked.push({
        id,
        name: acc.data?.name,
        phone_numbers: list.map((p) => ({ id: p.id, number: p.display_phone_number, name: p.verified_name })),
        has_our_number: hasOurNumber,
        error: acc.data?.error?.message || phones.data?.error?.message,
      });
      if (hasOurNumber && !wabaId) wabaId = id;
    }
    report.steps.push({ step: "find_waba", checked });

    if (!wabaId) {
      return res.status(200).json({ ...report, result: `No WABA found containing phone number ID ${phoneId}` });
    }
    report.waba_id = wabaId;

    // Step 3: subscribe the app to the WABA
    const sub = await graph(`${wabaId}/subscribed_apps`, token, { method: "POST" });
    report.steps.push({ step: "subscribe", ok: sub.ok, response: sub.data });

    // Step 4: confirm
    const check = await graph(`${wabaId}/subscribed_apps`, token);
    report.steps.push({
      step: "confirm",
      ok: check.ok,
      subscribed_apps: (check.data?.data || []).map((a) => a.whatsapp_business_api_data?.name || a.whatsapp_business_api_data?.id || a),
      error: check.data?.error?.message,
    });

    report.result = sub.ok
      ? `✅ Subscribed. Real WABA ID is ${wabaId}${wabaId !== fallbackWaba ? " (different from 167319694155975)" : ""}`
      : "❌ Subscribe failed — see steps";
    return res.status(200).json(report);
  } catch (e) {
    return res.status(500).json({ ...report, error: e.message });
  }
}
