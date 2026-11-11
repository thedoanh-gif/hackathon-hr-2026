// Trang chính: bình chọn Team yêu thích (nhập họ tên + mã bình chọn) và bảng xếp hạng đã công bố. Quản trị nằm ở btc.js (#quan-tri).
// Mọi đọc/ghi dữ liệu đi qua store.js (localStorage khi chạy thử; thay bằng kho dữ liệu dùng chung khi triển khai).
import { sharedGet, sharedPut, sharedList, sharedDelete, storageInfo } from './store.js';
import { tallyVotes, tokens, slug } from './scoring.js';
import { hash } from './btc.js';

let C, cfg, members;
const pad = n => String(n).padStart(2, '0');
// băm đơn giản (FNV-1a): chỉ để không lưu mật khẩu dạng chữ thường. Đây là khoá giao diện, không phải bảo mật máy chủ.

export async function initHub(ctx) {
  C = ctx;
  members = C.state.teams.flatMap(t => t.thanh_vien.map(m => ({ ten: m.ten, don_vi: m.don_vi, email: String(m.email || '').toLowerCase(), team: t.so })));
  cfg = { ...(C.state.config || {}), ...(await sharedGet('config') || {}) };
  placeEntry();
  await refreshResults();
  await renderVote();
}

/* ---------- lối vào trang quản trị ---------- */
function placeEntry() {
  if (cfg.an_link_quan_tri) return; // đặt an_link_quan_tri: true trong config.json nếu muốn ẩn lối vào
  const foot = C.$('.foot');
  if (foot && !C.$('#btc-link')) foot.insertAdjacentHTML('beforeend', `<a class="foot__btc" id="btc-link" href="#quan-tri">Trang quản trị</a>`);
}

/* ---------- kết quả đã công bố → trang chính ---------- */
async function refreshResults() {
  const snap = await sharedGet('result');
  if (cfg.cong_bo_diem && snap) C.state.scores = { ...snap, cong_bo: true };
  else if (!C.state.scoresFromFile) C.state.scores = null;
  C.renderRank();
}

/* ---------- bình chọn Team yêu thích ---------- */
let voter = null; // { ten, team } sau khi nhận diện họ tên
function findMembers(name) { const k = tokens(name); return k ? members.filter(m => tokens(m.ten) === k) : []; }

