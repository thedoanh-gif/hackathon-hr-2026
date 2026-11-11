// ============================================================================
// LỚP DỮ LIỆU · điểm duy nhất cần thay khi chuyển nền tảng
// ----------------------------------------------------------------------------
// Tự chọn nơi lưu:
//  1. Trang Claude (artifact) có khai báo capability `db`  → kho dữ liệu DÙNG CHUNG:
//     mọi người mở link thấy cùng nội dung. Quyền ghi theo mức chia sẻ:
//       · dữ liệu BTC (config, điểm, tiến độ, nội dung, kết quả): chỉ Owner/Editor ghi
//       · phiếu bình chọn: mỗi tài khoản Contributor trở lên ghi đúng 1 phiếu của mình
//  2. Không có kho dùng chung (mở file trên máy, localhost) → localStorage của trình duyệt.
//
// >>> GHI CHÚ CHO AGENT CỦA AMAZON QUICK <<<
// Thay phần "localStorage" bằng app storage phạm vi SHARED của apps in Quick
// (Get / Put / List / Delete Item; insert=true dùng chế độ INSERT). Không cần đổi file khác.
//
// Khoá dữ liệu dùng trong app:
//   config                      cấu hình: tieu_chi[], thang_diem, mat_khau_btc (băm), ma_binh_chon (băm), mo_binh_chon, cong_bo_diem, cong_bo_binh_chon
//   score:<tên-giám-khảo>:<số team>   điểm do BTC nhập { giam_khao, team, diem{ma:số}, luc }
//   vote:ten:<tên-người-bầu>    phiếu bình chọn { ten, team_minh, team_chon, luc }  (INSERT, mỗi người 1 phiếu)
//   result                      bản chụp kết quả khi BTC bấm Công bố
//   vote_result                 bản tổng hợp bình chọn khi BTC công bố (không có danh sách người bầu)
//   content                     chữ BTC sửa trực tiếp trên trang { data: {đường dẫn: chữ}, html: {khoá: html} }
//   team_progress               tiến độ do BTC cập nhật { <số team>: { tien_do, trang_thai_y_tuong, doi_truong, ten_nhom } }
// ============================================================================

/* ---------- 1 · kho dùng chung của trang Claude ---------- */
let backend = null; // { db, uid } | false
const ready = (async () => {
  try {
    if (!window.claude?.use) return false;
    const db = await window.claude.use('db');
    if (!db) return false;
    const user = await window.claude.use('user');
    const uid = user ? await user.id() : null;
    return { db, uid, user };
  } catch { return false; }
})().then(async b => { backend = b; if (b) await migrateLocal(b).catch(() => {}); return b; });

// Lần đầu mở bằng tài khoản có quyền sửa: chuyển dữ liệu đã lưu trên trình duyệt (chữ đã sửa, tiến độ,
// điểm, cấu hình) lên kho dùng chung. Chỉ thêm những mục kho chưa có; không đụng phiếu bình chọn.
async function migrateLocal({ db, user }) {
  if (!user || !(await user.canEdit())) return;
  let keys = []; try { keys = Object.keys(localStorage).filter(k => k.startsWith('hk_shared:') && !k.startsWith('hk_shared:vote:')); } catch { return; }
  if (!keys.length) return;
  let moved = 0;
  for (const full of keys) {
    const key = full.slice('hk_shared:'.length);
    let v; try { v = JSON.parse(localStorage.getItem(full)); } catch { continue; }
    if (v == null) continue;
    const ref = db.doc('hk/' + key.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 190));
    if ((await ref.get()).exists) continue;
    await ref.set({ k: key, t: key.split(':')[0], v }); moved++;
  }
  if (moved) { try { for (const k of keys) localStorage.setItem('hk_migrated:' + k, '1'); } catch {} console.info(`[store] đã chuyển ${moved} mục từ trình duyệt lên kho dùng chung`); }
}

