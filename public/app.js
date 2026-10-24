/* ReceiptSafe (cloud): students sign in, admins review. Data lives in Supabase. */
(() => {
'use strict';

const BUCKET = 'receipts';
const CATEGORIES = ['Tuition', 'Laboratory Fee', 'School Activity', 'Organization Fee', 'Books & Uniform', 'Exam Fee', 'Other'];
const STATUS = {
  pending: { label: 'Pending review', cls: 'unverified' },
  verified: { label: 'Verified', cls: 'ok' },
  rejected: { label: 'Rejected', cls: 'bad' }
};

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}
function ask(msg, ok = 'OK', danger = true) {
  return new Promise(res => {
    const d = $('#dlg');
    d.innerHTML = `<p style="margin:0 0 16px">${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" id="no" style="color:var(--ink)">Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="yes">${esc(ok)}</button></div>`;
    const done = v => { d.close(); res(v); };
    $('#yes').onclick = () => done(true); $('#no').onclick = () => done(false);
    d.oncancel = () => res(false);
    d.showModal();
  });
}
function compress(file, max = 1600, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(url); b ? res(b) : rej(new Error('Could not process the image')); }, 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a readable image')); };
    img.src = url;
  });
}
const blobUrls = [];
const localUrl = b => { const u = URL.createObjectURL(b); blobUrls.push(u); return u; };
const freeUrls = () => { while (blobUrls.length) URL.revokeObjectURL(blobUrls.pop()); };
const errText = e => (e && (e.message || e.error_description)) || 'Something went wrong. Please try again.';

/* ---------- Supabase ---------- */
let sb, session = null, profile = null, recovery = false;

async function boot() {
  let cfg;
  try {
    const r = await fetch('/api/config', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    cfg = await r.json();
    if (!window.supabase) throw new Error();
  } catch {
    view.innerHTML = `<div class="card empty">Cannot reach the server. Check your internet connection and reload.</div>`;
    return;
  }
  sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((event, s) => {
    const was = session?.user?.id;
    session = s;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') { profile = null; urlCache.clear(); }
    if (was !== s?.user?.id || event === 'PASSWORD_RECOVERY') { profile = null; setTimeout(render, 0); }
  });
  render();
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error) throw error;
  profile = data || { id: session.user.id, role: 'student', student_id: '', full_name: '' };
}

const urlCache = new Map();
async function signed(paths) {
  const need = [...new Set(paths.filter(p => p && !urlCache.has(p)))];
  if (!need.length) return;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
  if (!error) data.forEach(d => { if (d.signedUrl) urlCache.set(d.path, d.signedUrl); });
}

/* ---------- shell ---------- */
const ICONS = {
  home: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  list: 'M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-3.3 0-9 1.7-9 5v2h18v-2c0-3.3-5.7-5-9-5Z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z'
};
const tabIcon = p => `<svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="${p}"/></svg>`;

function shell(path) {
  const admin = profile?.role === 'admin';
  const tabs = admin
    ? [['#/review', 'Review', ICONS.check, 'review'], ['#/account', 'Account', ICONS.user, 'account']]
    : [['#/', 'Dashboard', ICONS.home, ''], ['#/receipts', 'Receipts', ICONS.list, 'receipts'], ['#/account', 'Account', ICONS.user, 'account']];
  const bar = $('#tabbar');
  bar.hidden = false;
  bar.innerHTML = tabs.map(([h, l, i]) => `<button class="tab" data-route="${h}">${tabIcon(i)}${l}</button>`).join('');
  bar.querySelectorAll('.tab').forEach(t => {
    const key = tabs.find(x => x[0] === t.dataset.route)[3];
    const on = key === path || (path === 'receipt' && key === (admin ? 'review' : 'receipts')) || (path === 'edit' && key === 'receipts');
    t.classList.toggle('on', on);
    t.onclick = () => { location.hash = t.dataset.route; };
  });
  $('#fab').hidden = admin || path === 'add' || path === 'edit' || path === 'account';
  const chip = $('#chip');
  chip.hidden = false;
  chip.innerHTML = `<b>${esc(profile.full_name || session.user.email)}</b>${admin ? 'Admin' : esc(profile.student_id || 'Student')}`;
}
function bareShell() { $('#tabbar').hidden = true; $('#fab').hidden = true; $('#chip').hidden = true; }
$('#fab').addEventListener('click', () => { location.hash = '#/add'; });

