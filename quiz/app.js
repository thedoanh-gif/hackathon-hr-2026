// Mini app Quiz trực tiếp (13/11/2026) — dùng chung cho nhiều chương trình.
//   ?g=<mã game>             : máy người chơi (Đội: mỗi đội một máy · Cá nhân: mỗi người một máy)
//   ?g=<mã game>#man-hinh    : màn hình lớn của MC, bảng xếp hạng trực tiếp
// Câu hỏi, danh sách đội, giờ mở game: quản lý trong Google Sheet (trang Games, CauHoi). Điểm ghi ở trang TraLoi.

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), topR = $('#top-r');
const fmt = n => Number(n || 0).toLocaleString('vi-VN');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = ms => ms + Math.round(Math.random() * ms * 0.4);
const SHAPES = [
  '<svg viewBox="0 0 20 20"><path d="M10 2 19 18H1z"/></svg>',
  '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5"/></svg>',
  '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2"/></svg>',
  '<svg viewBox="0 0 20 20"><path d="M10 1 19 10 10 19 1 10z"/></svg>'
];
const L = ['A', 'B', 'C', 'D'];
const AUTO_NEXT = 12;      // giây tự sang câu sau khi xem giải thích
const MC_TOP = 10;         // chế độ Cá nhân: số người hiện trên màn hình MC

let URL_ = '', G = null, MA = '';

/* ---------- Google Sheet ---------- */
async function apiGet(params) {
  const q = new URLSearchParams({ ...params, t: Date.now() }).toString();
  const r = await fetch(URL_ + (URL_.includes('?') ? '&' : '?') + q, { redirect: 'follow', cache: 'no-store' });
  const j = await r.json(); if (!j.ok) throw new Error(j.loi || 'Lỗi máy chủ'); return j;
}
async function apiPost(body) {
  const r = await fetch(URL_, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
const getState = () => apiGet({ g: MA });

/* ---------- khởi động ---------- */
async function boot() {
  try { URL_ = (await fetch('config.json', { cache: 'no-store' }).then(r => r.json())).sheet_url || ''; } catch {}
  MA = (new URLSearchParams(location.search).get('g') || '').trim().toLowerCase();
  if (!URL_) { app.innerHTML = `<p class="err center">Chưa gắn link Google Sheet (config.json > sheet_url).</p>`; return; }
  if (!MA) return askCode();
  try { G = (await apiGet({ a: 'game', g: MA })).game; }
  catch (e) { return askCode(e.message.includes('Không tìm thấy') ? `Không có game mã "${MA}". Kiểm tra lại mã.` : 'Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'); }
  document.title = G.ten;
  $('#g-ten').textContent = G.ten; $('#g-phu').textContent = G.phu_de || '';
  if (!G.cau.length) { app.innerHTML = `<p class="err center">Game này chưa có câu hỏi.</p>`; return; }
  if (location.hash === '#man-hinh') return mcScreen();
  player();
}
window.addEventListener('hashchange', () => location.reload());

function askCode(err) {
  app.innerHTML = `<section class="screen wait">
    <p class="eyebrow">Quiz trực tiếp</p><h1>Nhập mã game</h1>
    <form class="form" id="f" style="width:min(360px,100%)">
      <input class="input input--code" id="code" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ví dụ: hackathon" value="${esc(MA)}" required>
      <button class="btn btn--block">Vào game</button>
      ${err ? `<p class="note err">${esc(err)}</p>` : '<p class="note">Mã game do người dẫn chương trình cung cấp.</p>'}
    </form></section>`;
  $('#f').onsubmit = e => { e.preventDefault(); const v = $('#code').value.trim().toLowerCase(); if (v) location.search = '?g=' + encodeURIComponent(v); };
}

/* =====================================================================
   MÁY NGƯỜI CHƠI
   ===================================================================== */
let S = null, vong = 1;
const isTeam = () => G.che_do === 'doi';
const KEY = () => `quiz_${MA}_${vong}`;
const save = () => { try { localStorage.setItem(KEY(), JSON.stringify(S)); } catch {} };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || 'null'); } catch { return null; } };
const limitOf = q => (q.thoi_gian || G.thoi_gian || 20) * 1000;

function setTop() {
  topR.innerHTML = S && S.ten ? `<span class="pill score-pill">${esc(S.ten)} · <b>${fmt(S.diem)}</b></span>` : '';
}

