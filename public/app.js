import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
  if (s === 'ok')  { el.textContent = 'Synced';    el.className = 'sync-status sync-ok';  }
  else if (s === 'err') { el.textContent = 'Offline';  el.className = 'sync-status sync-err'; }
  else             { el.textContent = 'Syncing…';  el.className = 'sync-status';           }
}

// ── PLAN DATA ──────────────────────────────────────────────────────────────
const WEEK_STARTS = [
  '2026-04-07','2026-04-14','2026-04-21','2026-04-28',
  '2026-05-05','2026-05-12','2026-05-19','2026-05-26',
  '2026-06-02','2026-06-09','2026-06-16','2026-06-23','2026-06-30'
];
const WEIGHTS     = {easy:1,tempo:2.2,interval:3.5,long:1.8,optional:1.2,custom:1.5,skipped:0};
const TYPE_COLORS = {easy:'#639922',tempo:'#BA7517',interval:'#E24B4A',long:'#378ADD',optional:'#7F77DD',custom:'#7F77DD',skipped:'#ccc'};
const EFFORT_DESC = ['','very easy','easy','comfortable','moderate-easy','moderate','moderate-hard','hard','very hard','near max','all out'];







// ── STATE ──────────────────────────────────────────────────────────────────
let runs = [];
let effortVal = 5;
let activeCharts = {};
let activeChartName = 'fitness';
let editMode = false;
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
  } catch(e) { console.error(e); setSyncStatus('err'); }
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
function getWeekNum(dateStr) {
  if (dateStr < WEEK_STARTS[0]) return 1;
  for (let i = WEEK_STARTS.length - 1; i >= 0; i--) { if (dateStr >= WEEK_STARTS[i]) return i + 1; }
  return 1;
}
function getCurrentWeek() {
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return getWeekNum(todayStr);
}
function filterByRange(list) {
  const r = document.getElementById('chart-range')?.value || 'all';
  if (r === 'all') return list;
  return list.filter(x => x.date.startsWith(r));
}
function populateChartRangeDropdown() {
  const sel = document.getElementById('chart-range');
  if (!sel) return;
  const currentVal = sel.value;
  const months = [...new Set(runs.map(r => r.date.slice(0, 7)))].sort();
  sel.innerHTML = '<option value="all">All time</option>';
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
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
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
  const validRuns = runs.filter(r => r.type !== 'skipped');
  const totalKm = validRuns.reduce((s, r) => s + (r.dist || 0), 0);
  const paces = validRuns.filter(r => r.pace).map(r => r.pace);
  const bestPace = paces.length ? Math.min(...paces) : null;

  // Days since last run
  const today = new Date();
  const lastRun = validRuns.length > 0 ? validRuns[validRuns.length - 1] : null;
  const daysSinceLast = lastRun
    ? Math.floor((today - new Date(lastRun.date + 'T00:00:00')) / (1000 * 60 * 60 * 24))
    : null;
  const daysSinceLabel = daysSinceLast === null ? '—' : daysSinceLast === 0 ? 'Today' : daysSinceLast === 1 ? '1 day ago' : daysSinceLast + ' days ago';

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric"><div class="mlabel">Total runs</div><div class="mval">${validRuns.length}</div></div>
    <div class="metric"><div class="mlabel">Total km</div><div class="mval">${totalKm.toFixed(1)}</div></div>
    <div class="metric"><div class="mlabel">Last run</div><div class="mval" style="font-size:${daysSinceLast === null ? '22' : daysSinceLabel.length > 6 ? '14' : '18'}px">${daysSinceLabel}</div></div>
    <div class="metric"><div class="mlabel">Best pace</div><div class="mval" style="font-size:17px">${bestPace ? paceStr(bestPace) : '—'}</div></div>`;
  renderDashboardAiCard();

  // Recent activity card
  const recentRuns = validRuns.slice(-4).reverse();
  let activityHtml = '';
  if (recentRuns.length === 0) {
    activityHtml = `<div style="color:var(--text3);font-size:13px">No runs yet. Head to Log run to get started!</div>`;
  } else {
    activityHtml = recentRuns.map(r => {
      const bt = badgeType(r.type);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)">
        <span class="run-badge badge-${bt}" style="flex-shrink:0">${r.label || r.type}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${r.date}</div>
          <div style="font-size:12px;color:var(--text3)">${r.dist ? r.dist.toFixed(1) + ' km' : ''}${r.pace ? ' · ' + paceStr(r.pace) : ''}${r.effort ? ' · effort ' + r.effort + '/10' : ''}</div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('this-week-card').innerHTML = `
    <div class="sec" style="margin-bottom:.75rem">Recent activity</div>
    ${activityHtml}`;

  const profile = getProfile();
  const targetPace = profile?.targetPace || 4.0;
  const startPace  = profile?.startPace  || 5.5;
  document.getElementById('goal-start-label').textContent = 'Start: ' + paceStr(startPace);
  document.getElementById('goal-end-label').textContent   = 'Target: ' + paceStr(targetPace);
  if (bestPace) {
    const pct = Math.min(100, Math.max(0, ((startPace - bestPace) / (startPace - targetPace)) * 100));
    document.getElementById('goal-bar').style.width = Math.round(pct) + '%';
    document.getElementById('best-pace-disp').textContent = paceStr(bestPace);
    document.getElementById('goal-note').textContent =
      pct >= 100 ? 'Target reached! Time to race!' :
      pct < 20   ? 'Early days — build consistency first.' :
      pct < 55   ? 'Solid progress. Keep stacking the sessions.' :
                   'Getting close! Stay sharp.';
  }
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
  const date  = document.getElementById('log-date').value;
  const type  = document.getElementById('log-type').value;
  const custom = document.getElementById('log-custom').value.trim();
  const dist  = parseFloat(document.getElementById('log-dist').value);
  const t     = document.getElementById('log-time').value.trim();
  const notes = document.getElementById('log-notes').value.trim();
  const msg   = document.getElementById('log-msg');
  if (!date) { msg.style.color = 'var(--red)'; msg.textContent = 'Please select a date.'; return; }
  if (!dist || dist <= 0) { msg.style.color = 'var(--red)'; msg.textContent = 'Please enter a valid distance.'; return; }
  const pace = parsePace(dist, t);
  const wk   = getWeekNum(date);
  const run  = {date, type, label: type === 'custom' ? (custom || 'Custom') : type, dist, time: t, pace, effort: effortVal, notes, week: wk, id: Date.now()};
  msg.style.color = 'var(--text3)'; msg.textContent = 'Saving…';
  const saved = await saveRun(run);
  if (saved) {
    runs.push(saved); runs.sort((a, b) => a.date.localeCompare(b.date));
    clearWorkoutCache(); coachInitialized = false;
    msg.style.color = 'var(--green)';
    msg.textContent = 'Saved! ' + dist.toFixed(1) + ' km' + (pace ? ' @ ' + paceStr(pace) : '') + ' — Week ' + wk;
    setTimeout(() => msg.textContent = '', 3500);
    clearLogForm();
  } else { msg.style.color = 'var(--red)'; msg.textContent = 'Error saving. Check connection.'; }
};
window.clearLogForm = function() {
  document.getElementById('log-date').valueAsDate = new Date();
  document.getElementById('log-dist').value = '';
  document.getElementById('log-time').value = '';
  document.getElementById('log-notes').value = '';
  document.getElementById('log-type').value = 'easy';
  document.getElementById('log-custom-row').style.display = 'none';
  effortVal = 5; initEffortDots();
};
window.goToLog = function(type, date) {
  document.getElementById('log-type').value = type;
  document.getElementById('log-date').value = date;
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.nav button')[2].classList.add('active');
  showPage('log', null);
};
window.promptSkip = function(type, date, cw) {
  const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate() + 1);
  const nextDow = next.getDay();
  const nextStr = next.toISOString().split('T')[0];
  const nextIsRest = !SESSION_DAYS[nextDow];
  const nextLabel = next.toLocaleDateString('en-GB', {weekday:'short', month:'short', day:'numeric'});
  if (nextIsRest) {
    showModal('Skip this session?', `Tomorrow (${nextLabel}) is a rest day — you could reschedule there. What would you like to do?`, [
      {label: 'Reschedule as same run',  action: () => reschedule(type, date, nextStr, cw, type)},
      {label: 'Reschedule as easy run',  action: () => reschedule(type, date, nextStr, cw, 'easy')},
      {label: 'Just mark skipped', style: 'danger', action: () => justSkip(type, date, cw)},
      {label: 'Cancel', action: closeModal}
    ]);
  } else {
    showModal('Skip this session?', 'Tomorrow already has a run scheduled, so this cannot be rescheduled.', [
      {label: 'Mark as skipped', style: 'danger', action: () => justSkip(type, date, cw)},
      {label: 'Cancel', action: closeModal}
    ]);
  }
};
async function justSkip(type, date, cw) {
  closeModal();
  const run = {date, type:'skipped', label:'Skipped', originalType: type, dist:0, time:'', pace:null, effort:0, notes:'', week:cw, id:Date.now()};
  const saved = await saveRun(run);
  if (saved) { runs.push(saved); runs.sort((a, b) => a.date.localeCompare(b.date)); }
  clearWorkoutCache(); coachInitialized = false;
  renderDashboard();
}
async function reschedule(originalType, originalDate, newDate, cw, newType) {
  closeModal();
  const wdata = WEEKS[cw - 1];
  const desc  = newType === 'easy' ? 'Easy run (rescheduled)' : wdata[originalType]?.vol + ' · ' + wdata[originalType]?.pace;
  const run   = {date: originalDate, type:'skipped', label:'Skipped', originalType, rescheduledTo: newDate, rescheduledDesc: desc, dist:0, time:'', pace:null, effort:0, notes:'', week:cw, id:Date.now()};
  const saved = await saveRun(run);
  if (saved) { runs.push(saved); runs.sort((a, b) => a.date.localeCompare(b.date)); }
  clearWorkoutCache(); coachInitialized = false;
  renderDashboard();
}

// ── HISTORY ────────────────────────────────────────────────────────────────
window.toggleEditMode = function() {
  editMode = !editMode;
  const btn = document.getElementById('edit-toggle-btn');
  btn.textContent = editMode ? 'Done editing' : 'Edit runs';
  btn.className = 'btn btn-sm' + (editMode ? ' btn-primary' : '');
  renderHistory();
};
function renderHistory() {
  const filter   = document.getElementById('hist-filter').value;
  const list     = document.getElementById('run-list');
  const empty    = document.getElementById('hist-empty');
  const filtered = (filter === 'all' ? runs : runs.filter(r => r.type === filter)).slice().reverse();
  if (!filtered.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(r => {
    const bt  = ['easy','tempo','interval','long'].includes(r.type) ? r.type : r.type === 'skipped' ? 'skipped' : 'custom';
    const eid = 'ef-' + r._id;
    return `<li class="run-item">
      <div class="run-item-main">
        <span class="run-badge badge-${bt}">${r.label || r.type}</span>
        <span style="font-size:11px;color:var(--text3);background:var(--bg2);padding:2px 6px;border-radius:99px">W${r.week || '?'}</span>
        <span style="color:var(--text2);min-width:82px">${r.date}</span>
        ${r.type !== 'skipped' ? `<span style="font-weight:600">${(r.dist || 0).toFixed(1)} km</span>` : ''}
        ${r.pace ? `<span style="color:var(--text2)">${paceStr(r.pace)}</span>` : ''}
        ${r.type !== 'skipped' && r.effort ? `<span style="color:var(--text3);font-size:12px">effort ${r.effort}/10</span>` : ''}
        ${r.rescheduledTo ? `<span style="font-size:11px;color:var(--purple)">→ rescheduled to ${r.rescheduledTo}</span>` : ''}
        ${r.notes ? `<span style="color:var(--text3);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.notes}</span>` : ''}
        ${editMode ? `<div style="margin-left:auto;display:flex;gap:6px">
          ${r.type !== 'skipped' ? `<button class="btn btn-sm" onclick="toggleEF('${eid}')">Edit</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="confirmDelete('${r._id}')">Delete</button>
        </div>` : ''}
      </div>
      ${r.type !== 'skipped' ? `<div id="${eid}" class="run-edit-form">
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
      </div>` : ''}
    </li>`;
  }).join('');
}
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
  ['fitness','pace','distance','effort'].forEach(n => document.getElementById('chart-' + n).style.display = n === name ? 'block' : 'none');
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
  const data = filterByRange(runs); // all runs including skipped
  if (name === 'fitness')  renderFitness(data);
  else if (name === 'pace') renderPaceChart(data);
  else if (name === 'distance') renderDist(data);
  else if (name === 'effort') renderEffort(data);
}
function renderFitness(data) {
  destroyChart('fitness');
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  let score = 0;
  const labels = [], vals = [], ptColors = [], ptRadii = [], ptBorder = [];
  sorted.forEach(r => {
    if (r.type !== 'skipped') {
      const w = WEIGHTS[r.type] || 1.5, pb = r.pace ? Math.max(0, (5.5 - r.pace) * 8) : 0;
      score += (r.dist * w) + pb;
    }
    labels.push(fmtDate(r.date));
    vals.push(Math.round(score * 10) / 10);
    const skipped = r.type === 'skipped';
    ptColors.push(skipped ? 'rgba(180,180,180,0.4)' : '#378ADD');
    ptBorder.push(skipped ? 'rgba(180,180,180,0.6)' : '#378ADD');
    ptRadii.push(skipped ? 4 : 5);
  });
  activeCharts['fitness'] = new Chart(document.getElementById('c-fitness').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [{ label:'Fitness', data:vals, borderColor:'#378ADD', backgroundColor:'rgba(55,138,221,0.07)', fill:true, tension:0.4, pointRadius:ptRadii, pointBackgroundColor:ptColors, pointBorderColor:ptBorder }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label:(ctx) => { const r = sorted[ctx.dataIndex]; return r.type === 'skipped' ? 'Skipped — score: ' + ctx.parsed.y : 'Score: ' + ctx.parsed.y; } } } },
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

  // Build one data point per day in the range, 0 for rest/skipped days
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

    // x-axis: show label only on 1st of month or first data point
    const isFirst = d.getTime() === startDate.getTime();
    const isMonthStart = d.getDate() === 1;
    labels.push((isFirst || isMonthStart) ? d.toLocaleDateString('en-GB', {month:'short', year:'2-digit'}) : '');

    vals.push(dist);
    runRefs.push(run || null);

    if (!isRun) {
      ptColors.push('transparent');
      ptBorder.push('transparent');
      ptRadii.push(0);
    } else if (isMostRecent) {
      ptColors.push('#C8691A');
      ptBorder.push('#C8691A');
      ptRadii.push(5);
    } else {
      ptColors.push('transparent');
      ptBorder.push('#C8691A');
      ptRadii.push(4);
    }
  }

  // Dynamic y-axis: fit actual data with a little headroom
  const maxDist = Math.max(...vals, 1);
  const yMax = Math.ceil(maxDist / 2) * 2 + 2;
  const yStep = yMax <= 10 ? 2 : yMax <= 20 ? 5 : 10;

  activeCharts['dist'] = new Chart(document.getElementById('c-dist').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Distance',
        data: vals,
        borderColor: '#C8691A',
        backgroundColor: 'rgba(200,105,26,0.18)',
        fill: true,
        tension: 0,
        pointRadius: ptRadii,
        pointBackgroundColor: ptColors,
        pointBorderColor: ptBorder,
        pointBorderWidth: 2,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => runRefs[item.dataIndex] !== null,
          callbacks: {
            title: (items) => {
              const r = runRefs[items[0].dataIndex];
              return r ? r.date : '';
            },
            label: (ctx) => {
              const r = runRefs[ctx.dataIndex];
              if (!r) return null;
              let s = r.type.charAt(0).toUpperCase() + r.type.slice(1) + ': ' + (r.dist || 0).toFixed(1) + ' km';
              if (r.pace) s += ' · ' + paceStr(r.pace);
              return s;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yMax,
          grid: { color: 'rgba(128,128,128,0.1)' },
          ticks: { color: '#888', stepSize: yStep, callback: v => v + ' km' }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#888',
            maxRotation: 0,
            autoSkip: false,
            callback: function(val, idx) { return labels[idx] || ''; }
          }
        }
      }
    }
  });
}
function renderEffort(data) {
  destroyChart('effort');
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  activeCharts['effort'] = new Chart(document.getElementById('c-effort').getContext('2d'), {
    type: 'bar',
    data: { labels: sorted.map(r => fmtDate(r.date)), datasets: [{ label:'Effort', data: sorted.map(r => r.type === 'skipped' ? 0 : (r.effort || 0)), backgroundColor: sorted.map(r => r.type === 'skipped' ? 'rgba(180,180,180,0.35)' : (TYPE_COLORS[r.type] || '#888')), borderRadius: 4 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins: { legend:{display:false}, tooltip:{ callbacks:{ label:(ctx) => { const r = sorted[ctx.dataIndex]; return r.type === 'skipped' ? 'Skipped' : 'Effort: ' + ctx.parsed.y + '/10 (' + r.type + ')'; } } } },
      scales: { y:{ min:0, max:10, grid:{color:'rgba(128,128,128,0.1)'}, ticks:{color:'#888', stepSize:2} }, x:{ grid:{display:false}, ticks:{color:'#888', maxRotation:35, autoSkip:true, maxTicksLimit:8} } }
    }
  });
}

// ── AI: SYSTEM PROMPT ──────────────────────────────────────────────────────
function buildSystemPrompt() {
  const profile     = getProfile() || {};
  const validRuns   = runs.filter(r => r.type !== 'skipped');
  const skippedRuns = runs.filter(r => r.type === 'skipped');
  const skipRate    = runs.length > 0 ? Math.round((skippedRuns.length / runs.length) * 100) : 0;
  const recentSkips = runs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).filter(r => r.type === 'skipped').length;
  const paces       = validRuns.filter(r => r.pace).map(r => r.pace);
  const bestPace    = paces.length ? Math.min(...paces) : null;
  const avgPace     = paces.length ? (paces.reduce((a, b) => a + b, 0) / paces.length) : null;
  const recent      = runs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  const histText    = recent.map(r => {
    if (r.type === 'skipped') return `${r.date}: SKIPPED (was ${r.originalType || 'session'})`;
    return `${r.date}: ${r.type}, ${(r.dist || 0).toFixed(1)}km${r.pace ? ', pace ' + paceStr(r.pace) : ''}${r.effort ? ', effort ' + r.effort + '/10' : ''}${r.notes ? ', notes: "' + r.notes + '"' : ''}`;
  }).join('\n');

  // Gap analysis
  const today = new Date();
  const sortedValid = validRuns.slice().sort((a, b) => b.date.localeCompare(a.date));
  const lastRun = sortedValid.length > 0 ? sortedValid[0] : null;
  const daysSinceLast = lastRun
    ? Math.floor((today - new Date(lastRun.date + 'T00:00:00')) / (1000 * 60 * 60 * 24))
    : null;
  const gapNote = daysSinceLast === null ? 'No runs logged yet.'
    : daysSinceLast === 0 ? 'Runner trained today.'
    : daysSinceLast === 1 ? 'Last run was yesterday.'
    : `Last run was ${daysSinceLast} days ago.`;

  // Weekly volume for last 3 weeks
  const weekKm = [0, 1, 2].map(i => {
    const end   = new Date(today); end.setDate(end.getDate() - i * 7);
    const start = new Date(end);   start.setDate(start.getDate() - 7);
    const es = end.toISOString().split('T')[0], ss = start.toISOString().split('T')[0];
    return validRuns.filter(r => r.date >= ss && r.date < es).reduce((s, r) => s + (r.dist || 0), 0);
  });
  const avgWeeklyKm = weekKm.reduce((s, v) => s + v, 0) / 3;

  return `You are RunCoach, an expert AI running coach built into the RunTrack app. You give personalised, data-driven training advice based on the runner's actual logged history — there is no fixed plan.

USER PROFILE:
- Primary goal: ${profile.goal || 'Not set'} ← this is the north star for every suggestion
- Fitness level: ${profile.fitnessLevel || 'Unknown'}
- Available training days/week: ${profile.daysPerWeek || '3'}
- Current estimated 5K time: ${profile.current5K || 'Not provided'}
- Injuries/limitations: ${profile.injuries || 'None mentioned'}
- Additional notes: ${profile.extraNotes || 'None'}

RUNNING STATS:
- Total completed runs: ${validRuns.length}
- Total km logged: ${validRuns.reduce((s, r) => s + (r.dist || 0), 0).toFixed(1)} km
- Skip rate (all time): ${skipRate}%
- Skips in last 10 sessions: ${recentSkips}
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
3. Use gap analysis: if >5 days since last run, ease them back in; if >10 days, treat as returning from a break and start conservatively
4. If skip rate in last 10 sessions > 40%, prioritise consistency over intensity — suggest shorter, easier sessions
5. Never increase weekly volume more than 10% above the 3-week average
6. Be warm, direct, and specific — avoid vague advice
7. Keep responses concise — plain paragraphs, no excessive bullet lists
8. If no runs are logged, ask about recent activity before suggesting a workout
9. Adapt tone to the runner's level — don't overcomplicate things for beginners`;
}

// ── AI: FETCH WORKOUT SUGGESTION (via server) ──────────────────────────────
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

  // Include recent chat history so the workout reflects any coaching conversation
  const recentChat = chatHistory.slice(1).slice(-10); // skip greeting, last 10 messages
  const chatContext = recentChat.length > 0
    ? '\n\nRECENT COACHING CONVERSATION (use this to personalise the workout — e.g. injuries mentioned, preferred session type, time constraints):\n' +
      recentChat.map(m => `${m.role === 'user' ? 'Runner' : 'Coach'}: ${m.content}`).join('\n')
    : '';

  const userMessage  = `Based on this runner's complete history and profile${chatContext ? ', and our recent coaching conversation' : ''}, suggest their next workout.${chatContext}

Respond ONLY with a valid JSON object. No markdown, no extra text, no code fences. Exactly this format:
{
  "type": "easy|tempo|interval|long|recovery",
  "title": "Short descriptive title",
  "distance": "X km",
  "pace": "X:XX–X:XX/km",
  "duration": "~XX min",
  "structure": "Specific structure e.g. '5×400m with 90s recovery' or 'Continuous run'",
  "description": "2-3 sentences on exactly what to do and how it should feel.",
  "warmup": "Warmup instruction (1 sentence)",
  "cooldown": "Cooldown instruction (1 sentence)",
  "reasoning": "1-2 sentences explaining why THIS workout is right for them NOW, referencing their actual history."
}`;
  try {
    const resp = await fetch('/api/workout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({systemPrompt, userMessage})
    });
    if (!resp.ok) { console.error('Workout API error:', resp.status); return null; }
    const data = await resp.json();
    return data.workout || null;
  } catch(e) { console.error('Workout fetch failed:', e); return null; }
}

