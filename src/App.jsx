import { useState, useRef, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// ── Supabase client ────────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const sb = {
  async getPatients() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=*,sessions(*)&order=created_at.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(p => ({
      id: String(p.id || ""),
      firstName: String(p.first_name || ""),
      lastName: String(p.last_name || ""),
      name: String(p.name || ((p.first_name || "") + " " + (p.last_name || "")).trim()),
      gender: String(p.gender || ""),
      age: p.birth_date ? String(calcAge(p.birth_date).replace("גיל: ","")) : "",
      birthDate: String(p.birth_date || ""),
      idNumber: String(p.id_number || ""),
      diagnosis: String(p.diagnosis || ""),
      phone: String(p.phone || ""),
      email: String(p.email || ""),
      parentName: String(p.parent_name || ""),
      nextAppt: String(p.next_appt || "טרם נקבע"),
      sessions: typeof p.sessions === 'number' ? p.sessions : 0,
      paid: p.paid === true,
      history: (Array.isArray(p.sessions) ? p.sessions : [])
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
        .map(s => ({ date: String(s.date || ""), summary: String(s.summary || "") })),
    }));
  },
  async addPatient(p) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/patients`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ first_name: p.firstName, last_name: p.lastName, name: p.name, gender: p.gender, birth_date: p.birthDate, id_number: p.idNumber, diagnosis: p.diagnosis, phone: p.phone, email: p.email, parent_name: p.parentName, next_appt: p.nextAppt, sessions: 0, paid: false })
    });
    const data = await res.json();
    return data[0];
  },
  async updatePatient(id, p) {
    await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: p.firstName, last_name: p.lastName, name: p.name, gender: p.gender, birth_date: p.birthDate, id_number: p.idNumber, diagnosis: p.diagnosis, phone: p.phone, email: p.email, parent_name: p.parentName, next_appt: p.nextAppt, paid: p.paid })
    });
  },
  async deletePatient(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async addSession(patientId, date, summary) {
    await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId, date, summary })
    });
    // Update session count
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?patient_id=eq.${patientId}&select=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const sessions = await res.json();
    await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${patientId}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: sessions.length })
    });
  },
  async markPaid(id, paid) {
    await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paid })
    });
  },
  async getAppointments() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?select=*&order=day_index.asc,start_time.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async addAppointment(apt) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ 
        patient_id: apt.patientId || null, 
        patient_name: apt.patientName || null, 
        day_index: apt.dayIndex, 
        start_time: apt.startTime || "00:00", 
        status: apt.status || "pending",
        block_type: apt.blockType || "treatment",
        minutes: apt.minutes || 45
      })
    });
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  },
  async deleteAppointment(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async updateAppointmentStatus(id, status) {
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
  },
  async getDocumentBank() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/document_bank?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    return await res.json();
  },
  async addDocumentBank(doc) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/document_bank`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ category: doc.category, name: doc.name, size: doc.size, date: doc.date, extracted_text: doc.extracted_text || null })
    });
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  },
  async deleteDocumentBank(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/document_bank?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  }
};
const GI_KEY    = import.meta.env.VITE_GI_KEY || "";
const GI_SECRET = import.meta.env.VITE_GI_SECRET || "";

// ── Palette & globals ──────────────────────────────────────────────
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --cream: #F7F3EE;
  --warm: #EDE5D8;
  --sage: #8FAF8F;
  --sage-light: #C4D9C4;
  --sage-dark: #5A7A5A;
  --terracotta: #C4724A;
  --text: #2C2C2C;
  --text-soft: #6B6460;
  --white: #FFFFFF;
  --shadow: 0 2px 20px rgba(44,44,44,0.08);
  --radius: 16px;
}

body {
  font-family: 'DM Sans', sans-serif;
  background: var(--cream);
  color: var(--text);
  min-height: 100vh;
  direction: rtl;
}

h1,h2,h3,h4 { font-family: 'Fraunces', serif; font-weight: 300; }

.app {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
.sidebar {
  width: 220px;
  background: var(--sage-dark);
  color: var(--cream);
  display: flex;
  flex-direction: column;
  padding: 32px 0;
  flex-shrink: 0;
}
.sidebar-logo {
  padding: 0 24px 32px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  margin-bottom: 16px;
}
.sidebar-logo h2 { font-size: 1.3rem; color: var(--cream); line-height: 1.3; }
.sidebar-logo p { font-size: 0.75rem; opacity: 0.65; margin-top: 4px; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
  border-right: 3px solid transparent;
}
.nav-item:hover { background: rgba(255,255,255,0.08); }
.nav-item.active {
  background: rgba(255,255,255,0.15);
  border-right-color: var(--sage-light);
  font-weight: 500;
}
.nav-icon { font-size: 1.1rem; }

/* ── Main ── */
.main {
  flex: 1;
  padding: 36px;
  overflow-y: auto;
  max-height: 100vh;
}

/* ── Mobile ── */
@media (max-width: 600px) {
  .app { flex-direction: column; }
  .sidebar {
    width: 100%; height: 60px;
    flex-direction: row;
    padding: 0;
    justify-content: space-around;
    align-items: center;
    position: fixed; bottom: 0; right: 0;
    z-index: 200;
    order: 2;
  }
  .sidebar-logo { display: none; }
  .nav-item {
    flex-direction: column; gap: 2px;
    padding: 6px 4px;
    font-size: 0.6rem;
    flex: 1; text-align: center;
    border-right: none;
    border-top: 3px solid transparent;
  }
  .nav-item.active {
    border-right: none;
    border-top: 3px solid var(--sage-light);
    background: rgba(255,255,255,0.15);
  }
  .nav-icon { font-size: 1.3rem; }
  .main {
    padding: 16px 14px;
    max-height: calc(100vh - 60px);
    order: 1;
  }
  .stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
  .stat-card { padding: 14px !important; }
  .stat-num { font-size: 1.5rem !important; }
  .card { padding: 14px !important; }
  .patient-row { flex-wrap: wrap; gap: 6px; }
  .modal-box { width: 96vw !important; max-height: 88vh; overflow-y: auto; margin: auto; }
  .page-title { font-size: 1.4rem !important; margin-bottom: 16px !important; }
  .ai-quick-btns { gap: 4px; }
  .ai-quick-btn { font-size: 0.7rem !important; padding: 4px 8px !important; }
  .week-grid { overflow-x: auto; }
  .btn { font-size: 0.78rem !important; padding: 8px 12px !important; }
  .btn-sm { font-size: 0.7rem !important; padding: 4px 8px !important; }
}

.page-title {
  font-size: 2rem;
  color: var(--sage-dark);
  margin-bottom: 28px;
}

/* ── Cards ── */
.card {
  background: var(--white);
  border-radius: var(--radius);
  padding: 24px;
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}
.card-title {
  font-size: 1.1rem;
  color: var(--sage-dark);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Dashboard stats ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--white);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
  text-align: center;
}
.stat-num { font-family: 'Fraunces', serif; font-size: 2.4rem; color: var(--sage-dark); }
.stat-label { font-size: 0.78rem; color: var(--text-soft); margin-top: 4px; }

/* ── Calendar ── */
.week-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}
.day-col { display: flex; flex-direction: column; gap: 8px; }
.day-header {
  text-align: center;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-soft);
  padding-bottom: 8px;
  border-bottom: 2px solid var(--warm);
}
.appt-chip {
  background: var(--sage-light);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  border-right: 3px solid var(--sage-dark);
}
.appt-chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(90,122,90,0.2); }
.appt-chip .appt-time { font-size: 0.7rem; color: var(--text-soft); }
.appt-chip .appt-name { font-weight: 500; }
.appt-chip.confirmed { background: #E8F5E8; border-right-color: #4CAF50; }
.appt-chip.pending { background: #FFF8E1; border-right-color: #FFC107; }

/* ── Patients ── */
.search-bar {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--warm);
  border-radius: 12px;
  font-size: 0.9rem;
  font-family: 'DM Sans', sans-serif;
  background: var(--cream);
  margin-bottom: 20px;
  outline: none;
  transition: border-color 0.2s;
  direction: rtl;
}
.search-bar:focus { border-color: var(--sage); }

.patient-list { display: flex; flex-direction: column; gap: 12px; }
.patient-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--white);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: transform 0.15s;
}
.patient-row:hover { transform: translateX(-4px); }
.patient-avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: var(--sage-light);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Fraunces', serif;
  font-size: 1.1rem;
  color: var(--sage-dark);
  flex-shrink: 0;
}
.patient-info { flex: 1; }
.patient-name { font-weight: 500; }
.patient-meta { font-size: 0.78rem; color: var(--text-soft); margin-top: 2px; }
.patient-status {
  font-size: 0.72rem;
  padding: 4px 10px;
  border-radius: 20px;
  background: var(--sage-light);
  color: var(--sage-dark);
  font-weight: 500;
}

/* ── Patient Detail ── */
.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.85rem; color: var(--sage-dark);
  cursor: pointer; margin-bottom: 20px;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}
.back-btn:hover { background: var(--warm); }

.tabs { display: flex; gap: 4px; margin-bottom: 20px; }
.tab {
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  color: var(--text-soft);
}
.tab.active { background: var(--sage-dark); color: var(--white); }
.tab:not(.active):hover { background: var(--warm); }