async function player() {
  let st = null;
  try { st = await getState(); vong = st.vong; } catch {}
  S = load();
  if (S && S.ten) {
    if (S.dang != null && S.dang === S.i) return answer(null, true);   // tải lại giữa câu: tính là hết giờ
    setTop();
    if (S.i >= G.cau.length) return endScreen();
    if ((st && st.mo) || S.i > 0) return question();
    return waitScreen();
  }
  join(st);
}

function rulesHtml() {
  const t = G.thoi_gian || 20;
  return `<ul class="card rules">
    <li>${G.cau.length} câu, mỗi câu khoảng ${t} giây.</li>
    <li>Đúng được 500 đến 1.000 điểm, trả lời càng nhanh càng nhiều.</li>
    <li>Đúng 3 câu liên tiếp trở lên: thưởng thêm 100 điểm mỗi câu.</li>
    <li>${isTeam() ? 'Bàn nhanh trong đội rồi chốt.' : 'Tự trả lời, không hỏi bài nhé.'} Đã bấm là không đổi được.</li>
  </ul>`;
}

function join(st) {
  const start = ten => {
    S = { ten, i: 0, diem: 0, dung: 0, chuoi: 0, dang: null, hang_doi: [] };
    save(); setTop(); (st && st.mo) ? countdown() : waitScreen();
  };
  if (isTeam()) {
    let chosen = null;
    app.innerHTML = `<section class="screen">
      <div><p class="eyebrow">${esc(G.ten)}</p><h1>Đội của bạn là?</h1>
        <p class="lead" style="margin-top:8px">Mỗi đội dùng một máy. Chọn đúng đội mình trước khi bắt đầu.</p></div>
      <div class="teams">${G.doi.map((d, k) => `<button class="team-btn" data-k="${k}" aria-pressed="false"><b>${esc(shortName(d))}</b><span>${esc(d)}</span></button>`).join('')}</div>
      ${rulesHtml()}
      <button class="btn btn--block" id="go" disabled>Chọn đội để tiếp tục</button>
    </section>`;
    app.querySelectorAll('.team-btn').forEach(b => b.onclick = () => {
      chosen = G.doi[Number(b.dataset.k)];
      app.querySelectorAll('.team-btn').forEach(x => x.setAttribute('aria-pressed', x === b));
      const go = $('#go'); go.disabled = false; go.textContent = `Vào chơi với ${chosen}`;
    });
    $('#go').onclick = () => chosen && start(chosen);
  } else {
    app.innerHTML = `<section class="screen">
      <div><p class="eyebrow">${esc(G.ten)}</p><h1>Bạn là ai?</h1>
        <p class="lead" style="margin-top:8px">Tên này sẽ hiện trên bảng xếp hạng.</p></div>
      <form class="form" id="f">
        <div class="field"><label for="ten">Họ tên</label><input class="input" id="ten" maxlength="40" autocomplete="name" required></div>
        <div class="field"><label for="dv">Đơn vị / lớp (không bắt buộc)</label><input class="input" id="dv" maxlength="18"></div>
        ${rulesHtml()}
        <button class="btn btn--block">Vào chơi</button>
      </form>
    </section>`;
    $('#f').onsubmit = e => {
      e.preventDefault();
      const ten = $('#ten').value.trim().replace(/\s+/g, ' '), dv = $('#dv').value.trim();
      if (ten) start(dv ? `${ten} (${dv})` : ten);
    };
  }
}
// "Team 03" -> "03", "Nhóm Sao Mai" -> "SM"; dùng làm chữ lớn trên nút chọn đội
function shortName(d) {
  const m = d.match(/(\d+)\s*$/); if (m) return m[1].padStart(2, '0');
  return d.split(/\s+/).filter(w => !/^(team|đội|nhóm|doi|nhom)$/i.test(w)).map(w => w[0]).join('').slice(0, 3).toUpperCase() || d.slice(0, 2);
}

async function waitScreen() {
  app.innerHTML = `<section class="screen wait">
    <p class="eyebrow">Đã sẵn sàng</p>
    <div class="badge-team" style="font-size:clamp(2.2rem,10vw,4rem)">${esc(S.ten)}</div>
    <h2>Chờ MC mở game <span class="dots"><span></span><span></span><span></span></span></h2>
    <p class="note">Game tự bắt đầu khi được mở. Không cần tải lại trang.</p>
    <button class="btn btn--ghost" id="change">${isTeam() ? 'Chọn lại đội' : 'Đổi tên'}</button>
  </section>`;
  $('#change').onclick = () => { try { localStorage.removeItem(KEY()); } catch {} S = null; setTop(); join(null); };
  const view = app.firstElementChild;
  while (app.firstElementChild === view) {
    await sleep(jitter(isTeam() ? 3000 : 5000));
    try {
      const st = await getState();
      if (st.vong !== vong) return location.reload();
      if (st.mo && app.firstElementChild === view) return countdown();
    } catch {}
  }
}