async function renderVote() {
  const box = C.$('#vote'); if (!box) return;
  const teams = C.state.teams;
  // bản chỉ xem (GitHub Pages): không có kho dùng chung nên không nhận phiếu trên trang này
  if (cfg.chi_xem && !(await storageInfo()).shared) {
    box.innerHTML = `<p class="vote__status">${C.esc(cfg.loi_nhan_binh_chon || 'Bình chọn sẽ mở sau HR Day trên kênh do Ban tổ chức thông báo.')}</p>
      <div class="vote__grid">${teams.map(t => `<div class="vcard2"><span class="vcard2__n">${pad(t.so)}</span><span class="vcard2__a">${C.esc(C.shortArea(t.mang))}</span></div>`).join('')}</div>`;
    return;
  }
  let tally = null;
  if (cfg.cong_bo_binh_chon) {
    tally = await sharedGet('vote_result'); // bản tổng hợp BTC đã công bố
    if (!tally) { const votes = (await sharedList('vote:')).map(x => x.value).filter(Boolean); tally = tallyVotes(votes, members, teams.map(t => t.so), cfg.chi_thanh_vien_binh_chon !== false); }
  }
  const max = tally ? Math.max(1, ...tally.doi.map(d => d.phieu)) : 1;
  const open = cfg.mo_binh_chon && !cfg.cong_bo_binh_chon;
  const done = voter?.voted;
  box.innerHTML = `
    ${!cfg.mo_binh_chon && !tally ? `<p class="vote__status">Bình chọn mở sau khi tất cả các Team trình bày tại HR Day.</p>` : ''}
    ${open && !done ? `<form class="vote__form" id="vote-form" autocomplete="off">
        <label>Họ và tên<input id="v-name" list="v-names" required placeholder="Ví dụ: Nguyễn Văn A" value="${C.esc(voter?.ten || '')}"></label>
        <datalist id="v-names">${members.map(m => `<option value="${C.esc(m.ten)}">`).join('')}</datalist>
        ${voter?.choices?.length > 1 ? `<label>Team của bạn<select id="v-own">${voter.choices.map(m => `<option value="${m.team}">Team ${pad(m.team)} · ${C.esc(m.don_vi)}</option>`).join('')}</select></label>` : ''}
        ${cfg.ma_binh_chon ? `<label>Mã bình chọn<input id="v-code" required placeholder="BTC phát tại sự kiện"></label>` : ''}
        <button class="btn btn--gold" type="submit">${voter?.team ? 'Xác nhận lại' : 'Tiếp tục'}</button>
      </form>
      <p class="vote__status ${voter?.team ? 'vote__status--go' : ''}" id="v-msg">${voter?.team
        ? `Xin chào <b>${C.esc(voter.ten)}</b> (Team ${pad(voter.team)}). Chọn một Team bạn yêu thích nhất. Bạn không chọn được Team của mình.`
        : 'Nhập họ tên của bạn để bắt đầu. Mỗi người một phiếu, không bình chọn cho Team của mình.'}</p>` : ''}
    ${done ? `<p class="vote__status vote__status--ok">Cảm ơn <b>${C.esc(voter.ten)}</b>! Bạn đã bình chọn <b>Team ${pad(voter.picked)}</b>.</p>` : ''}
    <div class="vote__grid">${teams.map(t => {
      const own = voter?.team === t.so, picked = voter?.picked === t.so;
      const n = tally?.doi.find(d => d.so === t.so)?.phieu ?? null, win = tally?.dan_dau.includes(t.so);
      const can = open && voter?.team && !done && !own;
      return `<div class="vcard2 ${own ? 'is-own' : ''} ${picked ? 'is-picked' : ''} ${win ? 'is-win' : ''}">
        <span class="vcard2__n">${pad(t.so)}</span><span class="vcard2__a">${C.esc(C.shortArea(t.mang))}</span>
        ${n != null ? `<span class="vcard2__bar"><i style="--w:${n / max * 100}%"></i></span><span class="vcard2__v">${n} phiếu${win ? ' · Yêu thích nhất' : ''}</span>` : ''}
        ${can ? `<button type="button" class="btn btn--gold btn--sm" data-vote="${t.so}">Bình chọn</button>` : own && open ? `<span class="vcard2__own">Team của bạn</span>` : picked ? `<span class="vcard2__own">Bạn đã chọn</span>` : ''}
      </div>`; }).join('')}</div>
    ${tally ? `<p class="vote__meta">${tally.tong_phieu} phiếu hợp lệ.</p>` : ''}`;

  const form = C.$('#vote-form');
  if (form) form.onsubmit = async e => {
    e.preventDefault();
    const name = C.$('#v-name').value.trim(), msg = C.$('#v-msg');
    if (cfg.ma_binh_chon && hash('vote:' + C.$('#v-code').value.trim().toLowerCase()) !== cfg.ma_binh_chon) { msg.className = 'vote__status vote__status--err'; msg.textContent = 'Mã bình chọn chưa đúng.'; return; }
    const hits = findMembers(name);
    if (!hits.length && cfg.chi_thanh_vien_binh_chon !== false) { msg.className = 'vote__status vote__status--err'; msg.textContent = 'Không tìm thấy họ tên này trong danh sách thành viên các Team. Hãy chọn đúng tên trong danh sách gợi ý.'; return; }
    const ownSel = C.$('#v-own');
    const me = hits.length === 1 ? hits[0] : hits.find(m => ownSel && m.team === +ownSel.value);
    if (hits.length > 1 && !me) { voter = { ten: hits[0].ten, choices: hits }; renderVote(); return; }
    const key = 'vote:ten:' + slug((me || { ten: name }).ten) + (hits.length > 1 ? '-t' + me.team : '');
    const prev = await sharedGet(key);
    voter = { ten: (me || { ten: name }).ten, team: me?.team || 0, key, choices: hits.length > 1 ? hits : null };
    if (prev) { voter.voted = true; voter.picked = prev.team_chon; }
    renderVote();
  };
  box.onclick = async e => {
    const b = e.target.closest('[data-vote]'); if (!b || !voter?.team) return;
    const so = +b.dataset.vote; if (so === voter.team) return;
    if (!confirm(`Bình chọn Team ${pad(so)} là Team bạn yêu thích nhất? Mỗi người chỉ bình chọn một lần.`)) return;
    try { await sharedPut(voter.key, { ten: voter.ten, team_minh: voter.team, team_chon: so, luc: new Date().toISOString() }, { insert: true }); voter.picked = so; }
    catch (err) {
      if (err.code === 'EXISTS') { const p = await sharedGet(voter.key); voter.picked = p?.team_chon; if (!p) { alert('Tài khoản này đã bình chọn rồi. Mỗi người chỉ một phiếu.'); return; } }
      else { alert(err.message || 'Không lưu được phiếu, vui lòng thử lại.'); return; }
    }
    voter.voted = true; renderVote();
  };
}