// ── AI: CHAT (via server) ──────────────────────────────────────────────────
async function callChatApi(messages) {
  const systemPrompt   = buildSystemPrompt();
  const fullMessages   = [{role: 'system', content: systemPrompt}, ...messages];
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages: fullMessages})
    });
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
    wArea.innerHTML = `<div class="nw-card"><div class="nw-error">Couldn't generate a suggestion. Please check your connection and try again.<br><br><button class="btn btn-sm btn-primary" onclick="refreshWorkout()">Retry</button></div></div>`;
  } else {
    wArea.innerHTML = buildWorkoutCard(w);
  }

  if (!coachInitialized) {
    chatHistory = [];
    const greet = buildCoachGreeting(profile);
    chatHistory.push({role: 'assistant', content: greet});
    coachInitialized = true;
  }
  renderChatUI();
}

function buildCoachGreeting(profile) {
  const validRuns = runs.filter(r => r.type !== 'skipped');
  const skips     = runs.filter(r => r.type === 'skipped');
  const goalText  = profile.goal ? 'help you ' + profile.goal.toLowerCase() : 'support your training';
  if (validRuns.length === 0) {
    return `Hi! I'm your AI running coach. I'm here to ${goalText}.\n\nYou haven't logged any runs yet — once you start, I'll use your actual history to suggest workouts and adapt your plan. For now, feel free to ask me anything about pacing, training structure, or getting started.`;
  }
  const skipRate    = runs.length > 0 ? Math.round((skips.length / runs.length) * 100) : 0;
  const consistency = skipRate < 20 ? 'great consistency' : 'some skipped sessions';
  return `Hi! I'm your AI running coach. I can see you've logged ${validRuns.length} run${validRuns.length !== 1 ? 's' : ''} with ${consistency}.\n\nI'll use your history to suggest the right next workout and adapt as you train. Ask me anything — about today's session, pacing, recovery, or how to reach your goal of "${profile.goal || 'getting fitter'}".`;
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
    <div class="chat-welcome">${escHtml(welcomeMsg).replace(/\n/g, '<br>')}</div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-typing-row" id="chat-typing"></div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Ask your coach anything…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat();}">
      <button class="btn btn-primary btn-sm" id="chat-send-btn" onclick="sendChat()">Send</button>
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
  const sendBtn = document.getElementById('chat-send-btn');
  if (sendBtn) sendBtn.disabled = true;
  chatHistory.push({role: 'user', content: text});
  renderChatMessages();
  const typingEl = document.getElementById('chat-typing');
  if (typingEl) typingEl.textContent = 'Coach is typing…';
  const apiMessages = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({role: m.role === 'ai' ? 'assistant' : m.role, content: m.content}));
  const reply = await callChatApi(apiMessages);
  if (typingEl) typingEl.textContent = '';
  if (sendBtn) sendBtn.disabled = false;
  const aiText = reply || "I'm having trouble connecting right now. Please try again in a moment.";
  chatHistory.push({role: 'assistant', content: aiText});
  clearWorkoutCache(); // workout will now reflect this conversation on next refresh
  renderChatMessages();
  input.focus();
};
window.clearChat = function() {
  const profile = getProfile();
  chatHistory = profile ? [{role: 'assistant', content: buildCoachGreeting(profile)}] : [];
  coachInitialized = !!profile;
  renderChatUI();
};
window.refreshWorkout = async function() {
  clearWorkoutCache();
  const wArea = document.getElementById('coach-workout-area');
  if (wArea) wArea.innerHTML = `<div class="nw-card"><div class="nw-loading"><div class="spinner"></div><p>Generating new suggestion…</p></div></div>`;
  const w = await getOrFetchWorkout(true);
  if (!w) {
    wArea.innerHTML = `<div class="nw-card"><div class="nw-error">Couldn't generate suggestion. Please try again.<br><br><button class="btn btn-sm btn-primary" onclick="refreshWorkout()">Retry</button></div></div>`;
  } else {
    wArea.innerHTML = buildWorkoutCard(w);
  }
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
        document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.nav button')[2].classList.add('active');
        showPage('log', null);
        document.querySelectorAll('.nav button')[2].classList.add('active');
      }
    }
  } catch(e) { console.error(e); }
};

