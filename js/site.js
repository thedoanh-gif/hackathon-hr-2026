// HR Hackathon 2026 · giao diện v2
// Dữ liệu: data/program.json, data/teams.json, data/updates.json (không ghi chủ đề vào đây).

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 640px)');

const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (s, sep = '/') => { const d = parseDay(s); return pad(d.getDate()) + sep + pad(d.getMonth() + 1); };

// nội dung BTC sửa trực tiếp trên trang (khoá "content"): data = đường dẫn trong program/updates, html = chữ tĩnh
function setPath(root, path, val) {
  const ks = path.split('.'); let o = root;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) return; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = val;
}
function cleanHtml(html) { // chỉ giữ chữ, xuống dòng và highlight
  const box = document.createElement('div'); box.innerHTML = html;
  const walk = n => [...n.childNodes].map(c => c.nodeType === 3 ? c.textContent.replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))
    : c.nodeName === 'BR' ? '<br>' : c.nodeName === 'MARK' ? `<mark class="hl in">${walk(c)}</mark>` : /^(I|EM|B|STRONG)$/.test(c.nodeName) ? `<${c.nodeName.toLowerCase()}>${walk(c)}</${c.nodeName.toLowerCase()}>` : walk(c)).join('');
  return walk(box).replace(/(<br>)+$/, '');
}
function applyHtml(map) { for (const [k, v] of Object.entries(map)) { const el = document.querySelector(`[data-ed="html:${k}"]`); if (el) el.innerHTML = cleanHtml(v); } }
// window.__HK_DATA__: dữ liệu nhúng sẵn trong bản đóng gói một file (Amazon Quick không cho tải file ngoài)
async function load(p) {
  const pre = window.__HK_DATA__?.[p]; if (pre) return structuredClone(pre);
  const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p); return r.json();
}

const state = { program: null, teams: [], updates: [], week: 1, current: null, scores: null };

/* ---------- tuần hiện tại ---------- */
function currentWeek(program) {
  if (program.tuan_hien_tai) return program.tuan_hien_tai;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lt = program.lo_trinh;
  if (today < parseDay(lt[0].tu)) return 0;
  for (const w of lt) if (today <= parseDay(w.den)) return w.tuan;
  return today < parseDay(program.ngay_hr_day) ? 6 : 7; // 6: tuần HR Day, 7: đã qua HR Day
}
const shortArea = m => (state.program.ten_ngan_mang || {})[m] || m;
const stages = () => state.program.giai_doan_tien_do || [];
const stageOf = ma => stages().find(g => g.ma === ma) || stages()[0] || { ma: 'khoi_dong', ten: 'Khởi động', mau: '#FFF1CF' };
// màu nhạt cho nền sáng (lộ trình): trộn màu giai đoạn với trắng
const tint = (hex, k) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * k)); return `rgb(${c})`; };
const deep = hex => hex.toUpperCase() === '#FFF1CF' ? '#C9A24E' : hex; // "trắng vàng" quá nhạt trên nền sáng: dùng vàng nhạt đậm hơn cho viền

/* ---------- render ---------- */
function renderHero() {
  $('#hero-lede').textContent = state.program.thong_diep;
  const people = state.teams.reduce((n, t) => n + t.thanh_vien.length, 0);
  $('#stat-people').dataset.count = people;
  $('#teams-eyebrow').textContent = `${state.teams.length} Team · ${people} thành viên`;
}

