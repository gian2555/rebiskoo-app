/* ---------- receipt form ---------- */
function form(existing) {
  const r = existing || {
    description: '',
    amount: '',
    paid_on: todayISO(),
    category: CATEGORIES[2],
    receipt_no: '',
    notes: ''
  };

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
      <div class="row" style="margin-top:16px">
        <button class="btn" type="submit" id="save">${existing ? 'Save and resubmit' : 'Submit receipt'}</button>
        <button class="btn ghost" type="button" id="cancel" style="color:var(--ink)">Cancel</button>
      </div>
    </form>
    <p class="note">The cashier's office reviews every receipt. Your receipt stays "Pending review" until then.</p>`;

  let pending = null;

  $('#photo').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      pending = await compress(f);
      $('#pv').src = localUrl(pending);
      $('#pv').hidden = false;
      $('#err').textContent = '';
    } catch (x) {
      $('#err').textContent = errText(x);
    }
  });

  $('#cancel').onclick = () => history.back();

  $('#f').addEventListener('submit', async e => {
    e.preventDefault();

    const err = t => { $('#err').textContent = t; };
    const description = $('#desc').value.trim();
    const amount = parseFloat($('#amt').value);
    const paid_on = $('#date').value;

    if (!description) return err('Please enter a description.');
    if (!(amount > 0)) return err('Please enter an amount greater than zero.');
    if (!paid_on) return err('Please choose the payment date.');
    if (!existing && !pending) return err('Please add a photo of the receipt.');

    const row = {
      description,
      amount: Math.round(amount * 100) / 100,
      paid_on,
      category: $('#cat').value,
      receipt_no: $('#no').value.trim() || null,
      notes: $('#notes').value.trim() || null
    };

    $('#save').disabled = true;

    try {
      if (!existing) {
        const { data: mine } = await sb.from('receipts')
          .select('description,amount,paid_on,category,receipt_no');

        const same = (mine || []).find(x =>
          (row.receipt_no && x.receipt_no === row.receipt_no) ||
          (Number(x.amount) === row.amount && x.paid_on === paid_on && x.category === row.category)
        );

        if (same && !await ask(
          `A similar receipt already exists ("${same.description}", ${peso(same.amount)}). Save anyway?`,
          'Save anyway',
          false
        )) {
          $('#save').disabled = false;
          return;
        }
      }

      let newPath = null;

      if (pending) {
        newPath = `${session.user.id}/${uid()}.jpg`;
        const up = await sb.storage.from(BUCKET).upload(
          newPath,
          pending,
          { contentType: 'image/jpeg', upsert: false }
        );

        if (up.error) throw up.error;
        row.image_path = newPath;
      }

      let id;

      if (existing) {
        const { error } = await sb.from('receipts')
          .update(row)
          .eq('id', existing.id);

        if (error) {
          if (newPath) await sb.storage.from(BUCKET).remove([newPath]);
          throw error;
        }

        if (newPath && existing.image_path) {
          await sb.storage.from(BUCKET).remove([existing.image_path]);
        }

        id = existing.id;
      } else {
        const { data, error } = await sb.from('receipts')
          .insert({ ...row, user_id: session.user.id })
          .select('id')
          .single();

        if (error) {
          if (newPath) await sb.storage.from(BUCKET).remove([newPath]);
          throw error;
        }

        id = data.id;
      }

      toast(existing ? 'Receipt resubmitted' : 'Receipt submitted for review');
      location.replace('#/receipt/' + id);

    } catch (x) {
      err('Could not save: ' + errText(x));
      $('#save').disabled = false;
    }
  });
}

student['add'] = async () => form(null);

student['edit'] = async id => {
  const r = await getReceipt(id);
  if (!r || r.status === 'verified') {
    location.hash = '#/receipts';
    return;
  }
  form(r);
};

