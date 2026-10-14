/* Техника за обекта — Android CRM за Екосол България (офлайн, IndexedDB) */
'use strict';

/* ---------- помощни ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoDate(new Date());
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const DAYS = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'];
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}.${m}.${y}`; };
const fmtDT = ts => { const d = new Date(ts); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const money = (n, cur = 'EUR') => (isFinite(+n) ? (+n).toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00') + ' ' + (cur === 'EUR' ? '€' : cur);
const norm = s => String(s || '').toLowerCase().replace(/["„“”'`]/g, '').replace(/\b(еоод|оод|ead|еад|ад|ет|eood|ood|ad|et|ltd)\b/g, '').replace(/[^a-zа-я0-9]/gi, '');
const initials = s => String(s || '?').replace(/["„“”]/g, '').trim().split(/\s+/).filter(w => !/^(ЕООД|ООД|ЕАД|АД|ЕТ)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const hashInt = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2000000000 + 1; };
const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const P = name => window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null;

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}
function beep(times = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.45; g.gain.setValueAtTime(0.18, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
      o.start(t0); o.stop(t0 + 0.36);
    }
  } catch (e) { /* без звук */ }
}

/* ---------- база данни (IndexedDB) ---------- */
const STORES = ['clients', 'activities', 'brands', 'models', 'offers', 'events', 'settings'];
const S = Object.fromEntries(STORES.map(s => [s, []]));
let idb;
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('tehnika-za-obekta', 1);
    r.onupgradeneeded = () => { const db = r.result; STORES.forEach(s => db.objectStoreNames.contains(s) || db.createObjectStore(s, { keyPath: 'id' })); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = (store, mode, fn) => new Promise((res, rej) => { const t = idb.transaction(store, mode); const st = t.objectStore(store); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
async function loadAll() { for (const s of STORES) S[s] = (await tx(s, 'readonly', st => st.getAll())) || []; }
async function put(store, obj) {
  obj.updatedAt = Date.now(); if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  await tx(store, 'readwrite', st => st.put(obj));
  const i = S[store].findIndex(x => x.id === obj.id); if (i >= 0) S[store][i] = obj; else S[store].push(obj);
  return obj;
}
async function putMany(store, arr) {
  await tx(store, 'readwrite', st => arr.forEach(o => st.put(o)));
  const map = new Map(S[store].map(x => [x.id, x])); arr.forEach(o => map.set(o.id, o)); S[store] = [...map.values()];
}
async function del(store, id) { await tx(store, 'readwrite', st => st.delete(id)); S[store] = S[store].filter(x => x.id !== id); }
const get = (store, id) => S[store].find(x => x.id === id);
const DEFAULT_PROFILE = { firstName: 'Николай', name: 'Николай Герчев', title: 'Търговски мениджър Северна България', company: 'Екосол България АД', phone: '', email: '' };
const profile = () => Object.assign({}, DEFAULT_PROFILE, setting('profile', {}));
const setting = (k, d = null) => { const r = get('settings', k); return r ? r.value : d; };
const setSetting = (k, v) => put('settings', { id: k, value: v });

/* ---------- справочници ---------- */
const BRANDS = ['HIDROMEK', 'Ammann', 'FAE', 'IMEKS', 'Hycon', 'ATMOS', 'TRACTO-TECHNIK', 'Rioned', 'Bagela', 'KOMPLET', 'Fastverdini', 'Negri', 'GÖLZ', 'Werther',
  'U.EMME', 'Rehlko / SDMO / Kohler', 'GEHL', 'Komatsu', 'Manitou', 'Bosch Professional', 'Georg Fischer', 'Aliaxis / FRIAMAT', 'CMC'];
const CATEGORIES = ['Багер-товарачи', 'Верижни багери', 'Колесни багери', 'Мини багери', 'Челни товарачи', 'Мини челни товарачи', 'Валяци', 'Асфалтополагачи',
  'Виброплочи и трамбовки', 'Хидравлични чукове', 'Мулчери', 'Трошачки и пресевни', 'Генератори', 'Компресори', 'Безизкопни технологии', 'Каналопочистване',
  'Телескопични товарачи', 'Метачки и навесно оборудване', 'Заваряване на тръби', 'Отоплители', 'Електроинструменти', 'Друго'];
const ACT_TYPES = ['Разговор', 'Посещение', 'Запитване', 'Сделка', 'Имейл', 'Друго'];
const DEAL_STAGES = ['Нова', 'Оферирана', 'Преговори', 'Спечелена', 'Загубена'];
const OFFER_STATUS = ['Чернова', 'Изпратена', 'Спечелена', 'Загубена'];
const EV_KINDS = ['Задача', 'Среща', 'Активност'];
const ABC = { A: 'A — гореща', B: 'B — топла', C: 'C — студена', D: 'D — изключена' };

const clientName = id => (get('clients', id) || {}).name || '';
const modelTitle = m => m ? `${(get('brands', m.brandId) || {}).name || ''} ${m.name}`.trim() : '';

/* ---------- долен лист (форми) ---------- */
function openSheet(html, onMount) {
  $('#sheetPanel').innerHTML = html; $('#sheet').hidden = false; document.body.style.overflow = 'hidden';
  onMount && onMount($('#sheetPanel'));
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetPanel').innerHTML = ''; document.body.style.overflow = ''; }
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
const formData = root => { const o = {}; $$('[name]', root).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); }); return o; };
const field = (label, name, val = '', type = 'text', extra = '') =>
  `<label class="f"><span>${label}</span><input class="i" name="${name}" type="${type}" value="${esc(val)}" ${extra}></label>`;
const area = (label, name, val = '') => `<label class="f"><span>${label}</span><textarea class="i" name="${name}">${esc(val)}</textarea></label>`;
const select = (label, name, opts, val = '', extra = '') =>
  `<label class="f"><span>${label}</span><select class="i" name="${name}" ${extra}>${opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
const clientOpts = (withEmpty = true) => [...(withEmpty ? [['', '— без клиент —']] : []), ...S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'bg')).map(c => [c.id, c.name])];
const formBtns = (delId) => `<div class="btns"><button class="btn" type="submit">Запази</button><button class="btn text" type="button" data-close>Отказ</button>${delId ? `<span class="grow"></span><button class="btn text" type="button" data-del style="color:var(--danger)">Изтрий</button>` : ''}</div>`;
function wireForm(root, onSave, onDelete) {
  const f = $('form', root);
  f.addEventListener('submit', async e => { e.preventDefault(); try { await onSave(formData(f)); } catch (err) { toast(err.message || String(err)); } });
  $('[data-close]', root).onclick = closeSheet;
  const d = $('[data-del]', root); if (d && onDelete) d.onclick = async () => { if (confirm('Сигурни ли сте, че искате да изтриете записа?')) { await onDelete(); closeSheet(); } };
}

/* ---------- файлове ---------- */
const blobToB64 = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });
async function saveFile(name, blob) {
  if (native() && P('Filesystem') && P('Share')) {
    const data = await blobToB64(blob);
    const w = await P('Filesystem').writeFile({ path: name, data, directory: 'CACHE' });
    await P('Share').share({ title: name, files: [w.uri] });
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function pickFile(accept, multiple = false) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple; i.style.display = 'none';
    i.onchange = () => { res([...i.files]); i.remove(); }; document.body.appendChild(i); i.click();
  });
}
function imageToDataURL(file, max = 1400) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = rej; img.src = url;
  });
}

/* ---------- известия ---------- */
async function initNotifications() {
  const LN = P('LocalNotifications'); if (!native() || !LN) return;
  try {
    await LN.createChannel({ id: 'reminders', name: 'Напомняния', description: 'Задачи и срещи', importance: 5, visibility: 1, vibration: true, lights: true });
    LN.addListener('localNotificationActionPerformed', a => { const id = a.notification && a.notification.extra && a.notification.extra.eventId; if (id) location.hash = '#/calendar?d=' + ((get('events', id) || {}).date || todayISO()); });
  } catch (e) { console.warn(e); }
}
async function ensureNotifyPermission() {
  const LN = P('LocalNotifications');
  if (native() && LN) {
    let p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions();
    return p.display === 'granted';
  }
  if ('Notification' in window) { if (Notification.permission === 'default') await Notification.requestPermission(); return Notification.permission === 'granted'; }
  return false;
}
function reminderTime(ev) {
  if (!ev.date || ev.remind === 'none') return null;
  const base = ev.allDay || !ev.time ? new Date(ev.date + 'T08:00') : new Date(ev.date + 'T' + ev.time);
  const t = new Date(base.getTime() - (ev.allDay ? 0 : (+ev.remind || 0) * 60000));
  return t > new Date() ? t : null;
}
async function scheduleReminder(ev) {
  const LN = P('LocalNotifications'); const id = hashInt(ev.id);
  if (native() && LN) {
    try { await LN.cancel({ notifications: [{ id }] }); } catch (e) { }
    const at = ev.done ? null : reminderTime(ev);
    if (!at) return;
    if (!(await ensureNotifyPermission())) { toast('Известията са забранени — напомнянето няма да звъни. Разрешете ги от Настройки на телефона.', 5000); return; }
    const cl = clientName(ev.clientId);
    await LN.schedule({ notifications: [{ id, title: (ev.priority === 'висока' ? '❗ ' : '') + ev.kind + ': ' + ev.title, body: [ev.allDay ? 'Целодневно' : ev.time, cl].filter(Boolean).join(' · '), schedule: { at, allowWhileIdle: true }, channelId: 'reminders', extra: { eventId: ev.id } }] });
  }
}
async function cancelReminder(ev) { const LN = P('LocalNotifications'); if (native() && LN) { try { await LN.cancel({ notifications: [{ id: hashInt(ev.id) }] }); } catch (e) { } } }
/* докато приложението е отворено: звук и маркиране при настъпил час */
const alerted = new Set();
function dueEvent(ev) { if (ev.done || ev.date !== todayISO() || ev.allDay || !ev.time) return false; return ev.time <= nowTime(); }
function tickDue() {
  S.events.filter(dueEvent).forEach(ev => {
    if (alerted.has(ev.id)) return; alerted.add(ev.id);
    if (Date.now() - new Date(ev.date + 'T' + ev.time).getTime() < 90000) { beep(3); toast('⏰ ' + ev.kind + ': ' + ev.title, 6000); if (!native() && 'Notification' in window && Notification.permission === 'granted') new Notification(ev.kind + ': ' + ev.title); }
  });
  if (currentTab === 'home' || currentTab === 'calendar') { const sc = window.scrollY; render(); window.scrollTo(0, sc); }
}

/* ---------- рутер ---------- */
let currentTab = 'home';
const ICON_EMPTY = '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/></svg>';
const empty = (msg) => `<div class="empty">${ICON_EMPTY}${msg}</div>`;
function parseHash() {
  const h = location.hash.replace(/^#\/?/, ''); const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function setChrome(title, tab, back, fab) {
  $('#title').textContent = title; currentTab = tab;
  $('#backBtn').hidden = !back; $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  const f = $('#fab'); f.hidden = !fab; f.onclick = fab || null;
}
function render() {
  const { parts, q } = parseHash(); const v = $('#view');
  const r = parts[0] || '';
  const routes = {
    '': () => viewHome(v), clients: () => viewClients(v, q), client: () => viewClient(v, parts[1]),
    catalog: () => viewCatalog(v, q), brand: () => viewBrand(v, parts[1], q), model: () => viewModel(v, parts[1]),
    offers: () => viewOffers(v, q), offer: () => viewOffer(v, parts[1]), calendar: () => viewCalendar(v, q),
    reports: () => viewReports(v, q), info: () => viewInfo(v), settings: () => viewSettings(v)
  };
  (routes[r] || routes[''])();
}
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
$('#backBtn').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/');
$('#moreBtn').onclick = () => openSheet(`<h2>Още</h2><div class="list">
  <a class="item" href="#/reports"><div class="grow"><div class="t">Седмични отчети</div><div class="s">Excel по вашия шаблон</div></div></a>
  <a class="item" href="#/info"><div class="grow"><div class="t">Информация</div><div class="s">Време, курсове, полезни източници</div></div></a>
  <a class="item" href="#/settings"><div class="grow"><div class="t">Настройки и архив</div><div class="s">Импорт на клиенти, архив, подпис, ключове</div></div></a></div>`);

/* ---------- ТАБЛО ---------- */
function eventItem(ev, showDate = false) {
  const due = dueEvent(ev);
  const cls = ['item', 'ev', ev.priority === 'висока' ? 'high' : '', due ? 'due' : '', ev.done ? 'done' : ''].join(' ');
  return `<div class="${cls}" data-ev="${ev.id}">
    <div class="time">${ev.allDay || !ev.time ? 'цял ден' : esc(ev.time)}${showDate ? `<div class="small muted">${fmtDate(ev.date).slice(0, 5)}</div>` : ''}</div>
    <div class="grow"><div class="t">${esc(ev.title)}</div><div class="s">${esc(ev.kind)}${ev.clientId ? ' · ' + esc(clientName(ev.clientId)) : ''}${ev.place ? ' · ' + esc(ev.place) : ''}</div></div>
    ${due ? '<span class="chip due">настъпил час</span>' : ''}${ev.priority === 'висока' && !due ? '<span class="chip high">важно</span>' : ''}
    <input type="checkbox" data-done="${ev.id}" ${ev.done ? 'checked' : ''} aria-label="Изпълнено" style="width:22px;height:22px;accent-color:var(--primary)">
  </div>`;
}
function wireEvents(root) {
  $$('[data-done]', root).forEach(cb => { cb.onclick = async e => { e.stopPropagation(); const ev = get('events', cb.dataset.done); ev.done = cb.checked; await put('events', ev); ev.done ? cancelReminder(ev) : scheduleReminder(ev); render(); }; });
  $$('[data-ev]', root).forEach(it => it.onclick = () => eventForm(get('events', it.dataset.ev)));
}
function viewHome(v) {
  setChrome('Техника за обекта', 'home', false, () => eventForm());
  const t = todayISO(); const d = new Date();
  const today = S.events.filter(e => e.date === t).sort(byTime);
  const overdue = S.events.filter(e => !e.done && e.date < t).sort((a, b) => a.date.localeCompare(b.date));
  const openOffers = S.offers.filter(o => o.status === 'Изпратена' || o.status === 'Чернова');
  const recent = S.activities.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 5);
  v.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,var(--primary),var(--primary-2));color:#fff">
      <div class="small" style="opacity:.85">${DAYS[d.getDay()]}, ${fmtDate(t)}</div>
      <div style="font-size:21px;font-weight:700;margin-top:2px">${greet()}${profile().firstName ? ', ' + esc(profile().firstName) : ''}</div>
      <div class="small" style="opacity:.9;margin-top:4px">${today.filter(e => !e.done).length} за днес · ${overdue.length} просрочени · ${openOffers.length} отворени оферти</div>
    </div>
    <div id="infoBanners"></div>
    <div class="stats">
      <a class="stat" href="#/clients" style="text-decoration:none"><b>${S.clients.length}</b><span>клиента</span></a>
      <a class="stat" href="#/offers" style="text-decoration:none"><b>${openOffers.length}</b><span>отворени оферти</span></a>
      <a class="stat" href="#/catalog" style="text-decoration:none"><b>${S.models.length}</b><span>модела</span></a>
    </div>
    <div class="section-title">Днес</div>
    ${today.length ? `<div class="list">${today.map(e => eventItem(e)).join('')}</div>` : empty('Нямате задачи и срещи за днес.<br><button class="btn tonal" style="margin-top:10px" id="addToday">Добави задача</button>')}
    ${overdue.length ? `<div class="section-title" style="color:var(--danger)">Просрочени</div><div class="list">${overdue.map(e => eventItem(e, true)).join('')}</div>` : ''}
    <div class="section-title">Последни активности</div>
    ${recent.length ? `<div class="list">${recent.map(activityItem).join('')}</div>` : empty('Още няма записани разговори, посещения и запитвания.')}
  `;
  wireEvents(v); wireActivities(v);
  const a = $('#addToday'); if (a) a.onclick = () => eventForm();
  renderInfoBanners($('#infoBanners'));
}
const byTime = (a, b) => ((a.allDay || !a.time) ? '00:00' : a.time).localeCompare((b.allDay || !b.time) ? '00:00' : b.time);

