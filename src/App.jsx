import { useState, useRef, useEffect } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const GI_KEY    = import.meta.env.VITE_GI_KEY || "";
const GI_SECRET = import.meta.env.VITE_GI_SECRET || "";

// ── Palette & globals ──────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap');

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
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "שגיאה בתשובה";
}

// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [patients, setPatients] = useState(INITIAL_PATIENTS);
  const [patientModal, setPatientModal] = useState(null); // null | "add" | "edit"
  const [editingPatient, setEditingPatient] = useState(null);

  const addPatient = (data) => {
    const newP = {
      id: Date.now(),
      firstName: data.firstName,
      lastName: data.lastName,
      name: (data.firstName + " " + data.lastName).trim(),
      gender: data.gender || "",
      age: data.birthDate ? calcAge(data.birthDate).replace("גיל: ","") : "",
      birthDate: data.birthDate || "",
      idNumber: data.idNumber || "",
      sessions: 0,
      diagnosis: data.diagnosis,
      nextAppt: data.nextAppt || "טרם נקבע",
      paid: true,
      phone: data.phone || "",
      email: data.email || "",
      parentName: data.parentName || "",
      history: [],
    };
    setPatients(prev => [...prev, newP]);
    showNotification("✅ המטופל " + data.name + " נוסף בהצלחה");
  };

  const updatePatient = (id, data) => {
    setPatients(prev => prev.map(p => p.id === id ? {
      ...p,
      firstName: data.firstName || p.firstName,
      lastName: data.lastName || p.lastName,
      name: ((data.firstName || p.firstName) + " " + (data.lastName || p.lastName)).trim(),
      gender: data.gender || p.gender,
      age: data.birthDate ? calcAge(data.birthDate).replace("גיל: ","") : p.age,
      birthDate: data.birthDate || p.birthDate,
      idNumber: data.idNumber || p.idNumber,
      diagnosis: data.diagnosis,
      nextAppt: data.nextAppt || p.nextAppt,
      phone: data.phone || p.phone,
      email: data.email || p.email,
      parentName: data.parentName || p.parentName,
    } : p));
    showNotification("✏️ פרטי " + data.name + " עודכנו");
  };

  const deletePatient = (id) => {
    const p = patients.find(x => x.id === id);
    setPatients(prev => prev.filter(x => x.id !== id));
    setSelectedPatient(null);
    setPage("patients");
    showNotification("🗑️ " + p.name + " הוסר מהמערכת");
  };
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [modal, setModal] = useState(null); // "post_session" | "pre_session" | "receipt" | "report"
  const [currentPatientForModal, setCurrentPatientForModal] = useState(null);
  const [sessionNote, setSessionNote] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [receiptData, setReceiptData] = useState({ amount: "", method: "ביט", note: "" });
  const [notification, setNotification] = useState("");
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

  const saveSessionNote = () => {
    if (!sessionNote.trim()) return;
    const today = new Date().toLocaleDateString("he-IL");
    currentPatientForModal.history.unshift({ date: today, summary: sessionNote });
    showNotification(`✅ סיכום נשמר עבור ${currentPatientForModal.name}`);
    closeModal();
  };

  const sendWhatsApp = (patient) => {
    showNotification(`📱 אישור הגעה נשלח בוואטסאפ ל${patient.name}`);
  };

  const generateReceipt = async () => {
    if (!receiptData.amount) return alert("נא להזין סכום");
    showNotification("⏳ יוצר קבלה בחשבונית הירוקה...");
    try {
      // Step 1: Get token
      const authRes = await fetch("https://api.greeninvoice.co.il/api/v1/account/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: GI_KEY, secret: GI_SECRET }),
      });
      const authData = await authRes.json();
      if (!authData.token) throw new Error("שגיאת התחברות לחשבונית הירוקה");

      const paymentTypeMap = { "ביט": 4, "פייבוקס": 4, "העברה בנקאית": 3, "מזומן": 1 };
      const email = receiptData.email || currentPatientForModal?.email || "";

      // Step 2: Create receipt
      const receiptRes = await fetch("https://api.greeninvoice.co.il/api/v1/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData.token}`,
        },
        body: JSON.stringify({
          description: receiptData.note || "טיפול קלינאות תקשורת",
          type: 400,
          lang: "he",
          currency: "ILS",
          vatType: 0,
          signed: true,
          sendByEmail: !!email,
          client: { name: currentPatientForModal?.name, emails: email ? [email] : [], add: true },
          income: [{ description: receiptData.note || "טיפול קלינאות תקשורת", quantity: 1, price: parseFloat(receiptData.amount), currency: "ILS", vatType: 0 }],
          payment: [{ type: paymentTypeMap[receiptData.method] || 1, price: parseFloat(receiptData.amount), currency: "ILS", date: new Date().toISOString().split("T")[0] }],
        }),
      });
      const data = await receiptRes.json();
      if (data.errorMessage) throw new Error(data.errorMessage);

      setPatients(prev => prev.map(p =>
        p.id === currentPatientForModal?.id ? { ...p, paid: true } : p
      ));
      showNotification(`✅ קבלה מס' ${data.number} נוצרה בהצלחה!`);
      if (data.url && typeof data.url === 'string') window.open(data.url, "_blank");
    } catch (err) {
      showNotification(`❌ שגיאה: ${err.message}`);
    }
    closeModal();
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  // ── Render ──
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar page={page} setPage={setPage} />
        <main className="main">
          {notification && <div className="banner">🔔 {notification}</div>}

          {page === "dashboard" && <Dashboard patients={patients} openModal={openModal} sendWhatsApp={sendWhatsApp} />}
          {page === "calendar" && <Calendar patients={patients} openModal={openModal} sendWhatsApp={sendWhatsApp} />}
          {page === "patients" && !selectedPatient &&
            <PatientList patients={patients} onSelect={p => { setSelectedPatient(p); setPage("patient_detail"); }}
              onAdd={() => setPatientModal("add")} />}
          {page === "patient_detail" && selectedPatient &&
            <PatientDetail patient={selectedPatient} onBack={() => { setSelectedPatient(null); setPage("patients"); }}
              openModal={openModal} generateReport={generateReport} aiText={aiText} aiLoading={aiLoading}
              documents={documents[selectedPatient.id] || []} addDocument={addDocument} removeDocument={removeDocument}
              onEdit={() => { setEditingPatient(selectedPatient); setPatientModal("edit"); }}
              onDelete={() => deletePatient(selectedPatient.id)} />}
          {page === "receipts" && <Receipts patients={patients} openModal={openModal} />}
        </main>
      </div>

      {/* Modals */}
      {modal === "post_session" && (
        <Modal onClose={closeModal}>
          <h3>📝 סיכום טיפול — {currentPatientForModal?.name}</h3>
          <p className="text-soft">כתבי סיכום קצר של הפגישה שזה עתה הסתיימה</p>
          <textarea className="field" rows={5} style={{marginTop:14}} placeholder="מה עשינו היום? מה עבד? מה להמשיך?"
            value={sessionNote} onChange={e => setSessionNote(e.target.value)} />
          <div className="flex gap-3 mt-3">
            <button className="btn btn-primary" onClick={saveSessionNote}>שמור סיכום</button>
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
                <p className="field-label">טלפון</p>
                <input className="field" placeholder="050-0000000"
                  value={receiptData.phone ?? (currentPatientForModal?.phone || "")}
                  onChange={e => setReceiptData({...receiptData, phone: e.target.value})} />
              </div>
              <div style={{flex:1}}>
                <p className="field-label">מייל (לשליחת קבלה)</p>
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

          <p className="field-label">סכום</p>
          <input className="field" type="number" placeholder="₪" value={receiptData.amount}
            onChange={e => setReceiptData({...receiptData, amount: e.target.value})} />
          <p className="field-label">אמצעי תשלום</p>
          <select className="field" value={receiptData.method}
            onChange={e => setReceiptData({...receiptData, method: e.target.value})}>
            <option>ביט</option><option>פייבוקס</option><option>העברה בנקאית</option><option>מזומן</option>
          </select>
          <p className="field-label">הערה (אופציונלי)</p>
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
    </>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  const nav = [
    { id:"dashboard", icon:"🏠", label:"ראשי" },
    { id:"calendar",  icon:"📅", label:"יומן" },
    { id:"patients",  icon:"👥", label:"מטופלים" },
    { id:"receipts",  icon:"🧾", label:"קבלות" },
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
function Dashboard({ patients, openModal, sendWhatsApp }) {
  const todayPatients = WEEK_APTS[1]; // Tuesday
  return (
    <>
      <h1 className="page-title">שלום! 👋</h1>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">30</div><div className="stat-label">מטופלים השבוע</div></div>
        <div className="stat-card"><div className="stat-num">4</div><div className="stat-label">טיפולים היום</div></div>
        <div className="stat-card"><div className="stat-num">₪2,400</div><div className="stat-label">הכנסה השבוע</div></div>
        <div className="stat-card"><div className="stat-num">3</div><div className="stat-label">ממתינים לתשלום</div></div>
      </div>

      <div className="card">
        <div className="card-title">📅 טיפולים מחר</div>
        {todayPatients.map((a, i) => {
          const patient = patients.find(p => p.name === a.name);
          return (
            <div key={i} className="patient-row">
              <div className="patient-avatar">{a.name[0]}</div>
              <div className="patient-info">
                <div className="patient-name">{a.name}</div>
                <div className="patient-meta">🕐 {a.time}</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => patient && openModal("pre_session", patient)}>סקירה לפני</button>
              <button className="btn btn-sm btn-primary" onClick={() => patient && sendWhatsApp(patient)}>📱 שלח אישור</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">⏰ לא שילמו</div>
        {patients.filter(p => !p.paid).map(p => (
          <div key={p.id} className="patient-row">
            <div className="patient-avatar">{p.name[0]}</div>
            <div className="patient-info">
              <div className="patient-name">{p.name}</div>
              <div className="patient-meta">טיפול אחרון: {p.history[0]?.date}</div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => openModal("receipt", p)}>הנפק קבלה</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Calendar ───────────────────────────────────────────────────────
// Each day has an ordered list of "blocks": { type:"treatment"|"break", minutes, patientId?, patientName?, status? }
// The schedule is built by walking blocks sequentially from dayStart.

function Calendar({ patients, openModal, sendWhatsApp }) {
  const [dayStart, setDayStart] = useState("08:30");
  const [dayEnd,   setDayEnd]   = useState("14:30");

  // dayBlocks: { [dayIdx]: [ {id, type, minutes, patientId?, patientName?, status} ] }
  const makeId = () => Math.random().toString(36).slice(2,8);
  const [dayBlocks, setDayBlocks] = useState({
    0: [
      { id:makeId(), type:"treatment", minutes:45, patientId:1, patientName:"יוסי כהן", status:"confirmed" },
      { id:makeId(), type:"treatment", minutes:45, patientId:2, patientName:"מיה לוי",  status:"pending"   },
    ],
    1: [
      { id:makeId(), type:"treatment", minutes:45, patientId:3, patientName:"דניאל ברק",status:"confirmed" },
      { id:makeId(), type:"break",     minutes:15 },
      { id:makeId(), type:"treatment", minutes:45, patientId:4, patientName:"נועה שמיר",status:"confirmed" },
    ],
    2: [
      { id:makeId(), type:"treatment", minutes:45, patientId:5, patientName:"עמיר גל",  status:"confirmed" },
    ],
  });

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

  const addBlock = (dayIdx, insertAfterIdx) => {
    const block = addType === "break"
      ? { id: makeId(), type: "break", minutes: breakMins }
      : null; // patient chosen separately
    if (addType === "break" && block) {
      setDayBlocks(prev => {
        const arr = [...(prev[dayIdx] || [])];
        arr.splice(insertAfterIdx + 1, 0, block);
        return { ...prev, [dayIdx]: arr };
      });
      setAddModal(null);
    }
  };

  const assignPatientToModal = (patient) => {
    const block = { id: makeId(), type: "treatment", minutes: 45, patientId: patient.id, patientName: patient.name, status: "pending" };
    setDayBlocks(prev => {
      const arr = [...(prev[addModal.dayIdx] || [])];
      arr.splice(addModal.insertAfterIdx + 1, 0, block);
      return { ...prev, [addModal.dayIdx]: arr };
    });
    setAddModal(null);
    setPatientQ("");
  };

  const removeBlock = (dayIdx, blockId) => {
    setDayBlocks(prev => ({ ...prev, [dayIdx]: (prev[dayIdx]||[]).filter(b => b.id !== blockId) }));
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
        {WEEK_DAYS.map((day, di) => {
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
  const filtered = patients.filter(p => p.name.includes(q) || p.diagnosis.includes(q));
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
            <div className={`patient-status`} style={p.paid ? {} : {background:"#FBE8E3",color:"#C4724A"}}>
              {p.paid ? "שולם ✓" : "ממתין לתשלום"}
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
function PatientDetail({ patient, onBack, openModal, generateReport, aiText, aiLoading, documents, addDocument, removeDocument, onEdit, onDelete }) {
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
          <button className="btn btn-secondary btn-sm" onClick={() => { openModal("report", patient); generateReport(patient); }}>📄 צור דוח AI</button>
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

      {tab === "history" && (
        <div className="session-list">
          {patient.history.map((s, i) => (
            <div key={i} className="session-item">
              <div className="session-date">📅 {s.date}</div>
              <div className="session-summary">{s.summary}</div>
            </div>
          ))}
        </div>
      )}

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
          <p className="mt-2"><strong>סטטוס תשלום:</strong> {patient.paid ? "✅ שולם" : "⏳ ממתין לתשלום"}</p>
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
            <span className="patient-status">שולם ✓</span>
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

function AiLoading() {
  return (
    <div className="ai-loading">
      <div className="dot" /><div className="dot" /><div className="dot" />
      <span>AI מנתח...</span>
    </div>
  );
}
