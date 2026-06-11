import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE CONFIG ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDyNjXvyFOQkjd1nrHcwG_DWLs8ABq8qIs",
  authDomain: "run-track-7b6d5.firebaseapp.com",
  projectId: "run-track-7b6d5",
  storageBucket: "run-track-7b6d5.firebasestorage.app",
  messagingSenderId: "772554533579",
  appId: "1:772554533579:web:ee6e1499ede3f0e425c94e"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const RUNS_COL = collection(db, 'runs');

function setSyncStatus(s) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (s === 'ok')       { el.textContent = 'Synced';     el.className = 'sync-status sync-ok';  el.style.display = ''; }
  else if (s === 'err') { el.textContent = 'Offline — changes will sync when reconnected'; el.className = 'sync-status sync-err'; el.style.display = ''; }
  else                  { el.textContent = 'Syncing…';   el.className = 'sync-status';           el.style.display = ''; }
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const WEIGHTS     = {easy:1, tempo:2.2, interval:3.5, long:1.8, optional:1.2, custom:1.5};
const TYPE_COLORS = {easy:'#639922', tempo:'#BA7517', interval:'#E24B4A', long:'#378ADD', optional:'#7F77DD', custom:'#7F77DD'};
const EFFORT_DESC = ['','very easy','easy','comfortable','moderate-easy','moderate','moderate-hard','hard','very hard','near max','all out'];

// ── STATE ──────────────────────────────────────────────────────────────────
let runs = [];
let effortVal = 5;
let activeCharts = {};
let activeChartName = 'fitness';
let chatHistory = [];
let coachInitialized = false;

// ── PROFILE ────────────────────────────────────────────────────────────────
function getProfile() { try { return JSON.parse(localStorage.getItem('runtrack_profile') || 'null'); } catch(e) { return null; } }
function setProfile(p) { localStorage.setItem('runtrack_profile', JSON.stringify(p)); }
function clearWorkoutCache() { localStorage.removeItem('runtrack_next_workout'); }

// ── FIREBASE CRUD ──────────────────────────────────────────────────────────
async function loadRuns() {
  try {
    setSyncStatus('syncing');
    const q = query(RUNS_COL, orderBy('date', 'asc'));
    const snap = await getDocs(q);
    runs = snap.docs.map(d => ({...d.data(), _id: d.id}));
    setSyncStatus('ok');
  } catch(e) {
    console.error(e);
    setSyncStatus('err');
  }
}
async function saveRun(run) {
  try {
    setSyncStatus('syncing');
    const {_id, ...data} = run;
    if (_id) { await updateDoc(doc(db, 'runs', _id), data); setSyncStatus('ok'); return run; }
    else { const ref = await addDoc(RUNS_COL, data); setSyncStatus('ok'); return {...run, _id: ref.id}; }
  } catch(e) { console.error(e); setSyncStatus('err'); return null; }
}
async function removeRun(id) {
  try { setSyncStatus('syncing'); await deleteDoc(doc(db, 'runs', id)); setSyncStatus('ok'); }
  catch(e) { console.error(e); setSyncStatus('err'); }
}

// ── CHAT CONTEXT (Firestore) ────────────────────────────────────────────────
const CHAT_DOC = doc(db, 'chat_context', 'coach_chat');
const MAX_SAVED_MESSAGES = 60;

async function loadChatContext() {
  try {
    const snap = await getDoc(CHAT_DOC);
    if (snap.exists()) return snap.data().messages || [];
    return [];
  } catch(e) { console.error('loadChatContext:', e); return []; }
}

async function saveChatContext(messages) {
  try {
    const capped = messages.slice(-MAX_SAVED_MESSAGES);
    await setDoc(CHAT_DOC, { messages: capped, updatedAt: Date.now() });
  } catch(e) { console.error('saveChatContext:', e); }
}

async function clearChatContext() {
  try { await deleteDoc(CHAT_DOC); } catch(e) { console.error('clearChatContext:', e); }
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function paceStr(v) {
  if (v == null || isNaN(v)) return '—';
  const m = Math.floor(v), s = Math.round((v - m) * 60);
  return m + ':' + String(s).padStart(2, '0') + '/km';
}
function parsePace(dist, t) {
  if (!dist || !t) return null;
  const p = t.trim().split(':').map(Number); let sec = 0;
  if (p.length === 2) sec = p[0] * 60 + p[1];
  else if (p.length === 3) sec = p[0] * 3600 + p[1] * 60 + p[2];
  if (!sec || isNaN(sec)) return null;
  return (sec / 60) / dist;
}

// ISO week string: "2026-W21"
function isoWeekStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d - startOfWeek1;
  const week = Math.floor(diff / (7 * 86400000)) + 1;
  return d.getFullYear() + '-W' + String(week).padStart(2, '0');
}

// Monday of the ISO week containing dateStr
function weekMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // 0=Mon
  d.setDate(d.getDate() - day);
  // Use local date methods — toISOString() returns UTC and gives the wrong
  // day for users in UTC+ timezones (e.g. IST midnight = prev-day UTC).
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function todayStr() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}