// ── SETTINGS ───────────────────────────────────────────────────────────────
window.openSettings = function() {
  const profile = getProfile() || {};
  document.getElementById('settings-body').innerHTML = `
    <div class="settings-row">
      <div><div class="settings-label">Goal</div><div class="settings-val">${escHtml(profile.goal || 'Not set')}</div></div>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">Fitness level</div><div class="settings-val">${escHtml(profile.fitnessLevel || 'Not set')}</div></div>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">Training days</div><div class="settings-val">${escHtml(profile.daysPerWeek || 'Not set')}</div></div>
    </div>
    <div class="settings-row">
      <div><div class="settings-label">5K time</div><div class="settings-val">${escHtml(profile.current5K || 'Not set')}</div></div>
    </div>
    <div class="settings-row" style="border:none">
      <button class="btn btn-sm" onclick="document.getElementById('settings-modal').style.display='none';startOnboarding()">Edit full profile →</button>
    </div>`;
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

let onbStep = 0;
let onbData  = {};

function startOnboarding() {
  const existing = getProfile();
  onbData  = existing ? {...existing} : {};
  onbStep  = 0;
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
    content = `
      <div class="ob-emoji">🏃</div>
      <div class="ob-question">Welcome to RunTrack AI</div>
      <div class="ob-sub">Let's set up your personal AI coach. Answer a few quick questions and it will build your training plan around your actual runs — no rigid schedules.</div>
      <button class="btn btn-primary" style="width:100%" onclick="obNext()">Get started →</button>`;
  } else if (step.type === 'choice') {
    const opts = step.options.map(opt => {
      const sel = onbData[step.key] === opt ? ' selected' : '';
      return `<button class="ob-choice${sel}" data-key="${step.key}" data-val="${escHtml(opt)}" onclick="obChoice(this)">${escHtml(opt)}</button>`;
    }).join('');
    content = `
      ${progressHtml}
      <div class="ob-emoji">${step.emoji}</div>
      <div class="ob-question">${step.question}</div>
      <div class="ob-choices">${opts}</div>
      <div class="ob-nav">
        <button class="ob-back" onclick="obBack()">← Back</button>
        <button class="btn btn-primary btn-sm" id="ob-next-btn" onclick="obNext()" ${!onbData[step.key] ? 'disabled' : ''}>Continue →</button>
      </div>`;
  } else if (step.type === 'text') {
    content = `
      ${progressHtml}
      <div class="ob-emoji">${step.emoji}</div>
      <div class="ob-question">${step.question}</div>
      ${step.optional ? '<div class="ob-optional-note">Optional — you can skip this</div>' : ''}
      <div class="ob-input-wrap">
        <input type="text" id="ob-text-input" placeholder="${escHtml(step.placeholder || '')}" value="${escHtml(onbData[step.key] || '')}" oninput="obTextInput(this)" onkeydown="if(event.key==='Enter')obNext()">
      </div>
      <div class="ob-nav">
        <button class="ob-back" onclick="obBack()">← Back</button>
        <button class="btn btn-primary btn-sm" onclick="obNext()">${step.optional ? 'Skip / Continue →' : 'Continue →'}</button>
      </div>`;
  } else if (step.type === 'done') {
    content = `
      <div class="ob-emoji">✅</div>
      <div class="ob-question">You're all set!</div>
      <div class="ob-sub">Your AI coach is ready. It'll suggest your next workout based on your actual run history and get smarter as you train more.<br><br>
        <strong>Goal:</strong> ${escHtml(onbData.goal || '—')}<br>
        <strong>Fitness:</strong> ${escHtml(onbData.fitnessLevel || '—')}<br>
        <strong>Training:</strong> ${escHtml(onbData.daysPerWeek || '—')} per week<br>
        <strong>5K time:</strong> ${escHtml(onbData.current5K || '—')}
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="finishOnboarding()">Start training →</button>`;
  }
  document.getElementById('ob-content').innerHTML = content;
}