/* ---------- router ---------- */
const student = {}, admin = {};
async function render() {
  freeUrls();
  if (!sb) return;
  try {
    if (recovery) return recoveryView();
    if (!session) { bareShell(); return authView(); }
    if (!profile) await loadProfile();
    const isAdmin = profile.role === 'admin';
    const [, path, arg] = (location.hash || '').split('?')[0].match(/^#\/([^/]*)\/?(.*)$/) || [, '', ''];
    const routes = isAdmin ? admin : student;
    const key = path === '' && isAdmin ? 'review' : path;
    shell(key);
    const fn = routes[key] || (isAdmin ? admin.review : student['']);
    view.innerHTML = `<div class="spin">Loading…</div>`;
    await fn(decodeURIComponent(arg));
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card">Something went wrong: ${esc(errText(e))}<div class="row" style="margin-top:12px"><button class="btn small" id="retry">Try again</button></div></div>`;
    $('#retry').onclick = render;
  }
}
window.addEventListener('hashchange', render);

/* ---------- auth ---------- */
function authView(mode = 'login') {
  view.innerHTML = `
  <div class="auth">
    <div class="seg" role="tablist">
      <button class="${mode === 'login' ? 'on' : ''}" data-m="login">Log in</button>
      <button class="${mode === 'register' ? 'on' : ''}" data-m="register">Register</button>
    </div>
    <form id="af" class="card" novalidate>
      ${mode === 'register' ? `
        <label for="fn">Full name</label><input id="fn" autocomplete="name" required maxlength="80">
        <label for="sid">Student ID number</label><input id="sid" autocomplete="off" required maxlength="30" placeholder="e.g. 2022-01234">` : ''}
      <label for="em">Email</label><input id="em" type="email" autocomplete="email" required>
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="8">
      ${mode === 'register' ? '<div class="note">At least 8 characters.</div>' : ''}
      <div id="err" class="err" role="alert"></div>
      <div class="row" style="margin-top:14px"><button class="btn" type="submit" id="go" style="flex:1">${mode === 'login' ? 'Log in' : 'Create account'}</button></div>
      ${mode === 'login' ? '<p style="margin:12px 0 0"><button type="button" class="linkbtn" id="forgot">Forgot password?</button></p>' : ''}
    </form>
    <p class="note" style="text-align:center">Your receipts are private. Only you and school cashier staff can see them.</p>
  </div>`;
  view.querySelectorAll('.seg button').forEach(b => b.onclick = () => authView(b.dataset.m));
  const err = t => $('#err').textContent = t;
  const busy = v => { $('#go').disabled = v; };
  if (mode === 'login') $('#forgot').onclick = async () => {
    const email = $('#em').value.trim();
    if (!email) return err('Enter your email first, then tap "Forgot password?".');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
    err(''); toast(error ? errText(error) : 'If that email has an account, a reset link is on its way.');
  };
  $('#af').addEventListener('submit', async e => {
    e.preventDefault(); err('');
    const email = $('#em').value.trim(), password = $('#pw').value;
    if (!email || !password) return err('Enter your email and password.');
    busy(true);
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(/confirm/i.test(error.message) ? 'Confirm your email first. Check your inbox for the link.' : 'Wrong email or password.');
      } else {
        const full_name = $('#fn').value.trim(), student_id = $('#sid').value.trim();
        if (!full_name || !student_id) throw new Error('Enter your full name and student ID.');
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name, student_id }, emailRedirectTo: location.origin + '/' } });
        if (error) throw new Error(/database error/i.test(error.message) ? 'That student ID is already registered.' : error.message);
        if (!data.session) { authView('login'); toast('Account created. Check your email to confirm it, then log in.'); return; }
      }
    } catch (x) { err(errText(x)); busy(false); }
  });
}

