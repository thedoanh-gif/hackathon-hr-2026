// Dự đoán (Pick'em), Bình chọn và Bảng xếp hạng chung cuộc qua Google Sheet (Apps Script Web App).
// Thêm ngày 12/11/2026. Bật khi config.json có "sheet_url". Chạy được cả trên GitHub Pages (không cần đăng nhập).
// Sheet là nơi lưu phiếu và là bảng điều khiển của BTC (mở/khoá/công bố, đáp án, giám khảo). Xem HUONG-DAN-GOOGLE-SHEET.md.
import { tokens } from './scoring.js';

let C, cfg, URL_, S = null, me = null, mine = null, members = [];
const pad = n => String(n).padStart(2, '0');
const num = x => x == null ? '–' : Number(x).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const ID_KEY = 'hk_nguoi_choi';

/* ---------- gọi Apps Script ---------- */
async function get(params = {}) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(URL_ + (q ? (URL_.includes('?') ? '&' : '?') + q : ''), { redirect: 'follow' });
  const j = await r.json(); if (!j.ok) throw new Error(j.loi || 'Lỗi máy chủ'); return j;
}
async function post(body) {
  // text/plain để trình duyệt không gửi preflight (Apps Script không trả lời OPTIONS)
  const r = await fetch(URL_, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}

export async function initSheet(ctx, config) {
  C = ctx; cfg = config; URL_ = cfg.sheet_url;
  members = C.state.teams.flatMap(t => t.thanh_vien.map(m => ({ ten: m.ten, don_vi: m.don_vi, team: t.so })));
  try { me = JSON.parse(localStorage.getItem(ID_KEY) || 'null'); } catch { me = null; }
  const sec = C.$('#du-doan'); if (sec) sec.hidden = false;
  const nav = C.$('.nav__links a[href="#du-doan"]'); if (nav) nav.hidden = false;
  bindJudge();
  await refresh(true);
  setInterval(() => { if (!document.hidden && !busy()) refresh(); }, 30000);
}
const busy = () => document.activeElement && C.$('#du-doan, #vote')?.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);

async function refresh(first) {
  try { S = await get(); }
  catch (e) {
    if (first) {
      const msg = 'Chưa kết nối được nơi lưu phiếu. Hãy mở trang trên trình duyệt (bản GitHub) hoặc thử lại sau.';
      C.$('#pick') && (C.$('#pick').innerHTML = `<p class="vote__status vote__status--err">${msg}</p>`);
      C.$('#vote') && (C.$('#vote').innerHTML = `<p class="vote__status vote__status--err">${msg}</p>`);
    }
    return;
  }
  if (me && !mine) { try { mine = await get({ a: 'mine', ten: me.ten, team: me.team, ma: me.ma || '' }); } catch { mine = null; } }
  renderPick(); renderVote(); renderRank();
}

