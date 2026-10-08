(function () {
  const { risk, ttm, herbs } = window.PNC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const badge = (r) => `<span class="badge b-${r.level}">${r.icon} ${r.label} · ${r.th}</span>`;

  // ---------- Router (หน้าแรก + หน้าย่อย, รองรับปุ่ม Back ของเบราว์เซอร์) ----------
  const VIEWS = ['home', 'assess', 'chat', 'follow', 'herb', 'dash', 'history', 'alerts', 'me', 'birth'];
  const NAV = ['home', 'history', 'alerts', 'me'];
  function show(name) {
    if (!VIEWS.includes(name)) name = 'home';
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + name));
    $$('#bottom button').forEach(b => b.classList.toggle('on', b.dataset.nav === (NAV.includes(name) ? name : 'home')));
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    const to = b.dataset.go;
    if (location.hash.slice(1) === to || (to === 'home' && !location.hash)) show(to); else location.hash = to === 'home' ? '' : to;
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  // ---------- Assessment ----------
  const STATUS = { consider: 'พิจารณาได้ (รอยืนยัน)', defer: 'ยังไม่ถึงช่วงที่พิจารณา', avoid: 'ไม่แนะนำ/มีข้อห้าม' };
  function readForm(form) {
    const o = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return o;
  }
  function renderResult(a, target) {
    const r = risk.assess(a), t = ttm.recommend(a, r);
    const missing = r.missing.length ? `<p class="muted">ข้อมูลที่ยังไม่ได้กรอก: ${r.missing.join(', ')}</p>` : '';
    target.innerHTML = `
      <h2>ผลประเมิน</h2>
      <p>${badge(r)}</p>
      <ul class="reasons">${r.reasons.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>
      <p><b>แนวทาง:</b> ${esc(r.action)}</p>
      ${r.level === 'red' ? '<div class="alert">🚨 โทร <b>1669</b> หรือไปโรงพยาบาลที่ใกล้ที่สุดทันที — ระบบหยุดให้คำแนะนำทั่วไป</div>' : ''}
      ${a.selfHarm ? '<div class="alert">สายด่วนสุขภาพจิต <b>1323</b> (24 ชม.)</div>' : ''}
      ${missing}
      <h2 style="margin-top:16px">แนวทางแพทย์แผนไทย</h2>
      <p class="muted">${esc(t.message)}</p>
      ${t.items.map(i => `<div class="item ${i.status}"><b>${esc(i.name)}</b> — ${STATUS[i.status]}<ul>${i.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`).join('')}
      <p class="muted">AI แนะนำ — แพทย์/แพทย์แผนไทยเป็นผู้ยืนยันก่อนทำหัตถการ</p>`;
  }
  const form = $('#form'), result = $('#result');
  const rerun = () => {
    const a = readForm(form);
    renderResult(a, result);
    const r = risk.assess(a);
    $('#levelbar').innerHTML = `${badge(r)}<small>${esc(r.reasons[0].text)}</small>`;
  };
  form.addEventListener('input', rerun); form.addEventListener('change', rerun);
  const PRESETS = {
    green:  {},
    yellow: { pain: 5, milk: 'low', engorgement: true },
    orange: { tempC: 38.4, pain: 6 },
    red:    { bleeding: 'heavy' },
  };
  $$('[data-preset]').forEach(b => b.addEventListener('click', () => {
    form.reset();
    for (const [k, v] of Object.entries(PRESETS[b.dataset.preset])) {
      const el = form.elements[k]; if (!el) continue;
      if (el.type === 'checkbox') el.checked = v; else el.value = v;
    }
    rerun();
  }));
  rerun();

  // ---------- Chat ----------
  const YN = [{ l: 'ใช่', v: true }, { l: 'ไม่ใช่', v: false }];
  const STEPS = [
    { k: 'bleedingHeavy', q: 'เลือดออกมากจนชุ่มผ้าอนามัยภายใน 1 ชั่วโมงหรือไม่?', o: YN },
    { k: 'chestOrBreath', q: 'มีเจ็บหน้าอกหรือหายใจลำบากหรือไม่?', o: YN },
    { k: 'headacheVision', q: 'ปวดศีรษะรุนแรงหรือตาพร่ามัวหรือไม่?', o: YN },
    { k: 'feverQ', q: 'มีไข้หรือหนาวสั่นหรือไม่?', o: [{ l: 'มีไข้ (≥38°C)', v: 38.5 }, { l: 'ไม่มี', v: 36.8 }] },
    { k: 'pain', q: 'ระดับความปวดตอนนี้ 0–10?', o: [0, 2, 4, 6, 8, 10].map(n => ({ l: String(n), v: n })) },
    { k: 'delivery', q: 'คลอดแบบใด?', o: [{ l: 'ทางช่องคลอด', v: 'vaginal' }, { l: 'ผ่าตัดคลอด', v: 'cesarean' }] },
    { k: 'woundProblem', q: 'แผลผ่าตัด/แผลฝีเย็บบวม แดง มีหนอง หรือแยกหรือไม่?', o: YN },
    { k: 'milk', q: 'ให้นมบุตรหรือไม่ และน้ำนมเพียงพอไหม?', o: [{ l: 'เพียงพอ', v: 'enough' }, { l: 'น้อย', v: 'low' }, { l: 'ยังไม่มีน้ำนม', v: 'none' }] },
    { k: 'selfHarm', q: 'ช่วงนี้เคยคิดทำร้ายตัวเองหรือรู้สึกไม่อยากมีชีวิตอยู่หรือไม่?', o: YN },
  ];
  let ans, step, pending;
  const log = $('#log'), quick = $('#quick');
  const say = (t, who = 'bot') => { const d = document.createElement('div'); d.className = 'msg ' + who; d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  function resetChat() {
    ans = { days: 10, delivery: 'vaginal', bleeding: 'normal', tempC: 36.8, pain: 0, milk: 'enough' }; step = 0; pending = null; log.innerHTML = ''; quick.innerHTML = '';
    say('สวัสดีค่ะ น้องหมอท้องเอง 🤱 ไม่ใช่แพทย์ แต่ช่วยคัดกรองและบอกได้ว่าเมื่อไรควรพบบุคลากร\nเล่าอาการได้เลย เช่น “หลังคลอด 10 วัน ปวดหลังมาก”');
  }
  function parseFree(text) {
    const m = text.match(/(\d+)\s*วัน/); if (m) ans.days = Number(m[1]);
    const w = text.match(/(\d+)\s*สัปดาห์/); if (w) ans.days = Number(w[1]) * 7;
    if (/ผ่า(ตัด)?คลอด|ผ่าคลอด/.test(text)) { ans.delivery = 'cesarean'; ans._deliverySet = true; }
    if (/ปวด/.test(text) && !ans.pain) ans.pain = 5;
    if (/ไข้/.test(text)) ans.tempC = 38.2;
    if (/เลือด(ออก)?มาก|ตกเลือด/.test(text)) ans.bleeding = 'heavy';
  }
  function nextQuestion() {
    while (step < STEPS.length && STEPS[step].k === 'delivery' && ans._deliverySet) step++;
    while (step < STEPS.length && STEPS[step].k === 'woundProblem' && ans.delivery !== 'cesarean') step++;
    if (step >= STEPS.length) return finishChat();
    const s = STEPS[step];
    say(s.q);
    quick.innerHTML = '';
    s.o.forEach(o => { const b = document.createElement('button'); b.type = 'button'; b.textContent = o.l; b.onclick = () => answer(s, o); quick.appendChild(b); });
  }
  function answer(s, o) {
    say(o.l, 'me');
    if (s.k === 'bleedingHeavy') ans.bleeding = o.v ? 'heavy' : (ans.bleeding === 'heavy' ? 'heavy' : 'normal');
    else if (s.k === 'feverQ') ans.tempC = o.v;
    else ans[s.k] = o.v;
    step++;
    const r = risk.assess(ans);
    if (r.level === 'red') return finishChat();      // red flag → หยุดถามและเข้าสู่ระบบส่งต่อ
    nextQuestion();
  }
  function finishChat() {
    quick.innerHTML = '';
    const r = risk.assess(ans), t = ttm.recommend(ans, r);
    const lines = [`ผลคัดกรองเบื้องต้น: ${r.icon} ${r.label} (${r.th})`, ...r.reasons.map(x => '• ' + x.text), '', 'แนวทาง: ' + r.action];
    if (r.level === 'red') lines.push('', '🚨 โปรดโทร 1669 หรือไปโรงพยาบาลทันที ดิฉันจะหยุดให้คำแนะนำทั่วไป และแจ้งบุคลากรผู้ดูแลให้ติดต่อกลับ');
    else if (r.level === 'green' || r.level === 'yellow') {
      lines.push('', 'คำแนะนำดูแลตนเอง: พักผ่อนให้เพียงพอ ดื่มน้ำ ให้นมตามต้องการของลูก สังเกตเลือดออก ไข้ และอาการปวดต่อเนื่อง');
      const c = t.items.filter(i => i.status === 'consider').map(i => '• ' + i.name);
      if (c.length) lines.push('', 'บริการแพทย์แผนไทยที่อาจพิจารณา (ต้องให้แพทย์แผนไทยประเมินและยืนยันก่อน):', ...c);
    } else lines.push('', 'ยังไม่แนะนำหัตถการใด ๆ จนกว่าบุคลากรจะประเมิน');
    if (ans.selfHarm) lines.push('', 'สายด่วนสุขภาพจิต 1323 (24 ชม.)');
    say(lines.join('\n'));
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'เริ่มใหม่'; b.onclick = resetChat; quick.appendChild(b);
  }
  $('#chatform').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#chatin').value.trim(); if (!v) return;
    $('#chatin').value = '';
    say(v, 'me');
    if (step === 0 && !pending) { parseFree(v); pending = true; nextQuestion(); }
    else say('กรุณาเลือกคำตอบจากปุ่มด้านล่าง เพื่อให้คัดกรองได้แม่นยำ');
  });
  resetChat();

  // ---------- Dashboard (ข้อมูลสมมติ) ----------
  const base = { days: 10, delivery: 'vaginal', bleeding: 'normal', tempC: 36.8, pain: 2, sys: 118, dia: 76, epds: 4, milk: 'enough', sleepHours: 6 };
  const PATIENTS = [
    { id: 'A-01', name: 'มารดา A', ...base, bleeding: 'heavy', days: 2 },
    { id: 'A-02', name: 'มารดา B', ...base, days: 5, headacheVision: true, sys: 152, dia: 98 },
    { id: 'A-03', name: 'มารดา C', ...base, days: 9, tempC: 38.6, delivery: 'cesarean', woundProblem: true },
    { id: 'A-04', name: 'มารดา D', ...base, days: 20, epds: 15 },
    { id: 'A-05', name: 'มารดา E', ...base, days: 12, pain: 5, milk: 'low' },
    { id: 'A-06', name: 'มารดา F', ...base, days: 14, engorgement: true, sleepHours: 3 },
    { id: 'A-07', name: 'มารดา G', ...base, days: 30, pain: 3 },
    { id: 'A-08', name: 'มารดา H', ...base, days: 42, pain: 0, delivery: 'cesarean' },
    { id: 'A-09', name: 'มารดา I', ...base, days: 7, hxPPH: true, pain: 3 },
  ].map(p => ({ ...p, risk: risk.assess(p), confirmed: false }));
  const order = ['red', 'orange', 'yellow', 'green'];
  const COLORS = { red: 'b-red', orange: 'b-orange', yellow: 'b-yellow', green: 'b-green' };
  const GROUP = { red: 'กลุ่มฉุกเฉิน ต้องติดตามทันที', orange: 'กลุ่มเสี่ยง', yellow: 'กลุ่มติดตาม', green: 'กลุ่มปกติ' };
  let sel = null;
  function renderDash() {
    const sorted = [...PATIENTS].sort((a, b) => risk.LEVELS[b.risk.level].rank - risk.LEVELS[a.risk.level].rank);
    sel = sel || sorted[0];
    const cnt = (l) => PATIENTS.filter(p => p.risk.level === l).length;
    $('#dash').innerHTML = `
      <div class="stats">${order.map(l => `<div class="stat ${COLORS[l]}"><b>${cnt(l)}</b>${risk.LEVELS[l].icon} ${GROUP[l]}</div>`).join('')}</div>
      <div class="grid2"><div class="card"><h2>เรียงตามความเสี่ยง</h2>
        <table><tr><th>ระดับ</th><th>รหัส</th><th>วันหลังคลอด</th><th>สาเหตุหลัก</th></tr>
        ${sorted.map(p => `<tr class="pt" data-id="${p.id}"><td data-l="ระดับ">${risk.LEVELS[p.risk.level].icon}</td><td data-l="ผู้รับบริการ">${esc(p.name)}</td><td data-l="วันหลังคลอด">${p.days}</td><td data-l="สาเหตุหลัก">${esc(p.risk.reasons[0].text)}${p.confirmed ? ' ✅' : ''}</td></tr>`).join('')}</table>
        <p class="muted">ข้อมูลสมมติ ไม่ใช่ผู้ป่วยจริง</p></div>
        <div class="card" id="detail"></div></div>`;
    $$('tr.pt').forEach(tr => tr.addEventListener('click', () => { sel = PATIENTS.find(p => p.id === tr.dataset.id); renderDash(); }));
    const d = $('#detail');
    renderResult(sel, d);
    d.insertAdjacentHTML('afterbegin', `<h2>${esc(sel.name)} · หลังคลอด ${sel.days} วัน</h2>`);
    d.insertAdjacentHTML('beforeend', `<button id="confirm" type="button" style="background:var(--brand);color:#fff;border:0;padding:8px 14px;border-radius:8px">${sel.confirmed ? '✅ บุคลากรรับทราบแล้ว' : 'บุคลากรรับทราบ/ยืนยันแผนการดูแล'}</button>`);
    $('#confirm').onclick = () => { sel.confirmed = !sel.confirmed; renderDash(); };
  }
  renderDash();

  // ---------- Herbal checker ----------
  $('#herblist').innerHTML = herbs.DB.map(h => `<option value="${esc(h.name)}">`).join('');
  $('#herbform').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, profile = {};
    for (const el of f.elements) if (el.type === 'checkbox') profile[el.name] = el.checked;
    const r = herbs.check($('#herbq').value, profile);
    const cls = { ok: 'b-green', consult: 'b-yellow', avoid: 'b-red' }[r.verdict];
    const icon = { ok: '✅', consult: '⚠️', avoid: '⛔' }[r.verdict];
    $('#herbres').innerHTML = `<h2>${esc(r.herb ? r.herb.name : $('#herbq').value || '—')}</h2><p><span class="badge ${cls}">${icon} ${r.th}</span></p>
      <ul class="reasons">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="muted">ฐานข้อมูลตัวอย่างเพื่อสาธิต ต้องผ่านการตรวจสอบโดยผู้เชี่ยวชาญก่อนใช้จริง</p>`;
  });

  // ---------- Follow-up timeline ----------
  const FU = [
    [1, 'วันนี้มีเลือดออกมากผิดปกติหรือไม่?', ['ไม่มี → Green', 'มาก → Red แจ้งเตือนบุคลากรทันที']],
    [3, 'มีไข้หรือหนาวสั่นหรือไม่?', ['ไม่มี', 'มีไข้ → Orange']],
    [5, 'ระดับความปวดวันนี้เท่าไร (0–10)?', ['0–3 → Green', '4–6 → Yellow', '7+ → Orange → พิจารณานวด/ประคบ']],
    [7, 'น้ำนมเพียงพอหรือไม่?', ['เพียงพอ', 'น้อย → Yellow + แนะนำอาหารเพิ่มน้ำนม/ประเมินนมแม่']],
    [14, 'อารมณ์และการนอนหลับเป็นอย่างไร?', ['ดี', 'แย่ → ส่งแบบ EPDS → Yellow/Orange']],
    [42, 'สุขภาพหลังคลอดกลับมาใกล้เคียงปกติหรือยัง?', ['ปกติแล้ว → ปิดเคส', 'ยังไม่ → นัดพบบุคลากร']],
  ];
  $('#timeline').innerHTML = `<div class="tl">${FU.map(([d, q, r]) => `<div class="d">Day ${d}</div><div class="bubble">${esc(q)}</div><div class="replies">${r.map(x => `<span>${esc(x)}</span>`).join('')}</div>`).join('')}</div>`;

  // ---------- กราฟความเสี่ยง + ประวัติ (ข้อมูลตัวอย่างที่ผ่าน Risk Engine) ----------
  const COLS = [[1, ['วันคลอด', '(วันที่ 1)'], ['คลอด']], [2, ['2']], [3, ['3']], [4, ['4']], [5, ['5']], [6, ['6']], [7, ['7']], [10, ['8–14', 'วัน'], ['8–14']],
    [17, ['สัปดาห์', 'ที่ 3'], ['ส.3']], [24, ['สัปดาห์', 'ที่ 4'], ['ส.4']], [31, ['สัปดาห์', 'ที่ 5'], ['ส.5']], [38, ['สัปดาห์', 'ที่ 6'], ['ส.6']]];
  const OV = { 1: { bleeding: 'clots', pain: 5 }, 2: { pain: 5 }, 3: { pain: 2 }, 4: { pain: 4 }, 5: { pain: 7 }, 6: { milk: 'low' }, 7: { pain: 2 } };
  const HIST = COLS.map(([d, l, sh]) => ({ day: d, label: l, short: sh, r: risk.assess({ ...base, days: d, ...(OV[d] || {}) }) }));
  const CCOL = { green: '#4caf7a', yellow: '#f2c230', orange: '#f08a3c', red: '#d62b45' };
  const TODAY = 7;
  function chartSVG(wide) {
    const W = wide ? 330 : 258, H = wide ? 210 : 214, L = wide ? 52 : 46, R = 4, T = 6, B = wide ? 74 : 86, bands = ['red', 'orange', 'yellow', 'green'];
    const NAME = { red: 'รุนแรง', orange: 'เสี่ยง', yellow: 'ต้องติดตาม', green: 'ปกติ' };
    const bh = (H - T - B) / 4, cw = (W - L - R) / COLS.length, x = i => L + cw * (i + 0.5), y = rk => T + (3 - rk + 0.5) * bh;
    const bg = bands.map((l, i) => `<rect x="${L}" y="${T + i * bh}" width="${W - L - R}" height="${bh}" fill="${CCOL[l]}" opacity=".16"/><text x="${L - 4}" y="${T + i * bh + bh / 2 + 3}" text-anchor="end" font-size="8.5" fill="#8d7079">${NAME[l]}</text>`).join('');
    const grid = COLS.map((_, i) => `<line x1="${L + cw * i}" x2="${L + cw * i}" y1="${T}" y2="${H - B}" stroke="#fff" stroke-dasharray="2 3" opacity=".9"/>`).join('');
    const pts = HIST.map((h, i) => [x(i), y(risk.LEVELS[h.r.level].rank)]);
    const line = `<polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="#c9a24b" stroke-width="1.8"/>`;
    const dots = HIST.map((h, i) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.6" fill="${CCOL[h.r.level]}" stroke="#fff" stroke-width="1.2"/>`).join('');
    const ti = COLS.findIndex(c => c[0] === TODAY), yl = H - B + 12;
    const xl = HIST.map((h, i) => {
      const hi = i === ti;
      return (hi ? `<circle cx="${x(i)}" cy="${yl - 3}" r="8.5" fill="#ffd6de"/>` : '') +
        (wide ? h.label : (h.short || h.label)).map((t, k) => `<text x="${x(i)}" y="${yl + k * 9}" text-anchor="middle" font-size="${t.length > 3 ? 7 : 8.5}" fill="${hi ? '#e0476a' : '#8d7079'}" font-weight="${hi ? 700 : 400}">${t}</text>`).join('');
    }).join('');
    const bx1 = x(0) - cw / 2 + 2, bx2 = x(ti) + cw / 2 - 2, by = H - B + 36;
    const br = `<path d="M${bx1} ${by - 4}v4h${bx2 - bx1}v-4" fill="none" stroke="#f0607a" stroke-width="1"/><text x="${(bx1 + bx2) / 2}" y="${by + 9}" text-anchor="middle" font-size="10" fill="#f0607a">♥</text>` +
      `<text x="${(bx1 + bx2) / 2}" y="${by + 20}" text-anchor="middle" font-size="7.5" fill="#e0476a">ช่วงเริ่มต้น</text><text x="${(bx1 + bx2) / 2}" y="${by + 29}" text-anchor="middle" font-size="7.5" fill="#e0476a">กระตุ้นรับบริการฟื้นฟูหลังคลอด</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟระดับความเสี่ยงตามวันหลังคลอด (ข้อมูลตัวอย่าง)">${bg}${grid}${line}${dots}${xl}${br}</svg>`;
  }
  $$('[data-chart]').forEach(el => el.innerHTML = chartSVG(el.dataset.chart === 'wide'));
  $('#histlist').innerHTML = [...HIST].reverse().map(h => `<div class="hist"><span>${h.r.icon}</span><b>${h.r.level === 'green' ? 'ปกติ' : esc(h.r.reasons[0].text)}</b><small>วัน ${h.day}</small></div>`).join('');

  // ---------- แจ้งเตือน (ตัวอย่าง: วันนี้ = วันที่ 10) ----------
  const nextIdx = FU.findIndex(f => f[0] > TODAY);
  $('#alertlist').innerHTML = FU.map(([d, q], i) => `<div class="card al ${i === nextIdx ? 'next' : d <= TODAY ? 'done' : ''}"><div class="n"><span>วัน<b>${d}</b></span></div><div><div>${esc(q)}</div>${d <= TODAY ? '<small>✓ ตอบแล้ว</small>' : i === nextIdx ? '<small style="color:var(--pink-d)">ถัดไป</small>' : ''}</div></div>`).join('');
  $('#dot').textContent = FU.filter(f => f[0] > TODAY).length || ''; if (!$('#dot').textContent) $('#dot').hidden = true;

  // ---------- ไมค์ น้องหมอท้อง (ใช้ได้เมื่อเบราว์เซอร์รองรับ Web Speech) ----------
  $('#mic').addEventListener('click', () => {
    location.hash = 'chat';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $('#chatin').focus(); return; }
    const rec = new SR(); rec.lang = 'th-TH'; rec.interimResults = false;
    const mic = $('#mic'); mic.classList.add('live');
    rec.onresult = ev => { $('#chatin').value = ev.results[0][0].transcript; $('#chatform').requestSubmit(); };
    rec.onend = rec.onerror = () => mic.classList.remove('live');
    try { rec.start(); } catch (_) { mic.classList.remove('live'); }
  });

  const mascot = $('#mascot');
  mascot.addEventListener('click', e => { if (!e.target.closest('#mic')) location.hash = 'chat'; });
  mascot.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = 'chat'; });

  show(location.hash.slice(1));
})();
