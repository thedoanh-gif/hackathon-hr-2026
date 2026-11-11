// TRANG QUẢN TRỊ (#quan-tri): một quản trị viên, mở bằng mật khẩu.
// Tiến độ Team · Nhập điểm (tay hoặc Excel từ Forms) · Kết quả · Bình chọn · Công bố & cài đặt.
// Mọi đọc/ghi đi qua store.js.
import { sharedGet, sharedPut, sharedList, sharedDelete, storageInfo } from './store.js';
import { compute, tallyVotes, tokens, slug, norm } from './scoring.js';

let C, cfg, members, tab = 'tien-do';
const pad = n => String(n).padStart(2, '0');
// băm FNV-1a: chỉ để không lưu mật khẩu dạng chữ thường (khoá giao diện, không phải bảo mật máy chủ)
export const hash = s => { let h = 0x811c9dc5; for (const b of new TextEncoder().encode(s)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} }, del: k => { try { sessionStorage.removeItem(k); } catch {} } };
const unlocked = () => ss.get('hk_btc') === cfg.mat_khau_btc;
const IDEA = [['chua_chot', 'Đang tìm ý tưởng'], ['da_chot', 'Đã chốt ý tưởng'], ['dang_lam', 'Đang dựng sản phẩm'], ['hoan_thanh', 'Sẵn sàng demo']];

let warned = false;
export async function openAdmin(ctx) {
  C = ctx;
  if (!warned) { warned = true; addEventListener('unhandledrejection', e => { if (e.reason?.code && e.reason?.message) { e.preventDefault(); alert(e.reason.message); } }); }
  members = C.state.teams.flatMap(t => t.thanh_vien.map(m => ({ ten: m.ten, don_vi: m.don_vi, email: String(m.email || '').toLowerCase(), team: t.so })));
  cfg = { ...(C.state.config || {}), ...(await sharedGet('config') || {}) };
  const root = C.$('#admin');
  root.hidden = false;
  if (!unlocked()) return gate(root);
  shell(root);
}

function gate(root) {
  root.innerHTML = `<div class="adm__gate"><form class="adm__card adm__login" id="pw-form">
    <svg class="adm__logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#234C87"/><rect x="8" y="8" width="7" height="16" fill="#fff"/><rect x="17" y="8" width="7" height="7" fill="#B88A2D"/></svg>
    <p class="adm__eyebrow">HR Day Hackathon 2026</p><h1>Trang quản trị</h1>
    <label class="adm__field">Mật khẩu<input type="password" id="pw" autocomplete="current-password" required autofocus></label>
    <p class="adm__err" id="pw-err" role="alert"></p>
    <button class="btn btn--gold" type="submit">Mở khoá</button>
    <a class="adm__back" href="${location.pathname + location.search}">← Về trang chính</a></form></div>`;
  root.querySelector('#pw').focus();
  root.querySelector('#pw-form').onsubmit = e => {
    e.preventDefault();
    if (hash('hk:' + root.querySelector('#pw').value) === cfg.mat_khau_btc) { ss.set('hk_btc', cfg.mat_khau_btc); shell(root); }
    else root.querySelector('#pw-err').textContent = 'Mật khẩu chưa đúng.';
  };
}