/* ---------- nhận diện người chơi (dùng chung cho Dự đoán và Bình chọn) ---------- */
function identifyForm(id, needCode, codeLabel, btn) {
  const dup = me?.choices;
  return `<form class="vote__form" data-id-form="${id}" autocomplete="off">
    <label>Họ và tên<input name="ten" list="pk-names" required placeholder="Ví dụ: Nguyễn Văn A" value="${C.esc(me?.ten || '')}"></label>
    <datalist id="pk-names">${members.map(m => `<option value="${C.esc(m.ten)}">`).join('')}</datalist>
    ${dup ? `<label>Team của bạn<select name="team">${dup.map(m => `<option value="${m.team}">Team ${pad(m.team)} · ${C.esc(m.don_vi || '')}</option>`).join('')}</select></label>` : ''}
    ${needCode ? `<label>${codeLabel}<input name="ma" required placeholder="BTC gửi trong nhóm"></label>` : ''}
    <button class="btn btn--gold" type="submit">${btn}</button>
  </form>`;
}
async function onIdentify(form, msgEl) {
  const f = new FormData(form), ten = String(f.get('ten') || '').trim();
  const hits = members.filter(m => tokens(m.ten) === tokens(ten));
  if (!hits.length) { msgEl.textContent = 'Không tìm thấy tên này trong danh sách thành viên các Team. Kiểm tra lại dấu và chính tả.'; msgEl.className = 'vote__status vote__status--err'; return; }
  let team = +f.get('team') || 0;
  if (hits.length > 1 && !team) { me = { ten: hits[0].ten, choices: hits }; rerender(); return; }
  const m = hits.length > 1 ? hits.find(x => x.team === team) : hits[0];
  const cand = { ten: m.ten, team: m.team, ma: String(f.get('ma') || me?.ma || '').trim() };
  msgEl.textContent = 'Đang kiểm tra…'; msgEl.className = 'vote__status';
  try { mine = await get({ a: 'mine', ten: cand.ten, team: cand.team, ma: cand.ma }); }
  catch (e) { msgEl.textContent = e.message; msgEl.className = 'vote__status vote__status--err'; return; }
  me = cand; draft = null; try { localStorage.setItem(ID_KEY, JSON.stringify(me)); } catch {}
  rerender();
}
function rerender() { renderPick(); renderVote(); }
function logoutLink() { return me?.team ? ` <button type="button" class="pk-link" data-logout>Không phải bạn?</button>` : ''; }
function onLogout() { me = null; mine = null; draft = null; try { localStorage.removeItem(ID_KEY); } catch {} rerender(); }

