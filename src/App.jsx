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
      archived: p.archived === true,
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
  async archivePatient(id, archived) {
    await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ archived })
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
        minutes: apt.minutes || 45,
        date: apt.date || null
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
  async updateAppointmentPaid(id, paid) {
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paid })
    });
  },
  async getUnpaidArrivedAppointments() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?status=eq.arrived&block_type=eq.treatment&select=*&order=date.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.filter(a => a.paid !== true) : [];
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
  },
  async getReceipts() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/receipts?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async saveReceipt(r) {
    await fetch(`${SUPABASE_URL}/rest/v1/receipts`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: r.patientId, patient_name: r.patientName, amount: r.amount, method: r.method, note: r.note, receipt_number: r.receiptNumber })
    });
  },
  async getSettings() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return {};
    const res = await fetch(`${SUPABASE_URL}/rest/v1/settings?select=key,value`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return {};
    const data = await res.json();
    const obj = {};
    (Array.isArray(data) ? data : []).forEach(row => {
      try { obj[row.key] = JSON.parse(row.value); } catch { obj[row.key] = row.value; }
    });
    return obj;
  },
  async saveSetting(key, value) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value: JSON.stringify(value) })
    });
  },
  async getLeads() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  async addLead(lead) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(lead)
    });
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  },
  async updateLead(id, updates) {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
  },
  async deleteLead(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async saveQuestionnaire(patientId, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/questionnaires`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ patient_id: patientId, data })
    });
    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  },
  async getQuestionnaire(patientId) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/questionnaires?patient_id=eq.${patientId}&order=completed_at.desc&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }
};
const GI_KEY    = import.meta.env.VITE_GI_KEY || "";
const GI_SECRET = import.meta.env.VITE_GI_SECRET || "";

// ── Palette & globals ──────────────────────────────────────────────
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #F2F2F7;
  --cream: #FFFFFF;
  --warm: #E8E8F0;
  --sage: #6366F1;
  --sage-light: #C7D2FE;
  --sage-dark: #4338CA;
  --terracotta: #F43F5E;
  --peach: #FFF1F2;
  --peach-dark: #FECDD3;
  --mint: #ECFDF5;
  --mint-dark: #10B981;
  --yellow: #FFFBEB;
  --yellow-dark: #F59E0B;
  --text: #1C1C1E;
  --text-soft: #8E8E93;
  --white: #FFFFFF;
  --shadow: 0 2px 16px rgba(99,102,241,0.08);
  --shadow-hover: 0 8px 32px rgba(99,102,241,0.18);
  --radius: 22px;
  --radius-sm: 16px;
}

body {
  font-family: -apple-system, 'SF Pro Display', 'SF Pro Text', 'Inter', 'Plus Jakarta Sans', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  direction: rtl;
  -webkit-font-smoothing: antialiased;
}

h1,h2,h3,h4 { 
  font-family: -apple-system, 'SF Pro Display', 'Inter', sans-serif;
  font-weight: 700; 
  letter-spacing: -0.8px;
}

.app {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
.sidebar {
  width: 240px;
  background: rgba(28, 28, 30, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: white;
  display: flex;
  flex-direction: column;
  padding: 28px 0;
  flex-shrink: 0;
  box-shadow: 1px 0 0 rgba(255,255,255,0.06);
}
.sidebar-logo {
  padding: 0 20px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 12px;
}
.sidebar-logo h2 { 
  font-size: 1.5rem; 
  font-family: -apple-system, 'SF Pro Display', sans-serif;
  font-weight: 700;
  color: white;
  letter-spacing: -1px;
}
.sidebar-logo p { 
  font-size: 0.65rem; 
  color: rgba(255,255,255,0.3); 
  margin-top: 3px; 
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: 400;
}

.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.18s;
  border-radius: 12px;
  margin: 1px 10px;
  color: rgba(255,255,255,0.55);
  font-weight: 400;
  letter-spacing: -0.1px;
}
.nav-item:hover { 
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.9);
}
.nav-item.active {
  background: rgba(99,102,241,0.25);
  color: white;
  font-weight: 600;
}
.nav-icon { font-size: 1.05rem; width: 20px; text-align: center; }

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
  font-size: 1.9rem;
  color: var(--text);
  margin-bottom: 22px;
  font-weight: 700;
  letter-spacing: -1.2px;
  font-family: -apple-system, 'SF Pro Display', sans-serif;
}

/* ── Cards ── */
.card {
  background: var(--white);
  border-radius: var(--radius);
  padding: 22px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  margin-bottom: 16px;
  border: 0.5px solid rgba(0,0,0,0.06);
  transition: all 0.2s;
}
.card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06); }
.card-title {
  font-size: 1rem;
  color: var(--text);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  letter-spacing: -0.3px;
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
  border-radius: var(--radius-sm);
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  text-align: center;
  border: 0.5px solid rgba(0,0,0,0.06);
  transition: all 0.2s;
}
.stat-card:nth-child(1) { background: #EEF2FF; }
.stat-card:nth-child(2) { background: #ECFDF5; }
.stat-card:nth-child(3) { background: #FFFBEB; }
.stat-card:nth-child(4) { background: #FFF1F2; }
.stat-card:hover { transform: translateY(-2px); }
.stat-num { 
  font-family: -apple-system, 'SF Pro Display', sans-serif;
  font-size: 2.4rem; 
  color: var(--text); 
  font-weight: 700;
  letter-spacing: -1.5px;
  line-height: 1;
}
.stat-label { font-size: 0.72rem; color: var(--text-soft); margin-top: 6px; font-weight: 500; letter-spacing: 0.2px; }

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
  gap: 14px;
  padding: 12px 14px;
  background: var(--white);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s;
  border: 0.5px solid rgba(0,0,0,0.06);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.patient-row:hover { 
  background: #F8F8FF;
  border-color: rgba(99,102,241,0.2);
}
.patient-avatar {
  width: 44px; height: 44px;
  border-radius: 14px;
  background: #EEF2FF;
  display: flex; align-items: center; justify-content: center;
  font-family: -apple-system, 'SF Pro Display', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: #6366F1;
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

.tabs { 
  display: flex; gap: 2px; margin-bottom: 20px;
  background: rgba(0,0,0,0.05);
  border-radius: 12px;
  padding: 3px;
}
.tab {
  flex: 1; text-align: center;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text-soft);
  font-weight: 500;
}
.tab.active { 
  background: white;
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
.tab:not(.active):hover { color: var(--text); }

.session-list { display: flex; flex-direction: column; gap: 12px; }
.session-item {
  border-right: 4px solid var(--sage-light);
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--cream), var(--white));
  border-radius: 0 14px 14px 0;
  box-shadow: 0 2px 8px rgba(74,114,64,0.06);
  transition: all 0.2s;
}
.session-item:hover { border-right-color: var(--sage-dark); background: var(--peach); }
.session-date { font-size: 0.78rem; color: var(--text-soft); margin-bottom: 6px; font-weight: 500; }
.session-summary { font-size: 0.88rem; line-height: 1.7; }

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
  border-radius: 26px;
  padding: 28px 32px;
  width: 520px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 32px 80px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06);
  animation: slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1);
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
.btn-primary { 
  background: #6366F1;
  color: white;
  font-weight: 600;
  letter-spacing: -0.2px;
}
.btn-primary:hover { 
  background: #4F46E5;
  transform: scale(0.98);
}
.btn-secondary { 
  background: rgba(99,102,241,0.08);
  color: #4F46E5;
  border: none;
  font-weight: 500;
}
.btn-secondary:hover { background: rgba(99,102,241,0.15); }
.btn-danger { 
  background: rgba(244,63,94,0.08);
  color: #F43F5E;
  border: none;
  font-weight: 500;
}
.btn-danger:hover { background: rgba(244,63,94,0.15); }
.btn-sm { padding: 6px 14px; font-size: 0.78rem; border-radius: 10px; }

/* ── Textarea / Input ── */
.field {
  width: 100%;
  padding: 13px 14px;
  border: 1.5px solid rgba(0,0,0,0.1);
  border-radius: 14px;
  font-family: -apple-system, 'SF Pro Text', sans-serif;
  font-size: 0.9rem;
  background: var(--bg);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  direction: rtl;
  resize: vertical;
  -webkit-font-smoothing: antialiased;
}
.field:focus { 
  border-color: #6366F1; 
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
  background: white;
}
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
  background: linear-gradient(135deg, var(--sage-dark), #3D6B33);
  color: white;
  padding: 13px 20px;
  border-radius: 14px;
  margin-bottom: 20px;
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 16px rgba(74,114,64,0.25);
  animation: slideDown 0.3s ease;
}
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
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

  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [rememberMe, setRememberMe] = useState(false);

  // Check existing session on load
  useEffect(() => {
    const stored = localStorage.getItem("supabase_session");
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session?.access_token) {
          setUser(session.user);
        }
      } catch {}
    }
    // Load remembered email
    const rememberedEmail = localStorage.getItem("remembered_email");
    const rememberedPassword = localStorage.getItem("remembered_password");
    if (rememberedEmail) {
      setLoginEmail(rememberedEmail);
      setRememberMe(true);
    }
    if (rememberedPassword) {
      setLoginPassword(rememberedPassword);
    }
    setAuthLoading(false);
  }, []);

  const handleAuth = async () => {
    setAuthError("");
    if (!loginEmail || !loginPassword) {
      setAuthError("נא למלא מייל וסיסמה");
      return;
    }
    try {
      const endpoint = authMode === "login"
        ? `${SUPABASE_URL}/auth/v1/token?grant_type=password`
        : `${SUPABASE_URL}/auth/v1/signup`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
        },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.error || data.error_description) {
        setAuthError(authMode === "login" ? "מייל או סיסמה שגויים" : data.error_description || "שגיאה בהרשמה");
        return;
      }
      if (data.access_token) {
        localStorage.setItem("supabase_session", JSON.stringify(data));
        if (rememberMe) {
          localStorage.setItem("remembered_email", loginEmail);
          localStorage.setItem("remembered_password", loginPassword);
        } else {
          localStorage.removeItem("remembered_email");
          localStorage.removeItem("remembered_password");
        }
        setUser(data.user);
      } else {
        setAuthError("משהו השתבש, נסה שוב");
      }
    } catch {
      setAuthError("שגיאת חיבור, נסה שוב");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("supabase_session");
    setUser(null);
    // Keep remembered credentials
    const rememberedEmail = localStorage.getItem("remembered_email");
    if (!rememberedEmail) {
      setLoginEmail("");
      setLoginPassword("");
    }
  };

  // Login screen JSX — rendered conditionally below
  const loginScreen = (
    <div style={{
      minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%)",
      fontFamily:"inherit",direction:"rtl",padding:"1rem"
    }}>
      <div style={{
        background:"white",borderRadius:24,padding:"2rem 1.5rem",
        width:"100%",maxWidth:360,
        boxShadow:"0 20px 60px rgba(99,102,241,0.15)"
      }}>
        <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
          <div style={{fontSize:"2.5rem",marginBottom:8}}>🏥</div>
          <div style={{fontSize:"1.4rem",fontWeight:700,color:"#6366F1"}}>ClinicUp</div>
          <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginTop:4}}>מערכת ניהול קליניקה</div>
        </div>

        <div style={{display:"flex",gap:4,background:"#F5F5F5",borderRadius:12,padding:3,marginBottom:"1.2rem"}}>
          {[["login","התחברות"],["signup","הרשמה"]].map(([mode,label]) => (
            <div key={mode} onClick={() => { setAuthMode(mode); setAuthError(""); }}
              style={{
                flex:1,textAlign:"center",padding:"8px",borderRadius:10,cursor:"pointer",
                fontSize:"0.85rem",fontWeight:authMode===mode?600:400,
                background:authMode===mode?"white":"transparent",
                color:authMode===mode?"#6366F1":"var(--text-soft)",
                boxShadow:authMode===mode?"0 1px 4px rgba(0,0,0,0.08)":"none",
                transition:"all 0.15s"
              }}>{label}</div>
          ))}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:4}}>כתובת מייל</div>
          <input
            type="email"
            placeholder="example@gmail.com"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={{
              width:"100%",padding:"10px 12px",borderRadius:10,
              border:"1.5px solid #E0E7FF",fontSize:"0.9rem",
              direction:"ltr",textAlign:"right",outline:"none",
              fontFamily:"inherit",boxSizing:"border-box"
            }}
          />
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:4}}>סיסמה</div>
          <input
            type="password"
            placeholder="••••••••"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={{
              width:"100%",padding:"10px 12px",borderRadius:10,
              border:"1.5px solid #E0E7FF",fontSize:"0.9rem",
              direction:"ltr",textAlign:"right",outline:"none",
              fontFamily:"inherit",boxSizing:"border-box"
            }}
          />
        </div>

        {authError && (
          <div style={{
            background:"#FFF1F2",color:"#E11D48",fontSize:"0.8rem",
            padding:"8px 12px",borderRadius:8,marginBottom:12,textAlign:"center"
          }}>{authError}</div>
        )}

        {authMode === "login" && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer"}}
            onClick={() => setRememberMe(p => !p)}>
            <div style={{
              width:20,height:20,borderRadius:6,flexShrink:0,
              background: rememberMe ? "#6366F1" : "white",
              border:`2px solid ${rememberMe ? "#6366F1" : "#C7D2FE"}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all 0.15s"
            }}>
              {rememberMe && <span style={{color:"white",fontSize:13,fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:"0.82rem",color:"var(--text-soft)"}}>זכור אותי</span>
          </div>
        )}

        <button onClick={handleAuth} style={{
          width:"100%",padding:"12px",borderRadius:12,border:"none",
          background:"#6366F1",color:"white",fontSize:"1rem",
          fontWeight:600,cursor:"pointer",fontFamily:"inherit",
          boxShadow:"0 4px 12px rgba(99,102,241,0.3)"
        }}>
          {authMode === "login" ? "כניסה" : "הרשמה"}
        </button>
      </div>
    </div>
  );
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
    reminderTemplate: "שלום {שם הורה} 😊\nמתזכרת אתכם שיש טיפול מחר {תאריך} בשעה {שעה} ל{שם המטופל}.\nאודה לאישור הגעה:\n1️⃣ כן, נגיע\n2️⃣ לצערנו לא נוכל להגיע",
    giKey: "",
    giSecret: "",
    greenInstanceId: "",
    greenToken: "",
    logoUrl: "",
  });

  const saveSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    sb.saveSetting(key, value).catch(() => {});
  };
  const [appointments, setAppointments] = useState([]);
  const [unpaidAppointments, setUnpaidAppointments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [receiptsHistory, setReceiptsHistory] = useState([]);
  const [patientModal, setPatientModal] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);

  // Load patients, appointments and document bank from Supabase on startup
  useEffect(() => {
    Promise.all([sb.getPatients(), sb.getAppointments(), sb.getDocumentBank(), sb.getReceipts(), sb.getSettings(), sb.getLeads(), sb.getUnpaidArrivedAppointments()])
      .then(([pData, aData, dData, rData, sData, lData, uData]) => {
        setPatients(Array.isArray(pData) ? pData : []);
        setAppointments(Array.isArray(aData) ? aData : []);
        setUnpaidAppointments(Array.isArray(uData) ? uData : []);
        // Build docBank from flat array
        const bank = { continuation: [], discharge: [], diagnosis: [] };
        (Array.isArray(dData) ? dData : []).forEach(d => {
          if (bank[d.category]) bank[d.category].push({ ...d });
        });
        setDocBank(bank);
        setReceiptsHistory(Array.isArray(rData) ? rData : []);
        if (sData && Object.keys(sData).length > 0) {
          setSettings(prev => ({ ...prev, ...sData }));
        }
        setLeads(Array.isArray(lData) ? lData : []);
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
      await sb.archivePatient(id, true);
      setPatients(prev => prev.map(x => x.id === id ? {...x, archived: true} : x));
      setSelectedPatient(null);
      setPage("patients_list");
      showNotification("📦 " + p.name + " הועבר לארכיון");
    } catch {
      showNotification("❌ שגיאה");
    }
  };
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [modal, setModal] = useState(null); // "post_session" | "pre_session" | "receipt" | "report" | "questionnaire"
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showPatientsDrawer, setShowPatientsDrawer] = useState(false);
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
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState([]);
  const [markPaidModal, setMarkPaidModal] = useState(null); // { patientName, apts }
  const [notification, setNotification] = useState("");
  const [receiptSuccess, setReceiptSuccess] = useState(null);
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
    if (type === "questionnaire") {
      setCurrentPatientForModal(patient);
      setShowQuestionnaire(true);
      return;
    }
    setCurrentPatientForModal(patient);
    setAiText(""); setSessionNote(""); setAiChatMessages([]);
    setModal(type);
    if (type === "pre_session") generatePreSession(patient);
    if (type === "receipt") {
      setReceiptData({
        amount: "",
        method: "ביט",
        note: "",
        email: patient?.email || "",
        phone: patient?.phone || ""
      });
      setSelectedAppointmentIds([]);
    }
  };

  const closeModal = () => setModal(null);
  const openQuestionnaire = (patient) => {
    setCurrentPatientForModal(patient);
    setShowQuestionnaire(true);
  };

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
      // Reload all patients from Supabase to avoid duplicates
      const freshPatients = await sb.getPatients();
      if (Array.isArray(freshPatients)) setPatients(freshPatients);
      showNotification(`✅ סיכום נשמר עבור ${currentPatientForModal.name}`);
    } catch {
      showNotification("❌ שגיאה בשמירת הסיכום");
    }
    closeModal();
  };

  const sendWhatsApp = async (patient, customMessage) => {
    const instanceId = settings.greenInstanceId;
    const token = settings.greenToken;
    const phone = patient.phone;

    if (!instanceId || !token) {
      showNotification("⚠️ חסרים פרטי Green API בהגדרות");
      return;
    }
    if (!phone) {
      showNotification("⚠️ אין מספר טלפון למטופל");
      return;
    }

    // Build message from template or custom
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString("he-IL");
    
    // Find tomorrow's appointment for this patient
    const tomorrowApt = appointments.find(a => {
      const aptDate = new Date(a.date);
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      return a.date && aptDate.toDateString() === tom.toDateString() && 
             (a.patient_id === patient.id || a.patient_name === patient.name);
    });
    
    const timeStr = tomorrowApt?.start_time || "";
    const template = settings.reminderTemplate || 
      "שלום {שם} 😊\nמתזכרת לך לטיפול מחר {תאריך} בשעה {שעה}.\nאשמח לאישור הגעה:\n1️⃣ כן, אגיע\n2️⃣ לא אוכל להגיע";
    
    const message = customMessage || template
      .replace("{שם הורה}", patient.parentName || patient.firstName || patient.name)
      .replace("{שם המטופל}", patient.firstName || patient.name)
      .replace("{שם}", patient.parentName || patient.firstName || patient.name)
      .replace("{תאריך}", dateStr)
      .replace("{שעה}", timeStr);

    showNotification("⏳ שולח הודעה...");
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, token, phone, message })
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`✅ הודעה נשלחה ל${patient.name}!`);
      } else {
        showNotification(`❌ שגיאה: ${data.error}`);
      }
    } catch {
      showNotification("❌ שגיאה בשליחת הודעה");
    }
  };

  const generateReceipt = async () => {
    if (!receiptData.amount) return alert("נא להזין סכום");
    showNotification("⏳ יוצר חשבונית מס קבלה...");
    try {
      const email = receiptData.email || currentPatientForModal?.email || "";
      const patient = currentPatientForModal;
      const parentFull = patient?.parentName
        ? `${patient.parentName} ${patient?.lastName || ""}`.trim()
        : patient?.name || "";
      const childFirst = patient?.firstName || "";
      const clientName = `${parentFull}${childFirst ? ` (${childFirst})` : ""}${patient?.idNumber ? ` , ${patient.idNumber}` : ""}`;

      // בניית תיאור עם תאריכי טיפול
      const selectedApts = unpaidAppointments.filter(a => selectedAppointmentIds.includes(a.id));
      const datesList = selectedApts.map(a => {
        const d = new Date(a.date);
        return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
      }).join(", ");
      const description = selectedApts.length > 0
        ? `טיפול קלינאות תקשורת - ${patient?.name} | עבור תאריכי הטיפול: ${datesList}`
        : receiptData.note || `טיפול קלינאות תקשורת - ${patient?.name}`;

      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: clientName,
          amount: receiptData.amount,
          paymentMethod: receiptData.method,
          email,
          description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // עדכון paid=true לכל הפגישות שנבחרו
        for (const aptId of selectedAppointmentIds) {
          await sb.updateAppointmentPaid(aptId, true).catch(() => {});
        }
        // עדכון state של appointments
        setAppointments(prev => prev.map(a =>
          selectedAppointmentIds.includes(a.id) ? { ...a, paid: true } : a
        ));
        // רענון רשימת פגישות לא משולמות
        const uData = await sb.getUnpaidArrivedAppointments().catch(() => []);
        setUnpaidAppointments(Array.isArray(uData) ? uData : []);

        setPatients(prev => prev.map(p =>
          p.id === patient?.id ? { ...p, paid: true } : p
        ));
        sb.markPaid(patient?.id, true).catch(() => {});
        setReceiptSuccess({
          clientName,
          receiptNumber: data.receiptNumber,
          amount: receiptData.amount,
          method: receiptData.method,
        });
        try {
          await sb.saveReceipt({
            patientId: patient?.id,
            patientName: patient?.name,
            amount: parseFloat(receiptData.amount),
            method: receiptData.method,
            note: description,
            receiptNumber: data.receiptNumber
          });
          const rData = await sb.getReceipts();
          setReceiptsHistory(Array.isArray(rData) ? rData : []);
        } catch {}
      } else {
        showNotification(`❌ שגיאה: ${data.error}`);
      }
    } catch (err) {
      showNotification(`❌ שגיאה: ${err.message}`);
    }
    setSelectedAppointmentIds([]);
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
        <div style={{fontFamily:"Plus Jakarta Sans, sans-serif",fontSize:"2.5rem",fontWeight:800,letterSpacing:"-2px",background:"linear-gradient(135deg,#6C63FF,#9B95FF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ClinicUp</div>
        <div style={{display:"flex",gap:6,alignItems:"center",color:"var(--text-soft)",fontSize:"0.85rem"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--sage)",animation:"bounce 0.8s infinite"}} />
          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--sage)",animation:"bounce 0.8s 0.2s infinite"}} />
          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--sage)",animation:"bounce 0.8s 0.4s infinite"}} />
          <span>טוען...</span>
        </div>
      </div>
    </>
  );

  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"inherit"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:"2rem",marginBottom:8}}>🏥</div>
        <div style={{color:"var(--text-soft)"}}>טוען...</div>
      </div>
    </div>
  );

  if (!user) return <>{loginScreen}</>;

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar page={page} setPage={(p) => { setPage(p); setSelectedPatient(null); setShowPatientsDrawer(false); }} leadsCount={leads.filter(l => l.status === "waiting").length} openPatientsDrawer={() => setShowPatientsDrawer(true)} onLogout={handleLogout} />
        <main className="main">
          {notification && <div className="banner">🔔 {notification}</div>}

          {markPaidModal && (
            <div className="modal-overlay" onClick={() => setMarkPaidModal(null)}>
              <div className="modal" style={{width:340}} onClick={e => e.stopPropagation()}>
                <h3 style={{marginBottom:14}}>👑 סמן כשולם — {markPaidModal.patientName}</h3>
                <p style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:12}}>בחר את הטיפולים ששולמו:</p>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                  {markPaidModal.apts.map(a => {
                    const d = new Date(a.date);
                    const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
                    const checked = markPaidModal.selectedIds.includes(a.id);
                    return (
                      <div key={a.id} onClick={() => setMarkPaidModal(prev => ({
                        ...prev,
                        selectedIds: checked
                          ? prev.selectedIds.filter(id => id !== a.id)
                          : [...prev.selectedIds, a.id]
                      }))} style={{
                        display:"flex",alignItems:"center",gap:10,
                        padding:"8px 12px",borderRadius:10,cursor:"pointer",
                        background: checked ? "#6366F1" : "white",
                        border:`1.5px solid ${checked ? "#6366F1" : "#C7D2FE"}`,
                        transition:"all 0.15s"
                      }}>
                        <div style={{
                          width:18,height:18,borderRadius:4,flexShrink:0,
                          background: checked ? "white" : "transparent",
                          border:`2px solid ${checked ? "#6366F1" : "#A5B4FC"}`,
                          display:"flex",alignItems:"center",justifyContent:"center"
                        }}>
                          {checked && <span style={{fontSize:12,color:"#6366F1",fontWeight:700}}>✓</span>}
                        </div>
                        <span style={{fontSize:"0.85rem",fontWeight:500,color: checked ? "white" : "#1C1C1E",flex:1}}>{dateStr}</span>
                        <span style={{fontSize:"0.78rem",color: checked ? "rgba(255,255,255,0.8)" : "#8E8E93"}}>{a.start_time}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-primary" disabled={markPaidModal.selectedIds.length === 0}
                    onClick={async () => {
                      for (const aptId of markPaidModal.selectedIds) {
                        await sb.updateAppointmentPaid(aptId, true).catch(() => {});
                      }
                      setAppointments(prev => prev.map(a =>
                        markPaidModal.selectedIds.includes(a.id) ? { ...a, paid: true } : a
                      ));
                      const uData = await sb.getUnpaidArrivedAppointments().catch(() => []);
                      setUnpaidAppointments(Array.isArray(uData) ? uData : []);
                      setMarkPaidModal(null);
                    }}>
                    👑 סמן כשולם ({markPaidModal.selectedIds.length})
                  </button>
                  <button className="btn btn-secondary" onClick={() => setMarkPaidModal(null)}>ביטול</button>
                </div>
              </div>
            </div>
          )}

          {receiptSuccess && (
            <div className="modal-overlay" onClick={() => setReceiptSuccess(null)}>
              <div className="modal" style={{width:340,padding:0,overflow:"hidden",borderRadius:20}} onClick={e => e.stopPropagation()}>
                <div style={{background:"#6366F1",padding:"28px 24px 20px",textAlign:"center"}}>
                  <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
                    <span style={{fontSize:28}}>✓</span>
                  </div>
                  <div style={{fontSize:"1.1rem",fontWeight:600,color:"white",marginBottom:4}}>החשבונית הופקה בהצלחה</div>
                  <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.75)"}}>החשבונית נשלחה למייל של ההורה</div>
                </div>
                <div style={{padding:"20px 20px 24px",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#EEF2FF",borderRadius:10}}>
                    <span style={{fontSize:"0.75rem",color:"#4338CA"}}>לקוח</span>
                    <span style={{fontSize:"0.75rem",color:"#3730A3",fontWeight:600,textAlign:"left",maxWidth:"60%"}}>{receiptSuccess.clientName}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#F0FDF4",borderRadius:10}}>
                    <span style={{fontSize:"0.75rem",color:"#166534"}}>מספר חשבונית</span>
                    <span style={{fontSize:"0.75rem",color:"#166534",fontWeight:600}}>{receiptSuccess.receiptNumber}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#FFFBEB",borderRadius:10}}>
                    <span style={{fontSize:"0.75rem",color:"#92400E"}}>סכום</span>
                    <span style={{fontSize:"0.9rem",color:"#92400E",fontWeight:700}}>₪{receiptSuccess.amount}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#FDF4FF",borderRadius:10}}>
                    <span style={{fontSize:"0.75rem",color:"#7E22CE"}}>אמצעי תשלום</span>
                    <span style={{fontSize:"0.75rem",color:"#7E22CE",fontWeight:600}}>{receiptSuccess.method}</span>
                  </div>
                  <button onClick={() => setReceiptSuccess(null)}
                    style={{marginTop:8,padding:"10px 0",background:"#6366F1",color:"white",border:"none",borderRadius:12,fontSize:"0.9rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    סגור
                  </button>
                </div>
              </div>
            </div>
          )}

          {page === "dashboard" && <Dashboard patients={patients} appointments={appointments} unpaidAppointments={unpaidAppointments} openModal={openModal} sendWhatsApp={sendWhatsApp} setMarkPaidModal={setMarkPaidModal} />}
          {page === "calendar" && <Calendar patients={patients} appointments={appointments} setAppointments={setAppointments} openModal={openModal} sendWhatsApp={sendWhatsApp} settings={settings}
            onSelectPatient={(p) => { setSelectedPatient(p); setPage("patient_detail"); }}
            onOpenPostSession={(p) => { setCurrentPatientForModal(p); setSessionNote(""); setModal("post_session"); }} />}
          {(page === "patients_list" || page === "patients" || page === "receipts" || page === "patients_archive") && (
            <div>
              {/* Mobile sub-tabs - only shown on mobile */}
              <div style={{display:"flex",gap:4,marginBottom:16,background:"rgba(108,99,255,0.08)",borderRadius:14,padding:4}}>
                {[
                  {id:"patients_list", icon:"👥", label:"מטופלים"},
                  {id:"receipts", icon:"🧾", label:"חשבוניות"},
                  {id:"patients_archive", icon:"📦", label:"ארכיון"},
                ].map(t => (
                  <div key={t.id} onClick={() => setPage(t.id)}
                    style={{flex:1,textAlign:"center",padding:"9px 4px",borderRadius:10,cursor:"pointer",
                      fontSize:"0.78rem",fontWeight:page===t.id?700:400,
                      background:page===t.id?"white":"transparent",
                      color:page===t.id?"var(--sage-dark)":"var(--text-soft)",
                      boxShadow:page===t.id?"0 2px 8px rgba(108,99,255,0.15)":"none",
                      transition:"all 0.15s"}}>
                    {t.icon} {t.label}
                  </div>
                ))}
              </div>
              {(page === "patients_list" || page === "patients") && !selectedPatient &&
                <PatientList patients={patients.filter(p => !p.archived)} onSelect={p => { setSelectedPatient(p); setPage("patient_detail"); }}
                  onAdd={() => setPatientModal("add")} />}
              {/* receipts now inside patients section */}
              {page === "patients_archive" && <PatientsArchive patients={patients.filter(p => p.archived)} receiptsHistory={receiptsHistory} openAiChat={openAiChat} onRestore={(id) => {
                sb.archivePatient(id, false);
                setPatients(prev => prev.map(p => p.id === id ? {...p, archived: false} : p));
              }} onDelete={async (id) => {
                await sb.deletePatient(id);
                setPatients(prev => prev.filter(p => p.id !== id));
                showNotification("🗑️ המטופל נמחק לצמיתות");
              }} />}
            </div>
          )}
          {page === "patient_detail" && selectedPatient &&
            <PatientDetail patient={selectedPatient} onBack={() => { setSelectedPatient(null); setPage("patients_list"); }}
              openModal={openModal} generateReport={generateReport} aiText={aiText} aiLoading={aiLoading} openAiChat={openAiChat}
              documents={documents[selectedPatient.id] || []} addDocument={addDocument} removeDocument={removeDocument}
              onEdit={() => { setEditingPatient(selectedPatient); setPatientModal("edit"); }}
              onDelete={() => deletePatient(selectedPatient.id)}
              onSessionUpdated={async () => {
                const fresh = await sb.getPatients();
                if (Array.isArray(fresh)) setPatients(fresh);
              }} />}
          {page === "receipts" && <Receipts patients={patients.filter(p => !p.archived)} openModal={openModal} receiptsHistory={receiptsHistory} />}
          {page === "settings" && <Settings settings={settings} saveSetting={saveSetting} />}
          {/* archive now inside patients section */}
          {page === "finance" && <Finance receiptsHistory={receiptsHistory} appointments={appointments} />}
          {page === "leads" && <Leads leads={leads} setLeads={setLeads} />}
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
          <h3>🧾 חשבונית מס קבלה — {currentPatientForModal?.name}</h3>

          {/* בחירת תאריכי טיפול */}
          {(() => {
            const todayStr = new Date().toISOString().split("T")[0];
            const patientUnpaid = unpaidAppointments.filter(a =>
              (String(a.patient_id) === String(currentPatientForModal?.id) || a.patient_name === currentPatientForModal?.name)
              && a.date <= todayStr
            );
            if (patientUnpaid.length === 0) return null;
            const pricePerSession = parseFloat(settings?.defaultPrice || 380);
            return (
              <div style={{background:"#EEF2FF",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontWeight:600,fontSize:"0.85rem",color:"#4338CA",marginBottom:8}}>
                  📅 בחר טיפולים לחשבונית ({patientUnpaid.length} טיפולים לא משולמים)
                </div>
                {patientUnpaid.map(a => {
                  const d = new Date(a.date);
                  const dateStr = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
                  const checked = selectedAppointmentIds.includes(a.id);
                  return (
                    <div key={a.id} onClick={() => {
                      const newIds = checked
                        ? selectedAppointmentIds.filter(id => id !== a.id)
                        : [...selectedAppointmentIds, a.id];
                      setSelectedAppointmentIds(newIds);
                      setReceiptData(prev => ({ ...prev, amount: String(newIds.length * pricePerSession) }));
                    }} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"7px 10px",borderRadius:8,cursor:"pointer",marginBottom:4,
                      background: checked ? "#6366F1" : "white",
                      border:`1.5px solid ${checked ? "#6366F1" : "#C7D2FE"}`,
                      transition:"all 0.15s"
                    }}>
                      <div style={{
                        width:18,height:18,borderRadius:4,flexShrink:0,
                        background: checked ? "white" : "transparent",
                        border:`2px solid ${checked ? "#6366F1" : "#A5B4FC"}`,
                        display:"flex",alignItems:"center",justifyContent:"center"
                      }}>
                        {checked && <span style={{fontSize:12,color:"#6366F1",fontWeight:700}}>✓</span>}
                      </div>
                      <span style={{fontSize:"0.82rem",fontWeight:500,color: checked ? "white" : "#1C1C1E",flex:1}}>{dateStr}</span>
                      <span style={{fontSize:"0.78rem",color: checked ? "rgba(255,255,255,0.8)" : "#8E8E93"}}>{a.start_time}</span>
                      <span style={{fontSize:"0.78rem",fontWeight:600,color: checked ? "white" : "#6366F1"}}>₪{pricePerSession}</span>
                    </div>
                  );
                })}
                {selectedAppointmentIds.length > 0 && (
                  <div style={{marginTop:8,padding:"6px 10px",background:"white",borderRadius:8,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:"0.78rem",color:"#4338CA",fontWeight:500}}>
                      {selectedAppointmentIds.length} טיפולים נבחרו
                    </span>
                    <span style={{fontSize:"0.9rem",fontWeight:700,color:"#4338CA"}}>
                      סה״כ: ₪{selectedAppointmentIds.length * pricePerSession}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

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
              <div className="receipt-row"><span>שם לקוח:</span><span>{currentPatientForModal?.parentName || currentPatientForModal?.name}</span></div>
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
            <button className="btn btn-primary" onClick={generateReceipt}>שלח חשבונית</button>
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
      {/* Patients Drawer */}
      {showPatientsDrawer && (
        <>
          <div onClick={() => setShowPatientsDrawer(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:300}} />
          <div style={{
            position:"fixed",top:0,right:0,
            width:"min(33vw, 260px)",height:"100vh",
            background:"linear-gradient(160deg,#1A1D2E,#2D2B55)",
            zIndex:301,padding:"24px 16px",
            display:"flex",flexDirection:"column",gap:8,
            boxShadow:"-8px 0 40px rgba(0,0,0,0.3)",
            animation:"slideInRight 0.25s ease"
          }}>
            <div style={{color:"rgba(255,255,255,0.45)",fontSize:"0.7rem",fontWeight:600,
              letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:12}}>
              ניהול הקליניקה
            </div>
            {[
              {id:"patients_list",icon:"👥",label:"מטופלים"},
              {id:"receipts",icon:"🧾",label:"חשבוניות"},
              {id:"patients_archive",icon:"📦",label:"ארכיון"},
            ].map(t => (
              <div key={t.id}
                onClick={() => { setPage(t.id); setSelectedPatient(null); setShowPatientsDrawer(false); }}
                style={{
                  display:"flex",alignItems:"center",gap:12,
                  padding:"13px 14px",borderRadius:14,cursor:"pointer",
                  background:page===t.id?"rgba(108,99,255,0.3)":"rgba(255,255,255,0.05)",
                  color:page===t.id?"white":"rgba(255,255,255,0.7)",
                  fontWeight:page===t.id?700:400,fontSize:"0.9rem",
                  border:page===t.id?"1px solid rgba(108,99,255,0.4)":"1px solid transparent",
                  transition:"all 0.15s"
                }}>
                <span style={{fontSize:"1.2rem"}}>{t.icon}</span>{t.label}
              </div>
            ))}
          </div>
        </>
      )}

      {showQuestionnaire && currentPatientForModal && (
        <QuestionnaireModal
          patient={currentPatientForModal}
          onClose={() => setShowQuestionnaire(false)}
          onSave={(data) => {
            showNotification("✅ השאלון נשמר בהצלחה!");
            setShowQuestionnaire(false);
          }}
        />
      )}
    </>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────
function Sidebar({ page, setPage, leadsCount, openPatientsDrawer, onLogout }) {
  const patientsSubPages = ["patients_list","receipts","patients_archive"];
  const isPatientsSection = patientsSubPages.includes(page) || page === "patients" || page === "patient_detail";

  const nav = [
    { id:"dashboard",       icon:"🏠", label:"ראשי" },
    { id:"calendar",        icon:"📅", label:"יומן" },
    { id:"patients",        icon:"👥", label:"ניהול הקליניקה", sub:[
      { id:"patients_list",     icon:"👥", label:"מטופלים" },
      { id:"receipts",          icon:"🧾", label:"חשבוניות" },
      { id:"patients_archive",  icon:"📦", label:"ארכיון" },
    ]},
    { id:"leads",           icon:"⏳", label:"המתנה" },
    { id:"finance",         icon:"📊", label:"כספים" },
    { id:"documents_bank",  icon:"📚", label:"מסמכים" },
    { id:"settings",        icon:"⚙️", label:"הגדרות" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>ClinicUp</h2>
        <p>CLINIC MANAGEMENT</p>
      </div>
      {nav.map(n => (
        <div key={n.id}>
          <div className={`nav-item ${(page === n.id || (n.id==="patients" && isPatientsSection) || (page==="patient_detail" && n.id==="patients")) ? "active":""}`}
            onClick={() => n.sub ? openPatientsDrawer() : setPage(n.id)}
            style={{position:"relative"}}>
            <span className="nav-icon">{n.icon}</span>{n.label}
            {n.id === "leads" && leadsCount > 0 && (
              <span style={{
                position:"absolute", top:6, left:8,
                background:"#E53935", color:"white",
                borderRadius:"50%", minWidth:18, height:18,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"0.65rem", fontWeight:700, padding:"0 3px"
              }}>{leadsCount}</span>
            )}
          </div>
          {/* Sub-tabs */}
          {n.sub && isPatientsSection && n.id === "patients" && (
            <div style={{background:"rgba(0,0,0,0.2)"}}>
              {n.sub.map(s => (
                <div key={s.id}
                  className={`nav-item ${page === s.id || (page === "patient_detail" && s.id === "patients_list") ? "active" : ""}`}
                  onClick={() => setPage(s.id)}
                  style={{
                    fontSize:"0.78rem",
                    padding:"8px 16px 8px 24px",
                    borderRight:"2px solid transparent",
                    paddingRight:32
                  }}>
                  <span style={{marginLeft:4,opacity:0.7}}>—</span>
                  <span className="nav-icon" style={{fontSize:"0.85rem"}}>{s.icon}</span>
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div onClick={onLogout} className="nav-item" style={{marginTop:"auto",opacity:0.7,cursor:"pointer"}}>
        <span className="nav-icon">🚪</span>יציאה
      </div>
    </aside>
  );
}


// ── Dashboard ──────────────────────────────────────────────────────
function Dashboard({ patients, appointments, unpaidAppointments, openModal, sendWhatsApp, setMarkPaidModal }) {
  const activePatients = patients.filter(p => p && !p.archived);
  const todayStr = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const tomorrowStr = (() => { const d=new Date(); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const fmtD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const realApts = appointments.filter(a => a.date && a.block_type !== "break");
  const todayApts = realApts.filter(a => a.date === todayStr).sort((a,b) => (a.start_time||"") > (b.start_time||"") ? 1 : -1);
  const tomorrowApts = realApts.filter(a => a.date === tomorrowStr).sort((a,b) => (a.start_time||"") > (b.start_time||"") ? 1 : -1);
  const weekApts = realApts.filter(a => a.date >= fmtD(weekStart) && a.date <= fmtD(weekEnd));
  const totalWeekApts = weekApts.length;

  // קיבוץ פגישות לא משולמות לפי מטופל (רק עד היום)
  const todayStr2 = new Date().toISOString().split("T")[0];
  const unpaidByPatient = (unpaidAppointments || [])
    .filter(a => a.date <= todayStr2)
    .reduce((acc, a) => {
      const key = String(a.patient_id) || a.patient_name;
      if (!acc[key]) acc[key] = { patientId: a.patient_id, patientName: a.patient_name, apts: [] };
      acc[key].apts.push(a);
      return acc;
    }, {});
  const unpaidPatients = Object.values(unpaidByPatient);

  const [openPanel, setOpenPanel] = useState(null);
  const togglePanel = (id) => setOpenPanel(prev => prev === id ? null : id);

  const panels = [
    {
      id: "today",
      icon: "📅",
      label: "טיפולים היום",
      count: todayApts.length,
      color: "#EEF2FF",
      accent: "#6C63FF",
      empty: "אין טיפולים היום",
      content: todayApts.map((a, i) => {
        const patient = patients.find(p => p.id === a.patient_id || p.name === a.patient_name);
        return (
          <div key={i} className="patient-row" style={{marginBottom:8}}>
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
      })
    },
    {
      id: "tomorrow",
      icon: "🗓️",
      label: "טיפולים מחר",
      count: tomorrowApts.length,
      color: "#E8FFF4",
      accent: "#00C97B",
      empty: "אין טיפולים מחר",
      content: tomorrowApts.map((a, i) => {
        const patient = patients.find(p => p.id === a.patient_id || p.name === a.patient_name);
        return (
          <div key={i} className="patient-row" style={{marginBottom:8}}>
            <div className="patient-avatar">{(a.patient_name||"?")[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{a.patient_name}</div>
              <div className="patient-meta">🕐 {a.start_time}</div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => patient && openModal("pre_session", patient)}>סקירה</button>
            <button className="btn btn-sm btn-primary" onClick={() => patient && sendWhatsApp(patient)}>📱 וואטסאפ</button>
          </div>
        );
      })
    },
    {
      id: "unpaid",
      icon: "🧾",
      label: "ממתינים לתשלום",
      count: unpaidPatients.length,
      color: unpaidPatients.length > 0 ? "#FFF8E1" : "#E8FFF4",
      accent: unpaidPatients.length > 0 ? "#FFB300" : "#00C97B",
      empty: "✅ כל המטופלים שילמו",
      content: unpaidPatients.map(up => {
        const patient = patients.find(p => p.id === up.patientId || p.name === up.patientName);
        return (
          <div key={up.patientId || up.patientName} className="patient-row" style={{marginBottom:8}}>
            <div className="patient-avatar">{(up.patientName||"?")[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{up.patientName}</div>
              <div className="patient-meta" style={{color:"#C4724A",display:"flex",alignItems:"center",gap:6}}>
                ❌ טרם שולם
                <span style={{background:"#FFB300",color:"white",borderRadius:"50%",
                  minWidth:18,height:18,display:"inline-flex",alignItems:"center",
                  justifyContent:"center",fontSize:"0.65rem",fontWeight:700,padding:"0 3px"}}>
                  {up.apts.length}
                </span>
              </div>
            </div>
            <button className="btn btn-sm" style={{background:"#E8F5E8",color:"#2E7D32",border:"none",marginLeft:4}}
              onClick={() => setMarkPaidModal({ patientName: up.patientName, apts: up.apts, selectedIds: [] })}>
              👑 שולם
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => patient && openModal("receipt", patient)}>🧾 הפק</button>
          </div>
        );
      })
    },
  ];

  return (
    <>
      <h1 className="page-title">שלום! 👋</h1>

      {/* Stats */}
      <div className="stats-grid" style={{marginBottom:20}}>
        <div className="stat-card"><div className="stat-num">{activePatients.length}</div><div className="stat-label">סה"כ מטופלים</div></div>
        <div className="stat-card"><div className="stat-num">{todayApts.length}</div><div className="stat-label">טיפולים היום</div></div>
        <div className="stat-card"><div className="stat-num">{totalWeekApts}</div><div className="stat-label">טיפולים השבוע</div></div>
        <div className="stat-card"><div className="stat-num" style={{color: unpaidPatients.length > 0 ? "var(--terracotta)" : "var(--sage-dark)"}}>{unpaidPatients.length}</div><div className="stat-label">ממתינים לתשלום</div></div>
      </div>

      {/* Collapsible panels */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {panels.map(panel => (
          <div key={panel.id}
            style={{borderRadius:18,overflow:"hidden",
              boxShadow: openPanel===panel.id ? "0 8px 30px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.06)",
              transition:"box-shadow 0.2s",border:`1px solid ${panel.accent}22`}}>

            {/* Panel header */}
            <div onClick={() => togglePanel(panel.id)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"16px 20px",cursor:"pointer",
                background: openPanel===panel.id ? panel.color : "white",
                transition:"background 0.2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:12,
                  background:`${panel.accent}20`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem"}}>
                  {panel.icon}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:"0.95rem",color:"var(--text)"}}>{panel.label}</div>
                  <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginTop:1}}>
                    {panel.count === 0 ? "אין רשומות" : `${panel.count} רשומות`}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {panel.count > 0 && (
                  <div style={{background:panel.accent,color:"white",
                    borderRadius:"50%",minWidth:24,height:24,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:"0.75rem",fontWeight:700}}>
                    {panel.count}
                  </div>
                )}
                <div style={{fontSize:"1rem",color:"var(--text-soft)",
                  transform: openPanel===panel.id ? "rotate(180deg)" : "rotate(0deg)",
                  transition:"transform 0.2s"}}>
                  ▾
                </div>
              </div>
            </div>

            {/* Panel content */}
            {openPanel === panel.id && (
              <div style={{padding:"12px 20px 16px",background:"white",
                borderTop:`2px solid ${panel.accent}33`}}>
                {panel.count === 0
                  ? <p className="text-soft" style={{textAlign:"center",padding:"12px 0"}}>{panel.empty}</p>
                  : panel.content
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Calendar ───────────────────────────────────────────────────────
// Each day has an ordered list of "blocks": { type:"treatment"|"break", minutes, patientId?, patientName?, status? }
// The schedule is built by walking blocks sequentially from dayStart.

// ── Hebrew Date & Holidays ────────────────────────────────────────
function useHebrewCalendar(weekDates) {
  const [holidays, setHolidays] = useState({});

  useEffect(() => {
    if (!weekDates || weekDates.length === 0) return;
    const start = weekDates[0];
    const end = weekDates[weekDates.length - 1];
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    // Fetch holidays for both start and end month (week might span two months)
    const months = [...new Set([start.getMonth()+1, end.getMonth()+1])];
    const year = start.getFullYear();
    Promise.all(months.map(month =>
      fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&year=${year}&month=${month}&ss=on&mf=on&c=off&geo=il&M=on&s=on`)
        .then(r => r.json())
        .catch(() => ({ items: [] }))
    )).then(results => {
      const map = {};
      results.forEach(data => {
        (data.items || []).forEach(item => {
          const d = item.date?.split("T")[0];
          if (d) {
            if (!map[d]) map[d] = [];
            if (!map[d].includes(item.title)) map[d].push(item.title);
          }
        });
      });
      setHolidays(map);
    }).catch(() => {});
  }, [weekDates?.map(d=>d.toISOString()).join(",")]);

  const getHebrewDate = (date) => {
    try {
      const heLetters = ["","א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ז׳","ח׳","ט׳","י׳","י״א","י״ב","י״ג","י״ד","ט״ו","ט״ז","י״ז","י״ח","י״ט","כ׳","כ״א","כ״ב","כ״ג","כ״ד","כ״ה","כ״ו","כ״ז","כ״ח","כ״ט","ל׳"];
      const monthName = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { month: "long" }).format(date);
      const dayNum = parseInt(new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric" }).format(date).replace(/[^\d]/g,""));
      const dayHe = heLetters[dayNum] || dayNum;
      return `${dayHe} ${monthName}`;
    } catch { return ""; }
  };

  return { holidays, getHebrewDate };
}

function Calendar({ patients, appointments, setAppointments, openModal, sendWhatsApp, settings, onSelectPatient, onOpenPostSession }) {
  const [dayStart, setDayStart] = useState("08:30");
  const makeId = () => Math.random().toString(36).slice(2,8);

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);

  // Get the Sunday of current week + offset
  const getWeekStart = (offset) => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const sun = new Date(today);
    sun.setDate(today.getDate() - day + offset * 7);
    sun.setHours(0,0,0,0);
    return sun;
  };

  const weekStart = getWeekStart(weekOffset);

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };

  const workDays = settings?.workDays || [0,1,2,3,4];
  const WEEK_DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];

  // Build week dates
  const weekDates = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }).filter(d => workDays.includes(d.getDay()));

  const { holidays, getHebrewDate } = useHebrewCalendar(weekDates);

  // Get appointments for a specific date
  const getDateBlocks = (dateStr) => {
    return (appointments || [])
      .filter(a => a.date && a.date === dateStr)
      .sort((a,b) => (a.start_time||"") > (b.start_time||"") ? 1 : -1)
      .map(a => ({
        id: a.id,
        type: a.block_type || "treatment",
        minutes: a.minutes || 45,
        patientId: a.patient_id,
        patientName: a.patient_name,
        status: a.status || "pending",
        startTime: a.start_time || "08:30",
        date: a.date,
        paid: a.paid === true
      }));
  };

  const toMin = t => { const [h,m] = (t||"00:00").split(":").map(Number); return h*60+m; };
  const toTime = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;

  const buildTimeline = (dateStr) => {
    const blocks = getDateBlocks(dateStr);
    let cur = toMin(dayStart);
    return blocks.map(b => {
      const start = b.startTime !== "08:30" ? b.startTime : toTime(cur);
      cur = toMin(start) + b.minutes;
      return { ...b, startTime: start, endTime: toTime(cur) };
    });
  };

  const [addModal, setAddModal] = useState(null);
  const [addType, setAddType] = useState("treatment");
  const [breakMins, setBreakMins] = useState(10);
  const [patientQ, setPatientQ] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(8);

  const assignPatientToModal = async (patient) => {
    try {
      const timeline = buildTimeline(addModal.dateStr);
      const insertAfter = timeline[addModal.insertAfterIdx];
      // אם זו שעת חלון — השתמש בשעת ה-slot, אחרת חשב רגיל
      const startTime = addModal.slotStartTime || (insertAfter ? insertAfter.endTime : dayStart);
      const dayIdx = new Date(addModal.dateStr).getDay();

      // אם יש slotId — מחק את ה-slot
      if (addModal.slotId) {
        await sb.deleteAppointment(addModal.slotId).catch(() => {});
        setAppointments(prev => prev.filter(a => a.id !== addModal.slotId));
      }

      // Build list of dates to add
      const dates = [addModal.dateStr];
      if (isRecurring) {
        for (let w = 1; w < recurringWeeks; w++) {
          const d = new Date(addModal.dateStr);
          d.setDate(d.getDate() + w * 7);
          dates.push(fmt(d));
        }
      }

      const newApts = [];
      for (const date of dates) {
        const apt = await sb.addAppointment({
          patientId: patient.id,
          patientName: patient.name,
          dayIndex: dayIdx,
          startTime,
          blockType: "treatment",
          minutes: 45,
          date,
        });
        if (apt && apt.id) {
          newApts.push({
            ...apt,
            day_index: dayIdx,
            patient_name: patient.name,
            patient_id: patient.id,
            status: "pending",
            start_time: startTime,
            date,
            block_type: "treatment",
            minutes: 45
          });
        }
      }
      setAppointments(prev => [...prev, ...newApts]);
    } catch(e) { console.error(e); }
    setAddModal(null);
    setPatientQ("");
    setIsRecurring(false);
  };

  const addBlock = async (dateStr, insertAfterIdx) => {
    if (addType === "break" || addType === "slot") {
      const timeline = buildTimeline(dateStr);
      const insertAfter = timeline[insertAfterIdx];
      const blockStart = insertAfter ? insertAfter.endTime : dayStart;
      try {
        const newApt = await sb.addAppointment({
          dayIndex: new Date(dateStr).getDay(),
          startTime: blockStart,
          blockType: addType,
          minutes: addType === "break" ? breakMins : 45,
          status: addType,
          date: dateStr,
        });
        if (newApt && newApt.id) {
          setAppointments(prev => [...prev, {
            ...newApt,
            day_index: new Date(dateStr).getDay(),
            block_type: addType,
            minutes: addType === "break" ? breakMins : 45,
            start_time: blockStart,
            status: addType,
            date: dateStr
          }]);
        }
      } catch(e) { console.error(e); }
      setAddModal(null);
    }
  };

  const removeBlock = async (dateStr, blockId) => {
    try { await sb.deleteAppointment(blockId); } catch {}
    setAppointments(prev => prev.filter(a => a.id !== blockId));
  };

  const updateStatus = (blockId, status) => {
    sb.updateAppointmentStatus(blockId, status).catch(()=>{});
    setAppointments(prev => prev.map(a => a.id === blockId ? {...a, status} : a));
  };

  const isToday = (d) => fmt(d) === fmt(new Date());

  const weekLabel = () => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})} – ${end.toLocaleDateString("he-IL",{day:"numeric",month:"numeric",year:"numeric"})}`;
  };

  const filteredPatients = patients.filter(p =>
    (p.name||"").includes(patientQ) || (p.firstName||"").includes(patientQ)
  );

  return (
    <div style={{direction:"rtl"}}>
      {/* Week navigation */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <h1 className="page-title" style={{marginBottom:0}}>📅 יומן</h1>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(w => w-1)}>→ שבוע קודם</button>
          <span style={{fontSize:"0.82rem",color:"var(--text-soft)",fontWeight:500}}>{weekLabel()}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(w => w+1)}>שבוע הבא ←</button>
          <button className="btn btn-primary btn-sm" onClick={() => setWeekOffset(0)}>היום</button>
        </div>
      </div>

      {/* Day start setting */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,fontSize:"0.82rem",color:"var(--text-soft)"}}>
        <span>שעת התחלה:</span>
        <input type="time" value={dayStart} onChange={e => setDayStart(e.target.value)}
          style={{padding:"4px 8px",border:"2px solid var(--warm)",borderRadius:8,fontFamily:"DM Sans,sans-serif",fontSize:"0.82rem",background:"var(--cream)"}} />
      </div>

      {/* Week grid */}
      <div className="week-grid">
        {weekDates.map(date => {
          const dateStr = fmt(date);
          const timeline = buildTimeline(dateStr);
          const dayName = WEEK_DAYS_HE[date.getDay()];
          const dateLabel = date.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"});
          const today = isToday(date);

          return (
            <div key={dateStr} style={{
              minWidth:160, flex:1,
              background: today ? "#EEF2FF" : "var(--white)",
              borderRadius:20, padding:14,
              boxShadow: today ? "0 0 0 2px #6366F1" : "0 1px 3px rgba(0,0,0,0.06)",
              border: today ? "none" : "0.5px solid rgba(0,0,0,0.06)"
            }}>
              <div style={{textAlign:"center",borderBottom:"2px solid var(--warm)",paddingBottom:6,marginBottom:10}}>
                <div style={{fontWeight:600,fontSize:"0.85rem",color: today ? "var(--sage-dark)" : "var(--text)"}}>{dayName}</div>
                <div style={{fontSize:"0.75rem",color: today ? "var(--sage-dark)" : "var(--text-soft)",fontWeight: today ? 600 : 400}}>
                  {dateLabel} {today && "⭐"}
                </div>
                <div style={{fontSize:"0.65rem",color:"var(--text-soft)",marginTop:1}}>
                  {getHebrewDate(date)}
                </div>
                {holidays[dateStr] && holidays[dateStr].map((h,i) => {
                  const translations = {
                    "Erev Pesach": "ערב פסח",
                    "Pesach I": "פסח א׳",
                    "Pesach II": "פסח ב׳",
                    "Pesach VII": "פסח ז׳",
                    "Pesach VIII": "פסח ח׳",
                    "Chol HaMoed Pesach": "חול המועד פסח",
                    "Erev Shavuot": "ערב שבועות",
                    "Shavuot I": "שבועות",
                    "Shavuot II": "שבועות ב׳",
                    "Rosh Hashana 5786": "ראש השנה",
                    "Rosh Hashana 5787": "ראש השנה",
                    "Erev Rosh Hashana": "ערב ראש השנה",
                    "Yom Kippur": "יום כיפור",
                    "Erev Yom Kippur": "ערב יום כיפור",
                    "Erev Sukkot": "ערב סוכות",
                    "Sukkot I": "סוכות א׳",
                    "Sukkot II": "סוכות ב׳",
                    "Chol HaMoed Sukkot": "חול המועד סוכות",
                    "Hoshana Raba": "הושענא רבה",
                    "Shmini Atzeret": "שמיני עצרת",
                    "Simchat Torah": "שמחת תורה",
                    "Chanukah: 1 Candle": "חנוכה - נר א׳",
                    "Chanukah: 2 Candles": "חנוכה - נר ב׳",
                    "Chanukah: 3 Candles": "חנוכה - נר ג׳",
                    "Chanukah: 4 Candles": "חנוכה - נר ד׳",
                    "Chanukah: 5 Candles": "חנוכה - נר ה׳",
                    "Chanukah: 6 Candles": "חנוכה - נר ו׳",
                    "Chanukah: 7 Candles": "חנוכה - נר ז׳",
                    "Chanukah: 8 Candles": "חנוכה - נר ח׳",
                    "Tu BiShvat": "ט״ו בשבט",
                    "Purim": "פורים",
                    "Shushan Purim": "פורים שושן",
                    "Erev Purim": "ערב פורים",
                    "Lag BaOmer": "ל״ג בעומר",
                    "Yom HaShoah": "יום השואה",
                    "Yom HaZikaron": "יום הזיכרון",
                    "Yom HaAtzma'ut": "יום העצמאות",
                    "Yom Yerushalayim": "יום ירושלים",
                    "Tu B'Av": "ט״ו באב",
                    "Tish'a B'Av": "תשעה באב",
                    "Erev Tish'a B'Av": "ערב תשעה באב",
                    "Fast of Gedaliah": "צום גדליה",
                    "Fast of Esther": "תענית אסתר",
                    "Rosh Chodesh": "ראש חודש",
                  };
                  const isErev = h.startsWith("Erev");
                  const translated = translations[h] || h;
                  return (
                    <div key={i} style={{fontSize:"0.62rem",
                      background: isErev ? "#FFF3E0" : "#FFF8E1",
                      color: isErev ? "#E65100" : "#F57F17",
                      borderRadius:6,padding:"1px 5px",marginTop:2,fontWeight:500}}>
                      {isErev ? "🌆" : "✡️"} {translated}
                    </div>
                  );
                })}
              </div>

              <AddBtn onClick={() => { setAddModal({dateStr, insertAfterIdx:-1}); setAddType("treatment"); setPatientQ(""); }} />

              {timeline.map((b, bi) => (
                <div key={b.id}>
                  {b.type === "treatment" ? (
                    <div
                      onMouseDown={e => {
                        e.currentTarget._pressTimer = setTimeout(() => {
                          updateStatus(b.id, "pending");
                        }, 600);
                      }}
                      onMouseUp={e => clearTimeout(e.currentTarget._pressTimer)}
                      onMouseLeave={e => clearTimeout(e.currentTarget._pressTimer)}
                      onTouchStart={e => {
                        e.currentTarget._pressTimer = setTimeout(() => {
                          updateStatus(b.id, "pending");
                        }, 600);
                      }}
                      onTouchEnd={e => clearTimeout(e.currentTarget._pressTimer)}
                      style={{
                        background: b.status==="arrived" ? "#E8F5E8" : b.status==="cancelled" ? "#FBE8E3" : "var(--sage-light)",
                        border: `2px solid ${b.status==="arrived" ? "#4CAF50" : b.status==="cancelled" ? "#C4724A" : "var(--sage)"}`,
                        borderRadius:10, padding:"8px 10px", marginBottom:2, position:"relative",
                        userSelect:"none"
                      }}>
                      <div style={{fontSize:"0.68rem",color:"var(--text-soft)"}}>{b.startTime}–{b.endTime}</div>
                      <div style={{fontWeight:600,fontSize:"0.82rem",color:"var(--sage-dark)",marginTop:1,cursor:"pointer",textDecoration:"underline dotted"}}
                        onClick={e=>{e.stopPropagation();
                          const pt = patients.find(p=>p.id===b.patientId||p.name===b.patientName);
                          if(pt){onSelectPatient(pt);}
                        }}>{b.patientName} {b.paid ? "👑" : ""}</div>
                      <div style={{fontSize:"0.68rem",marginTop:2,color:
                        b.status==="arrived"?"#2E7D32":b.status==="cancelled"?"#C4724A":b.status==="confirmed"?"#4CAF50":"#FFA000"}}>
                        {b.status==="arrived"?"✅ הגיע":b.status==="cancelled"?"❌ בוטל":b.status==="confirmed"?"✅ אישר":"⏳ ממתין"}
                      </div>
                      <div style={{display:"flex",gap:4,marginTop:6}}>
                        <button onClick={e=>{e.stopPropagation();updateStatus(b.id,"arrived");}}
                          style={{flex:1,padding:"3px 0",fontSize:"0.6rem",borderRadius:6,border:"none",
                            background:b.status==="arrived"?"#4CAF50":"#E8F5E8",color:b.status==="arrived"?"white":"#2E7D32",cursor:"pointer"}}>
                          ✅ הגיע
                        </button>
                        <button onClick={e=>{e.stopPropagation();updateStatus(b.id,"cancelled");}}
                          style={{flex:1,padding:"3px 0",fontSize:"0.6rem",borderRadius:6,border:"none",
                            background:b.status==="cancelled"?"#C4724A":"#FBE8E3",color:b.status==="cancelled"?"white":"#C4724A",cursor:"pointer"}}>
                          ❌ בוטל
                        </button>
                        <button onClick={e=>{e.stopPropagation();
                          const patient = patients.find(p=>p.id===b.patientId||p.name===b.patientName);
                          const lastSummary = patient?.history?.[0]?.summary;
                          if (!lastSummary) { alert("אין סיכום טיפול קודם"); return; }
                          const u = new SpeechSynthesisUtterance(lastSummary);
                          u.lang = "he-IL";
                          window.speechSynthesis.speak(u);
                        }}
                          style={{flex:1,padding:"3px 0",fontSize:"0.6rem",borderRadius:6,border:"none",
                            background:"var(--warm)",color:"var(--sage-dark)",cursor:"pointer"}}>
                          🔊 סקירה
                        </button>
                        <button onClick={e=>{e.stopPropagation();
                          const pt = patients.find(p=>p.id===b.patientId||p.name===b.patientName);
                          if(pt) onOpenPostSession(pt);
                        }}
                          style={{flex:1,padding:"3px 0",fontSize:"0.6rem",borderRadius:6,border:"none",
                            background:"linear-gradient(135deg,#6C63FF,#8B85FF)",color:"white",cursor:"pointer"}}>
                          📝 תיעוד
                        </button>
                        <button onClick={e=>{e.stopPropagation(); updateStatus(b.id,"pending");}}
                          title="אפס סטטוס"
                          style={{padding:"3px 6px",fontSize:"0.65rem",borderRadius:6,border:"none",
                            background:"#F5F5F5",color:"#8E8E93",cursor:"pointer",
                            display: b.status==="pending" ? "none" : "block"}}>
                          ↺
                        </button>
                      </div>
                      <span onClick={() => removeBlock(dateStr, b.id)}
                        style={{position:"absolute",top:5,left:6,cursor:"pointer",fontSize:"0.7rem",color:"var(--terracotta)",opacity:0.7}}>✕</span>
                    </div>
                  ) : b.type === "slot" ? (
                    <div style={{
                      background:"repeating-linear-gradient(45deg,white,white 6px,#E0F2FE 6px,#E0F2FE 12px)",
                      border:"1.5px solid #7DD3FC",
                      borderRadius:10,padding:"8px 10px",marginBottom:2,position:"relative"
                    }}>
                      <div style={{fontSize:"0.68rem",color:"#0369A1",marginBottom:4,fontWeight:500}}>
                        🕐 שעת חלון · {b.startTime}–{b.endTime}
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"space-between"}}>
                        <button onClick={e=>{e.stopPropagation();
                          setAddModal({dateStr, insertAfterIdx:-1, slotId: b.id, slotStartTime: b.startTime});
                          setAddType("treatment");
                          setPatientQ("");
                        }} style={{
                          flex:1,padding:"4px 8px",fontSize:"0.65rem",borderRadius:6,border:"none",
                          background:"#0284C7",color:"white",cursor:"pointer",fontWeight:600
                        }}>+ הוסף מטופל</button>
                        <span onClick={() => removeBlock(dateStr, b.id)}
                          style={{cursor:"pointer",fontSize:"0.7rem",color:"#C4724A",opacity:0.7}}>✕</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{background:"repeating-linear-gradient(45deg,#f5f0e8,#f5f0e8 4px,#ede5d8 4px,#ede5d8 8px)",
                      borderRadius:10,padding:"6px 10px",marginBottom:2,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:"0.75rem",color:"var(--text-soft)"}}>☕ {b.startTime} ({b.minutes} דק&apos;)</span>
                      <span onClick={() => removeBlock(dateStr, b.id)} style={{cursor:"pointer",fontSize:"0.7rem",color:"var(--terracotta)"}}>✕</span>
                    </div>
                  )}
                  <AddBtn onClick={() => { setAddModal({dateStr, insertAfterIdx:bi}); setAddType("treatment"); setPatientQ(""); }} />
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
            <h3 style={{marginBottom:14}}>
              ➕ הוסף — {new Date(addModal.dateStr).toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long"})}
            </h3>

            <div style={{display:"flex",gap:4,background:"var(--warm)",borderRadius:10,padding:3,marginBottom:14}}>
              {[["treatment","👤 טיפול"],["break","☕ הפסקה"],["slot","🕐 שעת חלון"]].map(([val,label]) => (
                <div key={val} onClick={() => setAddType(val)}
                  style={{flex:1,textAlign:"center",padding:"7px",borderRadius:8,cursor:"pointer",fontSize:"0.85rem",
                    background:addType===val?"var(--white)":"transparent",
                    fontWeight:addType===val?600:400,
                    color:addType===val?"var(--sage-dark)":"var(--text-soft)",
                    transition:"all 0.15s"}}>{label}</div>
              ))}
            </div>

            {addType === "slot" ? (
              <div>
                <p style={{fontSize:"0.82rem",color:"var(--text-soft)",marginBottom:12}}>תתווסף שעת חלון של 45 דקות</p>
                <button className="btn btn-primary" onClick={() => addBlock(addModal.dateStr, addModal.insertAfterIdx)}>הוסף שעת חלון</button>
              </div>
            ) : addType === "break" ? (
              <div>
                <p style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:8}}>כמה דקות?</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
                  {[5,10,15,20,30].map(m => (
                    <div key={m} onClick={() => setBreakMins(m)}
                      style={{padding:"7px 14px",borderRadius:10,cursor:"pointer",fontSize:"0.82rem",
                        background:breakMins===m?"var(--sage-dark)":"var(--warm)",
                        color:breakMins===m?"white":"var(--text-soft)",transition:"all 0.15s"}}>
                      {m} דק&apos;
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={() => addBlock(addModal.dateStr, addModal.insertAfterIdx)}>הוסף הפסקה</button>
              </div>
            ) : (
              <div>
                <p style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:8}}>בחר/י מטופל:</p>
                <input className="field" placeholder="חיפוש..." value={patientQ}
                  onChange={e => setPatientQ(e.target.value)} style={{marginBottom:10}} />
                <div style={{maxHeight:160,overflowY:"auto",marginBottom:12}}>
                  {filteredPatients.map(p => (
                    <div key={p.id} className="picker-item" onClick={() => assignPatientToModal(p)}
                      style={{padding:"8px 12px",borderRadius:10,cursor:"pointer",marginBottom:4,
                        background:"var(--cream)",transition:"background 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--warm)"}
                      onMouseLeave={e=>e.currentTarget.style.background="var(--cream)"}>
                      <div style={{fontWeight:500}}>{p.name}</div>
                      <div style={{fontSize:"0.75rem",color:"var(--text-soft)"}}>{p.diagnosis}</div>
                    </div>
                  ))}
                </div>
                {/* Recurring toggle */}
                <div style={{borderTop:"1px solid var(--warm)",paddingTop:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div onClick={() => setIsRecurring(!isRecurring)}
                      style={{width:42,height:24,borderRadius:12,cursor:"pointer",transition:"all 0.2s",
                        background:isRecurring?"#6C63FF":"var(--warm)",position:"relative"}}>
                      <div style={{position:"absolute",top:3,transition:"all 0.2s",
                        right:isRecurring?3:undefined,left:isRecurring?undefined:3,
                        width:18,height:18,borderRadius:"50%",background:"white",
                        boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}} />
                    </div>
                    <span style={{fontSize:"0.82rem",fontWeight:500}}>
                      {isRecurring ? "🔁 מופע חוזר שבועי" : "1️⃣ טיפול חד פעמי"}
                    </span>
                  </div>
                  {isRecurring && (
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:"0.78rem",color:"var(--text-soft)"}}>מספר שבועות:</span>
                      <div style={{display:"flex",gap:4}}>
                        {[4,8,12,16,20].map(w => (
                          <div key={w} onClick={() => setRecurringWeeks(w)}
                            style={{padding:"4px 10px",borderRadius:8,cursor:"pointer",fontSize:"0.78rem",
                              background:recurringWeeks===w?"#6C63FF":"var(--warm)",
                              color:recurringWeeks===w?"white":"var(--text-soft)"}}>
                            {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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


// ── EditableSession ───────────────────────────────────────────────
function EditableSession({ session, patientId, onUpdated, isLatest }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(session.summary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      // Update in Supabase - find session by patient_id and date
      await fetch(`${SUPABASE_URL}/rest/v1/sessions?patient_id=eq.${patientId}&date=eq.${encodeURIComponent(session.date)}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: text })
      });
      setEditing(false);
      if (onUpdated) await onUpdated();
    } catch { alert("שגיאה בשמירה"); }
    setSaving(false);
  };

  return (
    <div className="session-item" style={{
      borderRight: isLatest ? "4px solid #6C63FF" : "3px solid var(--sage-light)",
      background: isLatest ? "linear-gradient(135deg, #EEF2FF, #F5F0FF)" : undefined,
      position: "relative"
    }}>
      {isLatest && (
        <div style={{fontSize:"0.72rem",fontWeight:700,color:"#6C63FF",marginBottom:4}}>🟢 טיפול אחרון</div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div className="session-date">📅 {session.date}</div>
        {!editing && (
          <button onClick={() => { setText(session.summary); setEditing(true); }}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.75rem",
              color:"var(--text-soft)",padding:"2px 6px",borderRadius:6,
              transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--warm)"}
            onMouseLeave={e=>e.currentTarget.style.background="none"}>
            ✏️ ערוך
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea className="field" rows={4} value={text}
            onChange={e => setText(e.target.value)}
            style={{marginBottom:8,fontSize:"0.85rem"}} />
          <div style={{display:"flex",gap:6}}>
            <button onClick={handleSave} disabled={saving}
              style={{padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",
                background:"#6C63FF",color:"white",fontSize:"0.8rem",fontWeight:600}}>
              {saving ? "שומר..." : "✅ שמור"}
            </button>
            <button onClick={() => setEditing(false)}
              style={{padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",
                background:"var(--warm)",color:"var(--text)",fontSize:"0.8rem"}}>
              ביטול
            </button>
          </div>
        </>
      ) : (
        <div className="session-summary">{session.summary}</div>
      )}
    </div>
  );
}

// ── Patient Detail ─────────────────────────────────────────────────
function PatientDetail({ patient, onBack, openModal, generateReport, aiText, aiLoading, openAiChat, documents, addDocument, removeDocument, onEdit, onDelete, onSessionUpdated }) {
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
          <button className="btn btn-secondary btn-sm" onClick={() => openModal("questionnaire", patient)}>📋 שאלון הורים</button>
          <button className="btn btn-danger btn-sm" onClick={() => openModal("receipt", patient)}>🧾 הפק חשבונית</button>
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
              <EditableSession session={visibleLatest} patientId={patient.id} onUpdated={onSessionUpdated} isLatest={true} />
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
                    <EditableSession key={i} session={s} patientId={patient.id} onUpdated={onSessionUpdated} />
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
function Receipts({ patients, openModal, receiptsHistory }) {
  return (
    <>
      <h1 className="page-title">🧾 קבלות ותשלומים</h1>

      {/* Unpaid patients */}
      <div className="card">
        <div className="card-title">⏳ ממתינים לתשלום ({patients.filter(p => !p.paid).length})</div>
        {patients.filter(p => !p.paid).length === 0 && (
          <p className="text-soft" style={{padding:"8px 0"}}>✅ כל המטופלים שילמו</p>
        )}
        {patients.filter(p => p && !p.paid).map(p => (
          <div key={p.id} className="patient-row">
            <div className="patient-avatar">{(p.name||"?")[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{p.name}</div>
              <div className="patient-meta" style={{color:"#C4724A"}}>❌ טרם שולם</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openModal("receipt", p)}>🧾 הפק חשבונית</button>
          </div>
        ))}
      </div>

      {/* Receipts history */}
      <div className="card">
        <div className="card-title">📋 היסטוריית קבלות ({receiptsHistory?.length || 0})</div>
        {(receiptsHistory?.length || 0) === 0 && (
          <p className="text-soft" style={{padding:"8px 0"}}>אין קבלות עדיין</p>
        )}
        {(receiptsHistory || []).map((r, i) => {
          const date = new Date(r.created_at);
          const dateStr = date.toLocaleDateString("he-IL");
          const timeStr = date.toLocaleTimeString("he-IL", {hour:"2-digit",minute:"2-digit"});
          return (
            <div key={i} className="patient-row" style={{borderBottom:"1px solid var(--warm)",paddingBottom:12,marginBottom:12}}>
              <div className="patient-avatar" style={{background:"var(--sage-light)",color:"var(--sage-dark)"}}>🧾</div>
              <div className="patient-info" style={{flex:1}}>
                <div className="patient-name">{r.patient_name}</div>
                <div className="patient-meta">
                  📅 {dateStr} ⏰ {timeStr}
                  {r.method && ` · ${r.method}`}
                  {r.note && ` · ${r.note}`}
                </div>
                {r.receipt_number && (
                  <div style={{fontSize:"0.72rem",color:"var(--text-soft)",marginTop:2}}>
                    קבלה מס׳ {r.receipt_number}
                  </div>
                )}
              </div>
              <div style={{fontWeight:600,color:"var(--sage-dark)",fontSize:"0.95rem"}}>
                ₪{r.amount}
              </div>
            </div>
          );
        })}
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




// ── Patients Archive ──────────────────────────────────────────────
function PatientsArchive({ patients, receiptsHistory, onRestore, openAiChat, onDelete }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = patients.filter(p =>
    (p.name||"").includes(search) || (p.diagnosis||"").includes(search)
  );

  const patientReceipts = selectedPatient
    ? (receiptsHistory||[]).filter(r => r.patient_id === selectedPatient.id || r.patient_name === selectedPatient.name)
    : [];

  return (
    <>
      <h1 className="page-title">📦 ארכיון מטופלים</h1>

      {!selectedPatient ? (
        <div className="card">
          <input className="field" placeholder="🔍 חיפוש..." value={search}
            onChange={e => setSearch(e.target.value)} style={{marginBottom:16}} />
          {filtered.length === 0 && (
            <p className="text-soft" style={{textAlign:"center",padding:20}}>
              {patients.length === 0 ? "הארכיון ריק" : "לא נמצאו תוצאות"}
            </p>
          )}
          {filtered.map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",
                borderBottom:"1px solid var(--warm)",cursor:"pointer"}}>
              <div className="patient-avatar" style={{opacity:0.6}}>{(p.name||"?")[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:500}}>{p.name}</div>
                <div style={{fontSize:"0.75rem",color:"var(--text-soft)"}}>{p.diagnosis}</div>
              </div>
              <div style={{fontSize:"0.72rem",color:"var(--text-soft)"}}>
                {p.sessions} טיפולים
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPatient(null)}
            style={{marginBottom:16}}>← חזרה לארכיון</button>

          <div className="card" style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <h3 style={{margin:0}}>{selectedPatient.name}</h3>
                <div style={{fontSize:"0.82rem",color:"var(--text-soft)",marginTop:4}}>
                  {selectedPatient.diagnosis} · גיל {selectedPatient.age}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn btn-secondary btn-sm" onClick={() => openAiChat(selectedPatient)}>🤖 עוזר AI</button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  onRestore(selectedPatient.id);
                  setSelectedPatient(null);
                }}>♻️ שחזר מטופל</button>
                <button className="btn btn-danger btn-sm" onClick={() => {
                  if (window.confirm("למחוק את " + selectedPatient.name + " לצמיתות? לא ניתן לשחזר!")) {
                    onDelete(selectedPatient.id);
                    setSelectedPatient(null);
                  }
                }}>🗑️ מחק לצמיתות</button>
              </div>
            </div>
          </div>

          {/* Sessions history */}
          <div className="card" style={{marginBottom:12}}>
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:12}}>📋 סיכומי טיפולים ({(selectedPatient.history||[]).length})</div>
            {(selectedPatient.history||[]).length === 0 ? (
              <p className="text-soft">אין סיכומים</p>
            ) : (
              (selectedPatient.history||[]).map((h,i) => (
                <div key={i} style={{borderBottom:"1px solid var(--warm)",paddingBottom:10,marginBottom:10}}>
                  <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginBottom:4}}>📅 {h.date}</div>
                  <div style={{fontSize:"0.85rem"}}>{h.summary}</div>
                </div>
              ))
            )}
          </div>

          {/* Receipts */}
          <div className="card">
            <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:12}}>🧾 חשבוניות ({patientReceipts.length})</div>
            {patientReceipts.length === 0 ? (
              <p className="text-soft">אין חשבוניות</p>
            ) : (
              patientReceipts.map((r,i) => (
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  borderBottom:"1px solid var(--warm)",paddingBottom:8,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:"0.82rem",fontWeight:500}}>₪{r.amount}</div>
                    <div style={{fontSize:"0.72rem",color:"var(--text-soft)"}}>
                      {new Date(r.created_at).toLocaleDateString("he-IL")} · {r.method}
                    </div>
                    {r.receipt_number && <div style={{fontSize:"0.68rem",color:"var(--text-soft)"}}>מס׳ {r.receipt_number}</div>}
                  </div>
                  <div style={{fontSize:"0.72rem",padding:"3px 8px",borderRadius:20,
                    background:"#E8F5E8",color:"#2E7D32",fontWeight:500}}>✅ שולם</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── Leads ─────────────────────────────────────────────────────────
function Leads({ leads, setLeads }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ parent_name:"", phone:"", child_age:"", had_diagnosis:"", city:"", notes:"" });
  const [filter, setFilter] = useState("all"); // all | waiting | handled | closed

  const statusLabel = { waiting:"⏳ ממתין", handled:"✅ טופל", closed:"❌ סגור" };
  const statusBg = { waiting:"#FFF8E1", handled:"#E8F5E8", closed:"#FBE8E3" };
  const statusColor = { waiting:"#F57F17", handled:"#2E7D32", closed:"#C4724A" };

  const filtered = leads.filter(l => filter === "all" || l.status === filter);

  const handleAdd = async () => {
    if (!form.parent_name || !form.phone) return alert("נא למלא שם הורה וטלפון");
    try {
      const saved = await sb.addLead({ ...form, status: "waiting", source: "manual" });
      if (saved && saved.id) {
        setLeads(prev => [saved, ...prev]);
        setForm({ parent_name:"", phone:"", child_age:"", had_diagnosis:"", city:"", notes:"" });
        setShowAddForm(false);
      }
    } catch { alert("שגיאה בשמירה"); }
  };

  const updateStatus = async (id, status) => {
    await sb.updateLead(id, { status });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, status }));
  };

  const deleteLead = async (id) => {
    if (!confirm("למחוק פנייה זו?")) return;
    await sb.deleteLead(id);
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedLead(null);
  };

  const leadNumber = (lead) => {
    const idx = [...leads].reverse().findIndex(l => l.id === lead.id);
    return String(idx + 1).padStart(3, "0");
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString("he-IL") + "  " + d.toLocaleTimeString("he-IL", {hour:"2-digit",minute:"2-digit"});
  };

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title" style={{marginBottom:0}}>⏳ מטופלים בהמתנה</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>+ הוסף פנייה</button>
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,background:"var(--warm)",borderRadius:12,padding:4}}>
        {[{id:"all",label:"הכל"},{id:"waiting",label:"⏳ ממתין"},{id:"handled",label:"✅ טופל"},{id:"closed",label:"❌ סגור"}].map(f => (
          <div key={f.id} onClick={() => setFilter(f.id)}
            style={{flex:1,textAlign:"center",padding:"8px 4px",borderRadius:10,cursor:"pointer",
              fontSize:"0.78rem",fontWeight:filter===f.id?600:400,
              background:filter===f.id?"white":"transparent",
              color:filter===f.id?"var(--sage-dark)":"var(--text-soft)",
              boxShadow:filter===f.id?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s"}}>
            {f.label} {f.id==="all" ? `(${leads.length})` : `(${leads.filter(l=>l.status===f.id).length})`}
          </div>
        ))}
      </div>

      {/* Leads list */}
      <div className="card">
        {filtered.length === 0 && (
          <p className="text-soft" style={{textAlign:"center",padding:20}}>אין פניות בקטגוריה זו</p>
        )}
        {filtered.map(lead => (
          <div key={lead.id} onClick={() => setSelectedLead(lead)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",
              borderBottom:"1px solid var(--warm)",cursor:"pointer",transition:"background 0.15s"}}
            onMouseEnter={e => e.currentTarget.style.background="var(--cream)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
            <div style={{width:40,height:40,borderRadius:12,background:"var(--sage-light)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"0.75rem",fontWeight:600,color:"var(--sage-dark)",flexShrink:0}}>
              #{leadNumber(lead)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:500,fontSize:"0.9rem"}}>{lead.parent_name || "ללא שם"}</div>
              <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginTop:2}}>{formatDate(lead.created_at)}</div>
            </div>
            <div style={{fontSize:"0.72rem",padding:"4px 10px",borderRadius:20,fontWeight:500,
              background:statusBg[lead.status]||"var(--warm)",color:statusColor[lead.status]||"var(--text-soft)"}}>
              {statusLabel[lead.status]||lead.status}
            </div>
          </div>
        ))}
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <Modal onClose={() => setSelectedLead(null)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <h3 style={{margin:0}}>📋 פנייה #{leadNumber(selectedLead)}</h3>
            <div style={{fontSize:"0.72rem",padding:"4px 10px",borderRadius:20,fontWeight:500,
              background:statusBg[selectedLead.status],color:statusColor[selectedLead.status]}}>
              {statusLabel[selectedLead.status]}
            </div>
          </div>

          <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginBottom:16}}>
            📅 {formatDate(selectedLead.created_at)}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:"0.8rem",color:"var(--text-soft)",minWidth:100}}>שם הורה:</span>
              <span style={{fontSize:"0.85rem",fontWeight:500}}>{selectedLead.parent_name || "—"}</span>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:"0.8rem",color:"var(--text-soft)",minWidth:100}}>טלפון:</span>
              <a href={`https://wa.me/972${selectedLead.phone?.replace(/^0/,"").replace(/-/g,"")}`}
                target="_blank" rel="noreferrer"
                style={{fontSize:"0.85rem",fontWeight:500,color:"var(--sage-dark)",
                  display:"flex",alignItems:"center",gap:4,textDecoration:"none"}}>
                📱 {selectedLead.phone}
                <span style={{fontSize:"0.7rem",background:"#25D366",color:"white",
                  padding:"2px 6px",borderRadius:8}}>וואטסאפ</span>
              </a>
            </div>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:"0.8rem",color:"var(--text-soft)",minWidth:100}}>גיל הילד:</span>
              <span style={{fontSize:"0.85rem",fontWeight:500}}>{selectedLead.child_age || "—"}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:"0.8rem",color:"var(--text-soft)",minWidth:100}}>אבחון קודם:</span>
              <span style={{fontSize:"0.85rem",fontWeight:500}}>{selectedLead.had_diagnosis || "—"}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:"0.8rem",color:"var(--text-soft)",minWidth:100}}>מאיפה:</span>
              <span style={{fontSize:"0.85rem",fontWeight:500}}>{selectedLead.city || "—"}</span>
            </div>
            {selectedLead.notes && (
              <div style={{display:"flex",gap:8}}>
                <span style={{fontSize:"0.8rem",color:"var(--text-soft)",minWidth:100}}>הערות:</span>
                <span style={{fontSize:"0.85rem"}}>{selectedLead.notes}</span>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {selectedLead.status !== "handled" && (
              <button className="btn btn-primary btn-sm" onClick={() => updateStatus(selectedLead.id, "handled")}>✅ סמן כטופל</button>
            )}
            {selectedLead.status !== "waiting" && (
              <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(selectedLead.id, "waiting")}>⏳ החזר להמתנה</button>
            )}
            {selectedLead.status !== "closed" && (
              <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(selectedLead.id, "closed")}>❌ סגור פנייה</button>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => deleteLead(selectedLead.id)}>🗑️ מחק</button>
          </div>
        </Modal>
      )}

      {/* Add form modal */}
      {showAddForm && (
        <Modal onClose={() => setShowAddForm(false)}>
          <h3>➕ פנייה חדשה</h3>
          {[
            {key:"parent_name", label:"שם הורה *", placeholder:"שם מלא"},
            {key:"phone", label:"טלפון *", placeholder:"050-0000000"},
            {key:"child_age", label:"גיל הילד", placeholder:"למשל: 4 שנים"},
            {key:"had_diagnosis", label:"אבחון קודם?", placeholder:"כן / לא / בתהליך"},
            {key:"city", label:"מאיפה?", placeholder:"עיר / יישוב"},
            {key:"notes", label:"הערות", placeholder:"מידע נוסף..."},
          ].map(f => (
            <div key={f.key} style={{marginBottom:12}}>
              <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:4}}>{f.label}</div>
              <input className="field" placeholder={f.placeholder}
                value={form[f.key]} onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))} />
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button className="btn btn-primary" onClick={handleAdd}>שמור פנייה</button>
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>ביטול</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Finance ───────────────────────────────────────────────────────
function Finance({ receiptsHistory, appointments }) {
  const today = new Date();
  const fmt = d => d.toISOString().split("T")[0]; // YYYY-MM-DD for input

  // Period
  const [startDate, setStartDate] = useState(fmt(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [endDate, setEndDate] = useState(fmt(today));

  // Average period
  const [avgMode, setAvgMode] = useState("months"); // months | custom
  const [monthsBack, setMonthsBack] = useState(6);
  const [avgStart, setAvgStart] = useState(fmt(new Date(today.getFullYear(), today.getMonth() - 5, 1)));
  const [avgEnd, setAvgEnd] = useState(fmt(today));

  const toHe = d => new Date(d).toLocaleDateString("he-IL");

  // Filter receipts by period
  const periodReceipts = (receiptsHistory || []).filter(r => {
    const rd = fmt(new Date(r.created_at));
    return rd >= startDate && rd <= endDate;
  });

  const totalIncome = periodReceipts.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const vat = Math.round(totalIncome * 0.18);
  const netIncome = totalIncome - vat;

  // Monthly chart data (last monthsBack months or custom range)
  const getMonthsData = () => {
    let months = [];
    if (avgMode === "custom") {
      // Build months between avgStart and avgEnd
      let d = new Date(avgStart);
      const endD = new Date(avgEnd);
      while (d <= endD) {
        const y = d.getFullYear(), m = d.getMonth();
        const mStart = fmt(new Date(y, m, 1));
        const mEnd = fmt(new Date(y, m + 1, 0));
        const label = new Date(y, m, 1).toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
        const income = (receiptsHistory || [])
          .filter(r => { const rd = fmt(new Date(r.created_at)); return rd >= mStart && rd <= mEnd; })
          .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        const totalApts = (appointments || []).filter(a => {
          if (!a.start_time) return false;
          return a.day_index !== undefined && a.block_type !== "break";
        }).length;
        months.push({ label, income, totalApts, cancelled: 0 });
        d = new Date(y, m + 1, 1);
      }
    } else {
      for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const y = d.getFullYear(), m = d.getMonth();
        const mStart = fmt(new Date(y, m, 1));
        const mEnd = fmt(new Date(y, m + 1, 0));
        const label = d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
        const income = (receiptsHistory || [])
          .filter(r => { const rd = fmt(new Date(r.created_at)); return rd >= mStart && rd <= mEnd; })
          .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        months.push({ label, income });
      }
    }
    return months;
  };

  const monthsData = getMonthsData();
  const avgIncome = monthsData.length > 0
    ? Math.round(monthsData.reduce((s, m) => s + m.income, 0) / monthsData.length)
    : 0;

  // Cancellations — only within selected date range AND up to today
  const todayStr2 = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const rangeApts = (appointments || []).filter(a => {
    if (!a.date || a.block_type === "break") return false;
    return a.date >= startDate && a.date <= endDate && a.date <= todayStr2;
  });
  const totalApts = rangeApts.length;
  const cancelled = rangeApts.filter(a => a.status === "cancelled").length;
  const cancelRate = totalApts > 0 ? Math.round((cancelled / totalApts) * 100) : 0;

  const maxIncome = Math.max(...monthsData.map(m => m.income), 1);

  const inputStyle = {
    padding:"7px 10px", border:"2px solid var(--warm)", borderRadius:10,
    fontFamily:"DM Sans,sans-serif", fontSize:"0.85rem", background:"var(--cream)",
    outline:"none", cursor:"pointer"
  };

  return (
    <>
      <h1 className="page-title">📊 דוח כספי</h1>

      {/* Period selector */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:14}}>📅 בחר תקופה לחישוב</div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:"0.82rem",color:"var(--text-soft)"}}>מיום:</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <span style={{color:"var(--text-soft)"}}>—</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:"0.82rem",color:"var(--text-soft)"}}>עד יום:</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{fontSize:"0.75rem",color:"var(--text-soft)",marginTop:8}}>
          תקופה נבחרת: {toHe(startDate)} — {toHe(endDate)}
        </div>
      </div>

      {/* Main stats */}
      <div className="stats-grid" style={{marginBottom:16}}>
        <div className="stat-card">
          <div className="stat-num">₪{totalIncome.toLocaleString()}</div>
          <div className="stat-label">הכנסה בתקופה</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{color:"#C4724A"}}>₪{vat.toLocaleString()}</div>
          <div className="stat-label">מע"מ לשלם (18%)</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{color:"var(--sage-dark)"}}>₪{netIncome.toLocaleString()}</div>
          <div className="stat-label">נטו אחרי מע"מ</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{periodReceipts.length}</div>
          <div className="stat-label">חשבוניות בתקופה</div>
        </div>
      </div>

      {/* Average + cancellation */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div className="card" style={{textAlign:"center"}}>
          <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:6}}>ממוצע חודשי</div>
          <div style={{fontSize:"1.8rem",fontWeight:600,color:"var(--sage-dark)"}}>₪{avgIncome.toLocaleString()}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginTop:10,flexWrap:"wrap"}}>
            <select value={avgMode} onChange={e => setAvgMode(e.target.value)}
              style={{...inputStyle,padding:"4px 8px",fontSize:"0.75rem"}}>
              <option value="months">חודשים אחרונים</option>
              <option value="custom">התאמה אישית</option>
            </select>
            {avgMode === "months" && (
              <select value={monthsBack} onChange={e => setMonthsBack(parseInt(e.target.value))}
                style={{...inputStyle,padding:"4px 8px",fontSize:"0.75rem"}}>
                {[3,6,9,12,18].map(n => <option key={n} value={n}>{n} חודשים</option>)}
              </select>
            )}
          </div>
          {avgMode === "custom" && (
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:"0.72rem",color:"var(--text-soft)"}}>מ:</span>
                <input type="date" value={avgStart} onChange={e => setAvgStart(e.target.value)}
                  style={{...inputStyle,padding:"4px 8px",fontSize:"0.72rem"}} />
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:"0.72rem",color:"var(--text-soft)"}}>עד:</span>
                <input type="date" value={avgEnd} onChange={e => setAvgEnd(e.target.value)}
                  style={{...inputStyle,padding:"4px 8px",fontSize:"0.72rem"}} />
              </div>
            </div>
          )}
        </div>
        <div className="card" style={{textAlign:"center"}}>
          <div style={{fontSize:"0.8rem",color:"var(--text-soft)",marginBottom:6}}>אחוז ביטולים</div>
          <div style={{fontSize:"1.8rem",fontWeight:600,color:"var(--sage-dark)"}}>
            {cancelRate}%
          </div>
          <div style={{fontSize:"0.72rem",color:"var(--text-soft)",marginTop:4}}>
            {cancelled} ביטולים מתוך {totalApts} תורים
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div className="card">
        <div style={{fontWeight:600,color:"var(--sage-dark)",marginBottom:16}}>📈 הכנסות לפי חודשים</div>
        {monthsData.length === 0 ? (
          <p className="text-soft">אין נתונים</p>
        ) : (
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:120,overflowX:"auto",paddingBottom:4}}>
            {monthsData.map((m, i) => (
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:44,flex:1}}>
                <div style={{fontSize:"0.62rem",color:"var(--text-soft)"}}>
                  {m.income > 0 ? "₪"+(m.income/1000).toFixed(1)+"k" : ""}
                </div>
                <div style={{
                  width:"100%",
                  height: m.income > 0 ? Math.max((m.income / maxIncome) * 90, 4) : 4,
                  background: i === monthsData.length-1 ? "var(--sage-dark)" : "var(--sage-light)",
                  borderRadius:"6px 6px 0 0",transition:"height 0.3s"
                }} />
                <div style={{fontSize:"0.58rem",color:"var(--text-soft)",textAlign:"center"}}>
                  {m.label}
                </div>
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
                משתנים: {"{שם הורה}"} {"{שם המטופל}"} {"{שעה}"} {"{תאריך}"}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}


// ── Questionnaire Modal ───────────────────────────────────────────
function QuestionnaireModal({ patient, onClose, onSave }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Helper components
  const YesNo = ({ k, label }) => (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:"0.85rem",fontWeight:500,marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:8}}>
        {["כן","לא"].map(v => (
          <button key={v} onClick={() => set(k, v)}
            style={{padding:"8px 24px",borderRadius:12,border:"2px solid",cursor:"pointer",fontFamily:"inherit",fontSize:"0.85rem",fontWeight:500,
              borderColor: form[k]===v ? "var(--sage)" : "var(--warm)",
              background: form[k]===v ? "var(--sage)" : "white",
              color: form[k]===v ? "white" : "var(--text-soft)",
              transition:"all 0.15s"}}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  const Select = ({ k, label, options, withOther }) => (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:"0.85rem",fontWeight:500,marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {options.map(v => (
          <button key={v} onClick={() => set(k, v)}
            style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid",cursor:"pointer",fontFamily:"inherit",fontSize:"0.82rem",
              borderColor: form[k]===v ? "var(--sage)" : "var(--warm)",
              background: form[k]===v ? "var(--sage)" : "white",
              color: form[k]===v ? "white" : "var(--text-soft)",
              transition:"all 0.15s"}}>
            {v}
          </button>
        ))}
        {withOther && (
          <button onClick={() => set(k, "אחר")}
            style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid",cursor:"pointer",fontFamily:"inherit",fontSize:"0.82rem",
              borderColor: form[k]==="אחר" ? "var(--sage)" : "var(--warm)",
              background: form[k]==="אחר" ? "var(--sage)" : "white",
              color: form[k]==="אחר" ? "white" : "var(--text-soft)"}}>
            אחר
          </button>
        )}
      </div>
      {form[k]==="אחר" && withOther && (
        <input className="field" style={{marginTop:8}} placeholder="פרט/י..."
          value={form[k+"_other"]||""} onChange={e => set(k+"_other", e.target.value)} />
      )}
    </div>
  );

  const MultiSelect = ({ k, label, options }) => {
    const vals = form[k] || [];
    const toggle = v => set(k, vals.includes(v) ? vals.filter(x=>x!==v) : [...vals, v]);
    return (
      <div style={{marginBottom:16}}>
        <div style={{fontSize:"0.85rem",fontWeight:500,marginBottom:8}}>{label}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {options.map(v => (
            <button key={v} onClick={() => toggle(v)}
              style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid",cursor:"pointer",fontFamily:"inherit",fontSize:"0.82rem",
                borderColor: vals.includes(v) ? "var(--sage)" : "var(--warm)",
                background: vals.includes(v) ? "var(--sage)" : "white",
                color: vals.includes(v) ? "white" : "var(--text-soft)",
                transition:"all 0.15s"}}>
              {v}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const Text = ({ k, label, placeholder, rows=1 }) => (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:"0.85rem",fontWeight:500,marginBottom:6}}>{label}</div>
      {rows > 1
        ? <textarea className="field" rows={rows} placeholder={placeholder||""}
            value={form[k]||""} onChange={e => set(k, e.target.value)} />
        : <input className="field" placeholder={placeholder||""}
            value={form[k]||""} onChange={e => set(k, e.target.value)} />
      }
    </div>
  );

  const steps = [
    {
      title: "פרטים אישיים",
      icon: "👤",
      content: (
        <>
          <Text k="child_name" label="שם הילד/ה (פרטי + משפחה)" placeholder="שם מלא" />
          <Text k="birth_date" label="תאריך לידה" placeholder="DD/MM/YYYY" />
          <Select k="gender" label="מין" options={["זכר","נקבה"]} />
          <Text k="parent_name" label="שם ההורה/אפוטרופוס" placeholder="שם מלא" />
          <Text k="phone" label="טלפון" placeholder="050-0000000" />
          <Text k="email" label="מייל" placeholder="example@gmail.com" />
          <Text k="address" label="כתובת" placeholder="רחוב, עיר" />
        </>
      )
    },
    {
      title: "מסגרת חינוכית",
      icon: "🏫",
      content: (
        <>
          <YesNo k="has_framework" label="האם הילד/ה במסגרת חינוכית?" />
          {form.has_framework === "כן" && (
            <>
              <Text k="framework_name" label="שם המסגרת" placeholder="שם הגן/בית הספר" />
              <Select k="framework_type" label="סוג המסגרת" withOther
                options={["משפחתון","גן רגיל","גן שפה","כיתה קטנה","בית ספר","גן תקשורת"]} />
              <Text k="teacher_name" label="שם הגננת/מורה" placeholder="שם מלא" />
              <MultiSelect k="professional_support" label="ליווי מקצועי במסגרת"
                options={["סייעת","קלינאי/ת תקשורת","מרפא/ה בעיסוק","פסיכולוג/ית","אין ליווי"]} />
              <Text k="framework_report" label="מה דיווחו אנשי המסגרת?" placeholder="תאר/י..." rows={3} />
            </>
          )}
        </>
      )
    },
    {
      title: "רקע רפואי — היריון ולידה",
      icon: "🏥",
      content: (
        <>
          <YesNo k="normal_pregnancy" label="האם ההיריון היה תקין?" />
          {form.normal_pregnancy === "לא" && (
            <Text k="pregnancy_details" label="פרט/י" rows={2} placeholder="תאר/י את הסיבוך..." />
          )}
          <Text k="birth_week" label="שבוע לידה" placeholder="למשל: 38" />
          <Text k="birth_weight" label="משקל לידה" placeholder="למשל: 3.2 ק״ג" />
          <YesNo k="birth_complication" label="האם היה סיבוך בלידה?" />
          {form.birth_complication === "כן" && (
            <Text k="birth_complication_details" label="פרט/י" rows={2} placeholder="תאר/י..." />
          )}
          <YesNo k="hospitalized_after_birth" label="האם הילד/ה אושפז/ה לאחר הלידה?" />
          {form.hospitalized_after_birth === "כן" && (
            <Text k="hospitalized_reason" label="מדוע?" rows={2} placeholder="סיבת האשפוז..." />
          )}
        </>
      )
    },
    {
      title: "מצב רפואי כללי",
      icon: "💊",
      content: (
        <>
          <YesNo k="medical_treatments" label="האם הילד/ה עובר/ת טיפולים רפואיים?" />
          {form.medical_treatments === "כן" && (
            <Text k="medical_treatments_details" label="אילו טיפולים?" rows={2} placeholder="פרט/י..." />
          )}
          <YesNo k="known_diagnoses" label="האם יש אבחנות רפואיות ידועות?" />
          {form.known_diagnoses === "כן" && (
            <Text k="diagnoses_details" label="אילו אבחנות?" rows={2} placeholder="פרט/י..." />
          )}
          <YesNo k="takes_medication" label="האם הילד/ה נוטל/ת תרופות?" />
          {form.takes_medication === "כן" && (
            <Text k="medication_details" label="אילו תרופות?" placeholder="שם התרופה ומינון" />
          )}
          <YesNo k="had_surgery" label="האם עבר/ה ניתוחים?" />
          {form.had_surgery === "כן" && (
            <Text k="surgery_details" label="פרט/י" placeholder="סוג הניתוח ומתי" />
          )}
          <YesNo k="prev_diagnosis" label="האם עבר/ה אבחון קודם?" />
          {form.prev_diagnosis === "כן" && (
            <MultiSelect k="prev_diagnosis_type" label="סוג האבחון"
              options={["פסיכולוג/ית","נוירולוג/ית","קלינאי/ת תקשורת","מרפא/ה בעיסוק","אחר"]} />
          )}
        </>
      )
    },
    {
      title: "שמיעה וראיה",
      icon: "👁️",
      content: (
        <>
          <YesNo k="hearing_tested" label="האם נבדקה שמיעת הילד/ה?" />
          {form.hearing_tested === "כן" && (
            <Text k="hearing_result" label="מה הייתה התוצאה?" placeholder="תקין / לא תקין / פרט..." />
          )}
          <YesNo k="hearing_problems" label="האם יש בעיות שמיעה ידועות?" />
          {form.hearing_problems === "כן" && (
            <Text k="hearing_details" label="פרט/י" rows={2} placeholder="תאר/י..." />
          )}
          <YesNo k="vision_tested" label="האם נבדקה ראיית הילד/ה?" />
          <YesNo k="wears_glasses" label="האם הילד/ה מרכיב/ה משקפיים?" />
        </>
      )
    },
    {
      title: "רקע התפתחותי — שפה",
      icon: "🗣️",
      content: (
        <>
          <Text k="first_word_age" label="באיזה גיל אמר/ה מילה ראשונה?" placeholder="למשל: 12 חודשים" />
          <Text k="two_words_age" label="באיזה גיל חיבר/ה שתי מילים יחד?" placeholder="למשל: 24 חודשים" />
          <YesNo k="speaks_sentences" label="האם מדבר/ת כיום במשפטים?" />
          <YesNo k="understands_simple" label="האם מבין/ה הוראות פשוטות?" />
          <YesNo k="understands_complex" label="האם מבין/ה הוראות מורכבות?" />
          <YesNo k="word_regression" label="האם היו מילים שחזר/ה עליהן ואחר כך הפסיק/ה?" />
          {form.word_regression === "כן" && (
            <Text k="word_regression_details" label="פרט/י" rows={2} placeholder="תאר/י..." />
          )}
        </>
      )
    },
    {
      title: "מוטוריקה ואכילה",
      icon: "🏃",
      content: (
        <>
          <Text k="sitting_age" label="באיזה גיל החל/ה לשבת לבד?" placeholder="למשל: 6 חודשים" />
          <Text k="crawling_age" label="באיזה גיל החל/ה לזחול?" placeholder="למשל: 9 חודשים" />
          <Text k="walking_age" label="באיזה גיל החל/ה ללכת?" placeholder="למשל: 12 חודשים" />
          <YesNo k="motor_difficulties" label="האם יש קשיים מוטוריים כיום?" />
          {form.motor_difficulties === "כן" && (
            <Text k="motor_details" label="פרט/י" rows={2} placeholder="תאר/י..." />
          )}
          <YesNo k="eating_difficulties" label="האם יש קשיים באכילה?" />
          <YesNo k="selective_eating" label="האם סלקטיבי/ת במזון?" />
          <YesNo k="infant_feeding_problems" label="האם היו קשיים בינקות (יניקה/בקבוק)?" />
        </>
      )
    },
    {
      title: "רקע משפחתי ושפתי",
      icon: "👨‍👩‍👧",
      content: (
        <>
          <MultiSelect k="home_languages" label="שפות המדוברות בבית"
            options={["עברית","ערבית","רוסית","אמהרית","אנגלית","צרפתית","אחר"]} />
          <YesNo k="multilingual" label="האם הילד/ה חשוף/ה ליותר משפה אחת?" />
          <Select k="sibling_order" label="מיקום בין האחים"
            options={["בכור/ה","אמצעי/ת","צעיר/ה","יחיד/ה"]} />
          <YesNo k="sibling_difficulties" label="האם יש אחים/אחיות עם קשיי שפה/התפתחות?" />
          <YesNo k="family_history" label="האם יש היסטוריה משפחתית של קשיי שפה, לקויות למידה או אוטיזם?" />
          {form.family_history === "כן" && (
            <Text k="family_history_details" label="פרט/י" rows={2} placeholder="מי ומה..." />
          )}
          <YesNo k="parents_together" label="האם ההורים גרים יחד?" />
          <Select k="main_language" label="באיזו שפה מדבר/ת הילד/ה בעיקר?"
            options={["עברית","ערבית","רוסית","אמהרית","אנגלית","אחר"]} withOther />
          <YesNo k="comprehension_expression_diff" label="האם יש הבדל בין הבנה לבין ביטוי?" />
        </>
      )
    },
    {
      title: "התנהגות כללית",
      icon: "😊",
      content: (
        <>
          <YesNo k="attentive" label="האם הילד/ה קשוב/ה ומרוכז/ת?" />
          <YesNo k="emotional_regulation" label="האם יש קשיים בוויסות רגשי?" />
          <YesNo k="sleeps_well" label="האם ישן/ה טוב בלילה?" />
          <YesNo k="repetitive_behaviors" label="האם יש התנהגויות חזרתיות?" />
          {form.repetitive_behaviors === "כן" && (
            <Text k="repetitive_details" label="פרט/י" rows={2} placeholder="תאר/י..." />
          )}
          <YesNo k="eye_contact" label="האם יש קשר עין תקין?" />
          <YesNo k="plays_with_others" label="האם משחק/ת עם ילדים אחרים?" />
          <YesNo k="anxieties" label="האם יש חרדות בולטות?" />
          {form.anxieties === "כן" && (
            <Text k="anxieties_details" label="פרט/י" rows={2} placeholder="תאר/י..." />
          )}
        </>
      )
    },
    {
      title: "תחומי חוזק ושיפור",
      icon: "⭐",
      content: (
        <>
          <Text k="strengths" label="במה הילד/ה מצטיין/ת?" rows={3} placeholder="תאר/י..." />
          <Text k="concerns" label="מה מדאיג אתכם ביותר?" rows={3} placeholder="תאר/י..." />
          <Text k="treatment_expectation" label="מה הציפייה מהטיפול?" rows={3} placeholder="תאר/י..." />
          <Text k="previous_attempts" label="מה ניסיתם עד כה?" rows={2} placeholder="תאר/י..." />
          <Text k="additional_info" label="האם יש עוד מידע שחשוב לנו לדעת?" rows={3} placeholder="כל מידע נוסף..." />
        </>
      )
    },
  ];

  const currentStep = steps[step];
  const progress = Math.round(((step + 1) / steps.length) * 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      await sb.saveQuestionnaire(patient.id, form);
      onSave(form);
    } catch { alert("שגיאה בשמירה"); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{width:580,maxHeight:"90vh"}} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <div style={{fontSize:"0.75rem",color:"var(--text-soft)",fontWeight:500}}>
              שלב {step+1} מתוך {steps.length}
            </div>
            <h3 style={{margin:0,marginTop:4}}>
              {currentStep.icon} {currentStep.title}
            </h3>
          </div>
          <span onClick={onClose} style={{cursor:"pointer",fontSize:"1.3rem",color:"var(--text-soft)"}}>✕</span>
        </div>

        {/* Progress bar */}
        <div style={{height:6,background:"var(--warm)",borderRadius:10,marginBottom:24,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,
            background:"linear-gradient(90deg, var(--sage), var(--sage-dark))",
            borderRadius:10,transition:"width 0.3s"}} />
        </div>

        {/* Form content */}
        <div style={{maxHeight:"55vh",overflowY:"auto",paddingLeft:4}}>
          {currentStep.content}
        </div>

        {/* Navigation */}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:20,paddingTop:16,borderTop:"1px solid var(--warm)"}}>
          <button className="btn btn-secondary" onClick={() => setStep(s => s-1)} disabled={step===0}>
            → הקודם
          </button>
          <div style={{display:"flex",gap:6}}>
            {steps.map((_,i) => (
              <div key={i} onClick={() => setStep(i)}
                style={{width:8,height:8,borderRadius:"50%",cursor:"pointer",
                  background: i===step ? "var(--sage-dark)" : i<step ? "var(--sage-light)" : "var(--warm)",
                  transition:"all 0.2s"}} />
            ))}
          </div>
          {step < steps.length-1 ? (
            <button className="btn btn-primary" onClick={() => setStep(s => s+1)}>
              הבא ←
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : "✅ שמור שאלון"}
            </button>
          )}
        </div>
      </div>
    </div>
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