function friendlyDate(dateStr) {
  const today = todayStr();
  const yesterday = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate()-1); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const days = Math.floor((new Date(today + 'T00:00:00') - new Date(dateStr + 'T00:00:00')) / 86400000);
  if (days < 7) return days + ' days ago';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short'});
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function filterByRange(list) {
  const r = document.getElementById('chart-range')?.value || 'all';
  if (r === 'all') return list;
  if (r === 'last4w') {
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate()-28); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    return list.filter(x => x.date >= cutoff);
  }
  if (r === 'last3m') {
    const cutoff = (() => { const d = new Date(); d.setMonth(d.getMonth()-3); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
    return list.filter(x => x.date >= cutoff);
  }
  return list.filter(x => x.date.startsWith(r));
}

function populateChartRangeDropdown() {
  const sel = document.getElementById('chart-range');
  if (!sel) return;
  const currentVal = sel.value;
  const months = [...new Set(runs.map(r => r.date.slice(0, 7)))].sort();
  sel.innerHTML = '<option value="all">All time</option><option value="last4w">Last 4 weeks</option><option value="last3m">Last 3 months</option>';
  months.forEach(ym => {
    const [y, m] = ym.split('-');
    const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = ym; opt.textContent = label;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
  else sel.value = 'all';
}

function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function paceAxisRange(values, padding = 0.25) {
  const valid = values.filter(v => v != null && !isNaN(v));
  if (!valid.length) return { min: 4.5, max: 7.0 };
  const lo = Math.min(...valid), hi = Math.max(...valid);
  return { min: Math.max(2.5, Math.floor((lo - padding) * 4) / 4), max: Math.ceil((hi + padding) * 4) / 4 };
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:var(--bg3);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
}

// ── PERSONAL BESTS ─────────────────────────────────────────────────────────
function computePersonalBests() {
  const valid = runs.filter(r => r.type !== 'skipped');

  // Best pace per type
  const bestPaceByType = {};
  ['easy','tempo','interval','long','optional','custom'].forEach(type => {
    const tr = valid.filter(r => r.type === type && r.pace);
    if (tr.length) {
      const best = tr.reduce((a, b) => b.pace < a.pace ? b : a);
      bestPaceByType[type] = { pace: best.pace, date: best.date };
    }
  });

  // Longest single run
  const withDist = valid.filter(r => r.dist);
  const longestRun = withDist.length ? withDist.reduce((a, b) => b.dist > a.dist ? b : a) : null;

  // Highest weekly km
  const weekMap = {};
  valid.forEach(r => {
    const wk = isoWeekStr(r.date);
    weekMap[wk] = (weekMap[wk] || 0) + (r.dist || 0);
  });
  const weekEntries = Object.entries(weekMap);
  const bestWeek = weekEntries.length ? weekEntries.reduce((a, b) => b[1] > a[1] ? b : a) : null;

  // Longest streak (consecutive weeks with ≥1 run)
  const weeksWithRuns = new Set(valid.map(r => isoWeekStr(r.date)));
  let maxStreak = 0, curStreak = 0, prevWeek = null;
  [...weeksWithRuns].sort().forEach(wk => {
    if (!prevWeek) { curStreak = 1; }
    else {
      // Check if consecutive
      const [y1, w1] = prevWeek.split('-W').map(Number);
      const [y2, w2] = wk.split('-W').map(Number);
      const isNext = (y2 === y1 && w2 === w1 + 1) || (y2 === y1 + 1 && w1 >= 52 && w2 === 1);
      curStreak = isNext ? curStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, curStreak);
    prevWeek = wk;
  });

  // Fastest 5K: runs ≥ 5km, estimate pace * 5
  const fast5k = valid.filter(r => r.dist >= 5 && r.pace);
  const best5k = fast5k.length ? fast5k.reduce((a, b) => b.pace < a.pace ? b : a) : null;

  // Fastest 10K: runs ≥ 10km
  const fast10k = valid.filter(r => r.dist >= 10 && r.pace);
  const best10k = fast10k.length ? fast10k.reduce((a, b) => b.pace < a.pace ? b : a) : null;

  return { bestPaceByType, longestRun, bestWeek, maxStreak, best5k, best10k };
}

// ── WEEKLY STREAK (current) ────────────────────────────────────────────────
function currentStreak() {
  const valid = runs.filter(r => r.type !== 'skipped');
  const weeksWithRuns = new Set(valid.map(r => isoWeekStr(r.date)));
  const thisWeek = isoWeekStr(todayStr());
  let streak = 0, wk = thisWeek;
  while (weeksWithRuns.has(wk)) {
    streak++;
    // go back one week
    const [y, w] = wk.split('-W').map(Number);
    wk = w === 1 ? (y-1) + '-W52' : y + '-W' + String(w-1).padStart(2,'0');
    if (streak > 200) break;
  }
  return streak;
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
window.showPage = function(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'dashboard') renderDashboard();
  if (id === 'coach')     renderCoachPage();
  if (id === 'history')   renderHistory();
  if (id === 'charts')    renderChart(activeChartName);
  if (id === 'calendar')  renderCalendar();
};

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function renderDashboard() {
  const valid = runs.filter(r => r.type !== 'skipped');
  const totalKm = valid.reduce((s, r) => s + (r.dist || 0), 0);

  // This week km
  const today = todayStr();
  const monday = weekMonday(today);
  const weekKm = valid.filter(r => r.date >= monday).reduce((s, r) => s + (r.dist || 0), 0);

  // Today's run (if any)
  const todayRun = valid.find(r => r.date === today);

  // Last run (for "last run" metric when no run today)
  const lastRun = valid.length > 0 ? valid[valid.length - 1] : null;
  const daysSinceLast = lastRun
    ? Math.floor((new Date(today + 'T00:00:00') - new Date(lastRun.date + 'T00:00:00')) / 86400000)
    : null;

  // Streak
  const streak = currentStreak();

  // Last run metric: show today's summary if ran, else days since
  let lastRunMetric;
  if (todayRun) {
    lastRunMetric = `<div class="metric" style="grid-column:span 2">
      <div class="mlabel">Today's run</div>
      <div class="mval" style="font-size:16px;display:flex;align-items:center;gap:10px">
        <span>${(todayRun.dist||0).toFixed(1)} km</span>
        ${todayRun.pace ? `<span style="font-size:13px;color:var(--text2)">${paceStr(todayRun.pace)}</span>` : ''}
        <span class="run-badge badge-${badgeType(todayRun.type)}" style="font-size:11px">${todayRun.type}</span>
      </div>
    </div>`;
  } else {
    const dayLabel = daysSinceLast === null ? '—' : daysSinceLast === 0 ? 'Today' : daysSinceLast === 1 ? '1 day ago' : daysSinceLast + ' days ago';
    lastRunMetric = `<div class="metric">
      <div class="mlabel">Last run</div>
      <div class="mval" style="font-size:${dayLabel.length > 7 ? '14' : '18'}px">${dayLabel}</div>
    </div>`;
  }

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric"><div class="mlabel">This week</div><div class="mval">${weekKm.toFixed(1)} <span style="font-size:14px;font-weight:500;color:var(--text2)">km</span></div></div>
    <div class="metric"><div class="mlabel">Total runs</div><div class="mval">${valid.length}</div></div>
    ${lastRunMetric}
    <div class="metric"><div class="mlabel">Streak</div><div class="mval">${streak}<span style="font-size:14px;font-weight:500;color:var(--text2)"> wk${streak !== 1 ? 's' : ''}</span></div></div>`;

  renderDashboardAiCard();
  renderPersonalBests();

  // Recent activity — friendly dates, last 5
  const recentRuns = valid.slice(-5).reverse();
  let activityHtml = '';
  if (!recentRuns.length) {
    activityHtml = `<div style="color:var(--text3);font-size:13px">No runs yet. Tap Log run to get started!</div>`;
  } else {
    activityHtml = recentRuns.map(r => {
      const bt = badgeType(r.type);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
        <span class="run-badge badge-${bt}" style="flex-shrink:0">${r.label || r.type}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${friendlyDate(r.date)}</div>
          <div style="font-size:12px;color:var(--text3)">${r.dist ? r.dist.toFixed(1) + ' km' : ''}${r.pace ? ' · ' + paceStr(r.pace) : ''}${r.effort ? ' · effort ' + r.effort + '/10' : ''}</div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('this-week-card').innerHTML = `
    <div class="sec" style="margin-bottom:.75rem">Recent activity</div>
    ${activityHtml}`;
}

function renderPersonalBests() {
  const el = document.getElementById('dash-pbs');
  if (!el) return;
  const pb = computePersonalBests();
  const valid = runs.filter(r => r.type !== 'skipped');
  if (!valid.length) { el.innerHTML = ''; return; }

  const cards = [];

  if (pb.best5k) cards.push({ icon:'⚡', label:'Fastest 5K pace', val: paceStr(pb.best5k.pace), sub: friendlyDate(pb.best5k.date) });
  if (pb.best10k) cards.push({ icon:'🏅', label:'Fastest 10K pace', val: paceStr(pb.best10k.pace), sub: friendlyDate(pb.best10k.date) });
  if (pb.longestRun) cards.push({ icon:'📏', label:'Longest run', val: pb.longestRun.dist.toFixed(1) + ' km', sub: friendlyDate(pb.longestRun.date) });
  if (pb.bestWeek) cards.push({ icon:'🔥', label:'Best week', val: pb.bestWeek[1].toFixed(1) + ' km', sub: pb.bestWeek[0] });
  if (pb.maxStreak) cards.push({ icon:'🗓️', label:'Longest streak', val: pb.maxStreak + ' week' + (pb.maxStreak !== 1 ? 's' : ''), sub: 'consecutive' });

  // Best pace per type
  Object.entries(pb.bestPaceByType).forEach(([type, data]) => {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    cards.push({ icon:'🏃', label: 'Best ' + typeLabel + ' pace', val: paceStr(data.pace), sub: friendlyDate(data.date), color: TYPE_COLORS[type] });
  });

  if (!cards.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="sec" style="margin-bottom:.75rem">🏆 Personal bests</div>
    <div class="pb-scroll">
      ${cards.map(c => `
        <div class="pb-card">
          <div class="pb-icon">${c.icon}</div>
          <div class="pb-label">${c.label}</div>
          <div class="pb-val" style="${c.color ? 'color:'+c.color : ''}">${c.val}</div>
          <div class="pb-sub">${c.sub}</div>
        </div>`).join('')}
    </div>`;
}

async function renderDashboardAiCard() {
  const el = document.getElementById('dash-ai-card');
  if (!el) return;
  el.innerHTML = `<div class="dash-ai"><div class="sec" style="margin-bottom:4px">🤖 AI Coach — Next workout</div><div style="display:flex;align-items:center;gap:8px;padding:8px 0;color:var(--text3);font-size:13px"><div class="spinner"></div>Thinking…</div></div>`;
  const w = await getOrFetchWorkout();
  if (!w) {
    el.innerHTML = `<div class="dash-ai"><div class="sec" style="margin-bottom:4px">🤖 AI Coach</div><div style="font-size:13px;color:var(--text3)">Couldn't load suggestion. <a style="color:var(--blue);cursor:pointer" onclick="renderDashboardAiCard()">Retry</a></div></div>`;
    return;
  }
  const bt = badgeType(w.type);
  el.innerHTML = `<div class="dash-ai">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div class="sec" style="margin:0">🤖 AI Coach — Next workout</div>
      <button class="btn btn-sm" onclick="showPage('coach',document.querySelectorAll('.nav button')[1])">Full view + chat →</button>
    </div>
    <div class="dash-ai-body" style="margin-top:10px">
      <span class="run-badge badge-${bt}" style="align-self:flex-start;margin-top:2px">${w.type || 'run'}</span>
      <div class="dash-ai-right">
        <div class="dash-ai-title">${escHtml(w.title || 'Workout')}</div>
        <div class="dash-ai-meta">${escHtml(w.distance || '')}${w.pace ? ' · ' + escHtml(w.pace) : ''}${w.duration ? ' · ' + escHtml(w.duration) : ''}</div>
        <div class="dash-ai-desc">${escHtml((w.description || '').substring(0, 120))}${(w.description || '').length > 120 ? '…' : ''}</div>
      </div>
    </div>
  </div>`;
}

function badgeType(type) {
  const t = (type || '').toLowerCase();
  if (['easy','tempo','interval','long','optional','custom','recovery'].includes(t)) return t;
  return 'custom';
}

// ── MODAL ──────────────────────────────────────────────────────────────────
function showModal(title, body, buttons) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent  = body;
  document.getElementById('modal-actions').innerHTML = buttons.map((b, i) =>
    `<button class="btn btn-sm ${b.style === 'danger' ? 'btn-danger' : i === 0 ? 'btn-primary' : ''}" id="mb-${i}">${b.label}</button>`
  ).join('');
  buttons.forEach((b, i) => document.getElementById('mb-' + i).onclick = b.action);
  document.getElementById('modal').style.display = 'flex';
}
function closeModal() { document.getElementById('modal').style.display = 'none'; }
window.closeModal = closeModal;
document.getElementById('modal').addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });

// ── LOG RUN ────────────────────────────────────────────────────────────────
window.toggleCustomRow = function() {
  document.getElementById('log-custom-row').style.display = document.getElementById('log-type').value === 'custom' ? 'block' : 'none';
};

function updateLivePace() {
  const dist  = parseFloat(document.getElementById('log-dist').value);
  const time  = document.getElementById('log-time').value.trim();
  const preview = document.getElementById('pace-preview');
  if (!preview) return;
  const pace = parsePace(dist, time);
  preview.textContent = pace ? '→ ' + paceStr(pace) : '';
}
window.updateLivePace = updateLivePace;

function initEffortDots(val) {
  if (val != null) effortVal = val;
  const c = document.getElementById('effort-dots'); if (!c) return; c.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const d = document.createElement('div'); d.className = 'effort-dot';
    const col = i <= 3 ? '#639922' : i <= 6 ? '#BA7517' : '#E24B4A';
    d.style.borderColor = col; d.style.background = i <= effortVal ? col : 'transparent';
    d.onclick = () => initEffortDots(i); c.appendChild(d);
  }
  const lbl = document.getElementById('effort-label');
  if (lbl) lbl.textContent = effortVal + ' · ' + EFFORT_DESC[effortVal];
}

window.logRun = async function() {
  const date   = document.getElementById('log-date').value;
  const type   = document.getElementById('log-type').value;
  const custom = document.getElementById('log-custom').value.trim();
  const dist   = parseFloat(document.getElementById('log-dist').value);
  const t      = document.getElementById('log-time').value.trim();
  const notes  = document.getElementById('log-notes').value.trim();
  const msg    = document.getElementById('log-msg');
  if (!date)          { msg.style.color = 'var(--red)'; msg.textContent = 'Please select a date.'; return; }
  if (!dist || dist <= 0) { msg.style.color = 'var(--red)'; msg.textContent = 'Please enter a valid distance.'; return; }
  const pace = parsePace(dist, t);
  const run  = {date, type, label: type === 'custom' ? (custom || 'Custom') : type, dist, time: t, pace, effort: effortVal, notes, id: Date.now()};
  msg.style.color = 'var(--text3)'; msg.textContent = 'Saving…';
  const saved = await saveRun(run);
  if (saved) {
    runs.push(saved); runs.sort((a, b) => a.date.localeCompare(b.date));
    clearWorkoutCache(); coachInitialized = false;
    msg.style.color = 'var(--green)';
    msg.textContent = '✓ Saved! ' + dist.toFixed(1) + ' km' + (pace ? ' @ ' + paceStr(pace) : '');
    setTimeout(() => {
      msg.textContent = '';
      showPage('dashboard', document.querySelector('.nav button'));
    }, 1800);
  } else { msg.style.color = 'var(--red)'; msg.textContent = 'Error saving. Check connection.'; }
};

window.clearLogForm = function() {
  document.getElementById('log-date').valueAsDate = new Date();
  document.getElementById('log-dist').value = '';
  document.getElementById('log-time').value = '';
  document.getElementById('log-notes').value = '';
  document.getElementById('log-type').value = 'easy';
  document.getElementById('log-custom-row').style.display = 'none';
  const preview = document.getElementById('pace-preview');
  if (preview) preview.textContent = '';
  effortVal = 5; initEffortDots();
};

window.goToLog = function(type, date) {
  document.getElementById('log-type').value = type || 'easy';
  document.getElementById('log-date').value = date || todayStr();
  showPage('log', null);
};