window.obNext = function() {
  const step = OB_STEPS[onbStep];
  if (step.type === 'text') {
    const val = document.getElementById('ob-text-input')?.value.trim() || '';
    if (val) onbData[step.key] = val;
  }
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
let calMonth = new Date().getMonth(); // 0-indexed

window.showCalendar = function() {
  calYear  = new Date().getFullYear();
  calMonth = new Date().getMonth();
  renderCalendar();
};

window.calPrev = function() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
};

window.calNext = function() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
};

function renderCalendar() {
  const container = document.getElementById('cal-container');
  if (!container) return;

  const runMap = {};
  runs.forEach(r => { runMap[r.date] = r; });

  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

  const monthName = new Date(calYear, calMonth, 1).toLocaleDateString('en-GB', {month:'long', year:'numeric'});
  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Monday-first

  const dayHeaders = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell cal-empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = calYear + '-' + String(calMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const run = runMap[ds];
    const isToday = ds === todayStr;
    const isRun = run && run.type !== 'skipped';
    const color = isRun ? (TYPE_COLORS[run.type] || '#888') : null;

    const circleStyle = isRun
      ? `background:${color};box-shadow:0 2px 8px ${color}55;`
      : '';

    const distLabel = isRun && run.dist
      ? `<div class="cal-dist" style="color:${color}">${run.dist.toFixed(1)} km</div>`
      : '';

    cells += `
      <div class="cal-cell ${isToday ? 'cal-today' : ''} ${isRun ? 'cal-has-run' : ''}" onclick="calDayClick('${ds}')">
        <div class="cal-day-num" style="${circleStyle}">${d}</div>
        ${distLabel}
      </div>`;
  }

  container.innerHTML = `
    <div class="cal-header">
      <button class="btn btn-sm" onclick="calPrev()">‹</button>
      <span class="cal-month-label">${monthName}</span>
      <button class="btn btn-sm" onclick="calNext()" style="transform:rotate(180deg)">‹</button>
    </div>
    <div class="cal-grid">
      ${dayHeaders.map(h => `<div class="cal-day-hdr">${h}</div>`).join('')}
      ${cells}
    </div>
    <div class="cal-legend">
      ${Object.entries(TYPE_COLORS).filter(([t]) => t !== 'skipped').map(([t, c]) =>
        `<span class="cal-legend-item"><span class="cal-legend-dot" style="background:${c}"></span>${t}</span>`
      ).join('')}
    </div>
    <div class="cal-detail" id="cal-detail"></div>`;
}