function recoveryView() {
  bareShell();
  view.innerHTML = `<div class="auth"><form id="rf" class="card" novalidate>
    <h2 style="margin-top:0">Choose a new password</h2>
    <label for="np">New password</label><input id="np" type="password" autocomplete="new-password" minlength="8" required>
    <div id="err" class="err" role="alert"></div>
    <div class="row" style="margin-top:14px"><button class="btn" type="submit">Save password</button></div></form></div>`;
  $('#rf').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#np').value;
    if (pw.length < 8) return $('#err').textContent = 'Use at least 8 characters.';
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return $('#err').textContent = errText(error);
    recovery = false; toast('Password updated'); render();
  });
}

/* ---------- shared pieces ---------- */
const statusOf = r => STATUS[String(r.status || '').toLowerCase()] || STATUS.pending;
const pill = r => `<span class="pill ${statusOf(r).cls}">${statusOf(r).label}</span>`;
function itemHTML(r, who) {
  const u = urlCache.get(r.image_path);
  const thumb = u ? `<img class="thumb" alt="" src="${esc(u)}">` : `<div class="thumb">No photo</div>`;
  return `<button class="item" data-id="${r.id}">${thumb}
    <div class="mid"><div class="t">${esc(r.description)}</div>
    <div class="s">${who ? esc(who) + ' · ' : ''}${fmtDate(r.paid_on)} · ${esc(r.category)}</div>
    <div class="s">${pill(r)}${r.receipt_no ? 'No. ' + esc(r.receipt_no) : ''}</div></div>
    <div class="amt">${peso(r.amount)}</div></button>`;
}
function bindItems(root = view) {
  root.querySelectorAll('.item').forEach(b => b.onclick = () => { location.hash = '#/receipt/' + b.dataset.id; });
}
async function myReceipts() {
  const { data, error } = await sb.from('receipts').select('*').order('paid_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  await signed(data.map(r => r.image_path));
  return data;
}

/* ---------- student ---------- */
student[''] = async () => {
  const rs = await myReceipts();
  const total = rs.reduce((s, r) => s + Number(r.amount), 0);
  const c = s => rs.filter(r => r.status === s).length;
  const byCat = {};
  rs.forEach(r => byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  view.innerHTML = `
    <h2 style="margin-top:4px">Welcome back${profile.full_name ? ', ' + esc(profile.full_name.split(' ')[0]) : ''}</h2>
    ${c('rejected') ? `<button class="banner" id="rej">${c('rejected')} receipt${c('rejected') > 1 ? 's were' : ' was'} rejected. Tap to see why and fix ${c('rejected') > 1 ? 'them' : 'it'}.</button>` : ''}
    <div class="grid four">
      <div class="card stat"><div class="n">${peso(total)}</div><div class="l">Total recorded</div></div>
      <div class="card stat"><div class="n">${rs.length}</div><div class="l">Receipts</div></div>
      <div class="card stat"><div class="n">${c('verified')}</div><div class="l">Verified</div></div>
      <div class="card stat"><div class="n">${c('pending')}</div><div class="l">Pending review</div></div>
    </div>
    ${cats.length ? `<h2>By category</h2><div class="card">${cats.map(([k, v]) => `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${esc(k)}</span><b>${peso(v)}</b></div>`).join('')}</div>` : ''}
    <h2>Recent receipts</h2>
    ${rs.length ? `<div class="list">${rs.slice(0, 5).map(r => itemHTML(r)).join('')}</div>` : `<div class="card empty">No receipts yet.<br>Tap <b>+ Add Receipt</b> after your next payment.</div>`}`;
  bindItems();
  const rj = $('#rej'); if (rj) rj.onclick = () => { location.hash = '#/receipts?rejected'; };
};

student['receipts'] = async () => {
  const rs = await myReceipts();
  const preset = location.hash.includes('?rejected') ? 'rejected' : '';
  view.innerHTML = `
    <h2 style="margin-top:4px">Receipts</h2>
    <div class="filters">
      <input id="q" class="full" type="search" placeholder="Search description or receipt no." aria-label="Search">
      <select id="fc" aria-label="Category"><option value="">All categories</option>${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <select id="fst" aria-label="Status"><option value="">Any status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === preset ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <div><label for="fd1" style="margin-top:0">From</label><input id="fd1" type="date"></div>
      <div><label for="fd2" style="margin-top:0">To</label><input id="fd2" type="date"></div>
      <select id="fs" class="full" aria-label="Sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="hi">Highest amount</option></select>
    </div>
    <div id="out" class="list"></div>`;
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), c = $('#fc').value, st = $('#fst').value, d1 = $('#fd1').value, d2 = $('#fd2').value, s = $('#fs').value;
    const list = rs.filter(r =>
      (!q || (r.description + ' ' + (r.receipt_no || '') + ' ' + r.category).toLowerCase().includes(q)) &&
      (!c || r.category === c) && (!st || r.status === st) && (!d1 || r.paid_on >= d1) && (!d2 || r.paid_on <= d2));
    if (s === 'old') list.reverse(); else if (s === 'hi') list.sort((a, b) => b.amount - a.amount);
    $('#out').innerHTML = list.length ? list.map(r => itemHTML(r)).join('') : `<div class="card empty">No matching receipts.</div>`;
    bindItems($('#out'));
  };
  $('.filters').addEventListener('input', draw); $('.filters').addEventListener('change', draw);
  draw();
};

