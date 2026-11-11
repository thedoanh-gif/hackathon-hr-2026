// ĐĂNG LÊN GITHUB: gom dữ liệu BTC đang cập nhật thành data/live.json và ghi thẳng lên kho GitHub
// qua GitHub API. Trang GitHub Pages đọc file này nên mọi người thấy bản mới sau 1–2 phút.
// Không đăng: điểm chi tiết của từng giám khảo, phiếu bầu từng người, mật khẩu, mã bình chọn.
import { sharedGet, sharedList, storageInfo } from './store.js';

const LS = 'hk_github';
const conf = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const saveConf = c => { try { localStorage.setItem(LS, JSON.stringify(c)); } catch {} };
const b64 = str => { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin); };

export async function buildLive() {
  const cfg = await sharedGet('config') || {};
  const out = { _ghi_chu: 'Do trang quản trị tạo khi BTC bấm "Đăng lên GitHub". Không sửa tay.', cap_nhat_luc: new Date().toISOString() };
  const content = await sharedGet('content'); if (content) out.content = content;
  const prog = await sharedGet('team_progress'); if (prog) out.team_progress = prog;
  // chỉ những cấu hình hiển thị công khai
  const pub = {};
  for (const k of ['tieu_chi', 'thang_diem', 'cong_bo_diem', 'cong_bo_binh_chon', 'mo_binh_chon']) if (cfg[k] !== undefined) pub[k] = cfg[k];
  if (Object.keys(pub).length) out.config = pub;
  if (cfg.cong_bo_diem) { const r = await sharedGet('result'); if (r) out.result = r; }
  if (cfg.cong_bo_binh_chon) { const v = await sharedGet('vote_result'); if (v) out.vote_result = v; }
  return out;
}

export async function publishPanel(body, { C }) {
  const c = conf();
  const info = await storageInfo();
  const live = await buildLive();
  const nContent = Object.keys(live.content?.data || {}).length + Object.keys(live.content?.html || {}).length;
  const nProg = Object.values(live.team_progress || {}).filter(o => Object.values(o).some(v => v)).length;
  body.innerHTML = `
    ${info.shared ? `<p class="hub__warn">Trang này đang dùng kho dữ liệu dùng chung của Claude, không cần đăng lên GitHub. Mục này dành cho bản chạy trên GitHub Pages.</p>` : ''}
    <p class="hub__note">Bấm <b>Đăng lên</b> để đưa các cập nhật trên máy này lên trang GitHub. Mọi người tải lại trang sau khoảng 1–2 phút sẽ thấy bản mới.</p>
    <div class="hub__stats"><div><b>${nContent}</b>chỗ sửa nội dung</div><div><b>${nProg}</b>Team có cập nhật tiến độ</div><div><b>${live.result ? 'Có' : 'Không'}</b>bảng xếp hạng (chỉ khi đã công bố)</div></div>
    <p class="hub__lbl">Kho GitHub</p>
    <div class="hub__row"><input id="gh-repo" value="${C.esc(c.repo || 'thedoanh-gif/hackathon-hr-2026')}" placeholder="tài-khoản/tên-kho"><input id="gh-branch" value="${C.esc(c.branch || 'main')}" style="max-width:120px" aria-label="Nhánh"></div>
    <p class="hub__lbl">Mã truy cập GitHub (token)</p>
    <div class="hub__row"><input type="password" id="gh-token" placeholder="github_pat_..." value="${C.esc(c.token || '')}" autocomplete="off"></div>
    <label class="hub__switch" style="margin-top:10px"><input type="checkbox" id="gh-remember" ${c.token ? 'checked' : ''}><span></span>Ghi nhớ token trên máy này</label>
    <div class="hub__actions"><button class="btn btn--gold" type="button" id="gh-go">Đăng lên GitHub</button><span class="hub__ok" id="gh-ok" role="status"></span></div>
    <details class="hub__det"><summary>Cách tạo token (làm một lần)</summary><ol class="hub__list">
      <li>GitHub → ảnh đại diện → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
      <li><b>Repository access</b>: chọn <i>Only select repositories</i> → kho <b>hackathon-hr-2026</b>.</li>
      <li><b>Permissions</b> → <b>Repository permissions</b> → <b>Contents</b>: <b>Read and write</b>. Không cấp quyền nào khác.</li>
      <li>Đặt hạn dùng (ví dụ đến 31/12/2026) → <b>Generate</b> → sao chép mã và dán vào ô trên.</li></ol>
      <p class="muted">Token chỉ gửi tới GitHub, không ghi vào mã nguồn trang. Không bật “Ghi nhớ” trên máy dùng chung.</p></details>
    <details class="hub__det"><summary>Xem nội dung sẽ đăng (data/live.json)</summary><pre class="hub__pre">${C.esc(JSON.stringify(live, null, 2))}</pre></details>`;
  const ok = (t, bad) => { const o = body.querySelector('#gh-ok'); o.textContent = t; o.style.color = bad ? '#B3402E' : ''; };
  body.querySelector('#gh-go').onclick = async () => {
    const repo = body.querySelector('#gh-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const branch = body.querySelector('#gh-branch').value.trim() || 'main';
    const token = body.querySelector('#gh-token').value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return ok('Tên kho chưa đúng dạng tài-khoản/tên-kho.', true);
    if (!token) return ok('Cần nhập token.', true);
    saveConf({ repo, branch, token: body.querySelector('#gh-remember').checked ? token : '' });
    ok('Đang đăng…');
    const api = `https://api.github.com/repos/${repo}/contents/data/live.json`;
    const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    try {
      let sha;
      const g = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers: H });
      if (g.status === 200) sha = (await g.json()).sha;
      else if (g.status === 401) throw new Error('Token không hợp lệ hoặc đã hết hạn.');
      else if (g.status === 403) throw new Error('Token chưa có quyền ghi (Contents: Read and write).');
      else if (g.status !== 404) throw new Error('GitHub báo lỗi ' + g.status + '.');
      const fresh = await buildLive();
      const p = await fetch(api, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Cập nhật dữ liệu trang (' + new Date().toLocaleString('vi-VN') + ')', content: b64(JSON.stringify(fresh, null, 2)), branch, ...(sha ? { sha } : {}) }) });
      if (!p.ok) { const e = await p.json().catch(() => ({})); throw new Error(p.status === 404 ? 'Không tìm thấy kho, hoặc token không được cấp quyền vào kho này.' : p.status === 409 ? 'File vừa thay đổi ở nơi khác, bấm Đăng lên lại.' : (e.message || 'GitHub báo lỗi ' + p.status)); }
      ok('Đã đăng. Trang GitHub sẽ cập nhật sau khoảng 1–2 phút.');
    } catch (err) { ok(err.message === 'Failed to fetch' ? 'Không kết nối được GitHub từ trang này (mạng hoặc trình duyệt chặn).' : err.message, true); }
  };
}
