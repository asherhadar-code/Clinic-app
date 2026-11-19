// api/wa-setup.js — TEMPORARY. Delete after running once.
//
// Finds the real WhatsApp Business Account (WABA) that owns our phone number,
// then POST /{WABA_ID}/subscribed_apps and confirms.
//
// Sources for candidate IDs:
//   - debug_token granular_scopes target_ids
//   - ?id=... from the URL (can be a WABA ID or a Business portfolio ID)
//   - if an ID is a Business portfolio: its owned_ / client_whatsapp_business_accounts
//
// Run:  https://clinic-app-ten-drab.vercel.app/api/wa-setup?key=<WHATSAPP_VERIFY_TOKEN>&id=1739632388174337
//
// Needs env vars: WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_NUMBER_ID

const GRAPH = "https://graph.facebook.com/v27.0";

async function graph(path, token, options = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data.error, status: res.status, data, error: data.error?.message };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.WHATSAPP_VERIFY_TOKEN || req.query.key !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(403).json({ error: "Forbidden: missing or wrong ?key=" });
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1492392977283786";
  if (!token) return res.status(500).json({ error: "WHATSAPP_TOKEN is not set in Vercel" });

  const report = { steps: [] };

  try {
    // 1) Token info
    const dbg = await graph(`debug_token?input_token=${encodeURIComponent(token)}`, token);
    const info = dbg.data?.data || {};
    report.steps.push({
      step: "debug_token",
      is_valid: info.is_valid,
      type: info.type,
      granular_scopes: info.granular_scopes,
      error: dbg.error,
    });
    if (!dbg.ok || info.is_valid === false) return res.status(200).json({ ...report, result: "Token is invalid" });

    // 2) Can the token see the phone number at all?
    const phone = await graph(`${phoneId}?fields=id,display_phone_number,verified_name`, token);
    report.steps.push({ step: "phone_number", ok: phone.ok, data: phone.ok ? phone.data : undefined, error: phone.error });

    // 3) Collect starting IDs
    const start = new Set();
    for (const s of info.granular_scopes || []) (s.target_ids || []).forEach((id) => start.add(String(id)));
    String(req.query.id || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((id) => start.add(id));
    if (start.size === 0) return res.status(200).json({ ...report, result: "No IDs to check — add &id=... to the URL" });

    // 4) Expand: each ID may be a WABA or a Business portfolio
    const wabas = new Set();
    const expand = [];
    for (const id of start) {
      const meta = await graph(`${id}?metadata=1&fields=id,name`, token);
      const kind = meta.data?.metadata?.type || null;
      const entry = { id, name: meta.data?.name, kind, error: meta.error };

      if (kind === "whatsapp_business_account") {
        wabas.add(id);
      } else {
        // Try as Business portfolio
        const owned = await graph(`${id}/owned_whatsapp_business_accounts?fields=id,name`, token);
        const client = await graph(`${id}/client_whatsapp_business_accounts?fields=id,name`, token);
        const found = [...(owned.data?.data || []), ...(client.data?.data || [])];
        found.forEach((w) => wabas.add(String(w.id)));
        entry.wabas_under_it = found;
        entry.owned_error = owned.error;
        entry.client_error = client.error;
        if (!found.length && !kind) wabas.add(id); // last resort: treat as WABA
      }
      expand.push(entry);
    }
    report.steps.push({ step: "resolve_ids", checked: expand, waba_candidates: [...wabas] });

    // 5) Find the WABA with our phone number
    let wabaId = null;
    const checked = [];
    for (const id of wabas) {
      const phones = await graph(`${id}/phone_numbers?fields=id,display_phone_number,verified_name`, token);
      const list = phones.data?.data || [];
      const has = list.some((p) => String(p.id) === String(phoneId));
      checked.push({
        id,
        phone_numbers: list.map((p) => ({ id: p.id, number: p.display_phone_number, name: p.verified_name })),
        has_our_number: has,
        error: phones.error,
      });
      if (has && !wabaId) wabaId = id;
    }
    report.steps.push({ step: "find_waba", checked });
    if (!wabaId) return res.status(200).json({ ...report, result: `No WABA found containing phone number ID ${phoneId}` });
    report.waba_id = wabaId;

    // 6) Subscribe + confirm
    const sub = await graph(`${wabaId}/subscribed_apps`, token, { method: "POST" });
    report.steps.push({ step: "subscribe", ok: sub.ok, response: sub.data });

    const check = await graph(`${wabaId}/subscribed_apps`, token);
    report.steps.push({ step: "confirm", ok: check.ok, subscribed_apps: check.data?.data, error: check.error });

    report.result = sub.ok ? `✅ Subscribed. Real WABA ID is ${wabaId}` : "❌ Subscribe failed — see steps";
    return res.status(200).json(report);
  } catch (e) {
    return res.status(500).json({ ...report, error: e.message });
  }
}