/* ---------- Dự đoán ---------- */
let draft = null;
function renderPick() {
  const box = C.$('#pick'); if (!box || !S) return;
  const c = S.cfg, teams = C.state.teams, tt = S.tien_tri;
  const open = c.mo_du_doan && !c.khoa_du_doan;
  const id = me?.team && mine;
  const saved = mine?.du_doan;
  if (id && !draft) draft = { loai: { ...(saved?.loai || {}) }, top: [...(saved?.top || [0, 0, 0])] };
  const d = draft || { loai: {}, top: [0, 0, 0] };
  const xu = S.xu_huong_vo_dich || {}, xuMax = Math.max(1, ...Object.values(xu));
  const opt = (v, sel, label) => `<option value="${v}" ${String(v) === String(sel) ? 'selected' : ''}>${label}</option>`;
  const teamOpts = sel => opt(0, sel, 'Chọn Team') + teams.map(t => opt(t.so, sel, `Team ${pad(t.so)} · ${C.esc(C.shortArea(t.mang))}`)).join('');
  const editable = open && id;
  const status = c.khoa_du_doan ? 'Đã khoá dự đoán' : c.mo_du_doan ? 'Đang mở · khoá khi Team đầu tiên lên trình bày' : 'Sắp mở';

  box.innerHTML = `
    <div class="pk-top">
      <span class="pk-chip ${open ? 'is-live' : ''}"><i></i>${status}</span>
      <span class="pk-chip"><b>${S.dem.du_doan}</b> người đã dự đoán</span>
      <span class="pk-rule">Đúng loại sản phẩm <b>+${c.diem_loai}</b>/Team · Đúng vô địch <b>+${c.diem_vo_dich}</b> · Mỗi đội đúng trong Top 3 <b>+${c.diem_top3}</b></span>
    </div>
    ${tt ? leaderboard(tt) : ''}
    ${open && !id ? `${identifyForm('pick', c.can_ma_du_doan, 'Mã dự đoán', 'Bắt đầu dự đoán')}
      <p class="vote__status" id="pk-msg">Dành cho thành viên 9 Team. Nhập họ tên để bắt đầu, sửa được đến khi khoá.</p>` : ''}
    ${id ? `<p class="vote__status ${saved ? 'vote__status--ok' : 'vote__status--go'}" id="pk-msg">Xin chào <b>${C.esc(me.ten)}</b> (Team ${pad(me.team)}).
      ${saved ? (open ? 'Bạn đã lưu dự đoán. Có thể sửa và lưu lại đến khi khoá.' : 'Dự đoán của bạn đã được ghi nhận.') : open ? 'Chọn Top 3 và đoán loại sản phẩm của từng Team, rồi bấm Lưu.' : 'Bạn chưa gửi dự đoán.'}${logoutLink()}</p>` : ''}
    ${!open && !id && !tt && c.khoa_du_doan ? `<p class="vote__status">Dự đoán đã khoá. Bảng Nhà tiên tri sẽ công bố cuối HR Day.</p>` : ''}

    <div class="pk-grid">
      <div class="pk-card pk-card--top">
        <h3 class="pk-h">Top 3 chung cuộc</h3>
        ${[0, 1, 2].map(i => `<label class="pk-rank pk-rank--${i + 1}"><span>${i + 1}</span>
          ${editable ? `<select data-top="${i}">${teamOpts(d.top[i])}</select>`
            : `<b>${id && d.top[i] ? `Team ${pad(d.top[i])}` : tt?.top3?.[i] ? `Team ${pad(tt.top3[i])}` : '…'}</b>`}
          ${tt?.top3?.[i] && id ? `<em class="${d.top[i] && tt.top3.includes(d.top[i]) ? 'ok' : ''}">Kết quả: Team ${pad(tt.top3[i])}</em>` : ''}</label>`).join('')}
        <div class="pk-crowd">
          <p class="pk-sub">Mọi người đang chọn vô địch</p>
          ${Object.keys(xu).length ? teams.filter(t => xu[t.so]).sort((a, b) => xu[b.so] - xu[a.so]).map(t => `<div class="pk-bar"><span>Team ${pad(t.so)}</span><i style="--w:${xu[t.so] / xuMax * 100}%"></i><b>${xu[t.so]}</b></div>`).join('')
            : '<p class="pk-empty">Chưa có ai chọn. Bạn là người đầu tiên?</p>'}
        </div>
      </div>
      <div class="pk-card">
        <h3 class="pk-h">Đoán loại sản phẩm</h3>
        <p class="pk-sub">Chủ đề giữ kín đến 15/12. Bạn chỉ cần đoán mỗi Team sẽ làm ra loại sản phẩm gì.</p>
        <div class="pk-teams">${teams.map(t => {
          const ans = tt?.dap_an?.[t.so], pick = d.loai[t.so] || '';
          return `<div class="pk-team ${ans && pick ? (ans === pick ? 'is-ok' : 'is-no') : ''}">
            <span class="pk-team__n">${pad(t.so)}</span><span class="pk-team__a">${C.esc(C.shortArea(t.mang))}</span>
            ${editable ? `<select data-loai="${t.so}">${opt('', pick, 'Chưa đoán')}${c.loai_san_pham.map(l => opt(C.esc(l), pick, C.esc(l))).join('')}</select>`
              : `<b class="pk-team__v">${pick ? C.esc(pick) : (ans ? '' : '…')}</b>`}
            ${ans ? `<em class="pk-team__ans">Đáp án: ${C.esc(ans)}</em>` : ''}
          </div>`; }).join('')}</div>
      </div>
    </div>
    ${editable ? `<div class="pk-save"><button type="button" class="btn btn--gold" id="pk-save">${saved ? 'Lưu lại dự đoán' : 'Lưu dự đoán'}</button><span id="pk-save-msg"></span></div>` : ''}`;

  box.onchange = e => {
    const s = e.target; if (!draft) return;
    if (s.dataset.top != null) draft.top[+s.dataset.top] = +s.value;
    if (s.dataset.loai) draft.loai[s.dataset.loai] = s.value;
  };
  box.onclick = async e => {
    if (e.target.closest('[data-logout]')) return onLogout();
    if (e.target.id !== 'pk-save') return;
    const msg = C.$('#pk-save-msg'), b = e.target;
    const top = draft.top.map(Number);
    if (top.some(x => !x)) { msg.textContent = 'Hãy chọn đủ 3 đội cho Top 3.'; return; }
    if (new Set(top).size < 3) { msg.textContent = 'Ba đội trong Top 3 phải khác nhau.'; return; }
    b.disabled = true; msg.textContent = 'Đang lưu…';
    const loai = Object.fromEntries(Object.entries(draft.loai).filter(([, v]) => v));
    try {
      const r = await post({ a: 'du_doan', ten: me.ten, team: me.team, ma: me.ma || '', loai, top });
      if (!r.ok) throw new Error(r.loi);
      mine = { ...mine, du_doan: { loai, top, luc: new Date().toISOString() } };
      S = await get().catch(() => S);
      renderPick(); C.$('#pk-save-msg') && (C.$('#pk-save-msg').textContent = 'Đã lưu. Có thể sửa lại đến khi khoá.');
    } catch (err) { b.disabled = false; msg.textContent = err.message || 'Không lưu được, thử lại nhé.'; }
  };
  box.onsubmit = e => { e.preventDefault(); onIdentify(e.target, C.$('#pk-msg')); };
}