function renderRoad() {
  const { lo_trinh, ngay_hr_day } = state.program;
  const w = state.week;
  const cur = w <= 0 ? 0 : Math.min(w, 6) - 1; // vị trí chặng hiện tại (0–5)
  const card = (s, idx) => {
    const cls = s.tuan < w ? 'is-past' : s.tuan === w ? 'is-now' : '';
    const g = stageOf(s.giai_doan);
    return `<div class="step ${cls}" style="--st:${tint(g.mau, .82)};--stb:${deep(g.mau)}">
      <div class="step__when">Tuần ${s.tuan}<b>${fmt(s.tu)} – ${fmt(s.den)}</b></div>
      <div>
        <span class="step__stage"><i class="dot" style="--c:${deep(g.mau)}"></i>${esc(g.ten)}</span>
        <h3 class="step__title" data-ed="program.lo_trinh.${idx}.tieu_de">${esc(s.tieu_de)}</h3>
        <p class="step__desc" data-ed="program.lo_trinh.${idx}.mo_ta">${esc(s.mo_ta)}</p>
        ${s.moc ? `<span class="step__moc" data-ed="program.lo_trinh.${idx}.moc">${esc(s.moc)}</span>` : ''}
      </div>
      ${s.tuan === w ? '<span class="badge">Tuần này</span>' : ''}
    </div>`;
  };
  const gf = stageOf(state.program.hr_day.giai_doan || 'trinh_bay');
  const cards = lo_trinh.map(card);
  cards.push(`<div class="step step--final ${w >= 6 ? 'is-now' : ''}" style="--st:${tint(gf.mau, .82)};--stb:${gf.mau}">
    <div class="step__when">HR Day<b>${fmt(ngay_hr_day)}</b></div>
    <div><span class="step__stage"><i class="dot" style="--c:${gf.mau}"></i>${esc(gf.ten)}</span><h3 class="step__title">Trình bày tại HR Day</h3>
    ${state.program.hr_day.mo_ta ? `<p class="step__desc">${esc(state.program.hr_day.mo_ta)}</p>` : ''}</div>
    ${w === 6 ? '<span class="badge">Sắp tới</span>' : ''}
  </div>`);
  // mỗi chặng bọc trong khung co giãn được (thu gọn mượt bằng grid-template-rows)
  $('#road-list').innerHTML = cards.map((c, i) => `<li class="road__item ${i === cur ? 'is-cur' : ''}" style="--i:${Math.abs(i - cur)}"><div class="road__clip"><div class="road__pad">${c}</div></div></li>`).join('');

  // biểu đồ Gantt: mỗi tuần là một thanh trên trục ngày; bấm vào thanh để xem chi tiết tuần đó
  $('#road-bar').innerHTML = gantt(lo_trinh, ngay_hr_day, gf, cur);

  // chỉ hiện một tuần: mặc định tuần hiện tại; bấm tuần khác để xem tuần đó; bấm ra ngoài thì quay về tuần hiện tại
  const items = $$('#road-list .road__item'), segsEl = $$('#road-bar [data-i]'), back = $('#road-back');
  let sel = cur;
  const show = i => {
    sel = i;
    items.forEach((el, k) => el.classList.toggle('is-shown', k === i));
    segsEl.forEach(el => el.setAttribute('aria-pressed', String(+el.dataset.i === i && !el.classList.contains('g-row--kick'))));
    back.hidden = i === cur;
  };
  $('#road-bar').onclick = e => { const b = e.target.closest('[data-i]'); if (b) show(+b.dataset.i === sel && sel !== cur ? cur : +b.dataset.i); };
  back.onclick = () => show(cur);
  document.addEventListener('click', e => { if (sel !== cur && !e.target.closest('#road-bar, #road, #road-back')) show(cur); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sel !== cur) show(cur); });
  show(cur);
}


/* ---------- Gantt lộ trình ---------- */
function gantt(lo_trinh, hrDay, gf, cur) {
  const DAY = 864e5, kick = state.program.ngay_kick_off || lo_trinh[0].tu;
  const start = parseDay(kick); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));  // thứ Hai của tuần Kick Off
  const end = parseDay(hrDay); end.setDate(end.getDate() + 2);
  const total = Math.round((end - start) / DAY);
  const pos = d => Math.round((parseDay(d) - start) / DAY) / total * 100;
  const len = (a, b) => (Math.round((parseDay(b) - parseDay(a)) / DAY) + 1) / total * 100;
  const pc = v => v.toFixed(3) + '%';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let grid = '', ticks = '', wk = '';
  for (let i = 0; i <= total; i++) {
    const d = new Date(start.getTime() + i * DAY), dow = d.getDay(), left = pc(i / total * 100);
    if (dow === 1) { grid += `<i class="g-line" style="left:${left}"></i>`; ticks += `<span style="left:${left}">${pad(d.getDate())}/${pad(d.getMonth() + 1)}</span>`; }
    if (dow === 6 && i < total) wk += `<i class="g-wkend" style="left:${left};width:${pc(2 / total * 100)}"></i>`;
  }
  const inRange = today >= start && today < end;
  const now = inRange ? `<i class="g-today" style="left:${pc(((today - start) / DAY + 0.5) / total * 100)}"><b>Hôm nay</b></i>` : '';
  const prog = s => { const a = parseDay(s.tu).getTime(), b = parseDay(s.den).getTime() + DAY; return Math.max(0, Math.min(1, (today - a) / (b - a))); };
  const row = (i, label, sub, bar, cls = '') => `<button type="button" class="g-row ${cls}" data-i="${i}" aria-label="${esc(label)}, ${esc(sub)}">
      <span class="g-lab"><b>${esc(label)}</b><small>${esc(sub)}</small></span>
      <span class="g-track">${bar}</span></button>`;
  const rows = [];
  const kickPast = today >= parseDay(kick);
  rows.push(row(0, 'Kick Off', fmt(kick),
    `<i class="g-ms" style="left:${pc(pos(kick) + 0.5 / total * 100)};--c:${deep(stageOf('khoi_dong').mau)}"><em>${fmt(kick)} · Kick Off</em></i>`, (kickPast ? 'is-past ' : '') + 'g-row--ms g-row--kick'));
  lo_trinh.forEach((s, i) => {
    const g = stageOf(s.giai_doan), st = i < cur ? 'is-past' : i === cur ? 'is-cur' : '';
    const p = i === cur ? prog(s) : i < cur ? 1 : 0;
    rows.push(row(i, 'Tuần ' + s.tuan, `${fmt(s.tu)} – ${fmt(s.den)}`,
      `<i class="g-bar" style="left:${pc(pos(s.tu))};width:${pc(len(s.tu, s.den))};--c:${deep(g.mau)};--p:${p.toFixed(3)}" title="${esc(s.tieu_de)}"><em>${esc(g.ten)}</em></i>`, st));
  });
  const fin = lo_trinh.length;
  rows.push(row(fin, 'HR Day', fmt(hrDay),
    `<i class="g-ms g-ms--final" style="left:${pc(pos(hrDay) + 0.5 / total * 100)};--c:${gf.mau}"><em>${fmt(hrDay)} · HR Day</em></i>`, (cur >= fin ? 'is-cur ' : '') + 'g-row--ms'));
  return `<div class="gantt"><div class="gantt__in">
    <div class="g-head"><span class="g-lab"></span><span class="g-track g-ticks">${ticks}</span></div>
    <div class="g-body"><div class="g-bg" aria-hidden="true"><span class="g-lab"></span><span class="g-track">${wk}${grid}${now}</span></div>${rows.join('')}</div>
  </div></div>`;
}

