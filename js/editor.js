// CHẾ ĐỘ CHỈNH SỬA TRỰC TIẾP: BTC (đã mở khoá trang quản trị) bấm vào chữ trên trang để sửa, rồi Lưu.
// Lưu vào khoá "content": { data: { "program.lo_trinh.0.tieu_de": "...", ... }, html: { "mo-dau.2": "...", ... } }
import { sharedGet, sharedPut } from './store.js';
import { hash } from './btc.js';

let C, editing = false, original = new Map();
const unlocked = cfg => { try { return sessionStorage.getItem('hk_btc') === cfg.mat_khau_btc; } catch { return false; } };

export async function initEditor(ctx) {
  C = ctx;
  const cfg = { ...(C.state.config || {}), ...(await sharedGet('config') || {}) };
  if (!unlocked(cfg)) return;
  const bar = document.createElement('div');
  bar.className = 'ed'; bar.id = 'ed-bar';
  bar.innerHTML = `<button type="button" class="ed__go" id="ed-go">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>Chỉnh sửa nội dung</button>
    <div class="ed__on" hidden><span class="ed__msg" id="ed-msg">Bấm vào chữ có viền nét đứt để sửa · Shift+Enter để xuống dòng</span>
      <button type="button" class="ed__btn ed__btn--main" id="ed-save">Lưu</button>
      <button type="button" class="ed__btn" id="ed-cancel">Huỷ</button>
      <button type="button" class="ed__btn ed__btn--ghost" id="ed-reset" title="Bỏ toàn bộ chỉnh sửa, quay về nội dung trong file dữ liệu">Khôi phục bản gốc</button></div>`;
  document.body.appendChild(bar);
  bar.querySelector('#ed-go').onclick = start;
  bar.querySelector('#ed-save').onclick = save;
  bar.querySelector('#ed-cancel').onclick = () => stop(true);
  let auto = false; try { auto = sessionStorage.getItem('hk_edit') === '1'; sessionStorage.removeItem('hk_edit'); } catch {}
  if (auto) setTimeout(start, 300);
  bar.querySelector('#ed-reset').onclick = async () => {
    if (!confirm('Bỏ toàn bộ nội dung đã sửa trên trang và quay về bản gốc?')) return;
    await sharedPut('content', { data: {}, html: {} }); location.reload();
  };
}

const fields = () => [...document.querySelectorAll('main [data-ed]')].filter(el => !el.closest('[hidden]'));
function start() {
  editing = true; original.clear();
  document.documentElement.classList.add('is-editing');
  C.$('#ed-go').hidden = true; C.$('.ed__on').hidden = false;
  for (const el of fields()) {
    original.set(el, el.innerHTML);
    el.contentEditable = el.dataset.ed.startsWith('html:') ? 'true' : 'plaintext-only';
    el.spellcheck = false;
  }
  document.addEventListener('keydown', keys, true);
  document.addEventListener('click', blockLinks, true);
  document.addEventListener('paste', plainPaste, true);
}
function stop(revert) {
  for (const el of fields()) {
    if (revert && original.has(el)) el.innerHTML = original.get(el);
    el.removeAttribute('contenteditable');
  }
  editing = false; document.documentElement.classList.remove('is-editing');
  C.$('#ed-go').hidden = false; C.$('.ed__on').hidden = true;
  document.removeEventListener('keydown', keys, true);
  document.removeEventListener('click', blockLinks, true);
  document.removeEventListener('paste', plainPaste, true);
}
function keys(e) {
  if (!editing) return;
  if (e.key === 'Escape') { e.preventDefault(); stop(true); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  // Enter: xuống dòng. Ô dữ liệu ngắn (tên giai đoạn, tiêu đề tuần): Enter = xong ô, Shift+Enter = xuống dòng.
  if (e.key === 'Enter' && e.target.isContentEditable) {
    const html = e.target.dataset.ed?.startsWith('html:');
    const shortField = !html && /\.(ten|tieu_de|moc)$/.test(e.target.dataset.ed || '');
    if (shortField && !e.shiftKey) { e.preventDefault(); e.target.blur(); return; }
    e.preventDefault(); document.execCommand(html ? 'insertLineBreak' : 'insertText', false, html ? undefined : '\n');
  }
}
function blockLinks(e) { if (e.target.closest('[contenteditable]') && e.target.closest('a, button')) e.preventDefault(); }
function plainPaste(e) { if (!e.target.closest('[contenteditable]')) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text')); }

async function save() {
  const cur = await sharedGet('content') || {};
  const data = { ...(cur.data || {}) }, html = { ...(cur.html || {}) };
  let n = 0;
  for (const el of fields()) {
    if (!original.has(el) || el.innerHTML === original.get(el)) continue;
    const k = el.dataset.ed;
    if (k.startsWith('html:')) html[k.slice(5)] = el.innerHTML;
    else data[k] = el.innerText.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    n++;
  }
  if (n) await sharedPut('content', { data, html, cap_nhat_luc: new Date().toISOString() });
  stop(false);
  const msg = n ? `Đã lưu ${n} chỗ sửa.` : 'Không có thay đổi.';
  toast(msg);
  if (n) setTimeout(() => location.reload(), 700); // vẽ lại để các phần dùng chung dữ liệu cùng cập nhật
}
function toast(t) {
  let el = C.$('#ed-toast'); if (!el) { el = document.createElement('div'); el.id = 'ed-toast'; el.className = 'ed__toast'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200);
}