// ── HISTORY ────────────────────────────────────────────────────────────────
function renderHistory() {
  const filter   = document.getElementById('hist-filter').value;
  const list     = document.getElementById('run-list');
  const empty    = document.getElementById('hist-empty');
  const filtered = (filter === 'all' ? runs : runs.filter(r => r.type === filter)).slice().reverse();
  if (!filtered.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(r => {
    const bt  = ['easy','tempo','interval','long'].includes(r.type) ? r.type : 'custom';
    const eid = 'ef-' + r._id;
    return `<li class="run-item" id="ri-${r._id}">
      <div class="run-item-main">
        <span class="run-badge badge-${bt}">${r.label || r.type}</span>
        <span style="color:var(--text2);font-size:13px">${fmtDate(r.date)}</span>
        <span style="font-weight:600">${(r.dist || 0).toFixed(1)} km</span>
        ${r.pace ? `<span style="color:var(--text2)">${paceStr(r.pace)}</span>` : ''}
        ${r.effort ? `<span style="color:var(--text3);font-size:12px">effort ${r.effort}/10</span>` : ''}
        ${r.notes ? `<span style="color:var(--text3);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes}</span>` : ''}
        <div style="margin-left:auto;position:relative">
          <button class="btn btn-sm" style="padding:3px 8px;font-size:13px" onclick="toggleRunMenu('${r._id}')">⋮</button>
          <div id="menu-${r._id}" class="run-menu" style="display:none">
            <button onclick="toggleEF('${eid}');toggleRunMenu('${r._id}')">Edit</button>
            <button class="danger" onclick="confirmDelete('${r._id}');toggleRunMenu('${r._id}')">Delete</button>
          </div>
        </div>
      </div>
      <div id="${eid}" class="run-edit-form">
        <div class="row">
          <div><label>Distance (km)</label><input type="number" id="ed-d-${r._id}" value="${r.dist || ''}" step="0.1" min="0"></div>
          <div><label>Duration</label><input type="text" id="ed-t-${r._id}" value="${r.time || ''}"></div>
        </div>
        <div class="row" style="margin-top:8px">
          <div><label>Type</label><select id="ed-tp-${r._id}">
            <option value="easy" ${r.type==='easy'?'selected':''}>Easy</option>
            <option value="tempo" ${r.type==='tempo'?'selected':''}>Tempo</option>
            <option value="interval" ${r.type==='interval'?'selected':''}>Interval</option>
            <option value="long" ${r.type==='long'?'selected':''}>Long run</option>
            <option value="optional" ${r.type==='optional'?'selected':''}>Optional</option>
            <option value="custom" ${r.type==='custom'?'selected':''}>Custom</option>
          </select></div>
          <div><label>Effort (1–10)</label><input type="number" id="ed-e-${r._id}" value="${r.effort || 5}" min="1" max="10"></div>
        </div>
        <div style="margin-top:8px"><label>Notes</label><textarea id="ed-n-${r._id}" rows="2">${r.notes || ''}</textarea></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn btn-sm btn-primary" onclick="saveEdit('${r._id}')">Save changes</button>
          <button class="btn btn-sm" onclick="toggleEF('${eid}')">Cancel</button>
        </div>
      </div>
    </li>`;
  }).join('');
}

window.toggleRunMenu = function(id) {
  const menu = document.getElementById('menu-' + id);
  if (!menu) return;
  // Close all other menus
  document.querySelectorAll('.run-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
};
// Close menus on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.run-item')) document.querySelectorAll('.run-menu').forEach(m => m.style.display = 'none');
});

window.toggleEF = function(id) { const el = document.getElementById(id); if (!el) return; el.style.display = el.style.display === 'block' ? 'none' : 'block'; };
window.saveEdit = async function(id) {
  const run = runs.find(r => r._id === id); if (!run) return;
  const dist   = parseFloat(document.getElementById('ed-d-' + id).value) || run.dist;
  const time   = document.getElementById('ed-t-' + id).value.trim();
  const type   = document.getElementById('ed-tp-' + id).value;
  const effort = parseInt(document.getElementById('ed-e-' + id).value) || run.effort;
  const notes  = document.getElementById('ed-n-' + id).value.trim();
  const pace   = parsePace(dist, time);
  Object.assign(run, {dist, time, type, label: type, effort, notes, pace});
  await saveRun(run); clearWorkoutCache(); renderHistory();
};
window.confirmDelete = function(id) {
  showModal('Delete run?', 'This will permanently delete this run. Cannot be undone.', [
    {label: 'Delete', style: 'danger', action: async () => { closeModal(); await removeRun(id); runs = runs.filter(r => r._id !== id); clearWorkoutCache(); coachInitialized = false; renderHistory(); }},
    {label: 'Cancel', action: closeModal}
  ]);
};

// ── CHARTS ─────────────────────────────────────────────────────────────────
window.showChart = function(name, btn) {
  activeChartName = name;
  ['fitness','pace','distance','effort','weeklykm'].forEach(n => {
    const el = document.getElementById('chart-' + n);
    if (el) el.style.display = n === name ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderChart(name);
};
function destroyChart(id) { if (activeCharts[id]) { try { activeCharts[id].destroy(); } catch(e) {} delete activeCharts[id]; } }
function renderChart(name) {
  populateChartRangeDropdown();
  const empty = document.getElementById('charts-empty');
  const valid = runs.filter(r => r.type !== 'skipped');
  if (!valid.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const data = filterByRange(runs);
  if (name === 'fitness')   renderFitness(data);
  else if (name === 'pace') renderPaceChart(data);
  else if (name === 'distance') renderDist(data);
  else if (name === 'effort')   renderEffort(data);
  else if (name === 'weeklykm') renderWeeklyKm(data);
}

function renderFitness(data) {
  destroyChart('fitness');
  const sorted = [...data].filter(r => r.type !== 'skipped').sort((a, b) => a.date.localeCompare(b.date));
  let score = 0;
  const labels = [], vals = [];
  sorted.forEach(r => {
    const w = WEIGHTS[r.type] || 1.5, pb = r.pace ? Math.max(0, (5.5 - r.pace) * 8) : 0;
    score += (r.dist * w) + pb;
    labels.push(fmtDate(r.date));
    vals.push(Math.round(score * 10) / 10);
  });
  activeCharts['fitness'] = new Chart(document.getElementById('c-fitness').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label:'Fitness', data:vals, borderColor:'#378ADD', backgroundColor:'rgba(55,138,221,0.07)', fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'#378ADD' }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label:(ctx) => 'Score: ' + ctx.parsed.y } } },
      scales: { y:{ beginAtZero:false, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:'#888'} }, x:{ grid:{display:false}, ticks:{color:'#888', maxRotation:35, autoSkip:true, maxTicksLimit:8} } }
    }
  });
}

function renderPaceChart(data) {
  destroyChart('pace');
  const validData = data.filter(r => r.type !== 'skipped');
  const types = ['easy','tempo','interval','long','optional','custom'];
  const datasets = [], allPaces = [];
  types.forEach(type => {
    const tr = validData.filter(r => r.type === type && r.pace).sort((a, b) => a.date.localeCompare(b.date));
    if (!tr.length) return;
    allPaces.push(...tr.map(r => r.pace));
    datasets.push({ label: type.charAt(0).toUpperCase() + type.slice(1), data: tr.map(r => ({ x: fmtDate(r.date), y: Math.round(r.pace * 100) / 100 })), borderColor: TYPE_COLORS[type], backgroundColor: TYPE_COLORS[type], tension: 0.3, pointRadius: 5, fill: false });
  });
  if (!datasets.length) return;
  const allL = [...new Set(validData.map(r => fmtDate(r.date)))];
  const { min, max } = paceAxisRange(allPaces);
  datasets.push({ label:'Target', data: allL.map(d => ({ x:d, y:4.0 })), borderColor:'rgba(180,180,180,0.5)', borderDash:[6,4], pointRadius:0, fill:false });
  activeCharts['pace'] = new Chart(document.getElementById('c-pace').getContext('2d'), {
    type: 'line', data: { datasets },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{ display:true, labels:{ color:'#888', boxWidth:10, font:{size:11} } } },
      scales: { y:{ reverse:true, min, max, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:'#888', callback: v => { const m=Math.floor(v),s=Math.round((v-m)*60); return m+':'+String(s).padStart(2,'0'); }} }, x:{ type:'category', grid:{display:false}, ticks:{color:'#888', maxRotation:35, autoSkip:true, maxTicksLimit:8} } }
    }
  });
}

function renderDist(data) {
  destroyChart('dist');
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return;
  const startDate = new Date(sorted[0].date + 'T00:00:00');
  const endDate   = new Date(sorted[sorted.length - 1].date + 'T00:00:00');
  const runMap    = {};
  sorted.forEach(r => { if (r.type !== 'skipped') runMap[r.date] = r; });

  const labels = [], vals = [], ptColors = [], ptBorder = [], ptRadii = [], runRefs = [];
  const msPerDay = 86400000;
  let lastRunDateStr = null;
  sorted.filter(r => r.type !== 'skipped').forEach(r => { if (!lastRunDateStr || r.date > lastRunDateStr) lastRunDateStr = r.date; });

  for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + msPerDay)) {
    const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const run = runMap[ds];
    const dist = run ? Math.round((run.dist || 0) * 10) / 10 : 0;
    const isMostRecent = ds === lastRunDateStr;
    const isRun = !!run;
    const isFirst = d.getTime() === startDate.getTime();
    const isMonthStart = d.getDate() === 1;
    labels.push((isFirst || isMonthStart) ? d.toLocaleDateString('en-GB', {month:'short', year:'2-digit'}) : '');
    vals.push(dist);
    runRefs.push(run || null);
    if (!isRun) { ptColors.push('transparent'); ptBorder.push('transparent'); ptRadii.push(0); }
    else if (isMostRecent) { ptColors.push('#C8691A'); ptBorder.push('#C8691A'); ptRadii.push(5); }
    else { ptColors.push('transparent'); ptBorder.push('#C8691A'); ptRadii.push(4); }
  }

  const maxDist = Math.max(...vals, 1);
  const yMax = Math.ceil(maxDist / 2) * 2 + 2;
  const yStep = yMax <= 10 ? 2 : yMax <= 20 ? 5 : 10;

  activeCharts['dist'] = new Chart(document.getElementById('c-dist').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label:'Distance', data:vals, borderColor:'#C8691A', backgroundColor:'rgba(200,105,26,0.18)', fill:true, tension:0, pointRadius:ptRadii, pointBackgroundColor:ptColors, pointBorderColor:ptBorder, pointBorderWidth:2, borderWidth:2 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ filter:(item) => runRefs[item.dataIndex] !== null, callbacks:{ title:(items) => { const r = runRefs[items[0].dataIndex]; return r ? r.date : ''; }, label:(ctx) => { const r = runRefs[ctx.dataIndex]; if (!r) return null; let s = r.type.charAt(0).toUpperCase()+r.type.slice(1)+': '+(r.dist||0).toFixed(1)+' km'; if (r.pace) s += ' · ' + paceStr(r.pace); return s; } } } },
      scales: { y:{ beginAtZero:true, max:yMax, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:'#888', stepSize:yStep, callback:v=>v+' km'} }, x:{ grid:{display:false}, ticks:{color:'#888', maxRotation:0, autoSkip:false, callback:function(val,idx){ return labels[idx]||''; } } } }
    }
  });
}

function renderWeeklyKm(data) {
  destroyChart('weeklykm');
  const valid = data.filter(r => r.type !== 'skipped' && r.dist);
  if (!valid.length) return;

  // Aggregate by ISO week
  const weekMap = {};
  valid.forEach(r => {
    const wk = isoWeekStr(r.date);
    if (!weekMap[wk]) weekMap[wk] = { total: 0, mon: weekMonday(r.date) };
    weekMap[wk].total += r.dist;
  });

  // Generate every week from first run to current week (zero-fill gaps)
  const sortedKeys = Object.keys(weekMap).sort();
  const firstMon = new Date(weekMap[sortedKeys[0]].mon + 'T00:00:00');
  const currentMonStr = weekMonday(todayStr());
  const currentMon = new Date(currentMonStr + 'T00:00:00');
  const currentWk = isoWeekStr(currentMonStr);

  const labels = [], vals = [], monStrs = [], weekRefs = [];
  for (let d = new Date(firstMon); d <= currentMon; d.setDate(d.getDate() + 7)) {
    // Use local date methods — toISOString() is UTC and shifts day back in UTC+ timezones
    const monStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const wk = isoWeekStr(monStr);
    labels.push(fmtDate(monStr));
    monStrs.push(monStr);
    const km = weekMap[wk] ? Math.round(weekMap[wk].total * 10) / 10 : 0;
    vals.push(km);
    weekRefs.push({ km, mon: monStr, isCurrent: wk === currentWk });
  }

  const currentWeekIdx = vals.length - 1; // always the rightmost bar
  const lastRunIdx = vals.reduce((last, v, i) => (v > 0 && i !== currentWeekIdx) ? i : last, -1);

  // Points: highlight last completed week and current week separately
  const ptColors = vals.map((v, i) => {
    if (i === currentWeekIdx) return v > 0 ? '#378ADD' : 'transparent';
    if (i === lastRunIdx) return '#639922';
    return 'transparent';
  });
  const ptBorder = vals.map((v, i) => {
    if (i === currentWeekIdx) return v > 0 ? '#378ADD' : 'transparent';
    return v > 0 ? '#639922' : 'transparent';
  });
  const ptRadii = vals.map((v, i) => {
    if (i === currentWeekIdx) return v > 0 ? 6 : 0;
    if (i === lastRunIdx) return 5;
    return v > 0 ? 4 : 0;
  });

  // Segment colors: current week point blue, rest green
  const pointBgColors = ptColors;

  const maxKm = Math.max(...vals, 1);
  const yMax  = Math.ceil(maxKm / 5) * 5 + 5;

  activeCharts['weeklykm'] = new Chart(document.getElementById('c-weeklykm').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label:'Weekly km', data:vals, borderColor:'#639922', backgroundColor:'rgba(99,153,34,0.15)', fill:true, tension:0, pointRadius:ptRadii, pointBackgroundColor:pointBgColors, pointBorderColor:ptBorder, pointBorderWidth:2, borderWidth:2 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{
        title:(items) => {
          const ref = weekRefs[items[0].dataIndex];
          return 'Week of ' + fmtDate(ref.mon) + (ref.isCurrent ? ' (this week)' : '');
        },
        label:(ctx) => {
          const ref = weekRefs[ctx.dataIndex];
          const km = ctx.parsed.y.toFixed(1);
          return ref.isCurrent ? km + ' km so far' : km + ' km';
        }
      } } },
      scales: { y:{ beginAtZero:true, max:yMax, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:'#888', callback:v=>v+' km'} }, x:{ grid:{display:false}, ticks:{color:'#888', maxRotation:35, autoSkip:true, maxTicksLimit:10} } }
    }
  });
}

function renderEffort(data) {
  destroyChart('effort');
  const sorted = [...data].filter(r => r.type !== 'skipped').sort((a, b) => a.date.localeCompare(b.date));
  activeCharts['effort'] = new Chart(document.getElementById('c-effort').getContext('2d'), {
    type: 'bar',
    data: { labels: sorted.map(r => fmtDate(r.date)), datasets: [{ label:'Effort', data: sorted.map(r => r.effort || 0), backgroundColor: sorted.map(r => TYPE_COLORS[r.type] || '#888'), borderRadius: 4 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label:(ctx) => { const r = sorted[ctx.dataIndex]; return 'Effort: ' + ctx.parsed.y + '/10 (' + r.type + ')'; } } } },
      scales: { y:{ min:0, max:10, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:'#888', stepSize:2} }, x:{ grid:{display:false}, ticks:{color:'#888', maxRotation:35, autoSkip:true, maxTicksLimit:8} } }
    }
  });
}

// ── AI: SYSTEM PROMPT ──────────────────────────────────────────────────────
function buildSystemPrompt() {
  const profile   = getProfile() || {};
  const valid     = runs.filter(r => r.type !== 'skipped');
  const paces     = valid.filter(r => r.pace).map(r => r.pace);
  const bestPace  = paces.length ? Math.min(...paces) : null;
  const avgPace   = paces.length ? (paces.reduce((a, b) => a + b, 0) / paces.length) : null;
  const recent    = valid.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  const histText  = recent.map(r =>
    `${r.date}: ${r.type}, ${(r.dist || 0).toFixed(1)}km${r.pace ? ', pace ' + paceStr(r.pace) : ''}${r.effort ? ', effort ' + r.effort + '/10' : ''}${r.notes ? ', notes: "' + r.notes + '"' : ''}`
  ).join('\n');

  const today = todayStr();
  const lastRun = valid.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const daysSinceLast = lastRun ? Math.floor((new Date(today + 'T00:00:00') - new Date(lastRun.date + 'T00:00:00')) / 86400000) : null;
  const gapNote = daysSinceLast === null ? 'No runs logged yet.' : daysSinceLast === 0 ? 'Runner trained today.' : daysSinceLast === 1 ? 'Last run was yesterday.' : `Last run was ${daysSinceLast} days ago.`;

  const monday = weekMonday(today);
  const weekKm = [0, 1, 2].map(i => {
    const end   = new Date(monday + 'T00:00:00'); end.setDate(end.getDate() - i * 7);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    const es = end.getFullYear() + '-' + String(end.getMonth()+1).padStart(2,'0') + '-' + String(end.getDate()).padStart(2,'0');
    const ss = start.getFullYear() + '-' + String(start.getMonth()+1).padStart(2,'0') + '-' + String(start.getDate()).padStart(2,'0');
    return valid.filter(r => r.date >= ss && r.date < es).reduce((s, r) => s + (r.dist || 0), 0);
  });
  const avgWeeklyKm = weekKm.reduce((s, v) => s + v, 0) / 3;

  return `You are RunCoach, an expert AI running coach built into the RunTrack app. You give personalised, data-driven training advice based on the runner's actual logged history — there is no fixed plan.

USER PROFILE:
- Primary goal: ${profile.goal || 'Not set'}
- Fitness level: ${profile.fitnessLevel || 'Unknown'}
- Available training days/week: ${profile.daysPerWeek || '3'}
- Current estimated 5K time: ${profile.current5K || 'Not provided'}
- Injuries/limitations: ${profile.injuries || 'None mentioned'}
- Additional notes: ${profile.extraNotes || 'None'}

RUNNING STATS:
- Total completed runs: ${valid.length}
- Total km logged: ${valid.reduce((s, r) => s + (r.dist || 0), 0).toFixed(1)} km
- Best logged pace: ${bestPace ? paceStr(bestPace) : 'No data yet'}
- Average pace: ${avgPace ? paceStr(avgPace) : 'No data yet'}

TRAINING LOAD & GAPS:
- ${gapNote}
- km this week: ${weekKm[0].toFixed(1)} km
- km last week: ${weekKm[1].toFixed(1)} km
- km two weeks ago: ${weekKm[2].toFixed(1)} km
- 3-week average weekly km: ${avgWeeklyKm.toFixed(1)} km

RECENT RUN HISTORY (newest first):
${histText || 'No runs logged yet.'}

COACHING RULES:
1. The runner's GOAL is the north star — every workout must move them toward it
2. Base ALL suggestions on actual history above — never invent generic plans
3. Use gap analysis: if >5 days since last run, ease them back in; if >10 days, treat as returning from a break
4. Never increase weekly volume more than 10% above the 3-week average
5. Be warm, direct, and specific — avoid vague advice
6. Keep responses concise — plain paragraphs, no excessive bullet lists
7. If no runs are logged, ask about recent activity before suggesting a workout
8. Adapt tone to the runner's level — don't overcomplicate things for beginners`;
}

// ── AI: FETCH WORKOUT ──────────────────────────────────────────────────────
const WORKOUT_CACHE_KEY = 'runtrack_next_workout';

async function getOrFetchWorkout(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(WORKOUT_CACHE_KEY);
      if (cached) {
        const p = JSON.parse(cached);
        if (p.runCount === runs.length) return p.workout;
      }
    } catch(e) {}
  }
  const w = await fetchWorkoutSuggestion();
  if (w) {
    try { localStorage.setItem(WORKOUT_CACHE_KEY, JSON.stringify({workout: w, runCount: runs.length, cachedAt: Date.now()})); } catch(e) {}
  }
  return w;
}

async function fetchWorkoutSuggestion() {
  const systemPrompt = buildSystemPrompt();
  const recentChat = chatHistory.slice(1).slice(-10);
  const chatContext = recentChat.length > 0
    ? '\n\nRECENT COACHING CONVERSATION:\n' + recentChat.map(m => `${m.role === 'user' ? 'Runner' : 'Coach'}: ${m.content}`).join('\n')
    : '';
  const userMessage = `Based on this runner's history${chatContext ? ' and our recent conversation' : ''}, suggest their next workout.${chatContext}

Respond ONLY with valid JSON, no markdown, no code fences:
{
  "type": "easy|tempo|interval|long|recovery",
  "title": "Short title",
  "distance": "X km",
  "pace": "X:XX–X:XX/km",
  "duration": "~XX min",
  "structure": "Specific structure",
  "description": "2-3 sentences on what to do and how it should feel.",
  "warmup": "Warmup (1 sentence)",
  "cooldown": "Cooldown (1 sentence)",
  "reasoning": "1-2 sentences why THIS workout now, referencing their history."
}`;
  try {
    const resp = await fetch('/api/workout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({systemPrompt, userMessage}) });
    if (!resp.ok) { console.error('Workout API error:', resp.status); return null; }
    const data = await resp.json();
    return data.workout || null;
  } catch(e) { console.error('Workout fetch failed:', e); return null; }
}

// ── AI: CHAT ───────────────────────────────────────────────────────────────
async function callChatApi(messages) {
  const systemPrompt = buildSystemPrompt();
  const fullMessages = [{role:'system', content:systemPrompt}, ...messages];
  try {
    const resp = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({messages: fullMessages}) });
    if (!resp.ok) { console.error('Chat API error:', resp.status); return null; }
    const data = await resp.json();
    return data.reply || null;
  } catch(e) { console.error('Chat failed:', e); return null; }
}

// ── AI COACH PAGE ──────────────────────────────────────────────────────────
async function renderCoachPage() {
  const profile = getProfile();
  const wArea   = document.getElementById('coach-workout-area');
  wArea.innerHTML = `<div class="nw-card"><div class="nw-loading"><div class="spinner"></div><p>Your coach is thinking…</p></div></div>`;

  if (!profile) {
    wArea.innerHTML = `<div class="nw-card"><div class="nw-nokey"><p>Complete your profile setup to get personalised workout suggestions.</p><button class="btn btn-primary btn-sm" onclick="startOnboarding()">Set up AI Coach</button></div></div>`;
    document.getElementById('coach-chat-area').innerHTML = `<div class="chat-nokey">Complete your profile to start chatting with your coach.</div>`;
    return;
  }

  const w = await getOrFetchWorkout();
  if (!w) {
    wArea.innerHTML = `<div class="nw-card"><div class="nw-error">Couldn't generate a suggestion. Check your connection.<br><br><button class="btn btn-sm btn-primary" onclick="refreshWorkout()">Retry</button></div></div>`;
  } else {
    wArea.innerHTML = buildWorkoutCard(w);
  }

  if (!coachInitialized) {
    const savedMessages = await loadChatContext();
    const greeting = {role:'assistant', content: buildCoachGreeting(profile)};
    chatHistory = [greeting, ...savedMessages];
    coachInitialized = true;
  }
  renderChatUI();
}

function buildCoachGreeting(profile) {
  const valid = runs.filter(r => r.type !== 'skipped');
  const goalText = profile.goal ? 'help you ' + profile.goal.toLowerCase() : 'support your training';
  if (!valid.length) return `Hi! I'm your AI running coach. I'm here to ${goalText}.\n\nYou haven't logged any runs yet — once you start, I'll use your history to suggest workouts. For now, ask me anything about pacing, training structure, or getting started.`;
  return `Hi! I'm your AI running coach. I can see you've logged ${valid.length} run${valid.length !== 1 ? 's' : ''}.\n\nI'll use your history to suggest the right next workout and adapt as you train. Ask me anything — about today's session, pacing, recovery, or reaching your goal of "${profile.goal || 'getting fitter'}".`;
}

function buildWorkoutCard(w) {
  const bt = badgeType(w.type);
  return `<div class="nw-card">
    <div class="nw-top">
      <div>
        <div class="nw-label">🤖 AI Coach — Next workout</div>
        <span class="run-badge badge-${bt}" style="margin-bottom:6px;display:inline-block">${w.type || 'run'}</span>
        <div class="nw-title">${escHtml(w.title || 'Workout')}</div>
      </div>
      <button class="btn btn-sm" onclick="refreshWorkout()" style="flex-shrink:0;margin-top:4px">↻ Refresh</button>
    </div>
    <div class="nw-meta-row">
      ${w.distance ? `<div class="nw-stat"><div class="nw-stat-label">Distance</div><div class="nw-stat-val">${escHtml(w.distance)}</div></div>` : ''}
      ${w.pace     ? `<div class="nw-stat"><div class="nw-stat-label">Target pace</div><div class="nw-stat-val">${escHtml(w.pace)}</div></div>` : ''}
      ${w.duration ? `<div class="nw-stat"><div class="nw-stat-label">Duration</div><div class="nw-stat-val">${escHtml(w.duration)}</div></div>` : ''}
    </div>
    ${w.structure  ? `<div class="nw-structure">📋 ${escHtml(w.structure)}</div>` : ''}
    <div class="nw-desc">${escHtml(w.description || '')}</div>
    <div class="nw-prep">
      ${w.warmup   ? `<div class="nw-prep-item">🔆 <strong>Warmup:</strong> ${escHtml(w.warmup)}</div>` : ''}
      ${w.cooldown ? `<div class="nw-prep-item">🏁 <strong>Cooldown:</strong> ${escHtml(w.cooldown)}</div>` : ''}
    </div>
    ${w.reasoning  ? `<details class="nw-reasoning"><summary>Why this workout?</summary><p>${escHtml(w.reasoning)}</p></details>` : ''}
    <div class="nw-actions">
      <button class="btn btn-primary btn-sm" onclick="loadWorkoutToLog()">Log this workout</button>
    </div>
  </div>`;
}

function renderChatUI() {
  const area = document.getElementById('coach-chat-area');
  const welcomeMsg = chatHistory.length > 0 && chatHistory[0].role === 'assistant' ? chatHistory[0].content : '';
  area.innerHTML = `
    <div class="chat-welcome">${escHtml(welcomeMsg).replace(/\n/g,'<br>')}</div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-typing-row" id="chat-typing"></div>
    <div class="chat-input-row" style="align-items:flex-end">
      <textarea id="chat-input" placeholder="Ask your coach anything… (Shift+Enter for new line)" rows="1"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat();}"
        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,140)+'px'"
        style="min-width:0;flex:1;resize:none;overflow-y:auto;line-height:1.45;padding:8px 10px;font-family:inherit;font-size:inherit;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text)"></textarea>
      <button class="btn btn-primary btn-sm" id="chat-send-btn" onclick="sendChat()" style="flex-shrink:0;margin-bottom:1px">Send</button>
    </div>`;
  renderChatMessages();
}
function renderChatMessages() {
  const el = document.getElementById('chat-messages'); if (!el) return;
  const msgs = chatHistory.slice(1);
  if (!msgs.length) { el.innerHTML = ''; return; }
  el.innerHTML = msgs.map(m => `
    <div class="chat-msg ${m.role}">
      <div class="chat-avatar">${m.role === 'ai' || m.role === 'assistant' ? '🏃' : 'You'}</div>
      <div class="chat-bubble">${renderMarkdown(escHtml(m.content))}</div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}
window.sendChat = async function() {
  const input = document.getElementById('chat-input'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  input.value = '';
  input.style.height = 'auto'; // reset auto-grow height after clearing
  const sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn) sendBtn.disabled = true;
  chatHistory.push({role:'user', content:text});
  renderChatMessages();
  const typingEl = document.getElementById('chat-typing');
  if (typingEl) typingEl.textContent = 'Coach is typing…';
  const apiMessages = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({role: m.role === 'ai' ? 'assistant' : m.role, content: m.content}));
  const reply = await callChatApi(apiMessages);
  if (typingEl) typingEl.textContent = '';
  if (sendBtn) sendBtn.disabled = false;
  chatHistory.push({role:'assistant', content: reply || "I'm having trouble connecting. Please try again."});
  // Save context to Firestore (all messages except the greeting at index 0)
  saveChatContext(chatHistory.slice(1));
  clearWorkoutCache();
  renderChatMessages();
  input.focus();
};
// Clears the visual chat only — Firestore context is preserved
window.clearChat = function() {
  const profile = getProfile();
  chatHistory = profile ? [{role:'assistant', content:buildCoachGreeting(profile)}] : [];
  coachInitialized = !!profile;
  renderChatUI();
};

// Wipes Firestore context + visual — true fresh start with the coach
window.resetContext = async function() {
  showModal('Reset coaching context?', 'This will permanently erase all saved coaching history. The coach will start fresh with no memory of past conversations.', [
    {label:'Reset', style:'danger', action: async () => {
      closeModal();
      await clearChatContext();
      clearWorkoutCache();
      coachInitialized = false;
      const profile = getProfile();
      chatHistory = profile ? [{role:'assistant', content:buildCoachGreeting(profile)}] : [];
      renderChatUI();
    }},
    {label:'Cancel', action: closeModal}
  ]);
};
window.refreshWorkout = async function() {
  clearWorkoutCache();
  const wArea = document.getElementById('coach-workout-area');
  if (wArea) wArea.innerHTML = `<div class="nw-card"><div class="nw-loading"><div class="spinner"></div><p>Generating new suggestion…</p></div></div>`;
  const w = await getOrFetchWorkout(true);
  if (wArea) wArea.innerHTML = w ? buildWorkoutCard(w) : `<div class="nw-card"><div class="nw-error">Couldn't generate suggestion. Try again.<br><br><button class="btn btn-sm btn-primary" onclick="refreshWorkout()">Retry</button></div></div>`;
  renderDashboardAiCard();
};
window.loadWorkoutToLog = function() {
  try {
    const cached = localStorage.getItem(WORKOUT_CACHE_KEY);
    if (cached) {
      const p = JSON.parse(cached); const w = p.workout;
      if (w) {
        const typeMap = {easy:'easy',tempo:'tempo',interval:'interval',long:'long',recovery:'optional'};
        document.getElementById('log-type').value = typeMap[w.type] || 'easy';
        document.getElementById('log-date').valueAsDate = new Date();
        document.getElementById('log-notes').value = w.title ? (w.title + (w.structure ? ' — ' + w.structure : '')) : '';
        showPage('log', null);
      }
    }
  } catch(e) { console.error(e); }
};

// ── SETTINGS ───────────────────────────────────────────────────────────────
window.openSettings = function() {
  const profile = getProfile() || {};
  document.getElementById('settings-body').innerHTML = `
    <div class="settings-row"><div><div class="settings-label">Goal</div><div class="settings-val">${escHtml(profile.goal || 'Not set')}</div></div></div>
    <div class="settings-row"><div><div class="settings-label">Fitness level</div><div class="settings-val">${escHtml(profile.fitnessLevel || 'Not set')}</div></div></div>
    <div class="settings-row"><div><div class="settings-label">Training days</div><div class="settings-val">${escHtml(profile.daysPerWeek || 'Not set')}</div></div></div>
    <div class="settings-row"><div><div class="settings-label">5K time</div><div class="settings-val">${escHtml(profile.current5K || 'Not set')}</div></div></div>
    <div class="settings-row" style="border:none"><button class="btn btn-sm" onclick="document.getElementById('settings-modal').style.display='none';startOnboarding()">Edit full profile →</button></div>`;
  document.getElementById('settings-modal').style.display = 'flex';
};
document.getElementById('settings-modal').addEventListener('click', e => { if (e.target === document.getElementById('settings-modal')) document.getElementById('settings-modal').style.display = 'none'; });

// ── ONBOARDING ─────────────────────────────────────────────────────────────
const OB_STEPS = [
  {id:'welcome',  type:'welcome'},
  {id:'goal',     type:'choice', key:'goal',        emoji:'🎯', question:"What's your main running goal?", options:['Break 20 min in 5K','Complete my first 5K','Improve general fitness','Lose weight','Run longer distances','Other']},
  {id:'fitness',  type:'choice', key:'fitnessLevel', emoji:'💪', question:"How would you describe your current fitness?", options:['Beginner — I rarely run','Intermediate — I run occasionally','Regular — a few times a week','Advanced — I train consistently']},
  {id:'days',     type:'choice', key:'daysPerWeek',  emoji:'📅', question:"How many days a week can you train?", options:['2 days','3 days','4 days','5+ days']},
  {id:'time5k',   type:'text',   key:'current5K',    emoji:'⏱',  question:"What's your current (or estimated) 5K time?", placeholder:"e.g. 28:00 — or 'Never run a 5K'"},
  {id:'injuries', type:'text',   key:'injuries',     emoji:'🩺',  question:"Any injuries or physical limitations?", placeholder:"e.g. knee pain, asthma… or leave blank", optional:true},
  {id:'notes',    type:'text',   key:'extraNotes',   emoji:'📝',  question:"Anything else your coach should know?", placeholder:"e.g. training for a race in June, prefer morning runs…", optional:true},
  {id:'done',     type:'done'}
];
let onbStep = 0, onbData = {};
function startOnboarding() {
  const existing = getProfile();
  onbData = existing ? {...existing} : {};
  onbStep = 0;
  document.getElementById('ob-overlay').style.display = 'flex';
  renderOnboardingStep();
}
window.startOnboarding = startOnboarding;
function renderOnboardingStep() {
  const step = OB_STEPS[onbStep];
  const contentSteps = OB_STEPS.filter(s => s.type !== 'welcome' && s.type !== 'done');
  const dotIdx = contentSteps.findIndex(s => s.id === step.id);
  let progressHtml = '';
  if (step.type !== 'welcome' && step.type !== 'done') {
    progressHtml = `<div class="ob-progress">${contentSteps.map((_, j) => `<div class="ob-dot ${j < dotIdx ? 'done' : j === dotIdx ? 'active' : ''}"></div>`).join('')}</div>`;
  }
  let content = '';
  if (step.type === 'welcome') {
    content = `<div class="ob-emoji">🏃</div><div class="ob-question">Welcome to RunTrack AI</div><div class="ob-sub">Let's set up your personal AI coach. Answer a few quick questions and it will adapt to your actual runs — no rigid schedules.</div><button class="btn btn-primary" style="width:100%" onclick="obNext()">Get started →</button>`;
  } else if (step.type === 'choice') {
    const opts = step.options.map(opt => `<button class="ob-choice${onbData[step.key] === opt ? ' selected' : ''}" data-key="${step.key}" data-val="${escHtml(opt)}" onclick="obChoice(this)">${escHtml(opt)}</button>`).join('');
    content = `${progressHtml}<div class="ob-emoji">${step.emoji}</div><div class="ob-question">${step.question}</div><div class="ob-choices">${opts}</div><div class="ob-nav"><button class="ob-back" onclick="obBack()">← Back</button><button class="btn btn-primary btn-sm" id="ob-next-btn" onclick="obNext()" ${!onbData[step.key] ? 'disabled' : ''}>Continue →</button></div>`;
  } else if (step.type === 'text') {
    content = `${progressHtml}<div class="ob-emoji">${step.emoji}</div><div class="ob-question">${step.question}</div>${step.optional ? '<div class="ob-optional-note">Optional — you can skip this</div>' : ''}<div class="ob-input-wrap"><input type="text" id="ob-text-input" placeholder="${escHtml(step.placeholder || '')}" value="${escHtml(onbData[step.key] || '')}" oninput="obTextInput(this)" onkeydown="if(event.key==='Enter')obNext()"></div><div class="ob-nav"><button class="ob-back" onclick="obBack()">← Back</button><button class="btn btn-primary btn-sm" onclick="obNext()">${step.optional ? 'Skip / Continue →' : 'Continue →'}</button></div>`;
  } else if (step.type === 'done') {
    content = `<div class="ob-emoji">✅</div><div class="ob-question">You're all set!</div><div class="ob-sub">Your AI coach is ready. It'll suggest your next workout based on your actual run history.<br><br><strong>Goal:</strong> ${escHtml(onbData.goal || '—')}<br><strong>Fitness:</strong> ${escHtml(onbData.fitnessLevel || '—')}<br><strong>Training:</strong> ${escHtml(onbData.daysPerWeek || '—')} per week<br><strong>5K time:</strong> ${escHtml(onbData.current5K || '—')}</div><button class="btn btn-primary" style="width:100%" onclick="finishOnboarding()">Start training →</button>`;
  }
  document.getElementById('ob-content').innerHTML = content;
}
window.obNext = function() {
  const step = OB_STEPS[onbStep];
  if (step.type === 'text') { const val = document.getElementById('ob-text-input')?.value.trim() || ''; if (val) onbData[step.key] = val; }
  if (onbStep < OB_STEPS.length - 1) { onbStep++; renderOnboardingStep(); }
};
window.obBack = function() { if (onbStep > 0) { onbStep--; renderOnboardingStep(); } };
window.obChoice = function(el) {
  const key = el.dataset.key, val = el.dataset.val;
  onbData[key] = val;
  el.closest('.ob-choices').querySelectorAll('.ob-choice').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  const nb = document.getElementById('ob-next-btn'); if (nb) nb.removeAttribute('disabled');
};
window.obTextInput = function(el) { const step = OB_STEPS[onbStep]; if (step && step.key) onbData[step.key] = el.value; };
window.finishOnboarding = function() {
  setProfile(onbData);
  clearWorkoutCache();
  coachInitialized = false;
  document.getElementById('ob-overlay').style.display = 'none';
  document.getElementById('profile-btn').style.display = '';
  renderDashboard();
};

// ── CALENDAR ───────────────────────────────────────────────────────────────
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

window.calPrev = function() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); };
window.calNext = function() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); };