const ICON = [
  /* Tính khả thi */ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="13" rx="2.5"/><path d="M8.5 21h7M12 17.5V21"/><path d="M8.8 11.2l2.2 2.2 4.4-4.6"/></svg>',
  /* Mức độ tác động */ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="3.5"/><path d="M11 13l9-9M16.5 4H20v3.5"/></svg>',
  /* Phạm vi sử dụng */ '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7.2l3.9 3.1M18 7.2l-3.9 3.1M6 16.8l3.9-3.1M18 16.8l-3.9-3.1"/></svg>'
];

function renderCriteria() {
  $('#criteria').innerHTML = state.program.tieu_chi.map((c, i) => `
    <div class="crit__i rv" style="transition-delay:${i * .08}s" title="${esc(c.mo_ta)}">
      <span class="crit__ic" aria-hidden="true">${ICON[i] || ''}</span><b data-ed="program.tieu_chi.${i}.ten">${esc(c.ten)}</b>
    </div>`).join('');
  $('#rules').innerHTML = state.program.the_le.map((r, i) => `<li data-ed="program.the_le.${i}">${esc(r)}</li>`).join('');
  $('#golden').textContent = state.program.quy_tac_vang || ''; $('#golden').dataset.ed = 'program.quy_tac_vang';
  if (!state.program.quy_tac_vang) $('.golden').hidden = true;
}

function renderLegend() {
  const count = ma => state.teams.filter(t => (t.tien_do || 'khoi_dong') === ma).length;
  $('#legend-list').innerHTML = stages().map(g => `<li><i style="--c:${g.mau}"></i>${esc(g.ten)}<span>${count(g.ma)}</span></li>`).join('');
}

function renderLog() {
  const items = [...state.updates].sort((a, b) => b.ngay.localeCompare(a.ngay));
  $('#log').innerHTML = items.length ? items.map(u => {
    const pics = (u.anh || []).filter(a => a && (a.src || typeof a === 'string')).map(a => typeof a === 'string' ? { src: a } : a);
    const team = so => state.teams.find(t => t.so === so);
    return `<li class="rv"><div class="log__meta">Tuần ${u.tuan}<span>${fmt(u.ngay, '.')}.${u.ngay.slice(0, 4)}</span></div>
    <div><h3 data-ed="updates.muc.${state.updates.indexOf(u)}.tieu_de">${esc(u.tieu_de)}</h3><p data-ed="updates.muc.${state.updates.indexOf(u)}.mo_ta">${esc(u.mo_ta)}</p>
    ${pics.length ? `<div class="gallery">${pics.map((a, i) => {
      const t = a.team ? team(a.team) : null; const g = t ? stageOf(t.tien_do) : null;
      return `<button class="gallery__i" type="button" data-src="${esc(a.src)}" data-cap="${esc(a.chu_thich || '')}${a.ngay ? ' · ' + fmt(a.ngay) : ''}">
        <img src="${esc(a.nho || a.src)}" alt="${esc(a.chu_thich || 'Ảnh hoạt động')}" loading="lazy" decoding="async">
        <span class="gallery__cap"><span>${t ? `<b>Team ${pad(t.so)}</b> · ${esc(shortArea(t.mang))}` : esc(a.chu_thich || '')}</span>${a.ngay ? `<i>${fmt(a.ngay)}</i>` : ''}</span>
      </button>`; }).join('')}</div>` : ''}
    </div></li>`; }).join('')
    : '<li class="log__empty">Chưa có cập nhật.</li>';
  $('#log').onclick = e => {
    const b = e.target.closest('.gallery__i'); if (!b) return;
    const items = [...b.parentElement.querySelectorAll('.gallery__i')];
    lightbox.open(items, items.indexOf(b));
  };
}

