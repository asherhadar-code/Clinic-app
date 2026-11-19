// api/whatsapp-webhook.js
// WhatsApp Cloud API (Meta) webhook:
//   GET  — verification handshake with Meta
//   POST — incoming messages → forwarded by email
//
// Environment variables (Vercel → Settings → Environment Variables):
//   WHATSAPP_VERIFY_TOKEN     — any secret string you choose; type the same one in Meta
//   WHATSAPP_PHONE_NUMBER_ID  — 1492392977283786
//   GMAIL_USER                — the Gmail address that sends the emails
//   GMAIL_APP_PASSWORD        — Gmail "App password" (not the regular password)
//   FORWARD_EMAIL_TO          — where messages are forwarded
//   VITE_SUPABASE_URL / VITE_SUPABASE_KEY — already used by the app (for patient name lookup)

import nodemailer from "nodemailer";

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1492392977283786";

// ---------- helpers ----------

const lastDigits = (s, n = 9) => String(s || "").replace(/\D/g, "").slice(-n);

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Pretty Israeli format: 972501234567 → 050-1234567
const prettyPhone = (waId) => {
  const d = String(waId || "").replace(/\D/g, "");
  if (d.startsWith("972") && d.length >= 11) {
    const local = "0" + d.slice(3);
    return local.slice(0, 3) + "-" + local.slice(3);
  }
  return "+" + d;
};

// Find patient in Supabase by phone (matches the last 9 digits of any field)
async function findPatientByPhone(waId) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url}/rest/v1/patients?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const patients = await res.json();
    const target = lastDigits(waId);
    if (!Array.isArray(patients) || target.length < 9) return null;

    return (
      patients.find((p) =>
        Object.values(p).some(
          (v) => (typeof v === "string" || typeof v === "number") && lastDigits(v) === target
        )
      ) || null
    );
  } catch (e) {
    console.error("Supabase lookup failed:", e.message);
    return null;
  }
}

// Turn any message type into readable Hebrew text
function describeMessage(msg) {
  switch (msg.type) {
    case "text":
      return msg.text?.body || "";
    case "image":
      return "📷 תמונה" + (msg.image?.caption ? `: ${msg.image.caption}` : "");
    case "video":
      return "🎥 סרטון" + (msg.video?.caption ? `: ${msg.video.caption}` : "");
    case "audio":
      return msg.audio?.voice ? "🎤 הודעה קולית" : "🎵 קובץ שמע";
    case "document":
      return "📄 מסמך" + (msg.document?.filename ? `: ${msg.document.filename}` : "");
    case "sticker":
      return "😀 סטיקר";
    case "location":
      return `📍 מיקום: ${msg.location?.latitude}, ${msg.location?.longitude}`;
    case "contacts":
      return "👤 איש קשר";
    case "button":
      return `🔘 לחצה על: ${msg.button?.text || ""}`;
    case "interactive":
      return (
        "🔘 בחרה: " +
        (msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "")
      );
    case "reaction":
      return `תגובה: ${msg.reaction?.emoji || ""}`;
    default:
      return `הודעה מסוג ${msg.type}`;
  }
}

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

async function forwardByEmail({ name, phone, content, time, isKnownPatient }) {
  const to = process.env.FORWARD_EMAIL_TO;
  if (!to) throw new Error("FORWARD_EMAIL_TO is not set");

  const subject = `הודעת וואטסאפ מ${name}`;
  const text =
    `שם: ${name}${isKnownPatient ? "" : " (לא נמצאה ברשימת המטופלים)"}\n` +
    `טלפון: ${phone}\n` +
    `זמן: ${time}\n\n` +
    `תוכן ההודעה:\n${content}`;

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
      <p><b>שם:</b> ${escapeHtml(name)}${isKnownPatient ? "" : " <i>(לא נמצאה ברשימת המטופלים)</i>"}</p>
      <p><b>טלפון:</b> ${escapeHtml(phone)}</p>
      <p><b>זמן:</b> ${escapeHtml(time)}</p>
      <hr/>
      <p><b>תוכן ההודעה:</b></p>
      <p style="white-space:pre-wrap">${escapeHtml(content)}</p>
    </div>`;

  await getTransporter().sendMail({
    from: `"ClinicUp WhatsApp" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

// ---------- handler ----------

export default async function handler(req, res) {
  // 1) Verification handshake (Meta sends GET when you save the webhook)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  // 2) Incoming events
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (body?.object !== "whatsapp_business_account") return res.status(200).send("ignored");

    const jobs = [];

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Only messages sent to our number (ignore delivery/read statuses)
       

        for (const msg of value.messages) {
          const contact = (value.contacts || []).find((c) => c.wa_id === msg.from) || {};
          jobs.push(
            (async () => {
              const patient = await findPatientByPhone(msg.from);
              const name = patient?.name || contact.profile?.name || "לא ידוע";
              const time = new Date(Number(msg.timestamp) * 1000).toLocaleString("he-IL", {
                timeZone: "Asia/Jerusalem",
              });

              await forwardByEmail({
                name,
                phone: prettyPhone(msg.from),
                content: describeMessage(msg),
                time,
                isKnownPatient: Boolean(patient),
              });
              console.log(`Forwarded message ${msg.id} from ${msg.from}`);
            })()
          );
        }
      }
    }

    // Finish the work before responding (Vercel may freeze the function after the response)
    const results = await Promise.allSettled(jobs);
    results
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.error("Forward failed:", r.reason?.message || r.reason));

    // Always 200 so Meta doesn't keep retrying
    return res.status(200).send("ok");
  } catch (e) {
    console.error("Webhook error:", e.message);
    return res.status(200).send("ok");
  }
}