function renderCalendar() {
  const container = document.getElementById('cal-container');
  if (!container) return;

  const runMap = {};
  runs.forEach(r => { runMap[r.date] = r; });

  const today = todayStr();
  const monthName = new Date(calYear, calMonth, 1).toLocaleDateString('en-GB', {month:'long', year:'numeric'});
  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;

  // Month summary
  const monthPrefix = calYear + '-' + String(calMonth+1).padStart(2,'0');
  const monthRuns = runs.filter(r => r.date.startsWith(monthPrefix) && r.type !== 'skipped');
  const monthKm   = monthRuns.reduce((s, r) => s + (r.dist || 0), 0);
  const monthSummary = monthRuns.length
    ? `<div class="cal-month-summary">${monthRuns.length} run${monthRuns.length !== 1 ? 's' : ''} · ${monthKm.toFixed(1)} km</div>`
    : `<div class="cal-month-summary" style="color:var(--text3)">No runs this month</div>`;

  const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  // Build week rows with km totals
  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell cal-empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const run = runMap[ds];
    const isToday = ds === today;
    const isRun = run && run.type !== 'skipped';
    const color = isRun ? (TYPE_COLORS[run.type] || '#888') : null;
    const circleStyle = isRun ? `background:${color};box-shadow:0 2px 8px ${color}55;` : '';
    const distLabel = isRun && run.dist ? `<div class="cal-dist" style="color:${color}">${run.dist.toFixed(1)}</div>` : '';

    cells += `<div class="cal-cell ${isToday ? 'cal-today' : ''} ${isRun ? 'cal-has-run' : ''}" onclick="calDayClick('${ds}')">
      <div class="cal-day-num" style="${circleStyle}">${d}</div>
      ${distLabel}
    </div>`;

    // After Sunday (or last day), add week km total
    const dayOfWeek = (new Date(ds + 'T00:00:00').getDay() + 6) % 7; // 0=Mon, 6=Sun
    const isLastDay = d === daysInMonth;
    if (dayOfWeek === 6 || isLastDay) {
      // Compute week total for this row
      const wMon = weekMonday(ds);
      const wSun = new Date(wMon + 'T00:00:00'); wSun.setDate(wSun.getDate() + 6);
      const wSunStr = wSun.getFullYear() + '-' + String(wSun.getMonth()+1).padStart(2,'0') + '-' + String(wSun.getDate()).padStart(2,'0');
      const wkKm = runs.filter(r => r.type !== 'skipped' && r.date >= wMon && r.date <= wSunStr && r.date.startsWith(monthPrefix))
                       .reduce((s, r) => s + (r.dist || 0), 0);
      cells += `<div class="cal-week-total">${wkKm > 0 ? wkKm.toFixed(1) + ' km' : ''}</div>`;
    }
  }

  container.innerHTML = `
    <div class="cal-header">
      <button class="btn btn-sm" onclick="calPrev()">‹</button>
      <div>
        <span class="cal-month-label">${monthName}</span>
        ${monthSummary}
      </div>
      <button class="btn btn-sm" onclick="calNext()" style="transform:rotate(180deg)">‹</button>
    </div>
    <div class="cal-grid-wrap">
      <div class="cal-grid">
        ${dayHeaders.map(h => `<div class="cal-day-hdr">${h}</div>`).join('')}
        <div class="cal-day-hdr cal-wk-hdr"></div>
        ${cells}
      </div>
    </div>
    <div class="cal-legend">
      ${Object.entries(TYPE_COLORS).filter(([t]) => t !== 'skipped' && t !== 'optional').map(([t, c]) =>
        `<span class="cal-legend-item"><span class="cal-legend-dot" style="background:${c}"></span>${t}</span>`
      ).join('')}
    </div>
    <div class="cal-detail" id="cal-detail"></div>`;
}