async function getReceipt(id) {
  const { data, error } = await sb.from('receipts').select('*, profiles(student_id, full_name)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (data) await signed([data.image_path]);
  return data;
}
function details(r, showWho) {
  const p = r.profiles || {};
  return `
    <h2 style="margin:0 0 4px">${esc(r.description)}</h2>
    <div style="font-size:1.6rem;font-weight:800;color:var(--brand)">${peso(r.amount)}</div>
    <dl class="kv">
      ${showWho ? `<dt>Student</dt><dd>${esc(p.full_name || '—')}<br><span class="note">${esc(p.student_id || '')}</span></dd>` : ''}
      <dt>Date paid</dt><dd>${fmtDate(r.paid_on)}</dd>
      <dt>Category</dt><dd>${esc(r.category)}</dd>
      <dt>Receipt no.</dt><dd>${esc(r.receipt_no) || '—'}</dd>
      <dt>Status</dt><dd>${pill(r)}</dd>
      ${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ''}
    </dl>
    ${r.status === 'rejected' && r.review_note ? `<div class="note-box"><b>Reason:</b> ${esc(r.review_note)}</div>` : ''}
    ${r.status === 'verified' ? `<p class="note">Verified ${r.reviewed_at ? fmtDate(r.reviewed_at.slice(0, 10)) : ''}${r.review_note ? ': ' + esc(r.review_note) : ''}</p>` : ''}
    ${r.image_path && urlCache.get(r.image_path) ? `<img class="preview" id="pimg" alt="Receipt photo" src="${esc(urlCache.get(r.image_path))}">` : '<p class="note">No photo attached.</p>'}`;
}
async function downloadPhoto(r) {
  const resp = await fetch(urlCache.get(r.image_path));
  const b = await resp.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = `${r.paid_on}_${r.description}`.replace(/[^\w.-]+/g, '_') + '.jpg'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

student['receipt'] = async id => {
  const r = await getReceipt(id);
  if (!r) { view.innerHTML = `<div class="card empty">Receipt not found.</div>`; return; }
  const locked = r.status === 'verified';
  view.innerHTML = `
    <div class="row noprint" style="margin-bottom:8px"><button class="btn small ghost" id="back" style="color:var(--ink)">← Back</button></div>
    <div class="card">${details(r, false)}
      <div class="row noprint" style="margin-top:14px">
        ${r.image_path ? '<button class="btn" id="dl">Download</button><button class="btn sec" id="pr">Print</button>' : ''}
        ${locked ? '' : '<button class="btn sec" id="ed">Edit</button><button class="btn danger" id="rm">Delete</button>'}
      </div>
      ${locked ? '<p class="note">Verified receipts are locked. Ask the cashier\'s office if something is wrong.</p>' : r.status === 'rejected' ? '<p class="note">Fix the problem and tap Edit. It goes back to the cashier for review.</p>' : ''}
    </div>`;
  $('#back').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/receipts');
  if (r.image_path) {
    $('#dl').onclick = () => downloadPhoto(r).catch(() => toast('Could not download the photo'));
    $('#pr').onclick = () => window.print();
  }
  if (!locked) {
    $('#ed').onclick = () => { location.hash = '#/edit/' + r.id; };
    $('#rm').onclick = async () => {
      if (!await ask('Delete this receipt? This cannot be undone.', 'Delete')) return;
      const { error } = await sb.from('receipts').delete().eq('id', r.id);
      if (error) return toast(errText(error));
      if (r.image_path) await sb.storage.from(BUCKET).remove([r.image_path]);
      toast('Receipt deleted'); location.hash = '#/receipts';
    };
  }
};

function form(existing) {
  const r = existing || { description: '', amount: '', paid_on: todayISO(), category: CATEGORIES[2], receipt_no: '', notes: '' };
  view.innerHTML = `
    <h2 style="margin-top:4px">${existing ? 'Edit receipt' : 'Add receipt'}</h2>
    <form id="f" class="card" novalidate>
      <label for="desc">Payment description</label>
      <input id="desc" required maxlength="120" placeholder="e.g. Sports Fest Fee" value="${esc(r.description)}">
      <label for="amt">Amount (₱)</label>
      <input id="amt" required type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="150.00" value="${esc(r.amount)}">
      <label for="date">Date of payment</label>
      <input id="date" required type="date" max="${todayISO()}" value="${esc(r.paid_on)}">
      <label for="cat">Payment category</label>
      <select id="cat">${CATEGORIES.map(c => `<option ${c === r.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label for="no">Receipt number <span class="note">(as printed on the receipt)</span></label>
      <input id="no" maxlength="40" value="${esc(r.receipt_no)}">
      <label for="notes">Notes <span class="note">(optional)</span></label>
      <textarea id="notes" rows="2" maxlength="300">${esc(r.notes)}</textarea>
      <label for="photo">Receipt photo</label>
      <input id="photo" type="file" accept="image/*" capture="environment">
      <img id="pv" class="preview" alt="" ${existing && urlCache.get(existing.image_path) ? `src="${esc(urlCache.get(existing.image_path))}"` : 'hidden'}>
      <div id="err" class="err" role="alert"></div>
      <div class="row" style="margin-top:16px"><button class="btn" type="submit" id="save">${existing ? 'Save and resubmit' : 'Submit receipt'}</button>
        <button class="btn ghost" type="button" id="cancel" style="color:var(--ink)">Cancel</button></div>
    </form>
    <p class="note">The cashier's office reviews every receipt. Your receipt stays "Pending review" until then.</p>`;
  let pending = null;
  $('#photo').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { pending = await compress(f); $('#pv').src = localUrl(pending); $('#pv').hidden = false; $('#err').textContent = ''; }
    catch (x) { $('#err').textContent = errText(x); }
  });
  $('#cancel').onclick = () => history.back();
  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const err = t => { $('#err').textContent = t; };
    const description = $('#desc').value.trim(), amount = parseFloat($('#amt').value), paid_on = $('#date').value;
    if (!description) return err('Please enter a description.');
    if (!(amount > 0)) return err('Please enter an amount greater than zero.');
    if (!paid_on) return err('Please choose the payment date.');
    if (!existing && !pending) return err('Please add a photo of the receipt.');
    const row = { description, amount: Math.round(amount * 100) / 100, paid_on, category: $('#cat').value, receipt_no: $('#no').value.trim() || null, notes: $('#notes').value.trim() || null };
    $('#save').disabled = true;
    try {
      if (!existing) {
        const { data: mine } = await sb.from('receipts').select('description,amount,paid_on,category,receipt_no');
        const same = (mine || []).find(x => (row.receipt_no && x.receipt_no === row.receipt_no) ||
          (Number(x.amount) === row.amount && x.paid_on === paid_on && x.category === row.category));
        if (same && !await ask(`A similar receipt already exists ("${same.description}", ${peso(same.amount)}). Save anyway?`, 'Save anyway', false)) { $('#save').disabled = false; return; }
      }
      let newPath = null;
      if (pending) {
        newPath = `${session.user.id}/${uid()}.jpg`;
        const up = await sb.storage.from(BUCKET).upload(newPath, pending, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        row.image_path = newPath;
      }
      let id;
      if (existing) {
        const { error } = await sb.from('receipts').update(row).eq('id', existing.id);
        if (error) { if (newPath) await sb.storage.from(BUCKET).remove([newPath]); throw error; }
        if (newPath && existing.image_path) await sb.storage.from(BUCKET).remove([existing.image_path]);
        id = existing.id;
      } else {
        const { data, error } = await sb.from('receipts').insert({ ...row, user_id: session.user.id }).select('id').single();
        if (error) { if (newPath) await sb.storage.from(BUCKET).remove([newPath]); throw error; }
        id = data.id;
      }
      toast(existing ? 'Receipt resubmitted' : 'Receipt submitted for review');
      location.replace('#/receipt/' + id);
    } catch (x) { err('Could not save: ' + errText(x)); $('#save').disabled = false; }
  });
}
student['add'] = async () => form(null);
student['edit'] = async id => {
  const r = await getReceipt(id);
  if (!r || r.status === 'verified') { location.hash = '#/receipts'; return; }
  form(r);
};