/* xem ảnh: phóng ra từ đúng vị trí ảnh nhỏ (FLIP), chuyển ảnh, vuốt, thu về khi đóng */
const lightbox = (() => {
  let items = [], idx = 0, busy = false;
  const lb = () => $('#lb'), img = () => $('#lb-img');
  const DUR = REDUCED ? 0 : 460;
  function fitRect(w, h) {
    const mw = innerWidth * (innerWidth < 640 ? .94 : .86), mh = innerHeight * (innerWidth < 640 ? .66 : .78);
    const k = Math.min(mw / w, mh / h);
    const W = w * k, H = h * k;
    return { left: (innerWidth - W) / 2, top: (innerHeight - H) / 2 - (innerWidth < 640 ? 20 : 10), width: W, height: H };
  }
  function place(r) { Object.assign(img().style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
  function flipFrom(thumbRect, to) {
    const el = img();
    const sx = thumbRect.width / to.width, sy = thumbRect.height / to.height;
    el.style.transition = 'none';
    el.style.transformOrigin = '0 0';
    el.style.transform = `translate(${thumbRect.left - to.left}px, ${thumbRect.top - to.top}px) scale(${sx}, ${sy})`;
    el.style.borderRadius = '14px';
    void el.offsetWidth;
    el.style.transition = `transform ${DUR}ms cubic-bezier(.22,.7,.2,1), border-radius ${DUR}ms`;
    el.style.transform = 'none';
    el.style.borderRadius = '12px';
  }
  function meta(i) { const b = items[i]; return { src: b.dataset.src, thumb: b.querySelector('img'), cap: b.dataset.cap }; }
  function setText() {
    $('#lb-cap').textContent = meta(idx).cap;
    $('#lb-n').textContent = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
    $$('#lb .lb__prev, #lb .lb__next').forEach(x => x.hidden = items.length < 2);
  }
  function open(list, i) {
    if (busy) return; items = list; idx = Math.max(0, i);
    const m = meta(idx), t = m.thumb;
    const r0 = t.getBoundingClientRect();
    const to = fitRect(t.naturalWidth || r0.width, t.naturalHeight || r0.height);
    const el = img(); el.src = t.currentSrc || t.src; el.alt = m.cap;
    const full = new Image(); full.onload = () => { if (meta(idx).src === m.src) el.src = m.src; }; full.src = m.src;
    lb().hidden = false; document.documentElement.style.overflow = 'hidden';
    place(to); setText(); t.style.visibility = 'hidden';
    requestAnimationFrame(() => { lb().classList.add('open'); flipFrom(r0, to); });
    setTimeout(() => { t.style.visibility = ''; }, DUR);
    $('#lb .lb__x').focus({ preventScroll: true });
  }
  function close() {
    if (lb().hidden || busy) return; busy = true;
    const t = meta(idx).thumb, el = img();
    const r = t.getBoundingClientRect(), cur = el.getBoundingClientRect();
    lb().classList.remove('open');
    const onScreen = r.bottom > 0 && r.top < innerHeight;
    el.style.transition = `transform ${DUR}ms cubic-bezier(.4,0,.2,1), opacity ${DUR}ms`;
    el.style.transformOrigin = '0 0';
    if (onScreen) { t.style.visibility = 'hidden'; el.style.transform = `translate(${r.left - cur.left}px, ${r.top - cur.top}px) scale(${r.width / cur.width}, ${r.height / cur.height})`; }
    else { el.style.opacity = '0'; el.style.transform = 'scale(.92)'; }
    setTimeout(() => { lb().hidden = true; el.style.cssText = ''; t.style.visibility = ''; document.documentElement.style.overflow = ''; busy = false; items[idx]?.focus({ preventScroll: true }); }, DUR);
  }
  function go(d) {
    if (busy || items.length < 2) return; busy = true;
    const el = img(), dir = d > 0 ? 1 : -1;
    el.style.transition = `transform ${DUR * .55}ms ease, opacity ${DUR * .55}ms ease`;
    el.style.transform = `translateX(${-dir * 60}px)`; el.style.opacity = '0';
    setTimeout(() => {
      idx = (idx + d + items.length) % items.length;
      const m = meta(idx), t = m.thumb;
      place(fitRect(t.naturalWidth || 16, t.naturalHeight || 10));
      el.src = t.currentSrc || t.src; el.alt = m.cap; setText();
      const full = new Image(); full.onload = () => { if (meta(idx).src === m.src) el.src = m.src; }; full.src = m.src;
      el.style.transition = 'none'; el.style.transform = `translateX(${dir * 60}px)`; void el.offsetWidth;
      el.style.transition = `transform ${DUR * .6}ms cubic-bezier(.22,.7,.2,1), opacity ${DUR * .6}ms ease`;
      el.style.transform = 'none'; el.style.opacity = '1';
      setTimeout(() => busy = false, DUR * .6);
    }, DUR * .55);
  }
  document.addEventListener('click', e => {
    if (lb().hidden) return;
    if (e.target.closest('[data-lb-close]')) close();
    const b = e.target.closest('[data-lb]'); if (b) go(+b.dataset.lb);
  });
  document.addEventListener('keydown', e => {
    if (lb().hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  }, true);
  let sx = null, sy = null;
  document.addEventListener('touchstart', e => { if (!lb().hidden && e.target.closest('#lb')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  document.addEventListener('touchend', e => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 90) close(); // vuốt xuống để đóng
  });
  addEventListener('resize', () => { if (!lb().hidden) { const t = meta(idx).thumb; place(fitRect(t.naturalWidth, t.naturalHeight)); } });
  return { open, close };
})();

function renderClose(updatedAt) {
  $('#close-lede').textContent = state.program.hr_day.mo_ta || 'Chi tiết chương trình sẽ được cập nhật sau.'; $('#close-lede').dataset.ed = 'program.hr_day.mo_ta';
  if (updatedAt) $('#foot-updated').textContent = 'Cập nhật dữ liệu: ' + fmt(updatedAt) + '/' + updatedAt.slice(0, 4);
}

function renderQuick() {
  $('#quick').innerHTML = state.teams.map(t => `<button type="button" data-team="${t.so}" aria-pressed="false" style="border-color:${stageOf(t.tien_do).mau}88" aria-label="Team ${t.so}, ${esc(shortArea(t.mang))}">${pad(t.so)}</button>`).join('');
  $('#quick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) selectTeam(+b.dataset.team, { fly: true }); });
}

/* ---------- điểm & bảng xếp hạng ---------- */
async function loadScores() {
  let data = null;
  try { data = await load('data/scores.json'); } catch {}
  state.scoresFromFile = !!data?.cong_bo;
  // bản xem trước từ trang quản trị: chỉ trên máy này
  try {
    const pv = JSON.parse(localStorage.getItem('hk_scores_preview'));
    if (pv?.data && Date.now() - pv.ts < 864e5) {
      data = pv.data; $('#pv').hidden = false;
      $('#pv-off').onclick = () => { try { localStorage.removeItem('hk_scores_preview'); } catch {} location.reload(); };
    }
  } catch {}
  return data;
}
const published = () => !!(state.scores?.cong_bo && state.scores.doi?.some(t => t.tong != null));
const fmtScore = v => v == null ? '–' : (Math.round(v * 10) / 10).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function scoreBlock(so) {
  if (!published()) return `<p class="p-score p-score--lock"><span aria-hidden="true">🔒</span> Điểm sẽ công bố sau khi các Team trình bày tại HR Day.</p>`;
  const sc = state.scores, row = sc.doi.find(t => t.so === so);
  if (!row || row.tong == null) return '';
  return `<div class="p-score">
    <div class="p-score__head"><span class="p-h">Điểm HR Day</span><span class="p-score__rank">Hạng ${row.hang}</span></div>
    ${sc.tieu_chi.map(c => `<div class="bar"><span>${esc(c.ten)}</span><b>${fmtScore(row.diem[c.ma])}</b>
      <i style="--w:${(row.diem[c.ma] || 0) / sc.thang_diem * 100}%"></i></div>`).join('')}
    <div class="p-score__total"><span>Tổng điểm</span><b>${fmtScore(row.tong)}<small>/${sc.thang_diem}</small></b></div>
  </div>`;
}

function renderRank() {
  const box = $('#rank');
  if (!published()) {
    $('#rank-sub').textContent = 'Bảng xếp hạng mở sau khi các Team trình bày tại HR Day.';
    box.innerHTML = `<div class="rank-lock rv">
      <div class="rank-lock__ghost" aria-hidden="true">${state.teams.map((t, i) => `<div><span>${pad(i + 1)}</span><i style="--w:${92 - i * 7}%"></i></div>`).join('')}</div>
      <div class="rank-lock__msg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>
      <h3>Mở sau HR Day ${fmt(state.program.ngay_hr_day)}</h3><p>Giám khảo chấm điểm từng Team ngay tại sự kiện. Kết quả sẽ hiện ở đây.</p></div>
    </div>`;
    return;
  }
  const sc = state.scores;
  const rows = sc.doi.filter(t => t.tong != null).sort((a, b) => a.hang - b.hang || a.so - b.so);
  const team = so => state.teams.find(t => t.so === so);
  const label = so => { const t = team(so); return `Team ${pad(so)}${t ? ' · ' + esc(shortArea(t.mang)) : ''}`; };
  const when = sc.cap_nhat_luc ? new Date(sc.cap_nhat_luc) : null;
  $('#rank-sub').textContent = `Trung bình của ${sc.giam_khao?.length || 0} giám khảo, thang điểm ${sc.thang_diem}.` + (when ? ` Cập nhật ${pad(when.getDate())}/${pad(when.getMonth() + 1)} lúc ${pad(when.getHours())}:${pad(when.getMinutes())}.` : '');
  const podium = rows.slice(0, 3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  box.innerHTML = `
    <div class="podium">${order.map(r => `<button type="button" class="pod pod--${r.hang} rv" data-team="${r.so}">
      <span class="pod__rank">${r.hang}</span><span class="pod__team">${label(r.so)}</span>
      <b class="pod__score">${fmtScore(r.tong)}</b><span class="pod__base" aria-hidden="true"></span></button>`).join('')}</div>
    <div class="board rv" style="--n:${sc.tieu_chi.length}">
      <div class="board__head"><span>Hạng</span><span>Team</span>${sc.tieu_chi.map(c => `<span class="board__c">${esc(c.ten)}</span>`).join('')}<span class="board__t">Tổng</span></div>
      ${rows.map(r => `<button type="button" class="board__row ${r.hang <= 3 ? 'is-top' : ''}" data-team="${r.so}">
        <span class="board__rank">${r.hang}</span>
        <span class="board__team">${label(r.so)}<i class="board__bar" style="--w:${r.tong / sc.thang_diem * 100}%"></i></span>
        ${sc.tieu_chi.map(c => `<span class="board__c">${fmtScore(r.diem[c.ma])}</span>`).join('')}
        <b class="board__t">${fmtScore(r.tong)}</b></button>`).join('')}
    </div>`;
  box.onclick = e => { const b = e.target.closest('[data-team]'); if (b) selectTeam(+b.dataset.team, { fly: true }); };
}

/* ---------- bảng thông tin đội ---------- */
const FOG = [16, 14, 11, 8, 5, 3, 2, 0]; // độ mờ theo tuần: màn sương rút dần
const IDEA = { chua_chot: 'Đang tìm ý tưởng', da_chot: 'Đã chốt ý tưởng', dang_lam: 'Đang dựng sản phẩm', hoan_thanh: 'Sẵn sàng demo' };
let galaxy = null;

function selectTeam(so, { fly = false } = {}) {
  const t = state.teams.find(x => x.so === so); if (!t) return;
  state.current = so;
  const cap = t.doi_truong;
  const title = t.ten_nhom ? esc(t.ten_nhom) : `Team ${t.so}`;
  $('#panel-body').innerHTML = `
    <p class="p-eyebrow">Team ${pad(t.so)} · ${esc(shortArea(t.mang))}</p>
    <h2 class="p-title" id="panel-title">${title}</h2>
    <div class="p-row">
      <div class="p-cell"><span>Tiến độ</span><b><i class="dot" style="--c:${deep(stageOf(t.tien_do).mau)}"></i>${esc(stageOf(t.tien_do).ten)}</b></div>
      <div class="p-cell"><span>Đội trưởng</span><b>${cap ? esc(cap) : 'Cập nhật sau tuần 1'}</b></div>
    </div>
    <div class="fog" style="--blur:${FOG[Math.min(state.week, 7)]}px">
      <span>Chủ đề</span>
      <div class="fog__txt" aria-hidden="true">Một bài toán HR có thật, Team sẽ kể vào ngày 15/12</div>
      <span class="fog__lock">Bí mật đến 15/12</span>
      <span class="sr-only">Chủ đề được giữ bí mật đến khi Team trình bày tại HR Day.</span>
    </div>
    <p class="p-h">${t.thanh_vien.length} thành viên</p>
    <ul class="members">${t.thanh_vien.map(m => `<li><b class="${cap && m.ten === cap ? 'cap' : ''}">${esc(m.ten)}</b><span>${esc(m.don_vi)}</span></li>`).join('')}</ul>
    ${scoreBlock(t.so)}
    <div class="p-actions"><button class="btn btn--gold" type="button" id="btn-content">Xem nội dung của Team</button></div>
    <div class="p-nav"><button type="button" data-step="-1">← Team trước</button><button type="button" data-step="1">Team sau →</button></div>`;
  $('#btn-content').onclick = () => openViewer(t);
  $$('.p-nav button').forEach(b => b.onclick = () => {
    const i = state.teams.findIndex(x => x.so === so);
    const n = state.teams[(i + +b.dataset.step + state.teams.length) % state.teams.length];
    selectTeam(n.so, { fly: true });
  });
  $$('#quick button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.team === so)));
  const panel = $('#panel'); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  if (galaxy) galaxy.focus(so, fly);
}
function closePanel() {
  const panel = $('#panel'); panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
  $$('#quick button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  state.current = null;
  if (galaxy) galaxy.release();
}

/* ---------- trình xem nội dung (slide / tài liệu) ---------- */
function openViewer(t) {
  const v = $('#viewer'), nd = t.noi_dung || {};
  const lockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`;
  let html = `<button class="viewer__x" type="button" aria-label="Đóng" data-close>×</button>
    <p class="eyebrow">Team ${pad(t.so)} · ${esc(shortArea(t.mang))}</p>`;
  if (!nd.cong_bo) {
    html += `<div class="lock">${lockIcon}<div><h3 id="viewer-title">Bí mật đến 15/12</h3>
      <p>Slide và tài liệu của Team sẽ mở ngay sau khi Team trình bày tại HR Day.</p></div></div>`;
  } else if (!nd.slides?.length && !nd.tai_lieu?.length && !nd.video) {
    html += `<div class="lock"><div><h3 id="viewer-title">Nội dung sẽ được cập nhật</h3><p>Ban tổ chức đang chuẩn bị bài trình bày của Team.</p></div></div>`;
  } else {
    html += `<h3 class="h3" id="viewer-title">Bài trình bày</h3>`;
    if (nd.slides?.length) html += `<div class="slides"><img id="slide-img" alt="" src="${esc(nd.slides[0])}"></div>
      <div class="slides__bar"><button class="tool" data-s="-1">← Trước</button><span id="slide-n">1 / ${nd.slides.length}</span><button class="tool" data-s="1">Sau →</button></div>`;
    if (nd.tai_lieu?.length) html += `<p class="p-h" style="margin-top:20px;color:rgba(232,238,247,.6)">Tài liệu</p>` +
      nd.tai_lieu.map(d => `<a class="btn btn--ghost btn--sm" href="${esc(d.duong_dan)}" download>${esc(d.ten || 'Tải về')}</a>`).join(' ');
  }
  $('#viewer-body').innerHTML = html;
  v.showModal();
  let i = 0; const S = nd.slides || [];
  const go = d => { if (!S.length) return; i = (i + d + S.length) % S.length; $('#slide-img').src = S[i]; $('#slide-n').textContent = `${i + 1} / ${S.length}`; };
  v.onclick = e => { if (e.target === v || e.target.closest('[data-close]')) v.close(); const b = e.target.closest('[data-s]'); if (b) go(+b.dataset.s); };
  v.onkeydown = e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
  let sx = null; const img = $('#slide-img');
  if (img) { img.addEventListener('touchstart', e => sx = e.touches[0].clientX, { passive: true });
    img.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); sx = null; }); }
}

/* ---------- hiệu ứng theo cuộn ---------- */
const GROUND = { dark: [11, 21, 38], light: [238, 243, 249] };  // nền tối navy đêm, nền sáng xanh băng
function scrollFx() {
  const secs = $$('main > .sec');
  const nav = $('#nav'), links = $$('.nav__links a'), fill = $('#road-fill'), road = $('#road');
  const root = document.documentElement;
  let ticking = false;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function frame() {
    ticking = false;
    const vh = innerHeight, probe = vh * 0.55;
    // nền chuyển màu liên tục giữa các section
    let col = GROUND[secs[0].dataset.ground], active = secs[0];
    for (let i = 0; i < secs.length; i++) {
      const r = secs[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        active = secs[i];
        const a = GROUND[secs[i].dataset.ground];
        const next = secs[i + 1];
        const b = next ? GROUND[next.dataset.ground] : a;
        const zone = Math.min(vh * 0.4, r.height * 0.3);
        const t = Math.max(0, Math.min(1, (probe - (r.bottom - zone)) / zone));
        col = mix(a, b, t * t * (3 - 2 * t));
        break;
      }
    }
    root.style.setProperty('--bg', `rgb(${col})`);
    const lum = (col[0] * 299 + col[1] * 587 + col[2] * 114) / 1000;
    const light = lum > 140;
    root.style.setProperty('--dot', light ? 'rgba(35,76,135,.07)' : 'rgba(120,170,255,.07)');
    if (root.dataset.ground !== (light ? 'light' : 'dark')) root.dataset.ground = light ? 'light' : 'dark';  // cho nền lưới đa giác (plexus.js)
    nav.style.setProperty('--nav-fg', light ? '#27364A' : '#E8EEF7');
    nav.style.setProperty('--line', light ? 'rgba(39,54,74,.1)' : 'rgba(255,255,255,.08)');
    document.querySelector('meta[name=theme-color]').content = `rgb(${col})`;
    links.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + active.id));
    // đường lộ trình tự vẽ theo con lăn
    if (road) {
      const r = road.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (vh * 0.7 - r.top) / r.height));
      fill.style.height = '0%';
    }
  }
  const on = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); frame();
}

function reveal() {
  const els = $$('.rv, .card, .card__art, mark.hl');
  if (REDUCED || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); countUp(true); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.matches('.stats')) countUp();
  }), { rootMargin: '0px 0px -10% 0px', threshold: .12 });
  els.forEach(e => io.observe(e));
}
function countUp(instant) {
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count;
    if (instant || REDUCED) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1400;
    const step = now => { const p = Math.min(1, (now - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

function countdown() {
  const target = parseDay(state.program.ngay_hr_day);
  const tick = () => {
    let ms = Math.max(0, target - new Date());
    const d = Math.floor(ms / 864e5); ms -= d * 864e5;
    const h = Math.floor(ms / 36e5); ms -= h * 36e5;
    const m = Math.floor(ms / 6e4);
    $('#cd-d').textContent = d; $('#cd-h').textContent = pad(h); $('#cd-m').textContent = pad(m);
    $('#cd-sr').textContent = `Còn ${d} ngày ${h} giờ ${m} phút đến HR Day.`;
  };
  tick(); setInterval(tick, 30e3);
}

function kickoffVideo() {
  const v = $('#kickoff'), card = v.closest('.vcard'), btn = $('#kickoff-play');
  const mob = MOBILE.matches;
  if (mob && v.dataset.posterMobile) v.poster = v.dataset.posterMobile;
  if (!v.dataset.src) { btn.hidden = true; return; } // bản đóng gói không kèm video: chỉ hiện ảnh bìa
  const start = () => { if (!v.src) v.src = mob ? v.dataset.srcMobile : v.dataset.src; v.play().then(() => card.classList.add('is-playing')).catch(() => {}); };
  btn.onclick = () => { v.controls = true; v.muted = false; start(); };
  if (REDUCED) return;
  new IntersectionObserver(([e]) => { if (e.isIntersecting) start(); else if (!v.paused) v.pause(); }, { threshold: .5 }).observe(v);
}

/* ---------- chòm sao 3D ---------- */
function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
function flatFallback(reason) {
  const st = $('#stage'); st.classList.add('is-flat');
  const fb = $('#stage-fallback'); fb.hidden = false;
  fb.innerHTML = `<div class="flat">${state.teams.map(t => `<button type="button" data-team="${t.so}"><b>${pad(t.so)}</b>${esc(shortArea(t.mang))} · ${t.thanh_vien.length} thành viên</button>`).join('')}</div>`;
  fb.onclick = e => { const b = e.target.closest('button'); if (b) selectTeam(+b.dataset.team); };
  console.info('[hackathon] chế độ 2D:', reason);
}
async function initGalaxy() {
  if (REDUCED) return flatFallback('giảm chuyển động');
  if (!hasWebGL()) return flatFallback('không hỗ trợ WebGL');
  try {
    const { createGalaxy } = await import('./constellation.js');
    await Promise.all([document.fonts.load('700 40px DINRoundOT'), document.fonts.load('500 20px DINRoundOT')]).catch(() => {}); await document.fonts.ready;
    galaxy = createGalaxy({
      stage: $('#stage'), canvas: $('#galaxy'), tip: $('#stage-tip'), hint: $('#stage-hint'),
      teams: state.teams.map(t => { const g = stageOf(t.tien_do); return { so: t.so, label: shortArea(t.mang), people: t.thanh_vien.length, color: g.mau, stage: g.ten }; }),
      onSelect: so => selectTeam(so, { fly: true }),
      isMobile: () => MOBILE.matches
    });
  } catch (err) { console.error(err); flatFallback('lỗi tải 3D'); }
}

/* ---------- khởi động ---------- */
(async function main() {
  try {
    const [program, teams, updates] = await Promise.all([load('data/program.json'), load('data/teams.json'), load('data/updates.json')]);
    state.scores = await loadScores();
    try { state.config = await load('data/config.json'); } catch { state.config = {}; }
    // tiến độ do BTC cập nhật ở trang quản trị (khoá "team_progress") ghi đè lên teams.json
    try {
      const { sharedGet } = await import('./store.js');
      const prog = await sharedGet('team_progress');
      if (prog) for (const t of teams.doi) Object.entries(prog[t.so] || {}).forEach(([k, v]) => { if (v != null && v !== '') t[k] = v; });
    } catch (err) { console.warn('[tiến độ]', err); }
    let content = null;
    try { content = await (await import('./store.js')).sharedGet('content'); } catch {}
    if (content?.data) { const root = { program, updates }; for (const [p, v] of Object.entries(content.data)) setPath(root, p, v); }
    state.program = program; state.teams = teams.doi; state.updates = updates.muc || [];
    state.week = currentWeek(program);
    renderHero(); renderRoad(); renderCriteria(); renderLegend(); renderLog(); renderClose(teams.cap_nhat_luc); renderQuick(); renderRank();
    if (content?.html) applyHtml(content.html);
    countdown(); kickoffVideo(); scrollFx(); reveal(); initGalaxy();
    import('./editor.js').then(m => m.initEditor({ state, $, $$, content })).catch(err => console.warn('[editor]', err));
    import('./hub.js').then(m => m.initHub({ state, $, esc, shortArea, selectTeam, renderRank })).catch(err => console.error('[hub]', err));
    // trang quản trị: index.html#quan-tri
    const ctx = { state, $, esc, shortArea };
    const route = () => {
      const admin = location.hash === '#quan-tri';
      document.documentElement.classList.toggle('is-admin', admin);
      if (admin) import('./btc.js').then(m => m.openAdmin(ctx));
      else if ($('#admin').innerHTML) location.reload(); // rời trang quản trị: tải lại để nhận dữ liệu mới
    };
    addEventListener('hashchange', route); route();
    $('#panel-close').onclick = closePanel;
    addEventListener('keydown', e => { if (e.key === 'Escape' && $('#panel').classList.contains('open') && !$('#viewer').open) closePanel(); });
    // vuốt xuống để đóng bảng trên điện thoại
    let y0 = null; const grab = $('#panel');
    grab.addEventListener('touchstart', e => { if ($('#panel-body').scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    grab.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) closePanel(); y0 = null; });
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend', '<p class="noscript">Không tải được dữ liệu. Hãy mở trang qua máy chủ (localhost hoặc GitHub Pages), không mở trực tiếp file.</p>');
  }
})();