/* ---------- КЛИЕНТИ ---------- */
let clientFilter = { q: '', abc: '' };
function viewClients(v) {
  setChrome('Клиенти', 'clients', false, () => clientForm());
  v.innerHTML = `
    <div class="search"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>
      <input id="cq" placeholder="Търси фирма, град, ЕИК, лице…" value="${esc(clientFilter.q)}"></div>
    <div class="chips" id="abc">${['', 'A', 'B', 'C', 'D'].map(k => `<button data-k="${k}" class="${clientFilter.abc === k ? 'on' : ''}">${k ? ABC[k] : 'Всички'}</button>`).join('')}</div>
    <div id="clist"></div>`;
  const draw = () => {
    const q = norm(clientFilter.q);
    let list = S.clients.filter(c => (!clientFilter.abc || c.abc === clientFilter.abc) &&
      (!q || norm([c.name, c.city, c.eik, c.phone, c.email, ...(c.contacts || []).map(x => x.name + x.phone)].join(' ')).includes(q)));
    list.sort((a, b) => a.name.localeCompare(b.name, 'bg'));
    const shown = list.slice(0, 200);
    $('#clist').innerHTML = !S.clients.length
      ? empty('Няма клиенти. Добавете с бутона + или импортирайте вашата Excel база.<br><a class="btn tonal" style="margin-top:10px" href="#/settings">Импорт от Excel</a>')
      : list.length ? `<div class="small muted" style="margin:0 4px 6px">${list.length} резултата${list.length > 200 ? ' (показани първите 200)' : ''}</div><div class="list">${shown.map(c => `
        <a class="item" href="#/client/${c.id}"><div class="avatar" style="background:var(--${(c.abc || 'x').toLowerCase()},var(--primary-2))">${esc(initials(c.name))}</div>
        <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc([c.city, (c.contacts || [])[0]?.name, c.phone].filter(Boolean).join(' · '))}</div></div>
        ${c.abc ? `<span class="chip ${c.abc}">${c.abc}</span>` : ''}</a>`).join('')}</div>` : empty('Няма съвпадения.');
  };
  $('#cq').oninput = e => { clientFilter.q = e.target.value; draw(); };
  $$('#abc button').forEach(b => b.onclick = () => { clientFilter.abc = b.dataset.k; $$('#abc button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}
function activityItem(a) {
  return `<div class="item" data-act="${a.id}"><div class="grow"><div class="t">${esc(a.type)}${a.clientId ? ' · ' + esc(clientName(a.clientId)) : ''}</div>
    <div class="s">${fmtDate(a.date)} · ${esc(a.text || a.result || '')}</div></div>${a.type === 'Сделка' && a.stage ? `<span class="chip">${esc(a.stage)}</span>` : ''}</div>`;
}
function wireActivities(root) { $$('[data-act]', root).forEach(it => it.onclick = () => activityForm(get('activities', it.dataset.act))); }
function viewClient(v, id) {
  const c = get('clients', id); if (!c) { location.hash = '#/clients'; return; }
  setChrome(c.name, 'clients', true, () => quickAdd(c));
  const acts = S.activities.filter(a => a.clientId === id);
  const evs = S.events.filter(e => e.clientId === id);
  const offs = S.offers.filter(o => o.clientId === id);
  const hist = [
    ...acts.map(a => ({ d: a.date, html: activityItem(a) })),
    ...evs.map(e => ({ d: e.date, html: eventItem(e, true) })),
    ...offs.map(o => ({ d: o.date, html: offerItem(o) }))
  ].sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  const deals = acts.filter(a => a.type === 'Сделка');
  v.innerHTML = `
    <div class="card"><div class="row"><div class="avatar" style="width:52px;height:52px;font-size:18px;background:var(--${(c.abc || 'x').toLowerCase()},var(--primary-2))">${esc(initials(c.name))}</div>
      <div class="grow"><div style="font-size:18px;font-weight:700">${esc(c.name)}</div><div class="muted small">${esc([c.city, c.eik ? 'ЕИК ' + c.eik : ''].filter(Boolean).join(' · '))}</div></div>
      ${c.abc ? `<span class="chip ${c.abc}">${ABC[c.abc]}</span>` : ''}</div>
      <dl class="kv" style="margin-top:12px">
        ${c.address ? `<dt>Адрес</dt><dd>${esc(c.address)}</dd>` : ''}
        ${c.phone ? `<dt>Телефон</dt><dd><a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a></dd>` : ''}
        ${c.email ? `<dt>Имейл</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd>` : ''}
        ${c.nextAction ? `<dt>Следващо действие</dt><dd>${esc(c.nextAction)}</dd>` : ''}
        ${c.product ? `<dt>Препоръчан продукт</dt><dd>${esc(c.product)}</dd>` : ''}
        ${c.notes ? `<dt>Бележки</dt><dd>${esc(c.notes)}</dd>` : ''}
      </dl>
      <div class="btns"><button class="btn tonal" id="editC">Редактирай</button><button class="btn tonal" id="newOffer">Нова оферта</button></div>
    </div>
    <div class="section-title">Лица за контакт</div>
    <div class="list">${(c.contacts || []).map((p, i) => `<div class="item" data-ci="${i}"><div class="avatar">${esc(initials(p.name))}</div>
      <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc([p.role, p.phone, p.email].filter(Boolean).join(' · '))}</div></div>
      ${p.phone ? `<a class="icon-btn" style="color:var(--primary)" href="tel:${esc(p.phone.replace(/\s/g, ''))}" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg></a>` : ''}</div>`).join('')}
      <div class="item" id="addContact" style="color:var(--primary);font-weight:600">+ Добави лице за контакт</div></div>
    ${deals.length ? `<div class="section-title">Сделки</div><div class="list">${deals.map(activityItem).join('')}</div>` : ''}
    <div class="section-title">История</div>
    ${hist.length ? `<div class="list">${hist.map(h => h.html).join('')}</div>` : empty('Няма записи. Добавете разговор, запитване, задача или оферта с бутона +.')}`;
  $('#editC').onclick = () => clientForm(c);
  $('#newOffer').onclick = () => offerForm(null, { clientId: c.id });
  $('#addContact').onclick = () => contactForm(c);
  $$('[data-ci]', v).forEach(it => it.onclick = () => contactForm(c, +it.dataset.ci));
  wireEvents(v); wireActivities(v); wireOffers(v);
}
function quickAdd(c) {
  openSheet(`<h2>Добави към ${esc(c.name)}</h2><div class="list">
    ${ACT_TYPES.slice(0, 4).map(t => `<div class="item" data-t="${t}"><div class="t">${t}</div></div>`).join('')}
    <div class="item" data-e="Задача"><div class="t">Задача</div></div><div class="item" data-e="Среща"><div class="t">Среща</div></div>
    <div class="item" data-o><div class="t">Оферта</div></div></div>`, r => {
    $$('[data-t]', r).forEach(i => i.onclick = () => activityForm(null, { clientId: c.id, type: i.dataset.t }));
    $$('[data-e]', r).forEach(i => i.onclick = () => eventForm(null, { clientId: c.id, kind: i.dataset.e }));
    $('[data-o]', r).onclick = () => offerForm(null, { clientId: c.id });
  });
}
function clientForm(c) {
  const x = c || { abc: '' };
  openSheet(`<h2>${c ? 'Редакция на клиент' : 'Нов клиент'}</h2><form>
    ${field('Фирма *', 'name', x.name, 'text', 'required')}
    <div class="grid2">${field('ЕИК', 'eik', x.eik, 'text', 'inputmode="numeric"')}${field('Град', 'city', x.city)}</div>
    ${field('Адрес', 'address', x.address)}
    <div class="grid2">${field('Телефон', 'phone', x.phone, 'tel')}${field('Имейл', 'email', x.email, 'email')}</div>
    ${select('Категория', 'abc', [['', '— без —'], ...Object.entries(ABC)], x.abc)}
    ${field('Следващо действие', 'nextAction', x.nextAction)}
    ${field('Препоръчан продукт', 'product', x.product)}
    ${area('Бележки', 'notes', x.notes)}
    ${formBtns(c && c.id)}</form>`, r => wireForm(r, async d => {
    if (!d.name) throw new Error('Въведете име на фирмата');
    const dup = S.clients.find(o => o.id !== x.id && ((d.eik && o.eik === d.eik) || norm(o.name) === norm(d.name)));
    if (dup && !confirm(`Вече има клиент „${dup.name}“. Да се запази ли все пак?`)) return;
    const o = Object.assign(c || { id: uid(), contacts: [] }, d); await put('clients', o); closeSheet();
    c ? render() : (location.hash = '#/client/' + o.id); toast('Клиентът е запазен');
  }, async () => {
    await del('clients', c.id); location.hash = '#/clients';
  }));
}
function contactForm(c, i) {
  const p = i != null ? c.contacts[i] : {};
  openSheet(`<h2>${i != null ? 'Лице за контакт' : 'Ново лице за контакт'}</h2><form>
    ${field('Име *', 'name', p.name, 'text', 'required')}${field('Длъжност', 'role', p.role)}
    <div class="grid2">${field('Телефон', 'phone', p.phone, 'tel')}${field('Имейл', 'email', p.email, 'email')}</div>
    ${formBtns(i != null)}</form>`, r => wireForm(r, async d => {
    c.contacts = c.contacts || []; if (i != null) c.contacts[i] = d; else c.contacts.push(d);
    await put('clients', c); closeSheet(); render();
  }, async () => { c.contacts.splice(i, 1); await put('clients', c); render(); }));
}
function activityForm(a, preset = {}) {
  const x = a || Object.assign({ date: todayISO(), type: 'Разговор' }, preset);
  openSheet(`<h2>${a ? 'Активност' : 'Нова активност'}</h2><form>
    ${select('Клиент', 'clientId', clientOpts(), x.clientId)}
    <div class="grid2">${select('Вид', 'type', ACT_TYPES, x.type, 'id="atype"')}${field('Дата', 'date', x.date, 'date')}</div>
    ${field('Лице за контакт', 'contact', x.contact)}
    ${area('Описание', 'text', x.text)}
    ${field('Резултат', 'result', x.result)}
    ${field('Следваща стъпка', 'next', x.next)}
    <div id="dealF" ${x.type === 'Сделка' ? '' : 'hidden'}><div class="grid2">${select('Етап', 'stage', DEAL_STAGES, x.stage)}${field('Стойност (€ без ДДС)', 'amount', x.amount, 'number', 'step="0.01"')}</div></div>
    ${select('Техника (по избор)', 'modelId', [['', '—'], ...S.models.map(m => [m.id, modelTitle(m)])], x.modelId)}
    ${!a ? `<label class="switch"><input type="checkbox" name="makeTask"> Създай задача за следващата стъпка</label>` : ''}
    ${formBtns(a && a.id)}</form>`, r => {
    $('#atype', r).onchange = e => ($('#dealF', r).hidden = e.target.value !== 'Сделка');
    wireForm(r, async d => {
      const mk = d.makeTask; delete d.makeTask; if (d.amount) d.amount = +d.amount;
      const o = Object.assign(a || { id: uid() }, d); await put('activities', o); closeSheet();
      if (mk && d.next) { eventForm(null, { title: d.next, clientId: d.clientId, kind: 'Задача' }); return; }
      render(); toast('Записано');
    }, async () => { await del('activities', a.id); render(); });
  });
}

/* ---------- ТЕХНИКА ---------- */
async function ensureBrands() {
  if (S.brands.length || setting('brandsSeeded')) return;
  await putMany('brands', BRANDS.map((n, i) => ({ id: uid(), name: n, order: i, createdAt: Date.now() })));
  await setSetting('brandsSeeded', true);
}
function viewCatalog(v) {
  setChrome('Техника', 'catalog', false, () => brandForm());
  const q = (viewCatalog.q || '');
  v.innerHTML = `<div class="search"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>
    <input id="mq" placeholder="Търси модел или каталожен номер…" value="${esc(q)}"></div><div id="cat"></div>`;
  const draw = () => {
    const nq = norm(viewCatalog.q);
    if (nq) {
      const ms = S.models.filter(m => norm(modelTitle(m) + ' ' + (m.partNo || '') + ' ' + m.category).includes(nq));
      $('#cat').innerHTML = ms.length ? `<div class="list">${ms.map(modelItem).join('')}</div>` : empty('Няма намерени модели.');
      return;
    }
    const brands = S.brands.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
    $('#cat').innerHTML = `<div class="section-title">Марки</div><div class="list">${brands.map(b => {
      const n = S.models.filter(m => m.brandId === b.id).length;
      return `<a class="item" href="#/brand/${b.id}"><div class="avatar" style="border-radius:12px">${esc(initials(b.name))}</div><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">${n} модела</div></div></a>`;
    }).join('')}</div>`;
  };
  $('#mq').oninput = e => { viewCatalog.q = e.target.value; draw(); };
  draw();
}
function modelItem(m) {
  const ph = (m.photos || [])[0];
  return `<a class="item" href="#/model/${m.id}">${ph ? `<img class="thumb" src="${ph.data}" alt="">` : `<div class="thumb" style="display:grid;place-items:center;color:var(--muted)"><svg viewBox="0 0 24 24"><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"/></svg></div>`}
    <div class="grow"><div class="t">${esc(modelTitle(m))}</div><div class="s">${esc(m.category || '')} · ${(m.params || []).length} параметъра · ${(m.photos || []).length} снимки</div></div></a>`;
}
function viewBrand(v, id, q) {
  const b = get('brands', id); if (!b) { location.hash = '#/catalog'; return; }
  setChrome(b.name, 'catalog', true, () => modelForm(null, { brandId: id, category: q.cat || '' }));
  const ms = S.models.filter(m => m.brandId === id);
  const cats = [...new Set(ms.map(m => m.category || 'Друго'))].sort((a, x) => a.localeCompare(x, 'bg'));
  v.innerHTML = `${b.site ? `<div class="card small">Официален сайт: <a href="${esc(b.site)}" target="_blank" rel="noopener">${esc(b.site)}</a></div>` : ''}
    ${cats.length ? cats.map(c => `<div class="section-title">${esc(c)}</div><div class="list">${ms.filter(m => (m.category || 'Друго') === c).sort((a, x) => a.name.localeCompare(x.name, 'bg', { numeric: true })).map(modelItem).join('')}</div>`).join('')
      : empty('Още няма добавени модели за тази марка. Добавете с бутона + — параметри, снимки и документи с източник.')}
    <div class="btns"><button class="btn text" id="editB">Редактирай марката</button></div>`;
  $('#editB').onclick = () => brandForm(b);
}
function brandForm(b) {
  const x = b || {};
  openSheet(`<h2>${b ? 'Марка' : 'Нова марка'}</h2><form>${field('Име *', 'name', x.name, 'text', 'required')}${field('Официален сайт', 'site', x.site, 'url', 'placeholder="https://"')}${formBtns(b && b.id)}</form>`,
    r => wireForm(r, async d => { const o = Object.assign(b || { id: uid(), order: 99 }, d); await put('brands', o); closeSheet(); b ? render() : (location.hash = '#/brand/' + o.id); },
      async () => { if (S.models.some(m => m.brandId === b.id)) { toast('Първо изтрийте моделите на марката'); throw new Error('Марката има модели'); } await del('brands', b.id); location.hash = '#/catalog'; }));
}
function viewModel(v, id) {
  const m = get('models', id); if (!m) { location.hash = '#/catalog'; return; }
  setChrome(modelTitle(m), 'catalog', true, null);
  v.innerHTML = `
    ${(m.photos || []).length ? `<div class="card"><div class="gallery">${m.photos.map((p, i) => `<figure><img src="${p.data}" alt=""><figcaption>${i === 0 ? 'Основна · ' : ''}${esc(p.source || 'без посочен източник')}</figcaption></figure>`).join('')}</div></div>` : ''}
    <div class="card"><div class="row"><div class="grow"><div style="font-size:18px;font-weight:700">${esc(modelTitle(m))}</div><div class="muted small">${esc(m.category || '')}${m.partNo ? ' · Кат. № ' + esc(m.partNo) : ''}</div></div></div>
      ${m.description ? `<p style="margin:10px 0 0">${esc(m.description)}</p>` : ''}
      <div class="btns"><button class="btn tonal" id="editM">Редактирай</button><button class="btn tonal" id="offerM">Оферта с този модел</button></div></div>
    <div class="section-title">Технически параметри</div>
    <div class="card">${(m.params || []).length ? `<table class="params">${m.params.map(p => `<tr><td>${esc(p.name)}</td><td><b>${esc(p.value)}</b> ${esc(p.unit || '')}${p.source ? `<div class="src">${esc(p.source)}${p.checked ? ' · проверено ' + fmtDate(p.checked) : ''}</div>` : ''}</td></tr>`).join('')}</table>`
      : '<div class="muted small">Няма въведени параметри. Непубликуваните параметри остават празни.</div>'}</div>
    <div class="section-title">Документи</div>
    <div class="list">${(m.docs || []).map(d => `<a class="item" href="${esc(d.url)}" target="_blank" rel="noopener"><div class="grow"><div class="t">${esc(d.name || d.url)}</div><div class="s">${esc(d.url)}</div></div></a>`).join('') || '<div class="item muted small">Няма документи</div>'}</div>`;
  $('#editM').onclick = () => modelForm(m);
  $('#offerM').onclick = () => offerForm(null, { items: [itemFromModel(m)] });
}
function modelForm(m, preset = {}) {
  const x = m ? JSON.parse(JSON.stringify(m)) : Object.assign({ params: [], photos: [], docs: [] }, preset);
  const paramRow = (p = {}) => `<div class="card" style="padding:10px;background:var(--surface-2);box-shadow:none" data-prow>
    <div class="grid2"><input class="i" placeholder="Параметър" data-p="name" value="${esc(p.name)}"><div class="row"><input class="i" placeholder="Стойност" data-p="value" value="${esc(p.value)}"><input class="i" style="max-width:80px" placeholder="ед." data-p="unit" value="${esc(p.unit)}"></div></div>
    <div class="grid2" style="margin-top:6px"><input class="i" placeholder="Източник (документ/линк)" data-p="source" value="${esc(p.source)}"><div class="row"><input class="i" type="date" data-p="checked" value="${esc(p.checked || todayISO())}"><button type="button" class="icon-btn" data-rm style="color:var(--danger)">✕</button></div></div></div>`;
  const photosHtml = () => x.photos.map((p, i) => `<figure><img src="${p.data}" alt=""><figcaption><input class="i" style="padding:4px 6px;font-size:12px" data-ps="${i}" placeholder="Източник" value="${esc(p.source)}">
    <div class="row" style="gap:2px;margin-top:2px">${i ? `<button type="button" class="btn text" style="padding:2px 6px;font-size:12px" data-first="${i}">Основна</button>` : '<span class="small muted">Основна</span>'}<span class="grow"></span><button type="button" class="btn text" style="padding:2px 6px;font-size:12px;color:var(--danger)" data-prm="${i}">Махни</button></div></figcaption></figure>`).join('');
  openSheet(`<h2>${m ? 'Редакция на модел' : 'Нов модел'}</h2><form>
    ${select('Марка *', 'brandId', S.brands.map(b => [b.id, b.name]), x.brandId)}
    ${field('Модел *', 'name', x.name, 'text', 'required placeholder="напр. HMK 102B ALPHA"')}
    <label class="f"><span>Вид техника</span><input class="i" name="category" list="cats" value="${esc(x.category)}"></label><datalist id="cats">${CATEGORIES.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    ${field('Каталожен номер', 'partNo', x.partNo)}
    ${area('Кратко описание за оферта', 'description', x.description)}
    <div class="section-title">Снимки (първата е основна — препоръчително на бял фон)</div>
    <div class="gallery" id="phs">${photosHtml()}</div><button type="button" class="btn tonal" id="addPh" style="margin:8px 0 4px">+ Снимки</button>
    <div class="section-title">Технически параметри (само от официален източник)</div>
    <div id="prows">${x.params.map(paramRow).join('')}</div><button type="button" class="btn tonal" id="addP">+ Параметър</button>
    <div class="section-title">Документи (линкове)</div>
    <div id="drows">${x.docs.map(d => `<div class="grid2" data-drow style="margin-bottom:6px"><input class="i" data-d="name" placeholder="Име" value="${esc(d.name)}"><input class="i" data-d="url" placeholder="https://" value="${esc(d.url)}"></div>`).join('')}</div>
    <button type="button" class="btn tonal" id="addD">+ Документ</button>
    ${formBtns(m && m.id)}</form>`, r => {
    const redrawPh = () => { $('#phs', r).innerHTML = photosHtml(); wirePh(); };
    const wirePh = () => {
      $$('[data-ps]', r).forEach(i => i.oninput = () => (x.photos[+i.dataset.ps].source = i.value));
      $$('[data-prm]', r).forEach(b => b.onclick = () => { x.photos.splice(+b.dataset.prm, 1); redrawPh(); });
      $$('[data-first]', r).forEach(b => b.onclick = () => { const [p] = x.photos.splice(+b.dataset.first, 1); x.photos.unshift(p); redrawPh(); });
    };
    wirePh();
    $('#addPh', r).onclick = async () => { const fs = await pickFile('image/*', true); for (const f of fs) x.photos.push({ data: await imageToDataURL(f), source: '' }); redrawPh(); };
    const wireRm = () => $$('[data-rm]', r).forEach(b => b.onclick = () => b.closest('[data-prow]').remove());
    wireRm();
    $('#addP', r).onclick = () => { $('#prows', r).insertAdjacentHTML('beforeend', paramRow()); wireRm(); };
    $('#addD', r).onclick = () => $('#drows', r).insertAdjacentHTML('beforeend', `<div class="grid2" data-drow style="margin-bottom:6px"><input class="i" data-d="name" placeholder="Име"><input class="i" data-d="url" placeholder="https://"></div>`);
    wireForm(r, async d => {
      if (!d.name) throw new Error('Въведете модел');
      const params = $$('[data-prow]', r).map(row => Object.fromEntries($$('[data-p]', row).map(i => [i.dataset.p, i.value.trim()]))).filter(p => p.name && p.value);
      const docs = $$('[data-drow]', r).map(row => Object.fromEntries($$('[data-d]', row).map(i => [i.dataset.d, i.value.trim()]))).filter(p => p.url);
      const o = Object.assign(m || { id: uid() }, d, { params, docs, photos: x.photos });
      await put('models', o); closeSheet(); m ? render() : (location.hash = '#/model/' + o.id); toast('Моделът е запазен');
    }, async () => { await del('models', m.id); location.hash = '#/brand/' + m.brandId; });
  });
}

/* ---------- ОФЕРТИ ---------- */
const offerTotal = o => (o.items || []).reduce((s, i) => s + (+i.qty || 1) * (+i.price || 0) * (1 - (+i.discount || 0) / 100), 0);
function offerItem(o) {
  return `<div class="item" data-offer="${o.id}"><div class="grow"><div class="t">№ ${esc(o.number)} · ${esc(clientName(o.clientId) || 'без клиент')}</div>
    <div class="s">${fmtDate(o.date)} · ${esc((o.items || []).map(i => i.name).join(', '))}</div></div>
    <div style="text-align:right"><div class="small" style="font-weight:700">${money(offerTotal(o))}</div><span class="chip ${o.status === 'Спечелена' ? 'done' : o.status === 'Загубена' ? 'D' : ''}">${esc(o.status)}</span></div></div>`;
}
function wireOffers(root) { $$('[data-offer]', root).forEach(it => it.onclick = () => (location.hash = '#/offer/' + it.dataset.offer)); }
let offerFilter = '';
function viewOffers(v) {
  setChrome('Оферти', 'offers', false, () => offerForm());
  const list = S.offers.filter(o => !offerFilter || o.status === offerFilter).sort((a, b) => (b.date + b.number).localeCompare(a.date + a.number));
  const sum = st => S.offers.filter(o => o.status === st).reduce((s, o) => s + offerTotal(o), 0);
  v.innerHTML = `<div class="stats"><div class="stat"><b>${S.offers.filter(o => o.status === 'Изпратена').length}</b><span>изпратени</span></div>
    <div class="stat"><b style="font-size:17px">${money(sum('Изпратена')).replace(',00', '')}</b><span>в процес</span></div>
    <div class="stat"><b style="font-size:17px">${money(sum('Спечелена')).replace(',00', '')}</b><span>спечелени</span></div></div>
    <div class="chips">${['', ...OFFER_STATUS].map(s => `<button data-s="${s}" class="${offerFilter === s ? 'on' : ''}">${s || 'Всички'}</button>`).join('')}</div>
    ${list.length ? `<div class="list">${list.map(offerItem).join('')}</div>` : empty('Няма оферти. Създайте с бутона +.')}`;
  $$('.chips button', v).forEach(b => b.onclick = () => { offerFilter = b.dataset.s; render(); });
  wireOffers(v);
}
function nextOfferNo() {
  const y = new Date().getFullYear(); const n = S.offers.filter(o => String(o.number).startsWith(y + '-')).map(o => +String(o.number).split('-')[1] || 0);
  return `${y}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`;
}
function itemFromModel(m) {
  return { modelId: m.id, name: modelTitle(m), qty: 1, price: '', discount: '', photos: 'all',
    description: [m.description, ...(m.params || []).map(p => `${p.name}: ${p.value}${p.unit ? ' ' + p.unit : ''}`)].filter(Boolean).join('\n') };
}
function offerForm(o, preset = {}) {
  const prof = profile(); const terms = setting('offerTerms', {});
  const x = o ? JSON.parse(JSON.stringify(o)) : Object.assign({ number: nextOfferNo(), date: todayISO(), status: 'Чернова', vat: 20, currency: 'EUR', items: [],
    delivery: terms.delivery || '', payment: terms.payment || '', warranty: terms.warranty || '', validity: terms.validity || '', issuer: prof.company || 'Екосол България АД' }, preset);
  const c = get('clients', x.clientId);
  const itemRow = (it, i) => `<div class="card" style="padding:10px;background:var(--surface-2);box-shadow:none" data-irow="${i}">
    <div class="row"><b class="grow">${esc(it.name || 'Позиция')}</b><button type="button" class="icon-btn" data-irm="${i}" style="color:var(--danger)">✕</button></div>
    <input class="i" data-i="name" value="${esc(it.name)}" placeholder="Наименование">
    <textarea class="i" data-i="description" style="margin-top:6px" placeholder="Техническо описание">${esc(it.description)}</textarea>
    <div class="grid2" style="margin-top:6px"><input class="i" data-i="qty" type="number" min="1" value="${esc(it.qty || 1)}" placeholder="Бр."><input class="i" data-i="price" type="number" step="0.01" value="${esc(it.price)}" placeholder="Ед. цена без ДДС"></div>
    <div class="grid2" style="margin-top:6px"><input class="i" data-i="discount" type="number" step="0.1" value="${esc(it.discount)}" placeholder="Отстъпка %">
      <select class="i" data-i="photos">${[['all', 'Всички снимки'], ['first', 'Само основната'], ['none', 'Без снимки']].map(([v, t]) => `<option value="${v}" ${it.photos === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>`;
  openSheet(`<h2>${o ? 'Оферта № ' + esc(x.number) : 'Нова оферта'}</h2><form>
    <div class="grid2">${field('Номер', 'number', x.number)}${field('Дата', 'date', x.date, 'date')}</div>
    <label class="f"><span>Клиент</span><input class="i" id="ocl" list="clist2" value="${esc(c ? c.name : '')}" placeholder="Започнете да пишете…"></label>
    <datalist id="clist2">${S.clients.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
    <label class="f"><span>Лице за контакт</span><input class="i" name="contact" id="ocontact" list="ctlist" value="${esc(x.contact)}"></label><datalist id="ctlist"></datalist>
    <div class="grid2">${select('Статус', 'status', OFFER_STATUS, x.status)}${select('Издател', 'issuer', ['Екосол България АД', 'Евромаркет Кънстракшън ЕАД'], x.issuer)}</div>
    <div class="section-title">Позиции</div><div id="irows">${x.items.map(itemRow).join('')}</div>
    <div class="row" style="gap:8px"><select class="i" id="addModel"><option value="">+ Добави модел от каталога…</option>${S.models.map(m => `<option value="${m.id}">${esc(modelTitle(m))}</option>`).join('')}</select>
      <button type="button" class="btn tonal" id="addFree">+ Свободна</button></div>
    <div class="section-title">Условия</div>
    <div class="grid2">${field('ДДС %', 'vat', x.vat, 'number')}${field('Валута', 'currency', x.currency)}</div>
    ${field('Срок на доставка', 'delivery', x.delivery)}${field('Начин на плащане', 'payment', x.payment)}
    <div class="grid2">${field('Гаранция', 'warranty', x.warranty)}${field('Валидност на офертата', 'validity', x.validity)}</div>
    ${area('Бележки', 'notes', x.notes)}
    <label class="switch"><input type="checkbox" name="saveTerms"> Запомни условията като стандартни</label>
    ${formBtns(o && o.id)}</form>`, r => {
    const contactsFor = () => { const cl = S.clients.find(c => c.name === $('#ocl', r).value); $('#ctlist', r).innerHTML = cl ? (cl.contacts || []).map(p => `<option value="${esc(p.name)}">`).join('') : ''; return cl; };
    $('#ocl', r).oninput = () => { const cl = contactsFor(); if (cl && !$('#ocontact', r).value && (cl.contacts || [])[0]) $('#ocontact', r).value = cl.contacts[0].name; };
    contactsFor();
    const collect = () => $$('[data-irow]', r).forEach(row => { const it = x.items[+row.dataset.irow]; $$('[data-i]', row).forEach(i => (it[i.dataset.i] = i.value)); });
    const redraw = () => { collect(); $('#irows', r).innerHTML = x.items.map(itemRow).join(''); wire(); };
    const wire = () => $$('[data-irm]', r).forEach(b => b.onclick = () => { collect(); x.items.splice(+b.dataset.irm, 1); $('#irows', r).innerHTML = x.items.map(itemRow).join(''); wire(); });
    wire();
    $('#addModel', r).onchange = e => { const m = get('models', e.target.value); if (m) { collect(); x.items.push(itemFromModel(m)); redraw(); } e.target.value = ''; };
    $('#addFree', r).onclick = () => { collect(); x.items.push({ name: '', qty: 1, price: '', description: '', photos: 'none' }); redraw(); };
    wireForm(r, async d => {
      collect();
      const cl = S.clients.find(c => c.name === $('#ocl', r).value);
      if ($('#ocl', r).value && !cl) throw new Error('Клиентът не е намерен — изберете от списъка или го добавете първо.');
      if (!x.items.length) throw new Error('Добавете поне една позиция');
      if (d.saveTerms) await setSetting('offerTerms', { delivery: d.delivery, payment: d.payment, warranty: d.warranty, validity: d.validity });
      delete d.saveTerms; d.vat = +d.vat || 0;
      if (S.offers.some(of => of.id !== x.id && of.number === d.number)) throw new Error('Вече има оферта с този номер');
      const out = Object.assign(o || { id: uid() }, d, { clientId: cl ? cl.id : '', items: x.items.map(i => ({ ...i, qty: +i.qty || 1, price: +i.price || 0, discount: +i.discount || 0 })) });
      await put('offers', out); closeSheet(); location.hash = '#/offer/' + out.id; render(); toast('Офертата е запазена');
    }, async () => { await del('offers', o.id); location.hash = '#/offers'; });
  });
}
function offerHTML(o, standalone = false) {
  const c = get('clients', o.clientId) || {}; const prof = profile();
  const net = offerTotal(o); const vat = net * (o.vat || 0) / 100;
  const euromarket = /Евромаркет/i.test(o.issuer || '');
  const photos = it => { const m = get('models', it.modelId); if (!m || it.photos === 'none') return []; return it.photos === 'first' ? (m.photos || []).slice(0, 1) : (m.photos || []); };
  const body = `<div class="offer-doc">
    ${euromarket ? '<div style="background:#C8102E;color:#fff;font-weight:700;letter-spacing:.2em;padding:10px 14px;margin:-18px -18px 14px;border-radius:12px 12px 0 0">EUROMARKET</div>' : ''}
    <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px"><div><b>${esc(o.issuer || '')}</b>${prof.region ? '<br>' + esc(prof.region) : ''}</div><div style="text-align:right">Оферта № ${esc(o.number)}<br>${fmtDate(o.date)}</div></div>
    <h1>${euromarket ? 'СПЕЦИАЛНА ОФЕРТА' : 'ОФЕРТА'}</h1>
    <p>До: <b>${esc(c.name || '')}</b>${c.city ? ', ' + esc(c.city) : ''}${o.contact ? '<br>На вниманието на: ' + esc(o.contact) : ''}</p>
    ${o.items.map((it, n) => `<h3 style="margin:16px 0 4px">${n + 1}. ${esc(it.name)}</h3>${photos(it).map(p => `<img src="${p.data}" alt="">`).join('')}
      ${it.description ? `<div style="white-space:pre-line;font-size:14px">${esc(it.description)}</div>` : ''}`).join('')}
    <h3 style="margin:18px 0 6px">Цена</h3>
    <table><tr><th>Позиция</th><th class="right">Бр.</th><th class="right">Ед. цена</th><th class="right">Отст.</th><th class="right">Сума</th></tr>
      ${o.items.map(it => `<tr><td>${esc(it.name)}</td><td class="right">${it.qty}</td><td class="right">${money(it.price, o.currency)}</td><td class="right">${it.discount ? it.discount + '%' : ''}</td><td class="right">${money(it.qty * it.price * (1 - (it.discount || 0) / 100), o.currency)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="4">Общо без ДДС</td><td class="right">${money(net, o.currency)}</td></tr>
      <tr><td colspan="4">ДДС ${o.vat}%</td><td class="right">${money(vat, o.currency)}</td></tr>
      <tr class="tot"><td colspan="4">Общо с ДДС</td><td class="right">${money(net + vat, o.currency)}</td></tr></table>
    ${(() => { const t = [['Срок на доставка', o.delivery], ['Начин на плащане', o.payment], ['Гаранция', o.warranty], ['Валидност на офертата', o.validity]].filter(r => r[1]); return t.length ? `<h3 style="margin:18px 0 6px">Условия</h3><table>${t.map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>` : ''; })()}
    ${o.notes ? `<p style="white-space:pre-line">${esc(o.notes)}</p>` : ''}
    <p style="margin-top:22px">С уважение,<br><b>${esc(prof.name || '')}</b>${prof.title ? '<br>' + esc(prof.title) : ''}${prof.phone ? '<br>тел. ' + esc(prof.phone) : ''}${prof.email ? '<br>' + esc(prof.email) : ''}</p></div>`;
  if (!standalone) return body;
  const css = `body{margin:0;background:#fff}.offer-doc{max-width:800px;margin:0 auto;padding:24px;font-family:"Times New Roman",serif;font-size:12pt;color:#111}
    .offer-doc h1{font-size:24pt;text-align:center;margin:10px 0 16px;letter-spacing:.05em}table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:6px;text-align:left}
    img{max-width:100%;max-height:300px;display:block;margin:8px auto;object-fit:contain}.right{text-align:right;white-space:nowrap}.tot td{font-weight:700}`;
  return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Оферта ${esc(o.number)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
function viewOffer(v, id) {
  const o = get('offers', id); if (!o) { location.hash = '#/offers'; return; }
  setChrome('Оферта № ' + o.number, 'offers', true, null);
  v.innerHTML = `<div class="btns no-print" style="margin:0 0 12px"><button class="btn" id="edO">Редактирай</button><button class="btn tonal" id="shO">Сподели / запази</button>
    ${native() ? '' : '<button class="btn tonal" id="prO">Печат / PDF</button>'}<button class="btn tonal" id="cpO">Копирай</button></div>
    ${offerHTML(o)}`;
  $('#edO').onclick = () => offerForm(o);
  $('#shO').onclick = () => saveFile(`Оферта_${o.number}_${(clientName(o.clientId) || '').replace(/[^\wа-яА-Я]+/g, '_')}.html`, new Blob([offerHTML(o, true)], { type: 'text/html' }));
  const pr = $('#prO'); if (pr) pr.onclick = () => window.print();
  $('#cpO').onclick = async () => { const n = JSON.parse(JSON.stringify(o)); Object.assign(n, { id: uid(), number: nextOfferNo(), date: todayISO(), status: 'Чернова', createdAt: 0 }); await put('offers', n); location.hash = '#/offer/' + n.id; toast('Създадено копие'); };
}

/* ---------- КАЛЕНДАР ---------- */
let calMonth = null;
function viewCalendar(v, q) {
  const sel = q.d || todayISO(); if (!calMonth || q.d) calMonth = sel.slice(0, 7);
  setChrome('Календар', 'calendar', false, () => eventForm(null, { date: sel }));
  const [y, mo] = calMonth.split('-').map(Number); const first = new Date(y, mo - 1, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const has = new Set(S.events.map(e => e.date)); const cells = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const s = isoDate(d); cells.push(`<button data-d="${s}" class="${d.getMonth() !== mo - 1 ? 'out' : ''} ${s === todayISO() ? 'today' : ''} ${s === sel ? 'sel' : ''}">${d.getDate()}${has.has(s) ? '<i></i>' : ''}</button>`); }
  const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
  const evs = S.events.filter(e => e.date === sel).sort(byTime);
  v.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="icon-btn" id="pm"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg></button>
    <div class="grow" style="text-align:center;font-weight:700;font-size:17px">${MONTHS[mo - 1]} ${y}</div><button class="icon-btn" id="nm"><svg viewBox="0 0 24 24"><path d="M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z"/></svg></button></div>
    <div class="month">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(h => `<div class="h">${h}</div>`).join('')}${cells.join('')}</div>
    <div class="section-title">${DAYS[new Date(sel + 'T12:00').getDay()]}, ${fmtDate(sel)}</div>
    ${evs.length ? `<div class="list">${evs.map(e => eventItem(e)).join('')}</div>` : empty('Няма записи за този ден.')}`;
  const shift = k => { const d = new Date(y, mo - 1 + k, 1); calMonth = isoDate(d).slice(0, 7); render(); };
  $('#pm').onclick = () => shift(-1); $('#nm').onclick = () => shift(1);
  $$('[data-d]', v).forEach(b => b.onclick = () => { location.hash = '#/calendar?d=' + b.dataset.d; });
  wireEvents(v);
}
function eventForm(ev, preset = {}) {
  const x = ev || Object.assign({ kind: 'Задача', date: todayISO(), time: '', allDay: false, priority: 'нормална', remind: '15' }, preset);
  openSheet(`<h2>${ev ? esc(x.kind) : 'Нов запис'}</h2><form>
    ${select('Вид', 'kind', EV_KINDS, x.kind)}
    ${field('Заглавие *', 'title', x.title, 'text', 'required')}
    <div class="grid2">${field('Дата', 'date', x.date, 'date')}${field('Час', 'time', x.time, 'time', 'id="etime"')}</div>
    <label class="switch"><input type="checkbox" name="allDay" id="eall" ${x.allDay ? 'checked' : ''}> Целодневно</label>
    <div class="grid2">${select('Важност', 'priority', ['нормална', 'висока'], x.priority)}
      ${select('Напомняне', 'remind', [['none', 'Без'], ['0', 'В момента'], ['5', '5 мин преди'], ['15', '15 мин преди'], ['30', '30 мин преди'], ['60', '1 час преди'], ['1440', '1 ден преди']], x.remind)}</div>
    ${select('Клиент', 'clientId', clientOpts(), x.clientId)}
    ${select('Оферта', 'offerId', [['', '—'], ...S.offers.map(o => [o.id, '№ ' + o.number + ' · ' + clientName(o.clientId)])], x.offerId)}
    ${field('Място', 'place', x.place)}
    ${area('Бележки', 'notes', x.notes)}
    <label class="switch"><input type="checkbox" name="done" ${x.done ? 'checked' : ''}> Изпълнено</label>
    ${formBtns(ev && ev.id)}</form>`, r => {
    const syncT = () => ($('#etime', r).disabled = $('#eall', r).checked); $('#eall', r).onchange = syncT; syncT();
    wireForm(r, async d => {
      if (!d.title) throw new Error('Въведете заглавие');
      if (d.allDay) d.time = '';
      const o = Object.assign(ev || { id: uid() }, d); await put('events', o); alerted.delete(o.id);
      await scheduleReminder(o); closeSheet(); render(); toast('Записано' + (reminderTime(o) && native() ? ' · напомняне ' + fmtDT(reminderTime(o)) : ''));
    }, async () => { await cancelReminder(ev); await del('events', ev.id); render(); });
  });
}

/* ---------- СЕДМИЧНИ ОТЧЕТИ ---------- */
const REPORT_FIELDS = { '': '— празно —', date: 'Дата', day: 'Ден от седмицата', client: 'Клиент', city: 'Град', contact: 'Лице за контакт', phone: 'Телефон',
  type: 'Вид (разговор, среща, оферта…)', description: 'Описание', result: 'Резултат', next: 'Следваща стъпка', offerNo: 'Оферта №', amount: 'Сума (€)', model: 'Техника', stage: 'Етап на сделка' };
function weekRange(anchor) { const d = new Date(anchor + 'T12:00'); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return [isoDate(mon), isoDate(sun)]; }
function reportRows(from, to) {
  const inR = s => s && s >= from && s <= to; const rows = [];
  const cinfo = id => { const c = get('clients', id) || {}; return { client: c.name || '', city: c.city || '', phone: c.phone || ((c.contacts || [])[0] || {}).phone || '' }; };
  S.activities.filter(a => inR(a.date)).forEach(a => rows.push({ date: a.date, ...cinfo(a.clientId), contact: a.contact || '', type: a.type, description: a.text || '', result: a.result || '', next: a.next || '', amount: a.amount || '', model: modelTitle(get('models', a.modelId)), stage: a.type === 'Сделка' ? a.stage || '' : '' }));
  S.events.filter(e => inR(e.date)).forEach(e => { const o = get('offers', e.offerId); rows.push({ date: e.date, ...cinfo(e.clientId), type: e.kind, description: e.title + (e.notes ? ' — ' + e.notes : ''), result: e.done ? 'Изпълнено' : 'Предстои', next: '', offerNo: o ? o.number : '' }); });
  S.offers.filter(o => inR(o.date)).forEach(o => rows.push({ date: o.date, ...cinfo(o.clientId), contact: o.contact || '', type: 'Оферта', description: o.items.map(i => i.name).join(', '), result: o.status, offerNo: o.number, amount: offerTotal(o), model: o.items.map(i => i.name).join(', ') }));
  rows.sort((a, b) => a.date.localeCompare(b.date)); rows.forEach(r => { r.day = DAYS[new Date(r.date + 'T12:00').getDay()]; r.date = fmtDate(r.date); });
  return rows;
}
let repAnchor = null;
function viewReports(v) {
  setChrome('Седмични отчети', 'more', true, null);
  repAnchor = repAnchor || todayISO(); const [from, to] = weekRange(repAnchor); const rows = reportRows(from, to);
  const tpl = setting('reportTemplate'); const map = setting('reportMap', []);
  const counts = rows.reduce((m, r) => (m[r.type] = (m[r.type] || 0) + 1, m), {});
  v.innerHTML = `<div class="row" style="margin-bottom:10px"><button class="icon-btn" id="pw"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg></button>
    <div class="grow" style="text-align:center;font-weight:700">${fmtDate(from)} – ${fmtDate(to)}</div><button class="icon-btn" id="nw"><svg viewBox="0 0 24 24"><path d="M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z"/></svg></button></div>
    <div class="chips">${Object.entries(counts).map(([k, n]) => `<span class="chip">${esc(k)}: ${n}</span>`).join('') || '<span class="chip">Няма записи</span>'}</div>
    <div class="card"><h3>Excel шаблон</h3>
      ${tpl ? `<div class="small">Зареден: <b>${esc(tpl.name)}</b> · лист „${esc(tpl.sheet)}“ · заглавен ред ${tpl.headerRow}</div>
        <div class="section-title" style="margin-top:12px">Кое поле в коя колона</div>
        <div class="mapgrid">${tpl.headers.map((h, i) => `<div class="small"><b>${esc(h.text)}</b></div><select class="i" data-map="${i}">${Object.entries(REPORT_FIELDS).map(([k, t]) => `<option value="${k}" ${(map[i] || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`).join('')}</div>
        <div class="btns"><button class="btn" id="expR" ${rows.length ? '' : 'disabled'}>Експорт на седмицата в Excel</button><button class="btn text" id="tplR">Смени шаблона</button></div>`
      : `<div class="small muted">Заредете вашия оригинален шаблон за седмичен отчет (.xlsx). Заглавията и оформлението се вземат от него — приложението не измисля колони.</div>
        <div class="btns"><button class="btn" id="tplR">Зареди шаблон</button></div>`}</div>
    <div class="section-title">Записи за седмицата (${rows.length})</div>
    ${rows.length ? `<div class="list">${rows.map(r => `<div class="item"><div class="grow"><div class="t">${esc(r.type)} · ${esc(r.client || '—')}</div><div class="s">${esc(r.date)} · ${esc(r.description)}</div></div></div>`).join('')}</div>` : empty('Няма активности, срещи или оферти през тази седмица.')}`;
  const sh = k => { const d = new Date(repAnchor + 'T12:00'); d.setDate(d.getDate() + 7 * k); repAnchor = isoDate(d); render(); };
  $('#pw').onclick = () => sh(-1); $('#nw').onclick = () => sh(1);
  $('#tplR').onclick = loadReportTemplate;
  $$('[data-map]', v).forEach(s => s.onchange = async () => { const m = setting('reportMap', []).slice(); m[+s.dataset.map] = s.value; await setSetting('reportMap', m); });
  const ex = $('#expR'); if (ex) ex.onclick = () => exportReport(from, to, rows).catch(e => toast('Грешка при експорт: ' + e.message, 5000));
}
async function loadReportTemplate() {
  const [f] = await pickFile('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); if (!f) return;
  try {
    const buf = await f.arrayBuffer(); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    const ws = wb.worksheets[0]; let headerRow = 0, headers = [];
    for (let r = 1; r <= Math.min(ws.rowCount, 25) && !headerRow; r++) {
      const row = ws.getRow(r); const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, col) => { const t = String(cell.text || '').trim(); if (t) cells.push({ col, text: t }); });
      if (cells.length >= 3) { headerRow = r; headers = cells; }
    }
    if (!headerRow) throw new Error('Не намерих заглавен ред (поне 3 попълнени клетки) в първите 25 реда.');
    const guess = h => { const t = h.toLowerCase(); for (const [k, re] of [['date', /дата/], ['day', /ден/], ['client', /клиент|фирма|контрагент/], ['contact', /лице|контакт/], ['city', /град|населено|област|регион/], ['type', /вид|тип|дейност|активност/], ['description', /описание|тема|съдържание|детайл/], ['result', /резултат|статус/], ['next', /следващ|стъпка|действие/], ['offerNo', /оферта/], ['amount', /сума|стойност|цена/], ['model', /техника|машина|модел|продукт/], ['phone', /телефон/]]) if (re.test(t)) return k; return ''; };
    await setSetting('reportTemplate', { name: f.name, sheet: ws.name, headerRow, headers, data: await blobToB64(new Blob([buf])) });
    await setSetting('reportMap', headers.map(h => guess(h.text)));
    toast(`Шаблонът е зареден: ${headers.length} колони. Проверете съответствието.`, 4000); render();
  } catch (e) { toast('Неуспешно четене на шаблона: ' + e.message, 6000); }
}
async function exportReport(from, to, rows) {
  const tpl = setting('reportTemplate'); const map = setting('reportMap', []);
  const bin = Uint8Array.from(atob(tpl.data), c => c.charCodeAt(0));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bin.buffer); const ws = wb.getWorksheet(tpl.sheet) || wb.worksheets[0];
  const styleRow = ws.getRow(tpl.headerRow + 1);
  // изчистване на стари данни под заглавието
  for (let r = tpl.headerRow + 1; r <= ws.rowCount; r++) tpl.headers.forEach(h => { ws.getRow(r).getCell(h.col).value = null; });
  const styles = tpl.headers.map(h => JSON.parse(JSON.stringify(styleRow.getCell(h.col).style || {})));
  rows.forEach((row, i) => {
    const R = ws.getRow(tpl.headerRow + 1 + i);
    tpl.headers.forEach((h, k) => { const key = map[k]; const cell = R.getCell(h.col); cell.value = key ? (key === 'amount' && row[key] !== '' ? +row[key] : row[key] ?? '') : null; if (styles[k] && Object.keys(styles[k]).length) cell.style = JSON.parse(JSON.stringify(styles[k])); });
    R.commit();
  });
  const out = await wb.xlsx.writeBuffer();
  await saveFile(`Седмичен_отчет_${fmtDate(from)}-${fmtDate(to)}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  toast('Отчетът е готов');
}

/* ---------- ИНФОРМАЦИЯ (само реални данни) ---------- */
const CACHE = {};
async function fetchJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
async function getWeather(force = false) {
  const key = setting('accuKey'); const loc = setting('accuLoc'); if (!key || !loc) return null;
  const c = CACHE.weather || setting('weatherCache'); const mins = +setting('weatherEvery', 15) || 15;
  if (!force && c && Date.now() - c.at < mins * 60000) return (CACHE.weather = c);
  const base = 'https://dataservice.accuweather.com'; const q = `apikey=${encodeURIComponent(key)}&language=bg&metric=true&details=true`;
  const [cur, hourly, daily] = await Promise.all([fetchJSON(`${base}/currentconditions/v1/${loc.key}?${q}`), fetchJSON(`${base}/forecasts/v1/hourly/12hour/${loc.key}?${q}`), fetchJSON(`${base}/forecasts/v1/daily/5day/${loc.key}?${q}`)]);
  const w = { at: Date.now(), loc, cur: cur[0], hourly: hourly.slice(0, 4), daily: daily.DailyForecasts };
  CACHE.weather = w; setSetting('weatherCache', w); return w;
}
async function getFx(force = false) {
  const c = CACHE.fx || setting('fxCache');
  if (!force && c && Date.now() - c.at < 3 * 3600000) return (CACHE.fx = c);
  const j = await fetchJSON('https://api.frankfurter.app/latest?from=EUR&to=USD');
  const fx = { at: Date.now(), date: j.date, usd: j.rates.USD }; CACHE.fx = fx; setSetting('fxCache', fx); return fx;
}
function weatherCard(w, full) {
  const cur = w.cur; const hrs = w.hourly.map(h => `<div class="d"><b>${new Date(h.DateTime).getHours()}:00</b>${Math.round(h.Temperature.Value)}°<div class="small">☔ ${h.PrecipitationProbability ?? '—'}%</div>${h.ThunderstormProbability != null ? `<div class="small">⚡ ${h.ThunderstormProbability}%</div>` : ''}</div>`).join('');
  const days = w.daily.map(d => `<div class="d"><b>${DAYS[new Date(d.Date).getDay()].slice(0, 3)}</b>${Math.round(d.Temperature.Minimum.Value)}° / ${Math.round(d.Temperature.Maximum.Value)}°<div class="small">☔ ${d.Day.PrecipitationProbability ?? '—'}%</div>${d.Day.ThunderstormProbability != null ? `<div class="small">⚡ ${d.Day.ThunderstormProbability}%</div>` : ''}</div>`).join('');
  return `<div class="card"><div class="row"><div class="grow"><b>${esc(w.loc.name)}</b> · ${Math.round(cur.Temperature.Metric.Value)}° · ${esc(cur.WeatherText)}
    ${cur.HasPrecipitation ? `<div class="small" style="color:var(--danger);font-weight:600">Вали в момента${cur.PrecipitationType ? ' (' + esc(cur.PrecipitationType) + ')' : ''}</div>` : ''}</div></div>
    <div class="section-title" style="margin-top:10px">Следващите 4 часа</div><div class="weather">${hrs}</div>
    ${full ? `<div class="section-title">5 дни</div><div class="weather">${days}</div>` : ''}
    <div class="banner-note">AccuWeather · обновено ${fmtDT(w.at)}</div></div>`;
}
async function renderInfoBanners(el) {
  if (!el) return; const parts = [];
  try { const w = await getWeather(); if (w) parts.push(weatherCard(w, false)); } catch (e) { /* без данни — не показваме банер */ }
  try { const fx = await getFx(); parts.push(`<div class="card row"><div class="grow"><b>EUR/USD ${fx.usd.toFixed(4)}</b><div class="banner-note">Референтен курс на ЕЦБ за ${fmtDate(fx.date)}</div></div></div>`); } catch (e) { }
  if (el.isConnected) el.innerHTML = parts.join('');
}
function viewInfo(v) {
  setChrome('Информация', 'more', true, null);
  const links = [['Пътна обстановка — АПИ', 'https://www.api.bg'], ['Обществени поръчки — ЦАИС ЕОП', 'https://app.eop.bg'], ['Европейски програми — eufunds.bg', 'https://www.eufunds.bg'],
    ['ИСУН 2020', 'https://eumis2020.government.bg'], ['Национален статистически институт', 'https://www.nsi.bg']];
  v.innerHTML = `<div id="w">${setting('accuKey') ? '<div class="card muted small">Зареждам времето…</div>' : `<div class="card"><h3>Време (AccuWeather)</h3><div class="small muted">Въведете API ключ и град в Настройки, за да се показва прогноза.</div><div class="btns"><a class="btn tonal" href="#/settings">Настройки</a></div></div>`}</div>
    <div id="fx"></div>
    <div class="section-title">Официални източници</div>
    <div class="list">${links.map(([t, u]) => `<a class="item" href="${u}" target="_blank" rel="noopener"><div class="grow"><div class="t">${t}</div><div class="s">${u}</div></div></a>`).join('')}</div>
    <div class="card small muted">Трафик с предупреждения и звук, тематични новини, злато, петрол и литий още не са свързани: нужен е избран източник с API. Приложението не показва измислени стойности.</div>`;
  if (setting('accuKey')) getWeather().then(w => { $('#w').innerHTML = w ? weatherCard(w, true) : ''; }).catch(e => { $('#w').innerHTML = `<div class="card small">Времето не може да се зареди: ${esc(e.message)}</div>`; });
  getFx().then(fx => { $('#fx').innerHTML = `<div class="card"><b>EUR/USD ${fx.usd.toFixed(4)}</b><div class="banner-note">Референтен курс на ЕЦБ за ${fmtDate(fx.date)} (източник: Frankfurter / ЕЦБ)</div></div>`; }).catch(() => { });
}

/* ---------- НАСТРОЙКИ, ИМПОРТ, АРХИВ ---------- */
function viewSettings(v) {
  setChrome('Настройки и архив', 'more', true, null);
  const p = profile(); const loc = setting('accuLoc');
  v.innerHTML = `
    <div class="card"><h3>Импорт на клиенти от Excel</h3><div class="small muted">.xlsx, .xls или .csv. След избор ще посочите кои колони какво съдържат. Дубликати (същ ЕИК или име) се пропускат.</div>
      <div class="btns"><button class="btn" id="impC">Избери файл</button></div></div>
    <div class="card"><h3>Архив</h3><div class="small muted">Пълен архив на всички данни (клиенти, оферти, календар, каталог със снимки). Правете архив преди обновяване на приложението.</div>
      <div class="btns"><button class="btn" id="bak">Създай архив</button><button class="btn tonal" id="rst">Възстанови от архив</button></div>
      ${setting('lastBackup') ? `<div class="banner-note">Последен архив: ${fmtDT(setting('lastBackup'))}</div>` : ''}</div>
    <div class="card"><h3>Подпис в офертите</h3><form id="pf">
      <div class="grid2">${field('Име за поздрав', 'firstName', p.firstName ?? 'Николай')}${field('Име и фамилия', 'name', p.name ?? 'Николай Герчев')}</div>
      ${field('Длъжност', 'title', p.title ?? 'Търговски мениджър Северна България')}
      ${field('Фирма', 'company', p.company ?? 'Екосол България АД')}
      <div class="grid2">${field('Телефон', 'phone', p.phone)}${field('Имейл', 'email', p.email, 'email')}</div>
      <div class="btns"><button class="btn" type="submit">Запази</button></div></form></div>
    <div class="card"><h3>Време — AccuWeather</h3><div class="small muted">Нужен е ключ от developer.accuweather.com. Безплатният план има ограничен брой заявки на ден — обновяване през 15 минути изисква платен план; при безплатен изберете по-рядко.</div>
      <form id="wf" style="margin-top:10px">${field('API ключ', 'key', setting('accuKey', ''))}${field('Град', 'city', loc ? loc.name : '', 'text', 'placeholder="напр. Русе"')}
      ${select('Обновяване', 'every', [['15', 'на 15 мин'], ['30', 'на 30 мин'], ['60', 'на 1 час'], ['180', 'на 3 часа']], setting('weatherEvery', '15'))}
      <div class="btns"><button class="btn" type="submit">Запази и провери</button></div></form></div>
    <div class="card"><h3>Известия</h3><div class="small muted">Проверка дали напомнянията звънят (и при затворено приложение).</div>
      <div class="btns"><button class="btn tonal" id="tn">Тестово известие след 10 сек</button></div></div>
    <div class="card small muted">Техника за обекта · версия 1.0 · данните се пазят само на това устройство.</div>`;
  $('#impC').onclick = importClients;
  $('#bak').onclick = backup; $('#rst').onclick = restore;
  $('#pf').onsubmit = async e => { e.preventDefault(); await setSetting('profile', formData(e.target)); toast('Запазено'); };
  $('#wf').onsubmit = async e => {
    e.preventDefault(); const d = formData(e.target);
    await setSetting('accuKey', d.key); await setSetting('weatherEvery', d.every);
    if (!d.key || !d.city) { toast('Въведете ключ и град'); return; }
    try {
      const r = await fetchJSON(`https://dataservice.accuweather.com/locations/v1/cities/search?apikey=${encodeURIComponent(d.key)}&q=${encodeURIComponent(d.city)}&language=bg`);
      const bg = r.find(x => x.Country && x.Country.ID === 'BG') || r[0]; if (!bg) throw new Error('Градът не е намерен');
      await setSetting('accuLoc', { key: bg.Key, name: bg.LocalizedName }); await setSetting('weatherCache', null); CACHE.weather = null;
      await getWeather(true); toast('Времето работи: ' + bg.LocalizedName);
    } catch (err) { toast('Проверката не успя: ' + err.message, 5000); }
  };
  $('#tn').onclick = async () => {
    const LN = P('LocalNotifications');
    if (native() && LN) { if (!(await ensureNotifyPermission())) { toast('Известията са забранени в настройките на телефона', 4000); return; } await LN.schedule({ notifications: [{ id: 777, title: 'Тест: Техника за обекта', body: 'Напомнянията работят ✔', schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }, channelId: 'reminders' }] }); toast('Затворете приложението — известието идва след 10 сек'); }
    else { await ensureNotifyPermission(); setTimeout(() => { beep(3); if ('Notification' in window && Notification.permission === 'granted') new Notification('Тест: Техника за обекта'); toast('⏰ Тестово напомняне'); }, 10000); toast('След 10 сек (в браузъра работи само при отворена страница)'); }
  };
}
async function importClients() {
  const [f] = await pickFile('.xlsx,.xls,.csv'); if (!f) return;
  let rows;
  try { const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }); }
  catch (e) { toast('Файлът не може да се прочете: ' + e.message, 5000); return; }
  let hr = rows.findIndex(r => r.filter(c => String(c).trim()).length >= 2); if (hr < 0) { toast('Файлът е празен'); return; }
  const heads = rows[hr].map((h, i) => String(h || '').trim() || `Колона ${i + 1}`);
  const FIELDS = { name: ['Фирма *', /фирма|клиент|име на фирма|наименование|контрагент|company/i], eik: ['ЕИК', /еик|булстат|eik/i], city: ['Град', /град|населено|city/i], address: ['Адрес', /адрес/i],
    phone: ['Телефон', /телефон|тел|gsm|phone/i], email: ['Имейл', /mail|имейл|e-mail/i], contact: ['Лице за контакт', /лице|контакт|управител/i], role: ['Длъжност', /длъжност|позиция/i],
    abc: ['ABC категория', /abc|категор|клас|приоритет/i], nextAction: ['Следващо действие', /следващ|действие/i], product: ['Препоръчан продукт', /продукт|техника/i], notes: ['Бележки', /бележ|коментар|notes/i] };
  const guess = Object.fromEntries(Object.entries(FIELDS).map(([k, [, re]]) => [k, heads.findIndex(h => re.test(h))]));
  if (guess.contact === guess.name) guess.contact = -1;
  openSheet(`<h2>Импорт: ${esc(f.name)}</h2><div class="small muted" style="margin-bottom:10px">${rows.length - hr - 1} реда · посочете колоните</div><form>
    <div class="mapgrid">${Object.entries(FIELDS).map(([k, [t]]) => `<div class="small"><b>${t}</b></div><select class="i" name="${k}"><option value="-1">—</option>${heads.map((h, i) => `<option value="${i}" ${guess[k] === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`).join('')}</div>
    <div class="btns"><button class="btn" type="submit">Импортирай</button><button class="btn text" type="button" data-close>Отказ</button></div></form>`, r => {
    wireForm(r, async m => {
      if (+m.name < 0) throw new Error('Изберете колоната с името на фирмата');
      const col = (row, k) => (+m[k] >= 0 ? String(row[+m[k]] ?? '').trim() : '');
      const byEik = new Map(S.clients.filter(c => c.eik).map(c => [c.eik, c])); const byName = new Map(S.clients.map(c => [norm(c.name), c]));
      let added = 0, dup = 0, emptyN = 0; const out = [];
      for (const row of rows.slice(hr + 1)) {
        const name = col(row, 'name'); if (!name) { emptyN++; continue; }
        const eik = col(row, 'eik').replace(/\s/g, ''); const key = norm(name);
        if ((eik && byEik.has(eik)) || byName.has(key)) { dup++; continue; }
        let abc = col(row, 'abc').toUpperCase().trim(); abc = /^[ABCD]/.test(abc) ? abc[0] : ({ 'А': 'A', 'В': 'B', 'С': 'C' }[abc[0]] || '');
        const c = { id: uid(), name, eik, city: col(row, 'city'), address: col(row, 'address'), phone: col(row, 'phone'), email: col(row, 'email'), abc,
          nextAction: col(row, 'nextAction'), product: col(row, 'product'), notes: col(row, 'notes'), contacts: col(row, 'contact') ? [{ name: col(row, 'contact'), role: col(row, 'role'), phone: '', email: '' }] : [],
          createdAt: Date.now(), updatedAt: Date.now(), source: f.name };
        out.push(c); if (eik) byEik.set(eik, c); byName.set(key, c); added++;
      }
      await putMany('clients', out); closeSheet();
      openSheet(`<h2>Импортът приключи</h2><div class="card"><dl class="kv"><dt>Добавени</dt><dd>${added}</dd><dt>Пропуснати дубликати</dt><dd>${dup}</dd><dt>Редове без име</dt><dd>${emptyN}</dd></dl></div><a class="btn block" href="#/clients">Към клиентите</a>`);
    });
  });
}
async function backup() {
  const data = { app: 'tehnika-za-obekta', version: 1, at: new Date().toISOString(), ...Object.fromEntries(STORES.map(s => [s, S[s].filter(x => !(s === 'settings' && /Cache$/.test(x.id)))])) };
  await saveFile(`Техника_за_обекта_архив_${todayISO()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  await setSetting('lastBackup', Date.now()); render();
}
async function restore() {
  const [f] = await pickFile('.json,application/json'); if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if (d.app !== 'tehnika-za-obekta') throw new Error('Това не е архив от приложението');
    const counts = STORES.filter(s => s !== 'settings').map(s => `${s}: ${(d[s] || []).length}`).join(', ');
    if (!confirm(`Архив от ${d.at}\n${counts}\n\nЗаписите от архива ще се добавят/обновят (нищо не се изтрива). Продължаване?`)) return;
    for (const s of STORES) if (Array.isArray(d[s])) await putMany(s, d[s]);
    for (const ev of S.events) await scheduleReminder(ev);
    toast('Архивът е възстановен'); render();
  } catch (e) { toast('Неуспешно възстановяване: ' + e.message, 5000); }
}

/* ---------- старт ---------- */
(async function start() {
  try { idb = await openDB(); await loadAll(); await ensureBrands(); }
  catch (e) { $('#view').innerHTML = `<div class="card">Базата не може да се отвори: ${esc(e.message)}</div>`; return; }
  await initNotifications();
  const App = P('App');
  if (App) App.addListener('backButton', () => { if (!$('#sheet').hidden) closeSheet(); else if (location.hash && location.hash !== '#/') history.back(); else App.exitApp(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  if (!native() && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  render(); setInterval(tickDue, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
})();
function greet() { const h = new Date().getHours(); return h < 5 ? 'Добра нощ' : h < 11 ? 'Добро утро' : h < 18 ? 'Добър ден' : 'Добър вечер'; }