function leaderboard(tt) {
  const you = me?.team ? tt.bxh.find(r => tokens(r.ten) === tokens(me.ten) && r.team === me.team) : null;
  return `<div class="pk-lead">
    <h3 class="pk-h">Bảng Nhà tiên tri <small>${tt.tong} người tham gia</small></h3>
    <ol>${tt.bxh.slice(0, 10).map(r => `<li class="${r === you ? 'is-you' : ''}"><span class="pk-lead__r">${r.hang}</span><span class="pk-lead__n">${C.esc(r.ten)} <small>Team ${pad(r.team)}</small></span>
      <span class="pk-lead__m">${r.dung_vo_dich ? 'Đúng vô địch · ' : ''}${r.dung_loai} loại đúng</span><b>${r.diem}</b></li>`).join('')}</ol>
    ${you && you.hang > 10 ? `<p class="pk-sub">Bạn đứng hạng ${you.hang} với ${you.diem} điểm.</p>` : ''}
  </div>`;
}

/* ---------- Bình chọn Team yêu thích ---------- */
function renderVote() {
  const box = C.$('#vote'); if (!box || !S) return;
  const c = S.cfg, teams = C.state.teams, tally = S.binh_chon;
  const open = c.mo_binh_chon && !c.cong_bo_binh_chon;
  const id = me?.team && mine, voted = mine?.binh_chon;
  const max = tally ? Math.max(1, ...tally.map(d => d.phieu)) : 1, top = tally ? Math.max(...tally.map(d => d.phieu)) : 0;
  box.innerHTML = `
    ${!open && !tally ? `<p class="vote__status">Bình chọn mở sau khi tất cả các Team trình bày tại HR Day.</p>` : ''}
    ${open && !id ? `${identifyForm('vote', c.can_ma_binh_chon, 'Mã bình chọn', 'Tiếp tục')}
      <p class="vote__status" id="v-msg">Nhập họ tên của bạn để bắt đầu. Mỗi người một phiếu, không bình chọn cho Team của mình.</p>` : ''}
    ${open && id && !voted ? `<p class="vote__status vote__status--go" id="v-msg">Xin chào <b>${C.esc(me.ten)}</b> (Team ${pad(me.team)}). Chọn một Team bạn yêu thích nhất.${logoutLink()}</p>` : ''}
    ${voted ? `<p class="vote__status vote__status--ok" id="v-msg">Cảm ơn <b>${C.esc(me.ten)}</b>! Bạn đã bình chọn <b>Team ${pad(voted)}</b>.${logoutLink()}</p>` : ''}
    ${open ? `<p class="vote__meta">${S.dem.binh_chon} phiếu đã gửi.</p>` : ''}
    <div class="vote__grid">${teams.map(t => {
      const own = id && me.team === t.so, picked = voted === t.so;
      const n = tally?.find(d => d.so === t.so)?.phieu ?? null, win = tally && n === top && top > 0;
      const can = open && id && !voted && !own;
      return `<div class="vcard2 ${own ? 'is-own' : ''} ${picked ? 'is-picked' : ''} ${win ? 'is-win' : ''}">
        <span class="vcard2__n">${pad(t.so)}</span><span class="vcard2__a">${C.esc(C.shortArea(t.mang))}</span>
        ${n != null ? `<span class="vcard2__bar"><i style="--w:${n / max * 100}%"></i></span><span class="vcard2__v">${n} phiếu</span>` : ''}
        ${can ? `<button type="button" class="btn btn--gold btn--sm" data-vote="${t.so}">Bình chọn</button>` : own && open ? `<span class="vcard2__own">Team của bạn</span>` : picked ? `<span class="vcard2__own">Bạn đã chọn</span>` : ''}
      </div>`; }).join('')}</div>`;
  box.onsubmit = e => { e.preventDefault(); onIdentify(e.target, C.$('#v-msg')); };
  box.onclick = async e => {
    if (e.target.closest('[data-logout]')) return onLogout();
    const b = e.target.closest('[data-vote]'); if (!b) return;
    const so = +b.dataset.vote;
    if (!confirm(`Bình chọn Team ${pad(so)} là Team bạn yêu thích nhất? Mỗi người chỉ bình chọn một lần.`)) return;
    b.disabled = true;
    const r = await post({ a: 'binh_chon', ten: me.ten, team: me.team, ma: me.ma || '', team_chon: so }).catch(() => ({ ok: false, loi: 'Không gửi được phiếu, thử lại nhé.' }));
    if (!r.ok && !r.da_chon) { b.disabled = false; alert(r.loi); return; }
    mine = { ...mine, binh_chon: r.da_chon || so };
    S = await get().catch(() => S); renderVote();
  };
}