window.calDayClick = function(ds) {
  const detail = document.getElementById('cal-detail');
  if (!detail) return;
  const run = runs.find(r => r.date === ds && r.type !== 'skipped');
  const today = todayStr();
  const isPastOrToday = ds <= today;

  if (!run) {
    detail.innerHTML = `<div class="cal-detail-empty">
      ${fmtDate(ds)} — rest day
      ${isPastOrToday ? `<button class="btn btn-sm" style="margin-left:10px" onclick="goToLog('easy','${ds}')">+ Log run</button>` : ''}
    </div>`;
    return;
  }
  const bt = badgeType(run.type);
  detail.innerHTML = `
    <div class="cal-detail-card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div>
          <span class="run-badge badge-${bt}">${run.label || run.type}</span>
          <span style="font-size:13px;font-weight:600;margin-left:6px">${fmtDate(run.date)}</span>
        </div>
        <button class="btn btn-sm" onclick="goToLog('${run.type}','${ds}')">+ Log another</button>
      </div>
      <div style="margin-top:8px;font-size:13px;color:var(--text2)">
        ${run.dist ? run.dist.toFixed(1) + ' km' : ''}
        ${run.pace ? ' · ' + paceStr(run.pace) : ''}
        ${run.effort ? ' · effort ' + run.effort + '/10' : ''}
      </div>
      ${run.notes ? `<div style="margin-top:4px;font-size:12px;color:var(--text3)">${escHtml(run.notes)}</div>` : ''}
    </div>`;
};

// ── INIT ───────────────────────────────────────────────────────────────────
document.getElementById('log-date').valueAsDate = new Date();
initEffortDots();
async function init() {
  setSyncStatus('syncing');
  await loadRuns();
  // Pre-load saved chat context so workout card on dashboard has full context
  const profile = getProfile();
  if (profile) {
    const savedMessages = await loadChatContext();
    if (savedMessages.length) {
      chatHistory = [{role:'assistant', content:buildCoachGreeting(profile)}, ...savedMessages];
      coachInitialized = true;
    }
  }
  if (!profile) { startOnboarding(); }
  else { document.getElementById('profile-btn').style.display = ''; }
  renderDashboard();
}
init();