const TABS = [['tien-do', 'Tiến độ Team', 'M4 19h16M7 16V9M12 16V5M17 16v-4'], ['noi-dung', 'Nội dung trang', 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4'], ['cham', 'Nhập điểm', 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4'], ['ket-qua', 'Kết quả', 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3'],
  ['binh-chon-qt', 'Bình chọn', 'M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z'], ['cong-bo', 'Công bố & cài đặt', 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 15H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 4.1V4a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z']];

function shell(root) {
  root.innerHTML = `<header class="adm__top"><div class="adm__topin">
      <div class="adm__brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#234C87"/><rect x="8" y="8" width="7" height="16" fill="#fff"/><rect x="17" y="8" width="7" height="7" fill="#B88A2D"/></svg><span>HR Day Hackathon <b>2026</b> · Quản trị</span></div>
      <div class="adm__acts"><a class="adm__link" href="${location.pathname + location.search}">← Trang chính</a><button type="button" class="adm__link" id="btc-lock">Khoá lại</button></div></div></header>
    <div class="adm__wrap">
      <nav class="adm__nav" aria-label="Mục quản trị">${TABS.map(([k, l, d]) => `<button type="button" data-tab="${k}" aria-current="${k === tab}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>${l}</button>`).join('')}</nav>
      <main class="adm__main"><p class="adm__mode" id="adm-mode"></p><h1 class="adm__h1" id="adm-title"></h1><div id="hub-body"></div></main>
    </div>`;
  root.querySelector('#btc-lock').onclick = () => { ss.del('hk_btc'); gate(root); };
  storageInfo().then(i => {
    const el = root.querySelector('#adm-mode'); if (!el) return;
    el.className = 'adm__mode ' + (i.shared ? (i.canEdit === false ? 'is-ro' : 'is-shared') : 'is-local');
    el.textContent = !i.shared ? 'Dữ liệu chỉ lưu trên trình duyệt của máy này' : i.canEdit === false ? 'Bạn đang ở quyền chỉ xem: cần quyền Editor để lưu thay đổi' : 'Dữ liệu dùng chung: mọi người mở link đều thấy thay đổi của bạn';
  });
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; root.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-current', String(x === b))); draw(); });
  draw();
}
async function draw() {
  const body = C.$('#hub-body');
  C.$('#adm-title').textContent = TABS.find(t => t[0] === tab)[1];
  body.innerHTML = '<p class="muted">Đang tải…</p>';
  ({ 'noi-dung': tabContent, 'tien-do': tabProgress, 'cham': tabScore, 'ket-qua': tabResult, 'binh-chon-qt': tabVotes, 'cong-bo': tabPublish })[tab](body);
  scrollTo({ top: 0 });
}

/* nội dung trang: sửa trực tiếp trên trang chính */
async function tabContent(body) {
  const c = await sharedGet('content') || {};
  const n = Object.keys(c.data || {}).length + Object.keys(c.html || {}).length;
  body.innerHTML = `<p class="hub__note">Sửa chữ ngay trên trang chính: bấm nút bên dưới, trang chính mở ra với nút <b>“Chỉnh sửa nội dung”</b> ở cuối màn hình. Bật lên rồi bấm vào chữ có viền nét đứt để sửa, xong bấm <b>Lưu</b> (hoặc Ctrl+S).</p>
    <ul class="hub__list"><li>Sửa được: tiêu đề, câu dẫn, thông điệp, nội dung từng tuần trong lộ trình, nguyên tắc vàng, tên tiêu chí, thể lệ, nhật ký, mô tả HR Day.</li>
      <li>Muốn tô highlight vàng cho từ khoá trong tiêu đề: giữ nguyên phần đang được tô khi sửa.</li>
      <li>Esc để huỷ những gì vừa gõ. “Khôi phục bản gốc” để bỏ toàn bộ chỉnh sửa.</li></ul>
    <div class="hub__stats"><div><b>${n}</b>chỗ đã sửa</div><div><b>${c.cap_nhat_luc ? new Date(c.cap_nhat_luc).toLocaleDateString('vi-VN') : '–'}</b>lần sửa gần nhất</div></div>
    <div class="hub__actions"><a class="btn btn--gold" id="go-edit" href="${location.pathname + location.search}">Mở trang chính để chỉnh sửa</a></div>`;
  body.querySelector('#go-edit').onclick = () => { try { sessionStorage.setItem('hk_edit', '1'); } catch {} };
}

/* tiến độ Team: giai đoạn, ý tưởng, đội trưởng, tên nhóm → khoá "team_progress" */
async function tabProgress(body) {
  const teams = C.state.teams, stages = C.state.program.giai_doan_tien_do || [];
  const prog = await sharedGet('team_progress') || {};
  const val = (t, k) => prog[t.so]?.[k] ?? t[k] ?? '';
  const scores = (await sharedList('score:')).length, votes = (await sharedList('vote:')).length;
  const count = ma => teams.filter(t => (val(t, 'tien_do') || 'khoi_dong') === ma).length;
  body.innerHTML = `<div class="hub__stats hub__stats--4">
      ${stages.map(g => `<div><b><i class="dot" style="--c:${g.mau === '#FFF1CF' ? '#C9A24E' : g.mau}"></i>${count(g.ma)}</b>${g.ten}</div>`).join('')}
    </div>
    <p class="hub__note">Cập nhật tiến độ từng Team. Màu điểm sáng trong chòm sao và bảng thông tin Team trên trang chính đổi theo. Hiện có ${scores} phiếu điểm, ${votes} phiếu bình chọn.</p>
    <div class="hub__scroll"><table class="hub__tbl hub__tbl--prog"><thead><tr><th>Team</th><th>Tiến độ</th><th>Ý tưởng</th><th>Đội trưởng</th><th>Tên nhóm</th></tr></thead><tbody>
    ${teams.map(t => `<tr data-so="${t.so}">
      <td><b>Team ${pad(t.so)}</b><small class="muted adm__sm">${C.esc(C.shortArea(t.mang))} · ${t.thanh_vien.length} người</small></td>
      <td data-l="Tiến độ"><select data-k="tien_do">${stages.map(g => `<option value="${g.ma}" ${(val(t, 'tien_do') || 'khoi_dong') === g.ma ? 'selected' : ''}>${g.ten}</option>`).join('')}</select></td>
      <td data-l="Ý tưởng"><select data-k="trang_thai_y_tuong">${IDEA.map(([v, l]) => `<option value="${v}" ${(val(t, 'trang_thai_y_tuong') || 'chua_chot') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td data-l="Đội trưởng"><select data-k="doi_truong"><option value="">Chưa có</option>${t.thanh_vien.map(m => `<option ${val(t, 'doi_truong') === m.ten ? 'selected' : ''}>${C.esc(m.ten)}</option>`).join('')}</select></td>
      <td data-l="Tên nhóm"><input data-k="ten_nhom" value="${C.esc(val(t, 'ten_nhom'))}" placeholder="Không bắt buộc"></td></tr>`).join('')}
    </tbody></table></div>
    <div class="hub__actions"><button class="btn btn--gold" type="button" id="pg-save">Lưu tiến độ</button><span class="hub__ok" id="pg-ok"></span></div>
    <p class="muted">Không nhập chủ đề của Team ở đây: chủ đề được giữ kín đến khi Team trình bày.</p>`;
  body.querySelector('#pg-save').onclick = async () => {
    const out = {};
    body.querySelectorAll('tr[data-so]').forEach(tr => {
      const o = {}; tr.querySelectorAll('[data-k]').forEach(el => { o[el.dataset.k] = el.value.trim() || null; });
      out[tr.dataset.so] = o;
    });
    await sharedPut('team_progress', out);
    body.querySelector('#pg-ok').textContent = 'Đã lưu. Trang chính sẽ hiện tiến độ mới khi tải lại.';
  };
}

/* nhập điểm: BTC nhập phiếu của từng giám khảo (9 Team × các tiêu chí) */
async function tabScore(body) {
  const teams = C.state.teams, crit = cfg.tieu_chi, scale = cfg.thang_diem;
  const all = (await sharedList('score:')).map(x => x.value).filter(Boolean);
  const judges = [...new Set(all.map(e => e.giam_khao))];
  let judge = body.dataset.judge || judges[0] || '';
  const draw = () => {
    const mine = all.filter(e => e.giam_khao === judge);
    body.innerHTML = `<p class="hub__note">Giám khảo chấm trên phiếu giấy hoặc Forms. Chọn tên giám khảo rồi nhập điểm của người đó cho từng Team (thang 0–${scale}).</p>
      <details class="hub__xl"><summary>Nhập từ file Excel của Microsoft Forms</summary>
        <label class="hub__drop" id="xl-drop"><input type="file" id="xl-file" accept=".xlsx,.xls,.csv" hidden><b>Kéo thả hoặc bấm để chọn file</b><span>Cột cần có: họ tên giám khảo, Team, và các cột trùng tên tiêu chí</span></label>
        <div id="xl-report"></div></details>
      <div class="hub__judges">${judges.map(j => `<button type="button" data-j="${C.esc(j)}" aria-pressed="${j === judge}">${C.esc(j)} <small>${all.filter(e => e.giam_khao === j).length}/${teams.length}</small></button>`).join('')}
        <button type="button" class="hub__add" id="j-add">+ Thêm giám khảo</button></div>
      ${judge ? `<div class="hub__scroll"><table class="hub__tbl hub__tbl--in"><thead><tr><th>Team</th>${crit.map(c => `<th class="n">${C.esc(c.ten)}</th>`).join('')}</tr></thead>
        <tbody>${teams.map(t => { const ex = mine.find(e => e.team === t.so); return `<tr><td>Team ${pad(t.so)} · ${C.esc(C.shortArea(t.mang))}</td>${crit.map(c =>
          `<td class="n"><input type="number" inputmode="decimal" min="0" max="${scale}" step="0.5" data-team="${t.so}" data-ma="${c.ma}" value="${ex?.diem?.[c.ma] ?? ''}" aria-label="Team ${pad(t.so)}, ${C.esc(c.ten)}"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
      <div class="hub__actions"><button class="btn btn--gold" type="button" id="s-save">Lưu điểm của ${C.esc(judge)}</button>
        <button class="btn btn--ghost btn--sm" type="button" id="s-del">Xoá giám khảo này</button><span class="hub__ok" id="s-ok"></span></div>`
      : `<p class="muted">Chưa có giám khảo nào. Bấm “+ Thêm giám khảo” để bắt đầu.</p>`}`;
    const xf = body.querySelector('#xl-file'), xd = body.querySelector('#xl-drop');
    xf.onchange = async e => { const f = e.target.files[0]; if (f && await importExcel(f, body.querySelector('#xl-report'))) { body.dataset.judge = ''; tabScore(body); } };
    ['dragover', 'dragenter'].forEach(ev => xd.addEventListener(ev, e => { e.preventDefault(); xd.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => xd.addEventListener(ev, e => { e.preventDefault(); xd.classList.remove('over'); }));
    xd.addEventListener('drop', async e => { const f = e.dataTransfer.files[0]; if (f && await importExcel(f, body.querySelector('#xl-report'))) tabScore(body); });
    body.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { judge = b.dataset.j; body.dataset.judge = judge; draw(); });
    body.querySelector('#j-add').onclick = () => { const n = (prompt('Tên giám khảo (ví dụ: Giám khảo 1 hoặc họ tên):') || '').trim(); if (n) { if (!judges.includes(n)) judges.push(n); judge = n; body.dataset.judge = n; draw(); } };
    const save = body.querySelector('#s-save');
    if (save) save.onclick = async () => {
      let n = 0;
      for (const t of teams) {
        const diem = {}; let any = false;
        body.querySelectorAll(`input[data-team="${t.so}"]`).forEach(i => { if (i.value !== '') { diem[i.dataset.ma] = Math.min(scale, Math.max(0, +i.value)); any = true; } });
        const key = `score:${slug(judge)}:${t.so}`;
        if (any) { const rec = { giam_khao: judge, team: t.so, diem, luc: new Date().toISOString() }; await sharedPut(key, rec); const i = all.findIndex(e => e.giam_khao === judge && e.team === t.so); if (i >= 0) all[i] = rec; else all.push(rec); n++; }
        else { await sharedDelete(key); const i = all.findIndex(e => e.giam_khao === judge && e.team === t.so); if (i >= 0) all.splice(i, 1); }
      }
      draw(); body.querySelector('#s-ok').textContent = `Đã lưu ${n} Team của ${judge}.`;
    };
    const del = body.querySelector('#s-del');
    if (del) del.onclick = async () => {
      if (!confirm(`Xoá toàn bộ điểm của ${judge}?`)) return;
      for (const t of teams) await sharedDelete(`score:${slug(judge)}:${t.so}`);
      for (let i = all.length - 1; i >= 0; i--) if (all[i].giam_khao === judge) all.splice(i, 1);
      judges.splice(judges.indexOf(judge), 1); judge = judges[0] || ''; body.dataset.judge = judge; draw();
    };
  };
  draw();
}

async function tabResult(body) {
  const entries = (await sharedList('score:')).map(x => x.value).filter(Boolean);
  const r = compute(entries, cfg.tieu_chi, cfg.thang_diem, C.state.teams.map(t => t.so));
  const rows = [...r.doi].sort((a, b) => (a.hang ?? 99) - (b.hang ?? 99) || a.so - b.so);
  const missing = r.doi.filter(t => !t.so_phieu).map(t => pad(t.so));
  const counts = r.doi.filter(t => t.so_phieu).map(t => t.so_phieu);
  body.innerHTML = `<div class="hub__stats"><div><b>${r.giam_khao.length}</b>giám khảo</div><div><b>${entries.length}</b>phiếu điểm</div><div><b>${cfg.cong_bo_diem ? 'Đã' : 'Chưa'}</b>công bố</div></div>
    ${entries.length && missing.length ? `<p class="hub__warn">Chưa có điểm cho Team ${missing.join(', ')}.</p>` : ''}
    ${counts.length && Math.min(...counts) !== Math.max(...counts) ? `<p class="hub__warn">Số giám khảo chấm giữa các Team chưa đều.</p>` : ''}
    <div class="hub__scroll"><table class="hub__tbl"><thead><tr><th>Hạng</th><th>Team</th>${cfg.tieu_chi.map(c => `<th class="n">${C.esc(c.ten)}</th>`).join('')}<th class="n">Tổng</th><th class="n">GK</th></tr></thead>
    <tbody>${rows.map(t => `<tr class="${t.hang === 1 ? 'is-top' : ''}"><td>${t.hang ?? '–'}</td><td>Team ${pad(t.so)}</td>${cfg.tieu_chi.map(c => `<td class="n">${t.diem[c.ma] ?? '–'}</td>`).join('')}<td class="n"><b>${t.tong ?? '–'}</b></td><td class="n">${t.so_phieu}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">Điểm mỗi tiêu chí là trung bình các giám khảo; tổng điểm có tính trọng số. Sang thẻ “Công bố & cài đặt” để đưa kết quả lên trang.</p>`;
}

async function tabVotes(body) {
  const votes = (await sharedList('vote:')).map(x => x.value).filter(Boolean);
  const t = tallyVotes(votes, members, C.state.teams.map(x => x.so), cfg.chi_thanh_vien_binh_chon !== false);
  const max = Math.max(1, ...t.doi.map(d => d.phieu));
  body.innerHTML = `<div class="hub__stats"><div><b>${t.tong_phieu}</b>phiếu hợp lệ</div><div><b>${t.so_phieu_loai}</b>phiếu bị loại</div><div><b>${members.length}</b>thành viên</div></div>
    <div class="hub__bars">${[...t.doi].sort((a, b) => b.phieu - a.phieu).map(d => `<div><span>Team ${pad(d.so)}</span><i style="--w:${d.phieu / max * 100}%"></i><b>${d.phieu}</b></div>`).join('')}</div>
    ${t.counted.length ? `<details class="hub__det"><summary>Danh sách đã bình chọn (${t.counted.length})</summary><ul>${t.counted.map(v => `<li>${C.esc(v.ten)} (Team ${pad(v.team_minh)}) → Team ${pad(v.team_chon)}</li>`).join('')}</ul></details>` : ''}
    ${t.rejected.length ? `<details class="hub__det"><summary>Phiếu bị loại (${t.rejected.length})</summary><ul>${t.rejected.map(v => `<li>${C.esc(v.ten)} → Team ${pad(v.team_chon)}: ${C.esc(v.ly_do)}</li>`).join('')}</ul></details>` : ''}`;
}

function tabPublish(body) {
  const crit = cfg.tieu_chi.map(c => ({ ...c }));
  const draw = () => {
    const W = crit.reduce((s, c) => s + (+c.trong_so || 0), 0) || 1;
    body.innerHTML = `<p class="hub__lbl">Công bố</p>
      <div class="hub__toggles">
        <label class="hub__switch"><input type="checkbox" id="p-score" ${cfg.cong_bo_diem ? 'checked' : ''}><span></span>Công bố điểm & bảng xếp hạng</label>
        <label class="hub__switch"><input type="checkbox" id="p-vopen" ${cfg.mo_binh_chon ? 'checked' : ''}><span></span>Mở bình chọn Team yêu thích</label>
        <label class="hub__switch"><input type="checkbox" id="p-vpub" ${cfg.cong_bo_binh_chon ? 'checked' : ''}><span></span>Công bố kết quả bình chọn (đóng bình chọn)</label>
      </div>
      <div class="hub__actions"><button type="button" class="btn btn--ghost btn--sm" id="p-snap">Cập nhật bảng xếp hạng đã công bố</button><span class="hub__ok" id="p-ok"></span></div>

      <p class="hub__lbl">Mã bình chọn</p>
      <div class="hub__row"><input id="p-code" placeholder="${cfg.ma_binh_chon ? 'Đã đặt mã. Nhập mã mới để thay' : 'Để trống nếu không cần mã'}"><button type="button" class="btn btn--ghost btn--sm" id="p-code-save">Lưu mã</button>${cfg.ma_binh_chon ? `<button type="button" class="btn btn--ghost btn--sm" id="p-code-clear">Bỏ mã</button>` : ''}</div>
      <p class="muted">BTC đọc mã này tại sự kiện, chỉ người có mặt mới bình chọn được. Không phân biệt chữ hoa, chữ thường.</p>

      <p class="hub__lbl">Tiêu chí chấm điểm</p>
      <div class="hub__crit">${crit.map((c, i) => `<div><input data-i="${i}" data-k="ten" value="${C.esc(c.ten)}" aria-label="Tên tiêu chí">
        <input data-i="${i}" data-k="trong_so" type="number" min="0" value="${c.trong_so}" aria-label="Trọng số"><span>${Math.round(c.trong_so / W * 100)}%</span>
        <button type="button" data-rm="${i}" aria-label="Xoá">×</button></div>`).join('')}</div>
      <div class="hub__actions"><button type="button" class="btn btn--ghost btn--sm" id="c-add">+ Thêm tiêu chí</button>
        <label class="hub__inline">Thang điểm <select id="c-scale">${[5, 10, 100].map(v => `<option ${v === cfg.thang_diem ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <button type="button" class="btn btn--gold btn--sm" id="c-save">Lưu tiêu chí</button></div>

      <p class="hub__lbl">Mật khẩu BTC</p>
      <div class="hub__row"><input type="password" id="p-pw" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" autocomplete="new-password"><button type="button" class="btn btn--ghost btn--sm" id="p-pw-save">Đổi mật khẩu</button></div>

      <p class="hub__lbl">Dữ liệu</p>
      <div class="hub__actions"><button type="button" class="btn btn--ghost btn--sm" id="d-export">Sao chép toàn bộ dữ liệu (JSON)</button>
        <button type="button" class="btn btn--ghost btn--sm hub__danger" id="d-reset">Xoá toàn bộ điểm & phiếu bầu</button></div>`;
    const ok = m => { const o = body.querySelector('#p-ok'); if (o) o.textContent = m; };
    body.querySelector('#p-score').onchange = async e => { cfg.cong_bo_diem = e.target.checked; if (cfg.cong_bo_diem) await snapshot(); await saveCfg(); ok(cfg.cong_bo_diem ? 'Đã công bố bảng xếp hạng.' : 'Đã ẩn bảng xếp hạng.'); };
    body.querySelector('#p-vopen').onchange = async e => { cfg.mo_binh_chon = e.target.checked; await saveCfg(); ok(cfg.mo_binh_chon ? 'Đã mở bình chọn.' : 'Đã đóng bình chọn.'); };
    body.querySelector('#p-vpub').onchange = async e => {
      cfg.cong_bo_binh_chon = e.target.checked;
      if (cfg.cong_bo_binh_chon) { // chụp kết quả tổng hợp để mọi người xem, không lộ ai bầu cho ai
        const votes = (await sharedList('vote:')).map(x => x.value).filter(Boolean);
        const t = tallyVotes(votes, members, C.state.teams.map(x => x.so), cfg.chi_thanh_vien_binh_chon !== false);
        await sharedPut('vote_result', { doi: t.doi, dan_dau: t.dan_dau, tong_phieu: t.tong_phieu, luc: new Date().toISOString() });
      }
      await saveCfg(); ok(cfg.cong_bo_binh_chon ? 'Đã công bố kết quả bình chọn.' : 'Đã ẩn kết quả bình chọn.'); };
    body.querySelector('#p-snap').onclick = async () => { await snapshot(); ok('Đã cập nhật bảng xếp hạng theo điểm mới nhất.'); };
    body.querySelector('#p-code-save').onclick = async () => { const v = body.querySelector('#p-code').value.trim().toLowerCase(); if (!v) return; cfg.ma_binh_chon = hash('vote:' + v); await saveCfg(); draw(); ok('Đã lưu mã bình chọn.'); };
    const clr = body.querySelector('#p-code-clear'); if (clr) clr.onclick = async () => { cfg.ma_binh_chon = ''; await saveCfg(); draw(); };
    body.querySelectorAll('.hub__crit input').forEach(inp => inp.onchange = () => { const c = crit[+inp.dataset.i]; if (inp.dataset.k === 'ten') c.ten = inp.value.trim() || c.ten; else c.trong_so = Math.max(0, +inp.value || 0); draw(); });
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (crit.length > 1) { crit.splice(+b.dataset.rm, 1); draw(); } });
    body.querySelector('#c-add').onclick = () => { let n = crit.length + 1; while (crit.some(c => c.ma === 'tieu_chi_' + n)) n++; crit.push({ ma: 'tieu_chi_' + n, ten: 'Tiêu chí mới', trong_so: 1 }); draw(); };
    body.querySelector('#c-save').onclick = async () => { cfg.tieu_chi = crit.map(c => ({ ...c })); cfg.thang_diem = +body.querySelector('#c-scale').value; await saveCfg(); ok('Đã lưu tiêu chí.'); };
    body.querySelector('#p-pw-save').onclick = async () => { const v = body.querySelector('#p-pw').value; if (v.length < 6) return alert('Mật khẩu cần ít nhất 6 ký tự.'); cfg.mat_khau_btc = hash('hk:' + v); await saveCfg(); ss.set('hk_btc', cfg.mat_khau_btc); body.querySelector('#p-pw').value = ''; ok('Đã đổi mật khẩu.'); };
    body.querySelector('#d-export').onclick = async () => {
      const data = { config: cfg, score: (await sharedList('score:')).map(x => x.value), vote: (await sharedList('vote:')).map(x => x.value), result: await sharedGet('result') };
      try { await navigator.clipboard.writeText(JSON.stringify(data, null, 2)); ok('Đã sao chép dữ liệu.'); } catch { ok('Trình duyệt không cho sao chép.'); }
    };
    body.querySelector('#d-reset').onclick = async () => {
      if (!confirm('Xoá toàn bộ điểm, phiếu bầu và bản công bố? Không hoàn tác được.')) return;
      for (const p of ['score:', 'vote:', 'result', 'vote_result']) for (const it of await sharedList(p)) await sharedDelete(it.key);
      cfg.cong_bo_diem = false; cfg.cong_bo_binh_chon = false; await saveCfg(); draw(); ok('Đã xoá dữ liệu.');
    };
  };
  draw();
}

async function snapshot() {
  const entries = (await sharedList('score:')).map(x => x.value).filter(Boolean);
  await sharedPut('result', { ...compute(entries, cfg.tieu_chi, cfg.thang_diem, C.state.teams.map(t => t.so)), cap_nhat_luc: new Date().toISOString() });
}
async function saveCfg() { const { _ghi_chu, ...rest } = cfg; await sharedPut('config', rest); }

/* nhập điểm từ file Excel tải về từ Microsoft Forms */
async function loadXLSX() {
  if (window.XLSX) return true;
  return new Promise(res => { const s = document.createElement('script'); s.src = 'vendor/sheetjs/xlsx.full.min.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
}
async function importExcel(f, rep) {
  rep.innerHTML = '<p class="muted">Đang đọc file…</p>';
  if (!(await loadXLSX())) { rep.innerHTML = '<p class="hub__warn">Bản này chưa kèm bộ đọc Excel. Hãy nhập tay ở bảng bên dưới.</p>'; return false; }
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) throw new Error('File không có dòng dữ liệu.');
    const headers = Object.keys(rows[0]);
    const find = tests => headers.find(h => tests.some(t => t(norm(h))));
    const colTeam = find([h => /^(team|doi)\b/.test(h), h => h.includes('team')]);
    const colJudge = find([h => h.includes('giam khao'), h => h === 'name' || h.includes('ho ten') || h.includes('ho va ten')]) || find([h => h.includes('email')]);
    const colCrit = Object.fromEntries(cfg.tieu_chi.map(c => [c.ma, find([h => h === norm(c.ten), h => h.includes(norm(c.ten))])]));
    const miss = [!colTeam && 'cột Team', !colJudge && 'cột giám khảo', ...cfg.tieu_chi.filter(c => !colCrit[c.ma]).map(c => `cột “${c.ten}”`)].filter(Boolean);
    if (miss.length) { rep.innerHTML = `<p class="hub__warn">Không tìm thấy: ${miss.map(C.esc).join(', ')}. Các cột trong file: ${headers.map(C.esc).join(', ')}.</p>`; return false; }
    let ok = 0, bad = 0;
    for (const r of rows) {
      const team = +(String(r[colTeam]).match(/\d+/) || [])[0], judge = String(r[colJudge]).trim();
      const diem = {}; let full = true;
      for (const c of cfg.tieu_chi) { const v = parseFloat(String(r[colCrit[c.ma]]).replace(',', '.')); if (Number.isFinite(v)) diem[c.ma] = Math.min(cfg.thang_diem, Math.max(0, v)); else full = false; }
      if (!C.state.teams.some(t => t.so === team) || !judge || !full) { bad++; continue; }
      await sharedPut(`score:${slug(judge)}:${team}`, { giam_khao: judge, team, diem, luc: new Date().toISOString(), nguon: f.name }); ok++;
    }
    rep.innerHTML = `<p class="hub__ok">Đã nhập ${ok} phiếu từ “${C.esc(f.name)}”.${bad ? ` Bỏ qua ${bad} dòng thiếu dữ liệu.` : ''}</p>`;
    return ok > 0;
  } catch (err) { rep.innerHTML = `<p class="hub__warn">Không đọc được file: ${C.esc(err.message)}</p>`; return false; }
}