window.calDayClick = function(ds) {
  const detail = document.getElementById('cal-detail');
  if (!detail) return;
  const run = runs.find(r => r.date === ds);
  if (!run) { detail.innerHTML = `<div class="cal-detail-empty">${ds} — rest day</div>`; return; }
  const bt = badgeType(run.type);
  detail.innerHTML = `
    <div class="cal-detail-card">
      <span class="run-badge badge-${bt}">${run.label || run.type}</span>
      <span style="font-size:13px;font-weight:600;margin-left:6px">${run.date}</span>
      ${run.type !== 'skipped'
        ? `<div style="margin-top:8px;font-size:13px;color:var(--text2)">
            ${run.dist ? run.dist.toFixed(1) + ' km' : ''}
            ${run.pace ? ' · ' + paceStr(run.pace) : ''}
            ${run.effort ? ' · effort ' + run.effort + '/10' : ''}
           </div>
           ${run.notes ? `<div style="margin-top:4px;font-size:12px;color:var(--text3)">${escHtml(run.notes)}</div>` : ''}`
        : `<div style="margin-top:8px;font-size:13px;color:var(--text3)">Session skipped${run.originalType ? ' (was ' + run.originalType + ')' : ''}</div>`
      }
    </div>`;
};

// ── INIT ───────────────────────────────────────────────────────────────────
document.getElementById('log-date').valueAsDate = new Date();
initEffortDots();
async function init() {
  await loadRuns();
  const profile = getProfile();
  if (!profile) { startOnboarding(); }
  else { document.getElementById('profile-btn').style.display = ''; }
  renderDashboard();
}
init();