/* ---------- admin ---------- */
admin['review'] = async () => {
  view.innerHTML = `
    <h2 style="margin-top:4px">Review receipts</h2>
    <div class="grid four" id="stats"></div>
    <div class="filters">
      <input id="q" class="full" type="search" placeholder="Search student ID, name, or receipt no." aria-label="Search">
      <select id="fst" aria-label="Status"><option value="pending">Pending review</option><option value="">Any status</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
      <select id="fc" aria-label="Category"><option value="">All categories</option>${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <div><label for="fd1" style="margin-top:0">From</label><input id="fd1" type="date"></div>
      <div><label for="fd2" style="margin-top:0">To</label><input id="fd2" type="date"></div>
    </div>
    <div class="row" style="margin-bottom:10px"><button class="btn small sec" id="csv">Export CSV</button><span class="note" id="count"></span></div>
    <div id="out" class="list"><div class="spin">Loading…</div></div>`;
  const { data, error } = await sb.from('receipts').select('*, profiles(student_id, full_name)').order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  await signed(data.slice(0, 200).map(r => r.image_path));
  const n = s => data.filter(r => r.status === s).length;
  $('#stats').innerHTML = `
    <div class="card stat"><div class="n">${n('pending')}</div><div class="l">Pending review</div></div>
    <div class="card stat"><div class="n">${n('verified')}</div><div class="l">Verified</div></div>
    <div class="card stat"><div class="n">${n('rejected')}</div><div class="l">Rejected</div></div>
    <div class="card stat"><div class="n">${peso(data.filter(r => r.status === 'verified').reduce((s, r) => s + Number(r.amount), 0))}</div><div class="l">Verified total</div></div>`;
  let shown = [];
  const draw = async () => {
    const q = $('#q').value.trim().toLowerCase(), st = $('#fst').value, c = $('#fc').value, d1 = $('#fd1').value, d2 = $('#fd2').value;
    shown = data.filter(r => {
      const p = r.profiles || {};
      return (!st || r.status === st) && (!c || r.category === c) && (!d1 || r.paid_on >= d1) && (!d2 || r.paid_on <= d2) &&
        (!q || ((p.student_id || '') + ' ' + (p.full_name || '') + ' ' + (r.receipt_no || '') + ' ' + r.description).toLowerCase().includes(q));
    });
    await signed(shown.slice(0, 100).map(r => r.image_path));
    $('#count').textContent = `${shown.length} receipt${shown.length === 1 ? '' : 's'}`;
    $('#out').innerHTML = shown.length ? shown.slice(0, 100).map(r => itemHTML(r, (r.profiles?.student_id || '?') + ' ' + (r.profiles?.full_name || ''))).join('') + (shown.length > 100 ? '<p class="note">Showing the first 100. Narrow the filters or export the CSV.</p>' : '') : `<div class="card empty">Nothing to review here.</div>`;
    bindItems($('#out'));
  };
  $('.filters').addEventListener('input', draw); $('.filters').addEventListener('change', draw);
  $('#csv').onclick = async () => {
    const qs = new URLSearchParams();
    if ($('#fst').value) qs.set('status', $('#fst').value);
    if ($('#fd1').value) qs.set('from', $('#fd1').value);
    if ($('#fd2').value) qs.set('to', $('#fd2').value);
    try {
      const resp = await fetch('/api/admin/export.csv?' + qs, { headers: { Authorization: 'Bearer ' + session.access_token } });
      if (!resp.ok) throw new Error(resp.status === 403 ? 'Only admins can export.' : 'Export failed. Try again.');
      const b = await resp.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `receipts-${todayISO()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (x) { toast(errText(x)); }
  };
  draw();
};

admin['receipt'] = async id => {
  const r = await getReceipt(id);
  if (!r) { view.innerHTML = `<div class="card empty">Receipt not found.</div>`; return; }
  view.innerHTML = `
    <div class="row" style="margin-bottom:8px"><button class="btn small ghost" id="back" style="color:var(--ink)">← Back</button></div>
    <div class="card">${details(r, true)}
      <label for="rn">Note to student <span class="note">(required when rejecting)</span></label>
      <textarea id="rn" rows="2" maxlength="300" placeholder="e.g. Receipt number is not readable. Please retake the photo.">${esc(r.review_note)}</textarea>
      <div id="err" class="err" role="alert"></div>
      <div class="row" style="margin-top:14px">
        <button class="btn" id="ok">Verify</button>
        <button class="btn danger" id="no">Reject</button>
        ${r.status !== 'pending' ? '<button class="btn ghost" id="re" style="color:var(--ink)">Back to pending</button>' : ''}
      </div>
    </div>`;
  $('#back').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/review');
  const set = async status => {
    const note = $('#rn').value.trim();
    if (status === 'rejected' && !note) return $('#err').textContent = 'Write a short reason so the student knows what to fix.';
    const { error } = await sb.from('receipts').update({ status, review_note: note || null, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() }).eq('id', r.id);
    if (error) return $('#err').textContent = errText(error);
    toast(status === 'verified' ? 'Receipt verified' : status === 'rejected' ? 'Receipt rejected' : 'Moved back to pending');
    location.hash = '#/review';
  };
  $('#ok').onclick = () => set('verified');
  $('#no').onclick = () => set('rejected');
  if ($('#re')) $('#re').onclick = () => set('pending');
};

/* ---------- account (both roles) ---------- */
student['account'] = admin['account'] = async () => {
  view.innerHTML = `
    <h2 style="margin-top:4px">Account</h2>
    <form id="pf" class="card" novalidate>
      <dl class="kv" style="margin-top:0">
        <dt>Email</dt><dd>${esc(session.user.email)}</dd>
        <dt>Student ID</dt><dd>${esc(profile.student_id) || '—'}</dd>
        <dt>Role</dt><dd>${profile.role === 'admin' ? 'Admin (cashier office)' : 'Student'}</dd>
      </dl>
      <label for="fn">Full name</label><input id="fn" maxlength="80" value="${esc(profile.full_name)}">
      <div id="err" class="err" role="alert"></div>
      <div class="row" style="margin-top:12px"><button class="btn sec" type="submit">Save name</button></div>
    </form>
    <div class="card" style="margin-top:12px"><button class="btn danger" id="out">Log out</button></div>`;
  $('#pf').addEventListener('submit', async e => {
    e.preventDefault();
    const full_name = $('#fn').value.trim();
    const { error } = await sb.from('profiles').update({ full_name }).eq('id', profile.id);
    if (error) return $('#err').textContent = errText(error);
    profile.full_name = full_name; toast('Name saved'); shell('account');
  });
  $('#out').onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; };
};

/* ---------- start ---------- */
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.warn));
boot();
})();