/* ---------- admin ---------- */
admin['review'] = async () => {
  view.innerHTML = `
    <h2 style="margin-top:4px">Review receipts</h2>
    <div class="grid four" id="stats"></div>

    <div class="filters">
      <input id="q" class="full" type="search" placeholder="Search student ID, name, or receipt no." aria-label="Search">

      <select id="fst" aria-label="Status">
        <option value="pending">Pending review</option>
        <option value="">Any status</option>
        <option value="verified">Verified</option>
        <option value="rejected">Rejected</option>
      </select>

      <select id="fc" aria-label="Category">
        <option value="">All categories</option>
        ${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('')}
      </select>

      <div>
        <label for="fd1" style="margin-top:0">From</label>
        <input id="fd1" type="date">
      </div>

      <div>
        <label for="fd2" style="margin-top:0">To</label>
        <input id="fd2" type="date">
      </div>
    </div>

    <div class="row" style="margin-bottom:10px">
      <button class="btn small sec" id="csv">Export CSV</button>
      <span class="note" id="count"></span>
    </div>

    <div id="out" class="list">
      <div class="spin">Loading…</div>
    </div>`;

  /* FIX: Explicitly identify the student profile relationship. */
  const { data, error } = await sb
    .from('receipts')
    .select('*, profiles!receipts_user_id_fkey(student_id, full_name)')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;

  await signed(data.slice(0, 200).map(r => r.image_path));

  const n = s => data.filter(r => r.status === s).length;

  $('#stats').innerHTML = `
    <div class="card stat">
      <div class="n">${n('pending')}</div>
      <div class="l">Pending review</div>
    </div>
    <div class="card stat">
      <div class="n">${n('verified')}</div>
      <div class="l">Verified</div>
    </div>
    <div class="card stat">
      <div class="n">${n('rejected')}</div>
      <div class="l">Rejected</div>
    </div>
    <div class="card stat">
      <div class="n">${peso(data.filter(r => r.status === 'verified').reduce((s, r) => s + Number(r.amount), 0))}</div>
      <div class="l">Verified total</div>
    </div>`;

  let shown = [];

  const draw = async () => {
    const q = $('#q').value.trim().toLowerCase();
    const st = $('#fst').value;
    const c = $('#fc').value;
    const d1 = $('#fd1').value;
    const d2 = $('#fd2').value;

    shown = data.filter(r => {
      const p = r.profiles || {};

      return (!st || r.status === st) &&
        (!c || r.category === c) &&
        (!d1 || r.paid_on >= d1) &&
        (!d2 || r.paid_on <= d2) &&
        (!q || (
          (p.student_id || '') + ' ' +
          (p.full_name || '') + ' ' +
          (r.receipt_no || '') + ' ' +
          r.description
        ).toLowerCase().includes(q));
    });

    await signed(shown.slice(0, 100).map(r => r.image_path));

    $('#count').textContent =
      `${shown.length} receipt${shown.length === 1 ? '' : 's'}`;

    $('#out').innerHTML = shown.length
      ? shown.slice(0, 100).map(r =>
          itemHTML(r, (r.profiles?.student_id || '?') + ' ' + (r.profiles?.full_name || ''))
        ).join('') +
        (shown.length > 100
          ? '<p class="note">Showing the first 100. Narrow the filters or export the CSV.</p>'
          : '')
      : `<div class="card empty">Nothing to review here.</div>`;

    bindItems($('#out'));
  };

  $('.filters').addEventListener('input', draw);
  $('.filters').addEventListener('change', draw);

  $('#csv').onclick = async () => {
    const qs = new URLSearchParams();

    if ($('#fst').value) qs.set('status', $('#fst').value);
    if ($('#fd1').value) qs.set('from', $('#fd1').value);
    if ($('#fd2').value) qs.set('to', $('#fd2').value);

    try {
      const resp = await fetch('/api/admin/export.csv?' + qs, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      });

      if (!resp.ok) {
        throw new Error(resp.status === 403
          ? 'Only admins can export.'
          : 'Export failed. Try again.');
      }

      const b = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `receipts-${todayISO()}.csv`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(a.href), 4000);

    } catch (x) {
      toast(errText(x));
    }
  };

  draw();
};
