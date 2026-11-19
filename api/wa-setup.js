// api/wa-setup.js — TEMPORARY. Delete after use.
// Lists the WhatsApp Business Accounts (WABAs) and their phone numbers
// visible to WHATSAPP_TOKEN. Read-only: does not change anything.
//
// Run:  https://clinic-app-ten-drab.vercel.app/api/wa-setup?key=<WHATSAPP_VERIFY_TOKEN>
// Optional: &business=<BUSINESS_ID> (default 1150313484252152)

const GRAPH = "https://graph.facebook.com/v27.0";

async function graph(path, token) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data.error, data, error: data.error?.message };
}

async function phonesFor(wabaId, token) {
  const r = await graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, token);
  return {
    phone_numbers: (r.data?.data || []).map((p) => ({
      id: p.id,
      number: p.display_phone_number,
      name: p.verified_name,
    })),
    error: r.error,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.WHATSAPP_VERIFY_TOKEN || req.query.key !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(403).json({ error: "Forbidden: missing or wrong ?key=" });
  }

  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return res.status(500).json({ error: "WHATSAPP_TOKEN is not set in Vercel" });

  const businessId = String(req.query.business || "1150313484252152");
  const report = { business_id: businessId, sources: [], wabas: [] };
  const seen = new Set();

  const addWabas = async (source, list) => {
    for (const w of list) {
      const id = String(w.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const phones = await phonesFor(id, token);
      report.wabas.push({ source, id, name: w.name, ...phones });
    }
  };

  try {
    // 1) Business → owned WABAs
    const owned = await graph(`${businessId}/owned_whatsapp_business_accounts?fields=id,name`, token);
    report.sources.push({ source: "owned_whatsapp_business_accounts", count: owned.data?.data?.length || 0, error: owned.error });
    await addWabas("owned", owned.data?.data || []);

    // 2) Fallbacks if nothing found
    if (report.wabas.length === 0) {
      const businesses = await graph(`me/businesses?fields=id,name`, token);
      const bizList = businesses.data?.data || [];
      report.sources.push({
        source: "me/businesses",
        businesses: bizList.map((b) => ({ id: b.id, name: b.name })),
        error: businesses.error,
      });
      for (const b of bizList) {
        const o = await graph(`${b.id}/owned_whatsapp_business_accounts?fields=id,name`, token);
        report.sources.push({ source: `${b.id}/owned_whatsapp_business_accounts`, count: o.data?.data?.length || 0, error: o.error });
        await addWabas(`business ${b.id}`, o.data?.data || []);
      }

      const assigned = await graph(`me/assigned_whatsapp_business_accounts?fields=id,name`, token);
      report.sources.push({ source: "me/assigned_whatsapp_business_accounts", count: assigned.data?.data?.length || 0, error: assigned.error });
      await addWabas("assigned", assigned.data?.data || []);
    }

    report.result = report.wabas.length
      ? `Found ${report.wabas.length} WABA(s)`
      : "No WABAs found — see sources for errors";
    return res.status(200).json(report);
  } catch (e) {
    return res.status(500).json({ ...report, error: e.message });
  }
}