/* ---------- Bảng xếp hạng chung cuộc ---------- */
function renderRank() {
  const kq = S?.ket_qua; if (!kq) return;
  const box = C.$('#rank'), w = kq.ty_le;
  const rows = kq.doi.filter(d => d.tong != null).sort((a, b) => a.hang - b.hang || a.so - b.so);
  const team = so => C.state.teams.find(t => t.so === so);
  const label = so => { const t = team(so); return `Team ${pad(so)}${t ? ' · ' + C.esc(C.shortArea(t.mang)) : ''}`; };
  C.$('#rank-sub').textContent = `Chung cuộc = Giám khảo ${w}% + Bình chọn ${100 - w}%. Điểm bình chọn quy về thang 10 theo đội nhiều phiếu nhất.`;
  const podium = rows.slice(0, 3), order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;
  box.innerHTML = `
    <div class="podium">${order.map(r => `<button type="button" class="pod pod--${r.hang} rv in" data-team="${r.so}">
      <span class="pod__rank">${r.hang}</span><span class="pod__team">${label(r.so)}</span>
      <b class="pod__score">${num(r.tong)}</b><span class="pod__base" aria-hidden="true"></span></button>`).join('')}</div>
    <div class="board rv in" style="--n:2">
      <div class="board__head"><span>Hạng</span><span>Team</span><span class="board__c">Giám khảo · ${w}%</span><span class="board__c">Bình chọn · ${100 - w}%</span><span class="board__t">Tổng</span></div>
      ${rows.map(r => `<button type="button" class="board__row ${r.hang <= 3 ? 'is-top' : ''}" data-team="${r.so}">
        <span class="board__rank">${r.hang}</span>
        <span class="board__team">${label(r.so)}<i class="board__bar" style="--w:${r.tong * 10}%"></i></span>
        <span class="board__c">${num(r.gk)}</span><span class="board__c">${num(r.bc)} <small>(${r.phieu} phiếu)</small></span>
        <b class="board__t">${num(r.tong)}</b></button>`).join('')}
    </div>`;
  box.onclick = e => { const b = e.target.closest('[data-team]'); if (b) C.selectTeam(+b.dataset.team, { fly: true }); };
}