export async function storageInfo() {
  await ready;
  if (!backend) return { shared: false };
  const { user } = backend;
  return { shared: true, uid: backend.uid, canEdit: user ? await user.canEdit() : null, isOwner: user ? await user.isOwner() : null };
}
const friendly = e => {
  const err = new Error(e?.code === 'invalid_argument' ? 'Bạn chưa có quyền ghi dữ liệu này. Chủ trang cần cấp quyền Editor cho bạn trong nút Share.'
    : e?.code === 'quota_exceeded' ? 'Kho dữ liệu đã đầy.' : 'Không lưu được, vui lòng thử lại.');
  err.code = e?.code || 'unknown'; return err;
};
const typeOf = k => k.split(':')[0];
const docId = k => k.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 190);
const isVote = k => k.startsWith('vote:');

async function dbGet(key) {
  const { db } = backend;
  if (isVote(key)) {
    const q = await db.collection('votes').where('k', '==', key).limit(1).get();
    return q.empty ? null : q.docs[0].data().v ?? null;
  }
  const s = await db.doc('hk/' + docId(key)).get();
  return s.exists ? s.data().v ?? null : null;
}
async function dbPut(key, value, insert) {
  const { db, uid } = backend;
  try {
    if (isVote(key)) {
      if (!uid) { const e = new Error('Cần đăng nhập để bình chọn.'); e.code = 'NO_ID'; throw e; }
      const mine = await db.doc('votes/' + uid).get();
      if (insert && (mine.exists || await dbGet(key) != null)) { const e = new Error('Khoá đã tồn tại'); e.code = 'EXISTS'; throw e; }
      await db.doc('votes/' + uid).set({ k: key, t: 'vote', v: value });
      return true;
    }
    const ref = db.doc('hk/' + docId(key));
    if (insert && (await ref.get()).exists) { const e = new Error('Khoá đã tồn tại'); e.code = 'EXISTS'; throw e; }
    await ref.set({ k: key, t: typeOf(key), v: value });
    return true;
  } catch (e) { if (e.code === 'EXISTS' || e.code === 'NO_ID') throw e; throw friendly(e); }
}
async function dbList(prefix) {
  const { db } = backend;
  const q = prefix.startsWith('vote:') ? await db.collection('votes').get() : await db.collection('hk').where('t', '==', typeOf(prefix)).get();
  return q.docs.map(d => d.data()).filter(d => d.k?.startsWith(prefix)).map(d => ({ key: d.k, value: d.v }));
}
async function dbDelete(key) {
  const { db } = backend;
  try {
    if (isVote(key)) { const q = await db.collection('votes').where('k', '==', key).get(); for (const d of q.docs) await db.doc('votes/' + d.id).delete(); return; }
    await db.doc('hk/' + docId(key)).delete();
  } catch (e) { throw friendly(e); }
}

/* ---------- 2 · localStorage (máy cá nhân / bản chạy thử) ---------- */
const NS = 'hk_shared:';
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  keys() { try { return Object.keys(localStorage); } catch { return []; } }
};
const mem = new Map();
const lsGet = key => { const raw = ls.get(NS + key) ?? mem.get(NS + key); try { return raw == null ? null : JSON.parse(raw); } catch { return null; } };

/* ---------- API chung (giữ nguyên chữ ký) ---------- */
export async function sharedGet(key) { await ready; return backend ? dbGet(key) : lsGet(key); }
export async function sharedPut(key, value, { insert = false } = {}) {
  await ready;
  if (backend) return dbPut(key, value, insert);
  if (insert && lsGet(key) != null) { const e = new Error('Khoá đã tồn tại'); e.code = 'EXISTS'; throw e; }
  const v = JSON.stringify(value); if (!ls.set(NS + key, v)) mem.set(NS + key, v); return true;
}
export async function sharedList(prefix) {
  await ready;
  if (backend) return dbList(prefix);
  const keys = new Set([...ls.keys(), ...mem.keys()].filter(k => k.startsWith(NS + prefix)));
  return [...keys].map(k => ({ key: k.slice(NS.length), value: lsGet(k.slice(NS.length)) }));
}
export async function sharedDelete(key) { await ready; if (backend) return dbDelete(key); ls.del(NS + key); mem.delete(NS + key); }

// tương thích với bản trước
export function isDemo() { return false; }
export async function getUser() { return null; }
export function setDemoUser() {}