.session-list { display: flex; flex-direction: column; gap: 12px; }
.session-item {
  border-right: 3px solid var(--sage-light);
  padding: 14px 16px;
  background: var(--cream);
  border-radius: 0 12px 12px 0;
}
.session-date { font-size: 0.78rem; color: var(--text-soft); margin-bottom: 6px; }
.session-summary { font-size: 0.88rem; line-height: 1.6; }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  direction: rtl;
}
.modal {
  background: var(--white);
  border-radius: 20px;
  padding: 32px;
  width: 520px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  animation: slideUp 0.25s ease;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.modal h3 { font-size: 1.4rem; color: var(--sage-dark); margin-bottom: 20px; }

/* ── Buttons ── */
.btn {
  padding: 10px 22px;
  border-radius: 12px;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary { background: var(--sage-dark); color: var(--white); }
.btn-primary:hover { background: var(--sage); }
.btn-secondary { background: var(--warm); color: var(--text); }
.btn-secondary:hover { background: var(--sage-light); }
.btn-danger { background: #FBE8E3; color: var(--terracotta); }
.btn-danger:hover { background: #F5D0C5; }
.btn-sm { padding: 6px 14px; font-size: 0.8rem; }

/* ── Textarea / Input ── */
.field {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--warm);
  border-radius: 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.88rem;
  background: var(--cream);
  outline: none;
  transition: border-color 0.2s;
  direction: rtl;
  resize: vertical;
}
.field:focus { border-color: var(--sage); }
.field-label { font-size: 0.8rem; color: var(--text-soft); margin-bottom: 6px; margin-top: 14px; }

/* ── AI bubble ── */
.ai-box {
  background: linear-gradient(135deg, #E8F0E8, #F0EDE8);
  border-radius: 14px;
  padding: 18px;
  border-right: 4px solid var(--sage);
  font-size: 0.88rem;
  line-height: 1.7;
  white-space: pre-wrap;
}
.ai-loading { display: flex; gap: 6px; align-items: center; color: var(--text-soft); font-size: 0.85rem; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sage); animation: bounce 0.8s infinite; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-6px); } }

/* ── Receipt ── */
.receipt-preview {
  border: 2px dashed var(--warm);
  border-radius: 14px;
  padding: 24px;
  background: var(--cream);
  font-size: 0.88rem;
  line-height: 1.8;
}
.receipt-preview h4 { font-size: 1.1rem; text-align: center; margin-bottom: 12px; color: var(--sage-dark); }
.receipt-row { display: flex; justify-content: space-between; padding: 4px 0; }
.receipt-divider { border: none; border-top: 1px dashed var(--text-soft); margin: 12px 0; }
.receipt-total { font-weight: 600; font-size: 1rem; }

/* ── Notification banner ── */
.banner {
  background: var(--sage-dark);
  color: var(--cream);
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.flex { display: flex; }
.gap-3 { gap: 12px; }
.mt-3 { margin-top: 12px; }
.mt-2 { margin-top: 8px; }
.text-soft { color: var(--text-soft); font-size: 0.82rem; }

/* ── File Upload ── */
.upload-zone {
  border: 2px dashed var(--sage);
  border-radius: 14px;
  padding: 28px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  background: var(--cream);
  margin-top: 14px;
}
.upload-zone:hover, .upload-zone.drag-over {
  background: var(--sage-light);
  border-color: var(--sage-dark);
}
.upload-zone .upload-icon { font-size: 2rem; margin-bottom: 8px; }
.upload-zone p { font-size: 0.85rem; color: var(--text-soft); }
.upload-zone strong { color: var(--sage-dark); }

.doc-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.doc-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  background: var(--white);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.doc-icon { font-size: 1.4rem; }
.doc-info { flex: 1; }
.doc-name { font-size: 0.88rem; font-weight: 500; }
.doc-meta { font-size: 0.75rem; color: var(--text-soft); margin-top: 2px; }
.doc-type-badge {
  font-size: 0.7rem; padding: 3px 8px;
  border-radius: 20px; font-weight: 500;
}
.doc-type-report { background: #E8F0FF; color: #3A5FCC; }
.doc-type-summary { background: #E8F5E8; color: #3A7A3A; }
.doc-type-other { background: var(--warm); color: var(--text-soft); }

/* ── Interactive Calendar ── */
.cal-toolbar {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 20px; flex-wrap: wrap;
}
.cal-toolbar label { font-size: 0.8rem; color: var(--text-soft); margin-left: 4px; }
.cal-toolbar input[type="time"] {
  padding: 7px 10px; border: 2px solid var(--warm);
  border-radius: 10px; font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem; background: var(--cream);
  direction: ltr; outline: none;
}
.cal-toolbar input[type="time"]:focus { border-color: var(--sage); }

.time-grid { display: flex; gap: 0; }
.time-labels {
  display: flex; flex-direction: column;
  padding-top: 36px; margin-left: 8px; flex-shrink: 0;
}
.time-label {
  height: 56px; font-size: 0.72rem; color: var(--text-soft);
  display: flex; align-items: flex-start; padding-top: 2px;
  width: 42px; text-align: left;
}
.days-cols { display: flex; flex: 1; gap: 6px; overflow-x: auto; }
.day-column { flex: 1; min-width: 100px; }
.day-head {
  text-align: center; font-size: 0.78rem; font-weight: 500;
  color: var(--text-soft); padding: 8px 4px; height: 36px;
  border-bottom: 2px solid var(--warm); margin-bottom: 0;
}
.time-slot {
  height: 56px; border-bottom: 1px solid var(--warm);
  position: relative; cursor: pointer;
  transition: background 0.12s;
}
.time-slot:hover { background: rgba(143,175,143,0.12); }
.time-slot.break-slot {
  background: repeating-linear-gradient(45deg, #f5f0e8, #f5f0e8 4px, #ede5d8 4px, #ede5d8 8px);
  cursor: default;
}
.time-slot.break-slot:hover { background: repeating-linear-gradient(45deg, #f5f0e8, #f5f0e8 4px, #ede5d8 4px, #ede5d8 8px); }
.slot-appt {
  position: absolute; inset: 2px 3px;
  background: var(--sage-light);
  border-right: 3px solid var(--sage-dark);
  border-radius: 8px; padding: 4px 7px;
  font-size: 0.75rem; cursor: pointer;
  display: flex; flex-direction: column; justify-content: center;
  transition: transform 0.15s;
  z-index: 1;
}
.slot-appt:hover { transform: scale(1.02); box-shadow: 0 2px 8px rgba(90,122,90,0.25); }
.slot-appt .sa-time { font-size: 0.68rem; color: var(--text-soft); }
.slot-appt .sa-name { font-weight: 500; color: var(--sage-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slot-appt.confirmed { background: #E8F5E8; border-right-color: #4CAF50; }
.slot-appt.pending   { background: #FFF8E1; border-right-color: #FFC107; }
.break-label {
  font-size: 0.68rem; color: var(--text-soft);
  text-align: center; padding-top: 6px; pointer-events: none;
}

/* Patient picker popup */
.slot-picker {
  position: fixed; z-index: 200;
  background: var(--white); border-radius: 14px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
  padding: 16px; width: 260px;
  animation: slideUp 0.18s ease;
  direction: rtl;
}
.slot-picker h4 { font-size: 0.95rem; color: var(--sage-dark); margin-bottom: 10px; }
.picker-search { width: 100%; padding: 8px 10px; border: 1.5px solid var(--warm); border-radius: 9px; font-size: 0.82rem; font-family: 'DM Sans',sans-serif; margin-bottom: 8px; direction: rtl; outline: none; }
.picker-search:focus { border-color: var(--sage); }
.picker-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.picker-item { padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; transition: background 0.12s; }
.picker-item:hover { background: var(--sage-light); color: var(--sage-dark); font-weight: 500; }
.picker-break { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--warm); }
.picker-break-btn { width: 100%; padding: 8px; border-radius: 8px; background: var(--warm); border: none; font-family: 'DM Sans',sans-serif; font-size: 0.82rem; cursor: pointer; transition: background 0.12s; }
.picker-break-btn:hover { background: #d4c8b0; }

/* ── Documents Bank ── */
.doc-bank-tabs {
  display: flex; gap: 4px; margin-bottom: 20px;
  background: var(--warm); border-radius: 12px; padding: 4px;
}
.doc-bank-tab {
  flex: 1; text-align: center; padding: 10px;
  border-radius: 10px; cursor: pointer; font-size: 0.85rem;
  transition: all 0.15s; color: var(--text-soft);
}
.doc-bank-tab.active {
  background: var(--white); color: var(--sage-dark);
  font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.doc-bank-empty {
  text-align: center; padding: 40px 20px;
  color: var(--text-soft); font-size: 0.88rem;
}
.doc-bank-empty .empty-icon { font-size: 2.5rem; margin-bottom: 12px; }

/* ── AI Chat ── */
.ai-chat-box {
  display: flex; flex-direction: column; gap: 10px;
  max-height: 380px; overflow-y: auto; padding: 4px;
}
.ai-chat-msg {
  padding: 12px 14px; border-radius: 14px;
  font-size: 0.85rem; line-height: 1.6; max-width: 90%;
}
.ai-chat-msg.user {
  background: var(--sage-dark); color: white;
  align-self: flex-end; border-radius: 14px 14px 4px 14px;
}
.ai-chat-msg.assistant {
  background: var(--cream); border: 1px solid var(--warm);
  align-self: flex-start; border-radius: 14px 14px 14px 4px;
  white-space: pre-wrap;
}
.ai-quick-btns {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;
}
.ai-quick-btn {
  padding: 5px 12px; border-radius: 20px; border: 1.5px solid var(--sage);
  background: white; color: var(--sage-dark); font-size: 0.75rem;
  cursor: pointer; font-family: 'DM Sans', sans-serif;
  transition: all 0.15s;
}
.ai-quick-btn:hover { background: var(--sage-light); }

/* ── Recording ── */
.rec-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 18px; border-radius: 12px; border: none;
  font-family: 'DM Sans', sans-serif; font-size: 0.88rem;
  cursor: pointer; transition: all 0.2s; font-weight: 500;
}
.rec-btn.idle { background: var(--warm); color: var(--text); }
.rec-btn.recording { background: #FBE8E3; color: #C4724A; animation: pulse 1.2s infinite; }
.rec-btn.transcribing { background: var(--sage-light); color: var(--sage-dark); }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
.rec-timer { font-size: 0.8rem; color: var(--text-soft); margin-top: 6px; text-align: center; }

/* ── New Patient Form ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.form-group { display: flex; flex-direction: column; }
.form-group.full { grid-column: 1 / -1; }
.form-group label { font-size: 0.8rem; color: var(--text-soft); margin-bottom: 5px; }
.top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }

`;

// ── Sample Data ────────────────────────────────────────────────────
const INITIAL_PATIENTS = [
  { id: 1, name: "יוסי כהן", firstName: "יוסי", lastName: "כהן", gender: "זכר", age: 7, sessions: 24, diagnosis: "עיכוב בהתפתחות הדיבור", nextAppt: "מחר, 09:00", paid: true,
    history: [
      { date: "10/03/2025", summary: "עבדנו על הגיית האות ר'. הילד שיתף פעולה מצוין. התקדמות ניכרת. הומלץ על תרגול בבית." },
      { date: "03/03/2025", summary: "הפגישה עסקה בבניית אוצר מילים. השתמשנו בקלפי תמונות. הילד מחובר ומשתף פעולה." },
      { date: "24/02/2025", summary: "הגעה קצרה, הילד לא היה בכי טוב. עבדנו על תרגילי נשימה ורגיעה בלבד." },
    ]
  },
  { id: 2, name: "מיה לוי", firstName: "מיה", lastName: "לוי", gender: "נקבה", age: 9, sessions: 15, diagnosis: "גמגום", nextAppt: "מחר, 10:30", paid: false,
    history: [
      { date: "11/03/2025", summary: "פגישה ממוקדת בטכניקות האטה בדיבור. מיה ניסתה בהצלחה לדבר לאט יותר בסיטואציה מדומה." },
      { date: "04/03/2025", summary: "עבדנו על נשימה דיאפרגמטית. תרגיל הקריאה בקול מחוץ לחדר – הצלחה חלקית." },
    ]
  },
  { id: 3, name: "דניאל ברק", firstName: "דניאל", lastName: "ברק", gender: "זכר", age: 5, sessions: 8, diagnosis: "אף נזלת כרונית, קשיי בליעה", nextAppt: "יום ד', 11:00", paid: true,
    history: [
      { date: "09/03/2025", summary: "תרגילי שפתיים ולשון. דניאל שיתף פעולה ונהנה מהמשחקים. הורים דיווחו על שיפור בבית." },
    ]
  },
  { id: 4, name: "נועה שמיר", firstName: "נועה", lastName: "שמיר", gender: "נקבה", age: 6, sessions: 30, diagnosis: "דיסלקציה + קשיי קריאה", nextAppt: "יום ה', 14:00", paid: true,
    history: [
      { date: "12/03/2025", summary: "קראנו יחד ספר מותאם. נועה זיהתה 8/10 אותיות בהצלחה. התקדמות יפה." },
    ]
  },
  { id: 5, name: "עמיר גל", firstName: "עמיר", lastName: "גל", gender: "זכר", age: 8, sessions: 12, diagnosis: "קשיי ביטוי בעל פה", nextAppt: "יום ו', 09:30", paid: false,
    history: [
      { date: "06/03/2025", summary: "עמיר התקשה להתחיל את הפגישה. בסוף פתח ודיבר על תחביביו. עבדנו על משפטים שלמים." },
    ]
  },
];

const WEEK_DAYS = ["ראשון","שני","שלישי","רביעי","חמישי","שישי"];
const WEEK_APTS = {
  0: [{ name:"יוסי כהן", time:"09:00", status:"confirmed" }, { name:"נועה שמיר", time:"10:30", status:"pending" }],
  1: [{ name:"מיה לוי", time:"09:30", status:"pending" }, { name:"דניאל ברק", time:"11:00", status:"confirmed" }],
  2: [{ name:"עמיר גל", time:"08:30", status:"confirmed" }],
  3: [{ name:"יוסי כהן", time:"09:00", status:"pending" }, { name:"מיה לוי", time:"10:30", status:"confirmed" }],
  4: [],
  5: [{ name:"נועה שמיר", time:"09:30", status:"confirmed" }],
};

// ── Claude API helper ──────────────────────────────────────────────
async function askClaude(prompt) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.text || data.error || "שגיאה בתשובה";
}

function AiLoading() {
  return (
    <div className="ai-loading">
      <div className="dot" /><div className="dot" /><div className="dot" />
      <span>AI מנתח...</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    clinicName: "",
    therapistName: "",
    phone: "",
    email: "",
    address: "",
    defaultPrice: "",
    defaultDuration: "45",
    workDays: [0,1,2,3,4],
    dayStart: "08:30",
    reminderHour: "17:00",
    reminderTemplate: "שלום {שם} 😊\nמתזכרת לך לטיפול מחר {תאריך} בשעה {שעה}.\nאשמח לאישור הגעה:\n1️⃣ כן, אגיע\n2️⃣ לא אוכל להגיע",
    giKey: "",
    giSecret: "",
    greenInstanceId: "",
    greenToken: "",
    logoUrl: "",
  });

  const saveSetting = (key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("clinicSettings", JSON.stringify(updated));
      return updated;
    });
  };
  const [appointments, setAppointments] = useState([]);
  const [patientModal, setPatientModal] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);

  // Load patients, appointments and document bank from Supabase on startup
  useEffect(() => {
    Promise.all([sb.getPatients(), sb.getAppointments(), sb.getDocumentBank()])
      .then(([pData, aData, dData]) => {
        setPatients(Array.isArray(pData) ? pData : []);
        setAppointments(Array.isArray(aData) ? aData : []);
        // Build docBank from flat array
        const bank = { continuation: [], discharge: [], diagnosis: [] };
        (Array.isArray(dData) ? dData : []).forEach(d => {
          if (bank[d.category]) bank[d.category].push({ ...d });
        });
        setDocBank(bank);
        setLoading(false);
      })
      .catch(err => {
        console.error("Supabase error:", err);
        setPatients([]);
        setAppointments([]);
        setLoading(false);
      });
  }, []);

  const addPatient = async (data) => {
    try {
      const newP = await sb.addPatient(data);
      if (newP && newP.id) {
        const patient = {
          id: String(newP.id || ""),
          firstName: String(newP.first_name || ""),
          lastName: String(newP.last_name || ""),
          name: String(newP.name || ((newP.first_name || "") + " " + (newP.last_name || "")).trim()),
          gender: String(newP.gender || ""),
          age: newP.birth_date ? String(calcAge(newP.birth_date).replace("גיל: ","")) : "",
          birthDate: String(newP.birth_date || ""),
          idNumber: String(newP.id_number || ""),
          diagnosis: String(newP.diagnosis || ""),
          phone: String(newP.phone || ""),
          email: String(newP.email || ""),
          parentName: String(newP.parent_name || ""),
          nextAppt: String(newP.next_appt || "טרם נקבע"),
          sessions: 0,
          paid: false,
          history: [],
        };
        setPatients(prev => [...prev.filter(p => p && p.id), patient]);
      }
      showNotification("✅ " + data.firstName + " " + data.lastName + " נוסף בהצלחה");
    } catch {
      showNotification("❌ שגיאה בשמירת המטופל");
    }
  };

  const updatePatient = async (id, data) => {
    try {
      await sb.updatePatient(id, data);
      setPatients(prev => prev.map(p => p.id === id ? {
        ...p,
        firstName: data.firstName || p.firstName,
        lastName: data.lastName || p.lastName,
        name: ((data.firstName || p.firstName) + " " + (data.lastName || p.lastName)).trim(),
        gender: data.gender || p.gender,
        birthDate: data.birthDate || p.birthDate,
        idNumber: data.idNumber || p.idNumber,
        diagnosis: data.diagnosis,
        nextAppt: data.nextAppt || p.nextAppt,
        phone: data.phone || p.phone,
        email: data.email || p.email,
        parentName: data.parentName || p.parentName,
      } : p));
      showNotification("✏️ פרטי " + data.firstName + " עודכנו");
    } catch {
      showNotification("❌ שגיאה בעדכון המטופל");
    }
  };

  const deletePatient = async (id) => {
    try {
      const p = patients.find(x => x.id === id);
      await sb.deletePatient(id);
      setPatients(prev => prev.filter(x => x.id !== id));
      setSelectedPatient(null);
      setPage("patients");
      showNotification("🗑️ " + p.name + " הוסר מהמערכת");
    } catch {
      showNotification("❌ שגיאה במחיקת המטופל");
    }
  };
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [modal, setModal] = useState(null); // "post_session" | "pre_session" | "receipt" | "report"
  const [currentPatientForModal, setCurrentPatientForModal] = useState(null);
  const [sessionNote, setSessionNote] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const [reminderHour, setReminderHour] = useState("19:00");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatPatient, setAiChatPatient] = useState(null);
  const [receiptData, setReceiptData] = useState({ amount: "", method: "ביט", note: "" });
  const [notification, setNotification] = useState("");
  const [docBank, setDocBank] = useState({
    continuation: [], // בקשה להמשך
    discharge: [],    // דוח סיום טיפול
    diagnosis: [],    // אבחונים
  });

  const extractTextFromFile = async (file) => {
    try {
      const reader = new FileReader();
      return await new Promise((resolve) => {
        reader.onload = async (e) => {
          const base64 = e.target.result.split(",")[1];
          const mediaType = file.name.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          try {
            const res = await fetch("/api/ai", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                max_tokens: 3000,
                messages: [{
                  role: "user",
                  content: [
                    { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
                    { type: "text", text: "חלץ את כל הטקסט מהמסמך הזה. כתוב את הטקסט המלא ללא שינויים, שמור על המבנה המקורי." }
                  ]
                }]
              })
            });
            const data = await res.json();
            resolve(data.text || "");
          } catch { resolve(""); }
        };
        reader.readAsDataURL(file);
      });
    } catch { return ""; }
  };

  const addDocToBank = async (category, doc, file) => {
    try {
      let extracted_text = "";
      if (file) {
        showNotification("📖 קורא מסמך...");
        extracted_text = await extractTextFromFile(file);
      }
      const saved = await sb.addDocumentBank({ ...doc, category, extracted_text });
      if (saved && saved.id) {
        setDocBank(prev => ({ ...prev, [category]: [...prev[category], { ...saved }] }));
        showNotification("✅ מסמך נשמר" + (extracted_text ? " ונקרא בהצלחה" : ""));
      }
    } catch {
      setDocBank(prev => ({ ...prev, [category]: [...prev[category], doc] }));
      showNotification("✅ מסמך נשמר");
    }
  };

  const removeDocFromBank = async (category, idx) => {
    const doc = docBank[category][idx];
    if (doc && doc.id) {
      try { await sb.deleteDocumentBank(doc.id); } catch {}
    }
    setDocBank(prev => ({ ...prev, [category]: prev[category].filter((_, i) => i !== idx) }));
  };

  const [documents, setDocuments] = useState({
    1: [
      { name: "דוח_ראשוני_יוסי.pdf", type: "report", date: "01/01/2025", size: "245 KB" },
      { name: "סיכום_פגישה_10.03.pdf", type: "summary", date: "10/03/2025", size: "120 KB" },
    ],
    2: [
      { name: "דוח_הערכה_מיה.pdf", type: "report", date: "15/01/2025", size: "310 KB" },
    ],
  });

  const addDocument = (patientId, doc) => {
    setDocuments(prev => ({
      ...prev,
      [patientId]: [...(prev[patientId] || []), doc]
    }));
    showNotification("📎 הקובץ \"" + doc.name + "\" הועלה בהצלחה");
  };

  const removeDocument = (patientId, docIndex) => {
    setDocuments(prev => ({
      ...prev,
      [patientId]: prev[patientId].filter((_, i) => i !== docIndex)
    }));
    showNotification("🗑️ הקובץ הוסר");
  };

  const openModal = (type, patient) => {
    setCurrentPatientForModal(patient);
    setAiText(""); setSessionNote("");
    setModal(type);
    if (type === "pre_session") generatePreSession(patient);
    if (type === "receipt") {
      setReceiptData({
        amount: settings.defaultPrice || "",
        method: "ביט",
        note: "",
        email: patient?.email || "",
        phone: patient?.phone || ""
      });
    }
  };

  const closeModal = () => setModal(null);

  const generatePreSession = async (patient) => {
    setAiLoading(true);
    const history = patient.history.map(h => `${h.date}: ${h.summary}`).join("\n");
    const firstName = patient.firstName || patient.name;
    const fullName = patient.name;
    const prompt = `את קלינאית תקשורת. להלן היסטוריית הטיפולים של ${fullName} (גיל ${patient.age}, אבחנה: ${patient.diagnosis}).\nבגוף הטקסט, התייחסי למטופל/ת בשם הפרטי בלבד: ${firstName}.\n\n${history}\n\nאנא כתבי:\n1. סיכום קצר של ההתקדמות עד כה (3-4 משפטים)\n2. 3 המלצות ממוקדות לטיפול הבא\n\nכתבי בעברית בסגנון מקצועי וחם.`;
    const result = await askClaude(prompt);
    setAiText(result);
    setAiLoading(false);
  };

  const generateReport = async (patient) => {
    setAiLoading(true);
    const history = patient.history.map(h => `${h.date}: ${h.summary}`).join("\n");
    const firstName = patient.firstName || patient.name;
    const fullName = patient.name;
    const prompt = `את קלינאית תקשורת. כתבי דוח טיפולי מקצועי עבור ${fullName} (גיל ${patient.age}, אבחנה: ${patient.diagnosis}).\nבכותרת ובפרטי המטופל השתמשי בשם המלא: ${fullName}.\nבגוף הדוח, התייחסי למטופל/ת בשם הפרטי בלבד: ${firstName}.\n\nסיכומי פגישות:\n${history}\n\nכתבי דוח בפורמט:\n- פרטי מטופל (שם מלא, גיל, אבחנה)\n- רקע ואבחנה\n- מהלך הטיפולים\n- התקדמות ומטרות שהושגו\n- המלצות להמשך\n\nסגנון מקצועי, חם, בעברית.`;
    const result = await askClaude(prompt);
    setAiText(result);
    setAiLoading(false);
  };

  const saveSessionNote = async () => {
    if (!sessionNote.trim()) return;
    const today = new Date().toLocaleDateString("he-IL");
    try {
      await sb.addSession(currentPatientForModal.id, today, sessionNote);
      setPatients(prev => prev.map(p => p.id === currentPatientForModal.id ? {
        ...p,
        history: [{ date: today, summary: sessionNote }, ...(p.history || [])],
        sessions: (p.sessions || 0) + 1,
      } : p));
      showNotification(`✅ סיכום נשמר עבור ${currentPatientForModal.name}`);
    } catch {
      showNotification("❌ שגיאה בשמירת הסיכום");
    }
    closeModal();
  };

  const sendWhatsApp = (patient) => {
    showNotification(`📱 אישור הגעה נשלח בוואטסאפ ל${patient.name}`);
  };

  const generateReceipt = async () => {
    if (!receiptData.amount) return alert("נא להזין סכום");
    showNotification("⏳ יוצר קבלה בחשבונית הירוקה...");
    try {
      const email = receiptData.email || currentPatientForModal?.email || "";
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: currentPatientForModal?.name,
          amount: receiptData.amount,
          paymentMethod: receiptData.method,
          email,
          description: receiptData.note || "טיפול קלינאות תקשורת",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPatients(prev => prev.map(p =>
          p.id === currentPatientForModal?.id ? { ...p, paid: true } : p
        ));
        sb.markPaid(currentPatientForModal?.id, true).catch(() => {});
        showNotification(`✅ קבלה מס' ${data.receiptNumber} נוצרה ונשלחה בהצלחה!`);
      } else {
        showNotification(`❌ שגיאה: ${data.error}`);
      }
    } catch (err) {
      showNotification(`❌ שגיאה: ${err.message}`);
    }
    closeModal();
  };

  const startRecording = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      showNotification("❌ הדפדפן שלך לא תומך בתמלול דיבור — נסה Chrome");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "he-IL";
    recognition.continuous = true;
    recognition.interimResults = false;
    mediaRecorderRef.current = recognition;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join(" ");
      if (transcript.trim()) {
        setSessionNote(prev => prev ? prev + " " + transcript : transcript);
      }
    };

    recognition.onerror = (e) => {
      clearInterval(recTimerRef.current);
      setIsRecording(false);
      setIsTranscribing(false);
      setRecSeconds(0);
      if (e.error === "no-speech") {
        showNotification("⚠️ לא זוהה דיבור — נא לדבר בקול ברור ולנסות שוב");
      } else if (e.error === "not-allowed") {
        showNotification("❌ אנא אשר גישה למיקרופון");
      } else {
        showNotification("❌ שגיאה בתמלול — נסה שוב");
      }
    };

    recognition.onend = () => {
      clearInterval(recTimerRef.current);
      setIsRecording(false);
      setIsTranscribing(false);
      setRecSeconds(0);
      showNotification("✅ ההקלטה הסתיימה ותומללה");
    };

    recognition.start();
    setIsRecording(true);
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const openAiChat = (patient) => {
    setAiChatPatient(patient);
    setAiChatMessages([{
      role: "assistant",
      text: `שלום! אני יודע הכל על ${patient.firstName || patient.name}. במה אוכל לעזור? 😊`
    }]);
    setAiChatInput("");
    setModal("ai_chat");
  };

  const sendAiChat = async (customMsg, docCategory) => {
    const msg = customMsg || aiChatInput.trim();
    // Auto-detect document category from message
    const autoCategory = docCategory ||
      (/סיום|discharge|סיכום טיפול/.test(msg) ? "discharge" :
       /המשך|continuation|הפניה/.test(msg) ? "continuation" :
       /אבחון|diagnosis|הערכה/.test(msg) ? "diagnosis" : null);
    if (!msg || aiChatLoading) return;
    setAiChatInput("");
    const newMessages = [...aiChatMessages, { role: "user", text: msg }];
    setAiChatMessages(newMessages);
    setAiChatLoading(true);
    const patient = aiChatPatient;
    const history = (patient.history || []).map(h => `${h.date}: ${h.summary}`).join("\n");
    // Get style examples from document bank - filter by category if specified
    const catDocs = autoCategory && docBank?.[autoCategory]
      ? docBank[autoCategory]
      : [...(docBank?.continuation||[]), ...(docBank?.discharge||[]), ...(docBank?.diagnosis||[])];
    const styleExamples = catDocs
      .filter(d => d.extracted_text)
      .slice(0, 3)
      .map(d => `--- דוגמה מ"${d.name}" ---\n${d.extracted_text?.slice(0, 800)}`)
      .join("\n\n");
    const catLabel = autoCategory === "discharge" ? "דוח סיום טיפול" :
                     autoCategory === "continuation" ? "בקשה להמשך טיפול" :
                     autoCategory === "diagnosis" ? "דוח אבחון" : "דוח";

    const systemPrompt = `את עוזרת AI חכמה לקלינאית תקשורת. להלן פרטי המטופל:
שם: ${patient.name}
גיל: ${patient.age}
אבחנה: ${patient.diagnosis}
מספר פגישות: ${patient.sessions}
היסטוריית טיפולים:
${history || "אין עדיין סיכומי טיפולים"}

${styleExamples ? `להלן דוגמאות לסגנון הכתיבה של הקלינאית עבור ${catLabel} — השתמשי בסגנון זה בדיוק:\n${styleExamples}` : ""}

ענה בעברית בסגנון מקצועי וחם. אם מתבקש דוח — חקי את סגנון הכתיבה של הדוגמאות.`;
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          max_tokens: 1500,
          messages: newMessages
            .filter(m => m.role === "user" || (m.role === "assistant" && m !== newMessages[0]))
            .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }))
        })
      });
      const data = await res.json();
      const reply = data.text || data.error || "מצטער, לא הצלחתי לענות";
      setAiChatMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setAiChatMessages(prev => [...prev, { role: "assistant", text: "שגיאה בחיבור ל-AI" }]);
    }
    setAiChatLoading(false);
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  // ── Render ──
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--cream)",flexDirection:"column",gap:16}}>
        <div style={{fontFamily:"Fraunces, serif",fontSize:"2rem",color:"var(--sage-dark)"}}>קליניקה</div>
        <div style={{display:"flex",gap:6,alignItems:"center",color:"var(--text-soft)",fontSize:"0.85rem"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--sage)",animation:"bounce 0.8s infinite"}} />
          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--sage)",animation:"bounce 0.8s 0.2s infinite"}} />
          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--sage)",animation:"bounce 0.8s 0.4s infinite"}} />
          <span>טוען...</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar page={page} setPage={(p) => { setPage(p); setSelectedPatient(null); }} />
        <main className="main">
          {notification && <div className="banner">🔔 {notification}</div>}

          {page === "dashboard" && <Dashboard patients={patients} appointments={appointments} openModal={openModal} sendWhatsApp={sendWhatsApp} />}
          {page === "calendar" && <Calendar patients={patients} appointments={appointments} setAppointments={setAppointments} openModal={openModal} sendWhatsApp={sendWhatsApp} settings={settings} />}
          {page === "patients" && !selectedPatient &&
            <PatientList patients={patients} onSelect={p => { setSelectedPatient(p); setPage("patient_detail"); }}
              onAdd={() => setPatientModal("add")} />}
          {page === "patient_detail" && selectedPatient &&
            <PatientDetail patient={selectedPatient} onBack={() => { setSelectedPatient(null); setPage("patients"); }}
              openModal={openModal} generateReport={generateReport} aiText={aiText} aiLoading={aiLoading} openAiChat={openAiChat}
              documents={documents[selectedPatient.id] || []} addDocument={addDocument} removeDocument={removeDocument}
              onEdit={() => { setEditingPatient(selectedPatient); setPatientModal("edit"); }}
              onDelete={() => deletePatient(selectedPatient.id)} />}
          {page === "receipts" && <Receipts patients={patients} openModal={openModal} />}
          {page === "settings" && <Settings settings={settings} saveSetting={saveSetting} />}
          {page === "documents_bank" && <DocumentsBank docBank={docBank} addDocToBank={addDocToBank} removeDocFromBank={removeDocFromBank} showNotification={showNotification} />}
        </main>
      </div>

      {/* Modals */}
      {modal === "post_session" && (
        <Modal onClose={closeModal}>
          <h3>📝 סיכום טיפול — {currentPatientForModal?.name}</h3>

          {/* Recording buttons */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {!isRecording && !isTranscribing && (
              <button className="rec-btn idle" onClick={startRecording}>
                🎙️ התחל הקלטה
              </button>
            )}
            {isRecording && (
              <button className="rec-btn recording" onClick={stopRecording}>
                ⏹️ עצור הקלטה
              </button>
            )}
            {isTranscribing && (
              <button className="rec-btn transcribing" disabled>
                ⏳ מתמלל...
              </button>
            )}
            {isRecording && (
              <div className="rec-timer">
                🔴 {Math.floor(recSeconds/60)}:{String(recSeconds%60).padStart(2,"0")}
              </div>
            )}
          </div>

          <p className="text-soft" style={{marginBottom:6}}>או כתבי ידנית:</p>
          <textarea className="field" rows={5} placeholder="מה עשינו היום? מה עבד? מה להמשיך?"
            value={sessionNote} onChange={e => setSessionNote(e.target.value)} />
          <div className="flex gap-3 mt-3">
            <button className="btn btn-primary" onClick={saveSessionNote} disabled={isTranscribing}>שמור סיכום</button>
            <button className="btn btn-secondary" onClick={closeModal}>ביטול</button>
          </div>
        </Modal>
      )}

      {modal === "pre_session" && (
        <Modal onClose={closeModal}>
          <h3>🔍 לפני הטיפול — {currentPatientForModal?.name}</h3>
          {aiLoading ? <AiLoading /> : <div className="ai-box">{aiText}</div>}
        </Modal>
      )}

      {modal === "receipt" && (
        <Modal onClose={closeModal}>
          <h3>🧾 קבלה — {currentPatientForModal?.name}</h3>

          {/* פרטי קשר */}
          <div style={{background:"var(--cream)",borderRadius:12,padding:"12px 14px",marginBottom:8,fontSize:"0.85rem"}}>
            <div style={{fontWeight:500,marginBottom:6,color:"var(--sage-dark)"}}>📋 פרטי הורה</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div className="field-label">טלפון</div>
                <input className="field" placeholder="050-0000000"
                  value={receiptData.phone ?? (currentPatientForModal?.phone || "")}
                  onChange={e => setReceiptData({...receiptData, phone: e.target.value})} />
              </div>
              <div style={{flex:1}}>
                <div className="field-label">מייל (לשליחת קבלה)</div>
                <input className="field" type="email" placeholder="example@gmail.com"
                  style={{direction:"ltr",textAlign:"right"}}
                  value={receiptData.email ?? (currentPatientForModal?.email || "")}
                  onChange={e => setReceiptData({...receiptData, email: e.target.value})} />
              </div>
            </div>
            {!currentPatientForModal?.email && !receiptData.email && (
              <p style={{fontSize:"0.75rem",color:"var(--terracotta)",marginTop:6}}>⚠️ אין מייל שמור — הקבלה לא תישלח אוטומטית</p>
            )}
          </div>

          <div className="field-label">סכום</div>
          <input className="field" type="number" placeholder="₪" value={receiptData.amount}
            onChange={e => setReceiptData({...receiptData, amount: e.target.value})} />
          <div className="field-label">אמצעי תשלום</div>
          <select className="field" value={receiptData.method}
            onChange={e => setReceiptData({...receiptData, method: e.target.value})}>
            <option>ביט</option><option>פייבוקס</option><option>העברה בנקאית</option><option>מזומן</option>
          </select>
          <div className="field-label">הערה (אופציונלי)</div>
          <input className="field" placeholder="למשל: טיפול ראשון" value={receiptData.note}
            onChange={e => setReceiptData({...receiptData, note: e.target.value})} />

          {receiptData.amount && (
            <div className="receipt-preview mt-3">
              <h4>קבלה | קליניקה לקלינאות תקשורת</h4>
              <hr className="receipt-divider" />
              <div className="receipt-row"><span>שם מטופל:</span><span>{currentPatientForModal?.name}</span></div>
              <div className="receipt-row"><span>תאריך:</span><span>{new Date().toLocaleDateString("he-IL")}</span></div>
              <div className="receipt-row"><span>אמצעי תשלום:</span><span>{receiptData.method}</span></div>
              {(receiptData.email || currentPatientForModal?.email) && (
                <div className="receipt-row"><span>נשלח למייל:</span><span>{receiptData.email || currentPatientForModal?.email}</span></div>
              )}
              {receiptData.note && <div className="receipt-row"><span>הערה:</span><span>{receiptData.note}</span></div>}
              <hr className="receipt-divider" />
              <div className="receipt-row receipt-total"><span>סה״כ:</span><span>₪{receiptData.amount}</span></div>
            </div>
          )}
          <div className="flex gap-3 mt-3">
            <button className="btn btn-primary" onClick={generateReceipt}>שלח קבלה</button>
            <button className="btn btn-secondary" onClick={closeModal}>ביטול</button>
          </div>
        </Modal>
      )}

      {patientModal && (
        <PatientFormModal
          mode={patientModal}
          patient={editingPatient}
          onSave={(data) => {
            if (patientModal === "add") addPatient(data);
            else updatePatient(editingPatient.id, data);
            setPatientModal(null);
            setEditingPatient(null);
          }}
          onClose={() => { setPatientModal(null); setEditingPatient(null); }}
        />
      )}

      {modal === "reminder" && (
        <Modal onClose={closeModal}>
          <h3>🔔 תזכורת לפני טיפול — {currentPatientForModal?.name}</h3>
          <div className="ai-box mt-3" style={{marginBottom:16}}>
            <strong>סיכום טיפול אחרון:</strong>
            <p style={{marginTop:8,fontSize:"0.88rem",lineHeight:1.6}}>
              {currentPatientForModal?.history?.[0]?.summary || "אין סיכומים עדיין"}
            </p>
            {currentPatientForModal?.history?.[0]?.date && (
              <p style={{fontSize:"0.75rem",color:"var(--text-soft)",marginTop:6}}>
                📅 {currentPatientForModal.history[0].date}
              </p>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <label style={{fontSize:"0.85rem",color:"var(--text-soft)"}}>⏰ שעת התראה:</label>
            <input type="time" value={reminderHour} onChange={e => setReminderHour(e.target.value)}
              style={{padding:"7px 10px",border:"2px solid var(--warm)",borderRadius:10,fontFamily:"DM Sans,sans-serif",fontSize:"0.85rem",background:"var(--cream)",direction:"ltr",outline:"none"}} />
          </div>
          <button className="btn btn-primary mt-3" onClick={() => {
            if ("Notification" in window) {
              Notification.requestPermission().then(perm => {
                if (perm === "granted") {
                  showNotification(`✅ התראה נקבעה ל-${reminderHour} לפני הטיפול של ${currentPatientForModal?.name}`);
                } else {
                  showNotification("⚠️ אנא אשר התראות בדפדפן");
                }
              });
            }
            closeModal();
          }}>🔔 קבע תזכורת</button>
        </Modal>
      )}

      {modal === "report" && (
        <Modal onClose={closeModal}>
          <h3>📄 דוח מקצועי — {currentPatientForModal?.name}</h3>
          {aiLoading ? <AiLoading /> : <div className="ai-box">{aiText}</div>}
          {!aiLoading && aiText && (
            <button className="btn btn-primary mt-3" onClick={() => {
              navigator.clipboard.writeText(aiText);
              showNotification("📋 הדוח הועתק ללוח");
            }}>העתק דוח</button>
          )}
        </Modal>
      )}

      {modal === "ai_chat" && aiChatPatient && (
        <Modal onClose={closeModal}>
          <h3>🤖 עוזר AI — {aiChatPatient.firstName || aiChatPatient.name}</h3>

          {/* Quick action buttons */}
          <div className="ai-quick-btns">
            {[
              { label: "סכם טיפולים", msg: "סכם את כל הטיפולים עד כה", cat: null },
              { label: "מה ההתקדמות?", msg: "מה ההתקדמות מתחילת הטיפול?", cat: null },
              { label: "📄 דוח סיום", msg: "כתוב דוח סיום טיפול מקצועי", cat: "discharge" },
              { label: "📋 בקשה להמשך", msg: "כתוב בקשה להמשך טיפול", cat: "continuation" },
              { label: "🔍 דוח אבחון", msg: "כתוב דוח אבחון", cat: "diagnosis" },
              { label: "המלצות", msg: "מה ההמלצות לטיפול הבא?", cat: null },
            ].map(q => (
              <button key={q.label} className="ai-quick-btn"
                onClick={() => sendAiChat(q.msg, q.cat)}>{q.label}</button>
            ))}
          </div>

          {/* Chat messages */}
          <div className="ai-chat-box" id="chatBox">
            {aiChatMessages.map((m, i) => (
              <div key={i} className={`ai-chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {aiChatLoading && (
              <div className="ai-chat-msg assistant">
                <div className="ai-loading"><div className="dot"/><div className="dot"/><div className="dot"/></div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-3 mt-3">
            <input className="field" style={{flex:1}} placeholder="שאל כל שאלה על המטופל..."
              value={aiChatInput} onChange={e => setAiChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAiChat()} />
            <button className="btn btn-primary" onClick={() => sendAiChat()} disabled={aiChatLoading}>שלח</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  const nav = [
    { id:"dashboard",       icon:"🏠", label:"ראשי" },
    { id:"calendar",        icon:"📅", label:"יומן" },
    { id:"patients",        icon:"👥", label:"מטופלים" },
    { id:"receipts",        icon:"🧾", label:"קבלות" },
    { id:"documents_bank",  icon:"📚", label:"מסמכים" },
    { id:"settings",        icon:"⚙️", label:"הגדרות" },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>קליניקה</h2>
        <p>קלינאות תקשורת</p>
      </div>
      {nav.map(n => (
        <div key={n.id} className={`nav-item ${page === n.id || (page==="patient_detail" && n.id==="patients") ? "active":""}`}
          onClick={() => setPage(n.id)}>
          <span className="nav-icon">{n.icon}</span>{n.label}
        </div>
      ))}
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────
function Dashboard({ patients, appointments, openModal, sendWhatsApp }) {
  // Get today's day index (0=Sunday...6=Saturday)
  const todayIdx = new Date().getDay();
  const tomorrowIdx = (todayIdx + 1) % 7;

  // Today's and tomorrow's appointments from real data
  const todayApts = appointments.filter(a => a.day_index === todayIdx).sort((a,b) => a.start_time > b.start_time ? 1 : -1);
  const tomorrowApts = appointments.filter(a => a.day_index === tomorrowIdx).sort((a,b) => a.start_time > b.start_time ? 1 : -1);
  const unpaid = patients.filter(p => p && !p.paid);
  const totalWeekApts = appointments.length;

  return (
    <>
      <h1 className="page-title">שלום! 👋</h1>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{patients.length}</div><div className="stat-label">סה"כ מטופלים</div></div>
        <div className="stat-card"><div className="stat-num">{todayApts.length}</div><div className="stat-label">טיפולים היום</div></div>
        <div className="stat-card"><div className="stat-num">{totalWeekApts}</div><div className="stat-label">טיפולים השבוע</div></div>
        <div className="stat-card"><div className="stat-num" style={{color: unpaid.length > 0 ? "var(--terracotta)" : "var(--sage-dark)"}}>{unpaid.length}</div><div className="stat-label">ממתינים לתשלום</div></div>
      </div>

      <div className="card">
        <div className="card-title">📅 טיפולים היום ({todayApts.length})</div>
        {todayApts.length === 0 && <p className="text-soft" style={{padding:"8px 0"}}>אין טיפולים היום</p>}
        {todayApts.map((a, i) => {
          const patient = patients.find(p => p.id === a.patient_id || p.name === a.patient_name);
          return (
            <div key={i} className="patient-row">
              <div className="patient-avatar">{(a.patient_name||"?")[0]}</div>
              <div className="patient-info">
                <div className="patient-name">{a.patient_name}</div>
                <div className="patient-meta">🕐 {a.start_time}</div>
              </div>
              <div style={{fontSize:"0.72rem",padding:"3px 8px",borderRadius:20,
                background: a.status==="confirmed" ? "#E8F5E8" : "#FFF8E1",
                color: a.status==="confirmed" ? "#2E7D32" : "#F57F17"}}>
                {a.status==="confirmed" ? "✅ אישר" : "⏳ ממתין"}
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => patient && openModal("pre_session", patient)}>סקירה</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">📅 טיפולים מחר ({tomorrowApts.length})</div>
        {tomorrowApts.length === 0 && <p className="text-soft" style={{padding:"8px 0"}}>אין טיפולים מחר</p>}
        {tomorrowApts.map((a, i) => {
          const patient = patients.find(p => p.id === a.patient_id || p.name === a.patient_name);
          return (
            <div key={i} className="patient-row">
              <div className="patient-avatar">{(a.patient_name||"?")[0]}</div>
              <div className="patient-info">
                <div className="patient-name">{a.patient_name}</div>
                <div className="patient-meta">🕐 {a.start_time}</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => patient && openModal("pre_session", patient)}>סקירה לפני</button>
              <button className="btn btn-sm btn-primary" onClick={() => patient && sendWhatsApp(patient)}>📱 שלח אישור</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">⏰ טרם שולמו ({unpaid.length})</div>
        {unpaid.length === 0 && <p className="text-soft" style={{padding:"8px 0"}}>✅ כל המטופלים שילמו</p>}
        {unpaid.map(p => (
          <div key={p.id} className="patient-row">
            <div className="patient-avatar">{(p.name||"?")[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{p.name}</div>
              <div className="patient-meta" style={{color:"#C4724A"}}>❌ טרם שולם</div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => openModal("receipt", p)}>🧾 הנפק קבלה</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Calendar ───────────────────────────────────────────────────────
// Each day has an ordered list of "blocks": { type:"treatment"|"break", minutes, patientId?, patientName?, status? }
// The schedule is built by walking blocks sequentially from dayStart.

function Calendar({ patients, appointments, setAppointments, openModal, sendWhatsApp, settings }) {
  const [dayStart, setDayStart] = useState("08:30");
  const [dayEnd,   setDayEnd]   = useState("14:30");

  // dayBlocks built from Supabase appointments
  const makeId = () => Math.random().toString(36).slice(2,8);
  const [localBreaks, setLocalBreaks] = useState({});

  // Build dayBlocks from appointments (includes breaks)
  const buildDayBlocks = () => {
    const blocks = {};
    (appointments || []).forEach(a => {
      const di = a.day_index;
      if (!blocks[di]) blocks[di] = [];
      blocks[di].push({ 
        id: a.id, 
        type: a.block_type || "treatment", 
        minutes: a.minutes || 45, 
        patientId: a.patient_id, 
        patientName: a.patient_name, 
        status: a.status || "pending",
        startTime: a.start_time || "00:00"
      });
    });
    // Sort by start_time from DB
    Object.keys(blocks).forEach(di => {
      blocks[di].sort((a,b) => a.startTime > b.startTime ? 1 : -1);
    });
    return blocks;
  };
  const dayBlocks = buildDayBlocks();

  // Modal state: adding a new block to a day
  const [addModal, setAddModal] = useState(null); // { dayIdx, insertAfterIdx }
  const [addType, setAddType]   = useState("treatment");
  const [breakMins, setBreakMins] = useState(10);
  const [patientQ, setPatientQ]  = useState("");

  // Convert "HH:MM" to minutes
  const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
  const toTime = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;

  // Build timeline for a day: returns blocks with computed startTime
  const buildTimeline = (dayIdx) => {
    const blocks = dayBlocks[dayIdx] || [];
    let cur = toMin(dayStart);
    return blocks.map(b => {
      const start = toTime(cur);
      cur += b.minutes;
      return { ...b, startTime: start, endTime: toTime(cur) };
    });
  };

  const addBlock = async (dayIdx, insertAfterIdx) => {
    if (addType === "break") {
      const timeline = buildTimeline(dayIdx);
      // startTime of the break = end of block before it
      const insertAfter = timeline[insertAfterIdx];
      const breakStart = insertAfter ? insertAfter.endTime : dayStart;

      try {
        // 1. Save the break
        const newApt = await sb.addAppointment({
          dayIndex: dayIdx,
          startTime: breakStart,
          blockType: "break",
          minutes: breakMins,
          status: "break"
        });

        // 2. Update all appointments AFTER the break — shift their start_time by breakMins
        const toMin = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
        const toTime = m => String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0");
        
        const breakStartMin = toMin(breakStart);
        const afterBreak = timeline.slice(insertAfterIdx + 1);
        
        // Update each subsequent appointment in Supabase
        const updatePromises = afterBreak.map(b => {
          const newStart = toTime(toMin(b.startTime) + breakMins);
          return sb.updateAppointmentStatus(b.id, b.status).then(() =>
            fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${b.id}`, {
              method: "PATCH",
              headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ start_time: newStart })
            })
          );
        });
        await Promise.all(updatePromises);

        // 3. Reload appointments from Supabase to reflect all changes
        const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?select=*&order=day_index.asc,start_time.asc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const updated = await res.json();
        if (Array.isArray(updated)) setAppointments(updated);

      } catch(e) {
        console.error("Error adding break:", e);
      }
      setAddModal(null);
    }
  };

  const assignPatientToModal = async (patient) => {
    try {
      const timeline = buildTimeline(addModal.dayIdx);
      const insertAfter = timeline[addModal.insertAfterIdx];
      const startTime = insertAfter ? insertAfter.endTime : dayStart;
      const newApt = await sb.addAppointment({
        patientId: patient.id,
        patientName: patient.name,
        dayIndex: addModal.dayIdx,
        startTime,
        blockType: "treatment",
        minutes: 45,
      });
      if (newApt && newApt.id) {
        setAppointments(prev => [...prev, { ...newApt, day_index: addModal.dayIdx, patient_name: patient.name, patient_id: patient.id, status: "pending" }]);
      }
    } catch(e) {
      console.error("Error adding appointment:", e);
    }
    setAddModal(null);
    setPatientQ("");
  };

  const removeBlock = async (dayIdx, blockId) => {
    // Check if it's a local break or a real appointment
    if (typeof blockId === 'string' && blockId.length < 10) {
      // Local break
      setLocalBreaks(prev => ({ ...prev, [dayIdx]: (prev[dayIdx]||[]).filter(b => b.id !== blockId) }));
    } else {
      // Real appointment in Supabase
      try { await sb.deleteAppointment(blockId); } catch(e) {}
      setAppointments(prev => prev.filter(a => a.id !== blockId));
    }
  };

  const filteredPatients = patients.filter(p =>
    p.name.includes(patientQ) || (p.firstName||"").includes(patientQ) || (p.lastName||"").includes(patientQ)
  );

  return (
    <div>
      <div className="top-bar">
        <h1 className="page-title" style={{marginBottom:0}}>📅 יומן שבועי</h1>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="cal-toolbar">
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label>🕐 תחילת יום:</label>
            <input type="time" value={dayStart} onChange={e => setDayStart(e.target.value)} />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label>🕕 סיום יום:</label>
            <input type="time" value={dayEnd} onChange={e => setDayEnd(e.target.value)} />
          </div>
        </div>
        <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginTop:8}}>
          לחצי על ➕ בין אירועים להוספת טיפול או הפסקה
        </div>
      </div>

      <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
        {WEEK_DAYS.map((day, di) => { if (settings?.workDays && !settings.workDays.includes(di)) return null;
          const timeline = buildTimeline(di);
          return (
            <div key={di} style={{minWidth:150,flex:1,background:"var(--white)",borderRadius:16,padding:12,boxShadow:"var(--shadow)"}}>
              <div style={{fontWeight:600,fontSize:"0.85rem",color:"var(--sage-dark)",marginBottom:10,textAlign:"center",borderBottom:"2px solid var(--warm)",paddingBottom:6}}>{day}</div>

              {/* Add at start */}
              <AddBtn onClick={() => { setAddModal({dayIdx:di, insertAfterIdx:-1}); setAddType("treatment"); setPatientQ(""); }} />

              {timeline.map((b, bi) => (
                <div key={b.id}>
                  {b.type === "treatment" ? (
                    <div style={{background:"var(--sage-light)",border:"2px solid var(--sage)",borderRadius:10,padding:"8px 10px",marginBottom:2,position:"relative"}}>
                      <div style={{fontSize:"0.68rem",color:"var(--text-soft)"}}>{b.startTime}–{b.endTime}</div>
                      <div style={{fontWeight:600,fontSize:"0.82rem",color:"var(--sage-dark)",marginTop:1}}>{b.patientName}</div>
                      <div style={{fontSize:"0.68rem",color: b.status==="confirmed"?"#4CAF50":"#FFA000",marginTop:2}}>{b.status==="confirmed"?"✅ אישר":"⏳ ממתין"}</div>
                      <span onClick={() => removeBlock(di, b.id)}
                        style={{position:"absolute",top:5,left:6,cursor:"pointer",fontSize:"0.7rem",color:"var(--terracotta)",opacity:0.7}}>✕</span>
                    </div>
                  ) : (
                    <div style={{background:"repeating-linear-gradient(45deg,#f5f0e8,#f5f0e8 4px,#ede5d8 4px,#ede5d8 8px)",borderRadius:10,padding:"6px 10px",marginBottom:2,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:"0.75rem",color:"var(--text-soft)"}}>☕ {b.startTime} ({b.minutes} דק')</span>
                      <span onClick={() => removeBlock(di, b.id)} style={{cursor:"pointer",fontSize:"0.7rem",color:"var(--terracotta)"}}>✕</span>
                    </div>
                  )}
                  <AddBtn onClick={() => { setAddModal({dayIdx:di, insertAfterIdx:bi}); setAddType("treatment"); setPatientQ(""); }} />
                </div>
              ))}

              {timeline.length === 0 && (
                <div style={{fontSize:"0.78rem",color:"var(--text-soft)",textAlign:"center",padding:"12px 0"}}>יום ריק</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add block modal */}
      {addModal && (
        <div className="modal-overlay" onClick={() => setAddModal(null)}>
          <div className="modal" style={{width:320}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:14}}>➕ הוסף ל{WEEK_DAYS[addModal.dayIdx]}</h3>

            {/* Toggle: treatment / break */}
            <div style={{display:"flex",gap:4,background:"var(--warm)",borderRadius:10,padding:3,marginBottom:14}}>
              {[["treatment","👤 טיפול"],["break","☕ הפסקה"]].map(([val,label]) => (
                <div key={val} onClick={() => setAddType(val)}
                  style={{flex:1,textAlign:"center",padding:"7px",borderRadius:8,cursor:"pointer",fontSize:"0.85rem",
                    background:addType===val?"var(--white)":"transparent",
                    fontWeight:addType===val?600:400,
                    color:addType===val?"var(--sage-dark)":"var(--text-soft)",
                    boxShadow:addType===val?"0 1px 4px rgba(0,0,0,0.1)":"none",
                    transition:"all 0.15s"}}>{label}</div>
              ))}
            </div>

            {addType === "break" ? (
              <div>
                <p style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:8}}>כמה דקות?</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
                  {[5,10,15,20,30].map(m => (
                    <div key={m} onClick={() => setBreakMins(m)}
                      style={{padding:"7px 14px",borderRadius:10,cursor:"pointer",fontSize:"0.82rem",
                        background:breakMins===m?"var(--sage-dark)":"var(--warm)",
                        color:breakMins===m?"white":"var(--text)",
                        fontWeight:breakMins===m?600:400,
                        transition:"all 0.15s"}}>{m} דק'</div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{width:"100%"}} onClick={() => addBlock(addModal.dayIdx, addModal.insertAfterIdx)}>
                  ☕ הוסף הפסקה של {breakMins} דק'
                </button>
              </div>
            ) : (
              <div>
                <p style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:8}}>בחרי מטופל:</p>
                <input className="picker-search" placeholder="חיפוש..." value={patientQ} onChange={e => setPatientQ(e.target.value)} autoFocus />
                <div className="picker-list" style={{maxHeight:200}}>
                  {filteredPatients.map(p => (
                    <div key={p.id} className="picker-item" onClick={() => assignPatientToModal(p)}>
                      {p.firstName||p.name} {p.lastName||""} <span style={{color:"var(--text-soft)",fontSize:"0.73rem"}}>({p.diagnosis?.slice(0,18)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-secondary mt-3" onClick={() => setAddModal(null)}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddBtn({ onClick }) {
  return (
    <div onClick={onClick}
      style={{textAlign:"center",padding:"3px 0",cursor:"pointer",opacity:0.4,transition:"opacity 0.15s",fontSize:"0.75rem",color:"var(--sage-dark)"}}
      onMouseEnter={e=>e.currentTarget.style.opacity=1}
      onMouseLeave={e=>e.currentTarget.style.opacity=0.4}>
      ＋
    </div>
  );
}

// ── Patient List ───────────────────────────────────────────────────
function PatientList({ patients, onSelect, onAdd }) {
  const [q, setQ] = useState("");
  const filtered = patients.filter(p => p && ((p.name || "").includes(q) || (p.diagnosis || "").includes(q)));
  return (
    <>
      <div className="top-bar">
        <h1 className="page-title" style={{marginBottom:0}}>👥 מטופלים</h1>
        <button className="btn btn-primary" onClick={onAdd}>+ מטופל חדש</button>
      </div>
      <input className="search-bar" placeholder="🔍 חיפוש לפי שם או אבחנה..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="patient-list">
        {filtered.map(p => (
          <div key={p.id} className="patient-row" onClick={() => onSelect(p)}>
            <div className="patient-avatar">{p.name[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{p.name} <span className="text-soft">(גיל {p.age})</span></div>
              <div className="patient-meta">{p.diagnosis} · {p.sessions} פגישות</div>
            </div>
            <div style={{
              fontSize:"0.72rem", padding:"4px 10px", borderRadius:20, fontWeight:500,
              background: p.paid ? "#E8F5E8" : "#FBE8E3",
              color: p.paid ? "#2E7D32" : "#C4724A"
            }}>
              {p.paid ? "✅ שולם" : "❌ טרם שולם"}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Upload Zone Component ──────────────────────────────────────────
function UploadZone({ patientId, addDocument }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      const ext = file.name.split(".").pop().toLowerCase();
      const type = ext === "pdf" ? "report" : ext === "docx" || ext === "doc" ? "summary" : "other";
      const size = file.size > 1024*1024 ? (file.size/1024/1024).toFixed(1)+" MB" : Math.round(file.size/1024)+" KB";
      addDocument(patientId, {
        name: file.name,
        type,
        date: new Date().toLocaleDateString("he-IL"),
        size,
      });
    });
  };

  return (
    <div
      className={`upload-zone ${drag ? "drag-over" : ""}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="upload-icon">📂</div>
      <p><strong>לחצי להעלאת קובץ</strong> או גררי לכאן</p>
      <p style={{marginTop:4}}>PDF, Word, תמונות — עד 20MB</p>
      <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        style={{display:"none"}} onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

// ── Patient Detail ─────────────────────────────────────────────────
function PatientDetail({ patient, onBack, openModal, generateReport, aiText, aiLoading, openAiChat, documents, addDocument, removeDocument, onEdit, onDelete }) {
  const [tab, setTab] = useState("history");

  const docIcon = (type) => type === "report" ? "📄" : type === "summary" ? "📝" : "📎";
  const docLabel = (type) => type === "report" ? "דוח" : type === "summary" ? "סיכום" : "אחר";
  const docClass = (type) => `doc-type-badge doc-type-${type}`;

  return (
    <>
      <div className="back-btn" onClick={onBack}>← חזרה לרשימה</div>
      <h1 className="page-title">{patient.name}</h1>
      <div className="card" style={{display:"flex",gap:24,marginBottom:20}}>
        <div><p className="text-soft">גיל</p><strong>{patient.age}</strong></div>
        <div><p className="text-soft">אבחנה</p><strong>{patient.diagnosis}</strong></div>
        <div><p className="text-soft">פגישות</p><strong>{patient.sessions}</strong></div>
        <div><p className="text-soft">תור הבא</p><strong>{patient.nextAppt}</strong></div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-primary btn-sm" onClick={() => openModal("pre_session", patient)}>🔍 סקירה לפני טיפול</button>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal("post_session", patient)}>📝 סיכום אחרי טיפול</button>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal("reminder", patient)}>🔔 תזכורת</button>
          <button className="btn btn-secondary btn-sm" onClick={() => openAiChat(patient)}>🤖 עוזר AI</button>
          <button className="btn btn-danger btn-sm" onClick={() => openModal("receipt", patient)}>🧾 קבלה</button>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>✏️ עריכה</button>
          <button className="btn btn-danger btn-sm" onClick={() => { if(window.confirm("למחוק את " + patient.name + "?")) onDelete(); }}>🗑️ מחיקה</button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab==="history"?"active":""}`} onClick={() => setTab("history")}>היסטוריה</div>
        <div className={`tab ${tab==="docs"?"active":""}`} onClick={() => setTab("docs")}>מסמכים {documents.length > 0 && `(${documents.length})`}</div>
        <div className={`tab ${tab==="info"?"active":""}`} onClick={() => setTab("info")}>מידע כללי</div>
      </div>

      {tab === "history" && (() => {
        const history = patient.history || [];
        if (history.length === 0) return (
          <p className="text-soft" style={{textAlign:"center",padding:20}}>אין סיכומי טיפולים עדיין</p>
        );

        const latest = history[0];
        const archived = history.slice(1);

        // Check if latest is older than 7 days
        const parseDate = (d) => {
          if (!d) return null;
          const parts = d.split("/");
          if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]);
          return new Date(d);
        };
        const latestDate = parseDate(latest.date);
        const isOld = latestDate && (new Date() - latestDate) > 7 * 24 * 60 * 60 * 1000;
        const showLatestInArchive = isOld;
        const visibleLatest = showLatestInArchive ? null : latest;
        const archiveItems = showLatestInArchive ? history : archived;

        return (
          <div className="session-list">
            {visibleLatest && (
              <div className="session-item" style={{borderRight:"3px solid var(--sage-dark)",background:"var(--sage-light)"}}>
                <div style={{fontSize:"0.72rem",fontWeight:600,color:"var(--sage-dark)",marginBottom:4}}>🟢 טיפול אחרון</div>
                <div className="session-date">📅 {visibleLatest.date}</div>
                <div className="session-summary">{visibleLatest.summary}</div>
              </div>
            )}

            {archiveItems.length > 0 && (
              <details style={{marginTop:8}}>
                <summary style={{cursor:"pointer",fontSize:"0.85rem",color:"var(--sage-dark)",fontWeight:500,
                  padding:"10px 14px",background:"var(--warm)",borderRadius:10,listStyle:"none",
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>📁 ארכיון טיפולים ({archiveItems.length})</span>
                  <span style={{fontSize:"0.75rem",color:"var(--text-soft)"}}>לחץ לפתיחה</span>
                </summary>
                <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                  {archiveItems.map((s, i) => (
                    <div key={i} className="session-item">
                      <div className="session-date">📅 {s.date}</div>
                      <div className="session-summary">{s.summary}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        );
      })()}

      {tab === "docs" && (
        <div className="card">
          <div className="card-title">📁 מסמכים ודוחות</div>
          <UploadZone patientId={patient.id} addDocument={addDocument} />
          {documents.length > 0 && (
            <div className="doc-list">
              {documents.map((doc, i) => (
                <div key={i} className="doc-item">
                  <div className="doc-icon">{docIcon(doc.type)}</div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-meta">{doc.date} · {doc.size}</div>
                  </div>
                  <span className={docClass(doc.type)}>{docLabel(doc.type)}</span>
                  <button className="btn btn-danger btn-sm" style={{marginRight:8}}
                    onClick={() => removeDocument(patient.id, i)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
          {documents.length === 0 && (
            <p className="text-soft" style={{textAlign:"center",marginTop:12}}>עדיין לא הועלו מסמכים</p>
          )}
        </div>
      )}

      {tab === "info" && (
        <div className="card">
          <p><strong>שם פרטי:</strong> {patient.firstName || patient.name}</p>
          <p className="mt-2"><strong>שם משפחה:</strong> {patient.lastName || ""}</p>
          {patient.gender && <p className="mt-2"><strong>מין:</strong> {patient.gender}</p>}
          {patient.birthDate && <p className="mt-2"><strong>תאריך לידה:</strong> {new Date(patient.birthDate).toLocaleDateString("he-IL")} ({calcAge(patient.birthDate)})</p>}
          {!patient.birthDate && patient.age && <p className="mt-2"><strong>גיל:</strong> {patient.age}</p>}
          {patient.idNumber && <p className="mt-2"><strong>תעודת זהות:</strong> {patient.idNumber}</p>}
          <p className="mt-2"><strong>אבחנה:</strong> {patient.diagnosis}</p>
          {patient.parentName && <p className="mt-2"><strong>הורה / איש קשר:</strong> {patient.parentName}</p>}
          {patient.phone && <p className="mt-2"><strong>טלפון:</strong> {patient.phone}</p>}
          {patient.email && <p className="mt-2"><strong>מייל:</strong> {patient.email}</p>}
          <p className="mt-2"><strong>מס' פגישות:</strong> {patient.sessions}</p>
          <p className="mt-2"><strong>תור הבא:</strong> {patient.nextAppt}</p>
          <div className="mt-2" style={{display:"flex",alignItems:"center",gap:12}}>
            <strong>סטטוס תשלום:</strong>
            <div style={{
              fontSize:"0.82rem", padding:"4px 12px", borderRadius:20, fontWeight:500,
              background: patient.paid ? "#E8F5E8" : "#FBE8E3",
              color: patient.paid ? "#2E7D32" : "#C4724A"
            }}>
              {patient.paid ? "✅ שולם" : "❌ טרם שולם"}
            </div>
            <button className="btn btn-sm" style={{
              background: patient.paid ? "#FBE8E3" : "#E8F5E8",
              color: patient.paid ? "#C4724A" : "#2E7D32",
              fontSize:"0.75rem"
            }} onClick={() => {
              const newPaid = !patient.paid;
              setPatients(prev => prev.map(p => p.id === patient.id ? {...p, paid: newPaid} : p));
              sb.markPaid(patient.id, newPaid).catch(() => {});
              showNotification(newPaid ? "✅ סומן כשולם" : "❌ סומן כטרם שולם");
            }}>
              {patient.paid ? "סמן כטרם שולם" : "סמן כשולם"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Receipts ───────────────────────────────────────────────────────
function Receipts({ patients, openModal }) {
  return (
    <>
      <h1 className="page-title">🧾 קבלות ותשלומים</h1>
      <div className="card">
        <div className="card-title">ממתינים לתשלום</div>
        {patients.filter(p => !p.paid).map(p => (
          <div key={p.id} className="patient-row">
            <div className="patient-avatar">{p.name[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{p.name}</div>
              <div className="patient-meta">תור אחרון: {p.history[0]?.date}</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openModal("receipt", p)}>הנפק קבלה</button>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">שולמו</div>
        {patients.filter(p => p.paid).map(p => (
          <div key={p.id} className="patient-row">
            <div className="patient-avatar">{p.name[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{p.name}</div>
              <div className="patient-meta">תור אחרון: {p.history[0]?.date}</div>
            </div>
            <span style={{fontSize:"0.72rem",padding:"4px 10px",borderRadius:20,fontWeight:500,background:"#E8F5E8",color:"#2E7D32"}}>✅ שולם</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Age Calculator ────────────────────────────────────────────────
function calcAge(birthDate) {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `גיל: ${months} חודשים`;
  if (months === 0) return `גיל: ${years} שנים`;
  return `גיל: ${years} שנים ו-${months} חודשים`;
}

// ── Patient Form Modal ────────────────────────────────────────────
function PatientFormModal({ mode, patient, onSave, onClose }) {
  const [form, setForm] = useState({
    firstName: patient?.firstName || (patient?.name ? patient.name.split(' ')[0] : ""),
    lastName: patient?.lastName || (patient?.name ? patient.name.split(' ').slice(1).join(' ') : ""),
    gender: patient?.gender || "",
    birthDate: patient?.birthDate || "",
    idNumber: patient?.idNumber || "",
    diagnosis: patient?.diagnosis || "",
    nextAppt: patient?.nextAppt || "",
    phone: patient?.phone || "",
    email: patient?.email || "",
    parentName: patient?.parentName || "",
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const isEdit = mode === "edit";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{isEdit ? "✏️ עריכת פרטי מטופל" : "➕ מטופל חדש"}</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>שם פרטי *</label>
            <input className="field" placeholder="שם פרטי" value={form.firstName} onChange={e => set("firstName", e.target.value)} />
          </div>
          <div className="form-group">
            <label>שם משפחה *</label>
            <input className="field" placeholder="שם משפחה" value={form.lastName} onChange={e => set("lastName", e.target.value)} />
          </div>
          <div className="form-group full">
            <label>מין</label>
            <div style={{display:"flex", gap:10, marginTop:4}}>
              {["זכר","נקבה"].map(g => (
                <div key={g} onClick={() => set("gender", g)}
                  style={{
                    flex:1, textAlign:"center", padding:"10px", borderRadius:10, cursor:"pointer",
                    border: form.gender === g ? "2px solid var(--sage-dark)" : "2px solid var(--warm)",
                    background: form.gender === g ? "var(--sage-light)" : "var(--cream)",
                    fontWeight: form.gender === g ? 500 : 400,
                    color: form.gender === g ? "var(--sage-dark)" : "var(--text-soft)",
                    transition:"all 0.15s"
                  }}>
                  {g === "זכר" ? "👦 זכר" : "👧 נקבה"}
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>תאריך לידה</label>
            <input className="field" type="date" value={form.birthDate} onChange={e => set("birthDate", e.target.value)}
              style={{direction:"ltr", textAlign:"right"}} />
            {form.birthDate && <span style={{fontSize:"0.75rem",color:"var(--sage-dark)",marginTop:4,display:"block"}}>
              {calcAge(form.birthDate)}
            </span>}
          </div>
          <div className="form-group full">
            <label>אבחנה / סיבת הפנייה</label>
            <input className="field" placeholder="למשל: עיכוב בהתפתחות הדיבור" value={form.diagnosis} onChange={e => set("diagnosis", e.target.value)} />
          </div>
          <div className="form-group">
            <label>תעודת זהות</label>
            <input className="field" placeholder="000000000" maxLength={9} value={form.idNumber} onChange={e => set("idNumber", e.target.value.replace(/\D/g,""))} />
          </div>
          <div className="form-group">
            <label>שם הורה / איש קשר</label>
            <input className="field" placeholder="שם ההורה" value={form.parentName} onChange={e => set("parentName", e.target.value)} />
          </div>
          <div className="form-group">
            <label>טלפון הורה</label>
            <input className="field" placeholder="050-0000000" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div className="form-group full">
            <label>מייל הורה</label>
            <input className="field" type="email" placeholder="example@gmail.com" value={form.email} onChange={e => set("email", e.target.value)}
              style={{direction:"ltr", textAlign:"right"}} />
          </div>
          <div className="form-group full">
            <label>תור הבא</label>
            <input className="field" placeholder="למשל: יום ג', 10:00" value={form.nextAppt} onChange={e => set("nextAppt", e.target.value)} />
          </div>
        </div>

        {(form.phone || form.email) && (
          <div style={{marginTop:16, padding:"14px 16px", background:"var(--sage-light)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:500, fontSize:"0.88rem"}}>📋 שאלון הורים</div>
              <div style={{fontSize:"0.75rem", color:"var(--text-soft)", marginTop:2}}>שלחי שאלון ממלא לפני הטיפול הראשון</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => alert("⏳ שאלון ההורים יהיה זמין לאחר העלאת התוכן")}>
              📤 שלח שאלון
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-3">
          <button className="btn btn-primary"
            onClick={() => { if (!form.firstName.trim()) return alert("נא להזין שם פרטי"); onSave(form); }}
          >{isEdit ? "שמור שינויים" : "הוסף מטופל"}</button>
          <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ── Documents Bank ────────────────────────────────────────────────
function DocumentsBank({ docBank, addDocToBank, removeDocFromBank, showNotification }) {
  const [activeTab, setActiveTab] = useState("continuation");
  const [analyzing, setAnalyzing] = useState(false);
  const [styleNote, setStyleNote] = useState("");
  const fileInputRef = useRef();

  const categories = [
    { id: "continuation", label: "📋 בקשה להמשך", desc: "בקשות להמשך טיפול" },
    { id: "discharge",    label: "📄 דוח סיום",    desc: "דוחות סיום טיפול" },
    { id: "diagnosis",    label: "🔍 אבחונים",      desc: "דוחות אבחון" },
  ];

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      const size = file.size > 1024*1024 ? (file.size/1024/1024).toFixed(1)+" MB" : Math.round(file.size/1024)+" KB";
      addDocToBank(activeTab, {
        name: file.name,
        date: new Date().toLocaleDateString("he-IL"),
        size,
        type: file.name.split(".").pop().toLowerCase(),
      }, file);
    });
  };

  const analyzeStyle = async () => {
    const allDocs = [...docBank.continuation, ...docBank.discharge, ...docBank.diagnosis];
    if (allDocs.length === 0) {
      setStyleNote("⚠️ אין מסמכים להניתוח. העלי מסמכים קודם.");
      return;
    }
    setAnalyzing(true);
    const docList = allDocs.map(d => d.name).join(", ");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `יש לי ${allDocs.length} מסמכים מקצועיים: ${docList}. 
על סמך שמות המסמכים, תאר בקצרה איך נראה סגנון כתיבה מקצועי של קלינאית תקשורת בדוחות כאלה. 
מה האלמנטים החשובים? מה הטון? מה המבנה? כתוב 3-4 משפטים בעברית.`
          }]
        })
      });
      const data = await res.json();
      setStyleNote(data.text || "לא הצלחתי לנתח");
    } catch {
      setStyleNote("שגיאה בניתוח");
    }
    setAnalyzing(false);
  };

  const activeDocs = docBank[activeTab] || [];
  const activeCategory = categories.find(c => c.id === activeTab);
  const totalDocs = Object.values(docBank).flat().length;

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title" style={{marginBottom:0}}>📚 מאגר מסמכים</h1>
        <div style={{fontSize:"0.82rem",color:"var(--text-soft)"}}>
          {totalDocs} מסמכים סה"כ
        </div>
      </div>

      {/* Style analysis card */}
      <div className="card" style={{marginBottom:20,background:"linear-gradient(135deg,#E8F0E8,#F0EDE8)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:4}}>🤖 ניתוח סגנון כתיבה</div>
            <div style={{fontSize:"0.82rem",color:"var(--text-soft)"}}>
              ה-AI ילמד את סגנון הכתיבה מהמסמכים שהעלית
            </div>
            {styleNote && <div style={{marginTop:10,fontSize:"0.85rem",lineHeight:1.6}}>{styleNote}</div>}
          </div>
          <button className="btn btn-primary btn-sm" onClick={analyzeStyle} disabled={analyzing}>
            {analyzing ? "מנתח..." : "🔍 נתח סגנון"}
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="doc-bank-tabs">
        {categories.map(c => (
          <div key={c.id} className={`doc-bank-tab ${activeTab === c.id ? "active" : ""}`}
            onClick={() => setActiveTab(c.id)}>
            {c.label}
            {docBank[c.id].length > 0 && (
              <span style={{marginRight:4,background:"var(--sage-dark)",color:"white",
                borderRadius:"50%",width:18,height:18,display:"inline-flex",
                alignItems:"center",justifyContent:"center",fontSize:"0.7rem"}}>
                {docBank[c.id].length}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <div className="card">
        <div style={{fontWeight:500,marginBottom:12,color:"var(--sage-dark)"}}>
          {activeCategory?.label} — {activeCategory?.desc}
        </div>

        <div className="upload-zone" onClick={() => fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
          <div className="upload-icon">📂</div>
          <p><strong>לחצי להעלאת מסמך</strong> או גררי לכאן</p>
          <p style={{marginTop:4}}>PDF, Word — עד 20MB</p>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx"
            style={{display:"none"}} onChange={e => handleFiles(e.target.files)} />
        </div>

        {/* Docs list */}
        {activeDocs.length === 0 ? (
          <div className="doc-bank-empty">
            <div className="empty-icon">📭</div>
            <p>אין מסמכים בקטגוריה זו עדיין</p>
          </div>
        ) : (
          <div className="doc-list" style={{marginTop:16}}>
            {activeDocs.map((doc, i) => (
              <div key={i} className="doc-item">
                <div className="doc-icon">{doc.type === "pdf" ? "📄" : "📝"}</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">{doc.date} · {doc.size}</div>
                </div>
                <button className="btn btn-danger btn-sm"
                  onClick={() => removeDocFromBank(activeTab, i)}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Settings ──────────────────────────────────────────────────────
function Settings({ settings, saveSetting }) {
  const [activeTab, setActiveTab] = useState("clinic");
  const [saved, setSaved] = useState(false);

  const tabs = [
    { id: "clinic",    label: "🏥 קליניקה" },
    { id: "calendar",  label: "📅 יומן" },
    { id: "payment",   label: "💳 תשלום" },
    { id: "whatsapp",  label: "📱 וואטסאפ" },
  ];

  const handleSave = (key, value) => {
    saveSetting(key, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Field = ({ label, settingKey, placeholder, type="text" }) => (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:5}}>{label}</div>
      <input className="field" type={type} placeholder={placeholder}
        defaultValue={settings[settingKey]}
        onBlur={e => handleSave(settingKey, e.target.value)} />
    </div>
  );

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title" style={{marginBottom:0}}>⚙️ הגדרות</h1>
        {saved && <div style={{color:"var(--sage-dark)",fontWeight:500,fontSize:"0.85rem"}}>✅ נשמר!</div>}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"var(--warm)",borderRadius:12,padding:4}}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setActiveTab(t.id)}
            style={{flex:1,textAlign:"center",padding:"10px 4px",borderRadius:10,cursor:"pointer",
              fontSize:"0.8rem",fontWeight: activeTab===t.id ? 600 : 400,
              background: activeTab===t.id ? "white" : "transparent",
              color: activeTab===t.id ? "var(--sage-dark)" : "var(--text-soft)",
              boxShadow: activeTab===t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition:"all 0.15s"}}>
            {t.label}
          </div>
        ))}
      </div>

      <div className="card">
        {/* Clinic tab */}
        {activeTab === "clinic" && (
          <>
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:16}}>פרטי הקליניקה</div>
            <Field label="שם הקליניקה" settingKey="clinicName" placeholder="לדוגמה: קליניקת שמש" />
            <Field label="שם המטפלת" settingKey="therapistName" placeholder="שם מלא" />
            <Field label="טלפון" settingKey="phone" placeholder="050-0000000" type="tel" />
            <Field label="מייל" settingKey="email" placeholder="clinic@gmail.com" type="email" />
            <Field label="כתובת" settingKey="address" placeholder="רחוב, עיר" />
            <div style={{marginBottom:16}}>
              <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:5}}>לוגו (קישור לתמונה)</div>
              <input className="field" placeholder="https://..." defaultValue={settings.logoUrl}
                onBlur={e => handleSave("logoUrl", e.target.value)} />
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt="לוגו" style={{width:80,height:80,objectFit:"contain",marginTop:8,borderRadius:8,border:"1px solid var(--warm)"}} />
              )}
            </div>
          </>
        )}

        {/* Calendar tab */}
        {activeTab === "calendar" && (
          <>
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:16}}>הגדרות יומן</div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:8}}>ימי עבודה</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"].map((day,i) => (
                  <div key={i} onClick={() => {
                    const days = settings.workDays.includes(i)
                      ? settings.workDays.filter(d => d !== i)
                      : [...settings.workDays, i];
                    handleSave("workDays", days);
                  }} style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:"0.82rem",
                    background: settings.workDays.includes(i) ? "var(--sage-dark)" : "var(--warm)",
                    color: settings.workDays.includes(i) ? "white" : "var(--text-soft)",
                    transition:"all 0.15s"}}>
                    {day}
                  </div>
                ))}
              </div>
              <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginTop:8}}>
                שעת התחלה ומשך טיפול ניתנים לעריכה ישירות ביומן
              </div>
            </div>
          </>
        )}

        {/* Payment tab */}
        {activeTab === "payment" && (
          <>
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:16}}>הגדרות תשלום</div>
            <Field label="מחיר ברירת מחדל לטיפול (₪)" settingKey="defaultPrice" placeholder="350" type="number" />
            <div style={{marginTop:20,padding:14,background:"var(--cream)",borderRadius:12}}>
              <div style={{fontWeight:500,marginBottom:12,color:"var(--sage-dark)"}}>🧾 חשבונית ירוקה</div>
              <Field label="API Key" settingKey="giKey" placeholder="מפתח API" />
              <Field label="API Secret" settingKey="giSecret" placeholder="סיסמת API" />
              {settings.giKey && <div style={{fontSize:"0.75rem",color:"var(--sage-dark)"}}>✅ מחובר</div>}
            </div>
          </>
        )}

        {/* WhatsApp tab */}
        {activeTab === "whatsapp" && (
          <>
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:16}}>הגדרות וואטסאפ</div>
            <div style={{padding:14,background:"var(--cream)",borderRadius:12,marginBottom:16}}>
              <div style={{fontWeight:500,marginBottom:12,color:"var(--sage-dark)"}}>📱 Green API</div>
              <Field label="Instance ID" settingKey="greenInstanceId" placeholder="1234567890" />
              <Field label="API Token" settingKey="greenToken" placeholder="טוקן" />
              {settings.greenInstanceId && settings.greenToken &&
                <div style={{fontSize:"0.75rem",color:"var(--sage-dark)"}}>✅ מחובר</div>}
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:5}}>שעת שליחת תזכורות</div>
              <input className="field" type="time" defaultValue={settings.reminderHour}
                onBlur={e => handleSave("reminderHour", e.target.value)} />
            </div>
            <div>
              <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:5}}>תבנית הודעת תזכורת</div>
              <textarea className="field" rows={3} defaultValue={settings.reminderTemplate}
                onBlur={e => handleSave("reminderTemplate", e.target.value)} />
              <div style={{fontSize:"0.72rem",color:"var(--text-soft)",marginTop:4}}>
                משתנים: {"{שם}"} {"{שעה}"} {"{תאריך}"}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal">
        {children}
        <button className="btn btn-secondary mt-3" style={{marginRight:8}} onClick={onClose}>סגור</button>
      </div>
    </div>
  );
}