/* ---------- Trang chấm điểm cho giám khảo: mở bằng đường link …#cham-diem ---------- */
function bindJudge() {
  const go = () => { if (location.hash === '#cham-diem') openJudge(); };
  addEventListener('hashchange', go); go();
}
function openJudge() {
  if (C.$('#judge')) return;
  const crit = (cfg.tieu_chi || []).length ? cfg.tieu_chi : [{ ma: 'kha_thi', ten: 'Tính khả thi' }, { ma: 'tac_dong', ten: 'Mức độ tác động' }, { ma: 'pham_vi', ten: 'Phạm vi sử dụng' }];
  const el = document.createElement('div'); el.id = 'judge'; el.className = 'judge';
  el.innerHTML = `<div class="judge__panel" role="dialog" aria-modal="true" aria-label="Chấm điểm">
    <header class="judge__head"><h2>Chấm điểm HR Day</h2><button type="button" class="judge__x" aria-label="Đóng">×</button></header>
    <form class="judge__login" autocomplete="off"><label>Tên giám khảo<input name="ten" required></label><label>Mã PIN<input name="pin" required inputmode="numeric"></label><button class="btn btn--gold btn--sm">Vào chấm</button></form>
    <p class="judge__msg"></p><div class="judge__body"></div></div>`;
  document.body.append(el); document.body.style.overflow = 'hidden';
  const close = () => { el.remove(); document.body.style.overflow = ''; if (location.hash === '#cham-diem') history.replaceState(null, '', location.pathname + location.search); };
  el.querySelector('.judge__x').onclick = close;
  let who = null;
  const msg = t => el.querySelector('.judge__msg').textContent = t;
  el.querySelector('.judge__login').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    msg('Đang kiểm tra…');
    try {
      const r = await get({ a: 'gk', giam_khao: f.get('ten'), pin: f.get('pin') });
      who = { ten: r.giam_khao, pin: String(f.get('pin')) }; e.target.hidden = true; msg(`Giám khảo: ${r.giam_khao}. Thang điểm 0–10. Bấm Lưu ở từng Team, sửa lại được.`);
      draw(r.diem);
    } catch (err) { msg(err.message); }
  };
  function draw(d) {
    el.querySelector('.judge__body').innerHTML = C.state.teams.map(t => {
      const v = d[t.so] || {}, done = crit.every(c => v[c.ma] != null);
      return `<form class="judge__row ${done ? 'is-done' : ''}" data-team="${t.so}">
        <b class="judge__t">Team ${pad(t.so)} <small>${C.esc(C.shortArea(t.mang))}</small></b>
        ${crit.map(c => `<label>${C.esc(c.ten)}<input type="number" name="${c.ma}" min="0" max="10" step="0.5" required value="${v[c.ma] ?? ''}"></label>`).join('')}
        <button class="btn btn--gold btn--sm">${done ? 'Lưu lại' : 'Lưu'}</button><span class="judge__ok">${done ? 'Đã lưu' : ''}</span></form>`;
    }).join('');
    el.querySelectorAll('.judge__row').forEach(f => f.onsubmit = async e => {
      e.preventDefault(); const ok = f.querySelector('.judge__ok'), btn = f.querySelector('button');
      const diem = Object.fromEntries(crit.map(c => [c.ma, +f.elements[c.ma].value]));
      btn.disabled = true; ok.textContent = 'Đang lưu…';
      const r = await post({ a: 'cham_diem', giam_khao: who.ten, pin: who.pin, team: +f.dataset.team, diem }).catch(() => ({ ok: false, loi: 'Không gửi được.' }));
      btn.disabled = false; ok.textContent = r.ok ? 'Đã lưu' : r.loi; if (r.ok) { f.classList.add('is-done'); btn.textContent = 'Lưu lại'; }
    });
  }
}