async function countdown() {
  for (const n of [3, 2, 1]) {
    app.innerHTML = `<section class="screen wait"><p class="eyebrow">Bắt đầu sau</p><div class="count">${n}</div></section>`;
    await sleep(900);
  }
  question();
}

let raf = 0, nextT = 0;
function question() {
  cancelAnimationFrame(raf); clearInterval(nextT);
  const q = G.cau[S.i], limit = limitOf(q);
  S.dang = S.i; save();
  app.innerHTML = `<section class="screen">
    <div class="qhead"><span>Câu <b>${S.i + 1}</b>/${G.cau.length}${q.nhom ? ' · ' + esc(q.nhom) : ''}</span><span class="secs" id="secs">${limit / 1000}</span></div>
    <div class="timer" id="timer"><i></i></div>
    <h2 class="question">${esc(q.hoi)}</h2>
    <div class="opts" id="opts">${q.lua_chon.map((o, k) => `<button class="opt" data-k="${k}"><span class="sh">${SHAPES[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div id="fb"></div>
  </section>`;
  const t0 = performance.now(), bar = $('#timer i'), secs = $('#secs'), tm = $('#timer');
  let done = false;
  const tick = () => {
    if (done) return;
    const left = Math.max(0, limit - (performance.now() - t0));
    bar.style.transform = `scaleX(${left / limit})`;
    secs.textContent = Math.ceil(left / 1000);
    tm.classList.toggle('low', left < 5000);
    if (left <= 0) { done = true; answer(null, false, limit); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    b.classList.add('picked');
    answer(Number(b.dataset.k), false, performance.now() - t0);
  });
}

function answer(k, fromReload, ms) {
  const q = G.cau[S.i], limit = limitOf(q);
  ms = ms == null ? limit : Math.min(ms, limit);
  const right = k === q.dap_an;
  let pts = 0, bonus = 0;
  if (right) {
    S.chuoi += 1; S.dung += 1;
    pts = 500 + Math.round(500 * (1 - ms / limit));
    if (S.chuoi >= 3) { bonus = 100; pts += bonus; }
  } else S.chuoi = 0;
  S.diem += pts;
  S.hang_doi.push({ a: 'tl', g: MA, vong, ten: S.ten, cau: S.i + 1, chon: k == null ? '' : L[k], dung: right, diem: pts, ms: Math.round(ms) });
  S.dang = null; S.i += 1; save(); setTop(); flush();
  const last = S.i >= G.cau.length;
  if (fromReload) return last ? endScreen() : question();

  const opts = $('#opts'); opts.classList.add('locked', 'revealed');
  if (q.dap_an >= 0) {
    opts.children[q.dap_an].classList.add('right');
    opts.children[q.dap_an].insertAdjacentHTML('beforeend', '<span class="mark">Đáp án</span>');
  }
  $('#fb').innerHTML = `<div class="fb ${right ? 'ok' : 'bad'}">
    <div class="fb__h"><strong>${right ? 'Chính xác!' : (k == null ? 'Hết giờ!' : 'Chưa đúng')}</strong><span class="fb__pts">+${fmt(pts)}</span></div>
    ${bonus ? `<div><span class="streak">Chuỗi ${S.chuoi} câu đúng · thưởng +${bonus}</span></div>` : ''}
    ${q.dap_an >= 0 ? `<p><b>${L[q.dap_an]}. ${esc(q.lua_chon[q.dap_an])}</b>${q.giai_thich ? '<br>' + esc(q.giai_thich) : ''}</p>` : ''}
    <button class="btn btn--block" id="next">${last ? 'Xem kết quả' : 'Câu tiếp theo'}</button>
    <p class="next-hint" id="hint"></p>
  </div>`;
  let n = AUTO_NEXT; const hint = $('#hint');
  const go = () => { clearInterval(nextT); last ? endScreen() : question(); };
  $('#next').onclick = go;
  hint.textContent = `Tự chuyển sau ${n} giây`;
  nextT = setInterval(() => { n -= 1; hint.textContent = `Tự chuyển sau ${n} giây`; if (n <= 0) go(); }, 1000);
  $('#fb').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

let flushing = false;
async function flush() {
  if (flushing || !S.hang_doi.length) return;
  flushing = true;
  try {
    while (S.hang_doi.length) {
      const j = await apiPost(S.hang_doi[0]);
      if (j && j.vong_cu) { S.hang_doi = []; save(); break; }
      if (!j || !j.ok) throw new Error(j && j.loi);
      S.hang_doi.shift(); save();
    }
  } catch { setTimeout(() => { flushing = false; flush(); }, jitter(4000)); return; }
  flushing = false;
}

async function endScreen() {
  cancelAnimationFrame(raf); clearInterval(nextT);
  app.innerHTML = `<section class="screen end">
    <p class="eyebrow">${esc(S.ten)} đã hoàn thành</p>
    <div class="big-score">${fmt(S.diem)}</div>
    <p class="muted">điểm</p>
    <div class="stats">
      <div class="stat"><b>${S.dung}/${G.cau.length}</b><span>câu đúng</span></div>
      <div class="stat"><b id="rank">–</b><span>hạng hiện tại</span></div>
    </div>
    <p class="note" id="endnote">Nhìn lên màn hình lớn để xem bảng xếp hạng.</p>
  </section>`;
  const view = app.firstElementChild;
  while (app.firstElementChild === view) {
    flush();
    try {
      const list = rank((await getState()).bang);
      const me = list.find(d => d.ten === S.ten);
      if (me) $('#rank').textContent = `${me.hang}/${list.length}`;
      $('#endnote').textContent = S.hang_doi.length ? 'Đang gửi nốt điểm về bảng chung…' : 'Nhìn lên màn hình lớn để xem bảng xếp hạng.';
    } catch { $('#endnote').textContent = 'Chưa kết nối được bảng chung. Báo số điểm này cho MC nếu cần.'; }
    await sleep(jitter(6000));
  }
}

/* =====================================================================
   MÀN HÌNH MC
   ===================================================================== */
function rank(bang) {
  const by = {}; (bang || []).forEach(d => by[d.ten] = d);
  const base = isTeam() ? G.doi.map(ten => ({ ten, diem: 0, da_lam: 0, dung: 0, chuoi: 0, ...(by[ten] || {}) })) : (bang || []).map(d => ({ ...d }));
  base.sort((a, b) => b.diem - a.diem || b.dung - a.dung || a.ten.localeCompare(b.ten, 'vi'));
  base.forEach((d, i) => d.hang = i > 0 && d.diem === base[i - 1].diem && d.dung === base[i - 1].dung ? base[i - 1].hang : i + 1);
  return base;
}

async function mcScreen() {
  document.body.classList.add('mc');
  const joinUrl = location.href.replace(/#.*$/, '');
  const total = G.cau.length;
  app.innerHTML = `<section class="screen">
    <div class="mc-head">
      <div><p class="eyebrow">Bảng xếp hạng trực tiếp</p><h1>${esc(G.phu_de || G.ten)}</h1></div>
      <div class="join-wrap">
        <div class="join"><span>${isTeam() ? 'Mỗi đội một máy' : 'Mỗi người một máy'}, vào chơi tại</span><b>${esc(joinUrl.replace(/^https?:\/\//, ''))}</b><span>Mã game: <span class="code-chip">${esc(G.ma)}</span></span></div>
        <div class="qr" id="qr" hidden></div>
      </div>
    </div>
    <div class="board" id="board"></div>
    <div class="mc-foot">
      <span class="muted" id="foot">Đang kết nối…</span>
      <button class="btn" id="reveal">Công bố Top 3</button>
    </div>
  </section>`;
  const drawQR = () => { try { if (!window.qrcode) return false; const q = qrcode(0, 'M'); q.addData(joinUrl); q.make(); const el = $('#qr'); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); el.hidden = false; return true; } catch { return true; } };
  if (!drawQR()) window.addEventListener('load', drawQR);

  let last = rank([]);
  $('#reveal').onclick = () => podium(last);
  const board = $('#board'), rows = new Map(), shown = new Map();
  const rowFor = ten => {
    if (rows.has(ten)) return rows.get(ten);
    const el = document.createElement('div'); el.className = 'row';
    el.innerHTML = `<div class="rk">–</div>
      <div class="tm"><b></b></div>
      <div class="prog"><div class="prog__bar"><i style="width:0"></i></div><small><span class="pc"></span><span class="st"></span></small></div>
      <div class="acc"><b class="ac">0</b>đúng</div>
      <div class="pts">0</div>`;
    $('.tm b', el).textContent = ten;
    rows.set(ten, el); return el;
  };
  const draw = list => {
    const show = isTeam() ? list : list.slice(0, MC_TOP);
    const before = new Map(); rows.forEach((el, k) => el.isConnected && before.set(k, el.getBoundingClientRect().top));
    board.style.setProperty('--rows', Math.max(show.length, 8));
    const keep = new Set(show.map(d => d.ten));
    rows.forEach((el, k) => { if (!keep.has(k)) el.remove(); });
    show.forEach((d, i) => {
      const el = rowFor(d.ten); board.appendChild(el);
      el.classList.toggle('lead1', i === 0 && d.diem > 0);
      $('.rk', el).textContent = d.da_lam ? d.hang : '–';
      $('.prog__bar i', el).style.width = `${(d.da_lam / total) * 100}%`;
      $('.pc', el).textContent = `${d.da_lam}/${total} câu`;
      const stl = $('.st', el);
      if (d.da_lam >= total) { stl.textContent = 'Hoàn thành'; stl.className = 'st done'; }
      else { stl.textContent = d.chuoi >= 3 ? `Chuỗi ${d.chuoi}` : ''; stl.className = 'st gold'; }
      $('.ac', el).textContent = d.dung;
      const p = $('.pts', el), old = shown.get(d.ten);
      if (old !== d.diem) { if (old != null) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } countUp(p, old || 0, d.diem); shown.set(d.ten, d.diem); }
    });
    show.forEach(d => {
      const el = rows.get(d.ten), b = before.get(d.ten); if (b == null) return;
      const dy = b - el.getBoundingClientRect().top;
      if (dy) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; requestAnimationFrame(() => { el.style.transition = ''; el.style.transform = ''; }); }
    });
    let more = $('.board-more'); if (!isTeam() && list.length > MC_TOP) { if (!more) { more = document.createElement('p'); more.className = 'board-more'; board.after(more); } more.textContent = `và ${list.length - MC_TOP} người chơi khác`; } else more && more.remove();
  };
  draw(last);
  while (true) {
    try {
      const st = await getState();
      if (st.vong !== G.vong) { G.vong = st.vong; rows.forEach(el => el.remove()); rows.clear(); shown.clear(); }
      last = rank(st.bang); draw(last);
      const n = isTeam() ? G.doi.length : last.length;
      const doneN = last.filter(d => d.da_lam >= total).length, playing = last.filter(d => d.da_lam > 0).length;
      const unit = isTeam() ? 'đội' : 'người';
      topR.innerHTML = `<span class="pill ${st.mo ? 'on' : ''}"><i></i>${st.mo ? 'Đang mở' : 'Chưa mở'} · Vòng ${st.vong}</span>`;
      $('#foot').textContent = !st.mo
        ? 'Game chưa mở. Tick ô "Mở" của game này trong Google Sheet (trang Games) khi sẵn sàng.'
        : (n && doneN === n ? `Tất cả ${unit} đã hoàn thành. Bấm "Công bố Top 3".`
          : `${playing}${isTeam() ? '/' + n : ''} ${unit} đang chơi · ${doneN} ${unit} đã xong · cập nhật ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch { $('#foot').textContent = 'Mất kết nối bảng điểm, đang thử lại…'; }
    await sleep(2500);
  }
}

function countUp(el, from, to) {
  const t0 = performance.now(), dur = 700;
  const f = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

function podium(list) {
  const top = list.filter(d => d.diem > 0).slice(0, 3);
  if (!top.length) return;
  const order = [top[1], top[0], top[2]], cls = ['p2', 'p1', 'p3'], lbl = [2, 1, 3];
  const ov = document.createElement('div'); ov.className = 'podium';
  ov.innerHTML = `<p class="eyebrow">${esc(G.ten)}</p><h2>Top 3</h2>
    <div class="steps">${order.map((d, i) => d ? `<div class="step ${cls[i]}"><div class="who"><b>${esc(d.ten)}</b><em>${fmt(d.diem)}</em></div><div class="block">${lbl[i]}</div></div>` : '<div class="step" style="visibility:hidden"></div>').join('')}</div>
    <button class="btn btn--ghost" id="close-pd">Quay lại bảng điểm</button>`;
  document.body.appendChild(ov);
  $('#close-pd', ov).onclick = () => ov.remove();
}

boot();
