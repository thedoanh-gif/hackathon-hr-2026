// Tính điểm HR Day Hackathon: dùng chung cho trang quản trị.
// entries: [{ giam_khao, team, diem: { ma: số } }]
export function compute(entries, criteria, scale = 10, teamNumbers = []) {
  const W = criteria.reduce((s, c) => s + (+c.trong_so || 0), 0) || 1;
  // mỗi giám khảo chỉ tính phiếu cuối cùng cho mỗi Team
  const last = new Map();
  for (const e of entries) if (e && e.team) last.set(`${norm(e.giam_khao)}|${e.team}`, e);
  const byTeam = new Map();
  for (const e of last.values()) { if (!byTeam.has(e.team)) byTeam.set(e.team, []); byTeam.get(e.team).push(e); }
  const teams = [...new Set([...teamNumbers, ...byTeam.keys()])].sort((a, b) => a - b);
  const rows = teams.map(so => {
    const list = byTeam.get(so) || [];
    const diem = {};
    for (const c of criteria) {
      const v = list.map(e => +e.diem?.[c.ma]).filter(x => Number.isFinite(x));
      diem[c.ma] = v.length ? round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    }
    const ok = criteria.every(c => diem[c.ma] != null);
    const tong = ok ? round(criteria.reduce((s, c) => s + diem[c.ma] * (+c.trong_so || 0), 0) / W) : null;
    return { so, diem, tong, so_phieu: list.length };
  });
  const ranked = rows.filter(r => r.tong != null).sort((a, b) => b.tong - a.tong);
  ranked.forEach((r, i) => { r.hang = i && r.tong === ranked[i - 1].tong ? ranked[i - 1].hang : i + 1; });
  rows.forEach(r => { if (r.tong == null) r.hang = null; });
  const judges = [...new Set([...last.values()].map(e => (e.giam_khao || '').trim()).filter(Boolean))];
  return { thang_diem: scale, tieu_chi: criteria, giam_khao: judges, doi: rows };
}
export const round = x => Math.round(x * 100) / 100;
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
export const slug = s => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Bình chọn Team yêu thích: mỗi người 1 phiếu (lấy phiếu cuối), không được chọn Team của mình.
// votes: [{ nguoi, team_minh, team_chon }]; members: [{ ten, team }]
export const tokens = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean).sort().join(' ');
export function tallyVotes(votes, members, teamNumbers, onlyMembers = true) {
  const idx = new Map(), byEmail = new Map();
  for (const m of members) {
    const k = tokens(m.ten); idx.set(k, idx.has(k) ? null : m); // null = trùng tên, không xác định được
    if (m.email) byEmail.set(String(m.email).toLowerCase(), m);
  }
  const who = v => String(v.email || '').toLowerCase() || tokens(v.nguoi ?? v.ten ?? '');
  const last = new Map();
  for (const v of votes) { const k = who(v); if (k) last.set(k, v); }
  const counted = [], rejected = [];
  for (const v of last.values()) {
    const e = String(v.email || '').toLowerCase();
    const m = e && byEmail.has(e) ? byEmail.get(e) : idx.get(tokens(v.nguoi ?? v.ten ?? ''));
    const own = m ? m.team : (v.team_minh || null);
    if (!teamNumbers.includes(v.team_chon)) { rejected.push({ ...v, ly_do: 'Team không hợp lệ' }); continue; }
    if (m === undefined && onlyMembers) { rejected.push({ ...v, ly_do: 'Không có trong danh sách thành viên' }); continue; }
    if (m === null && !v.team_minh) { rejected.push({ ...v, ly_do: 'Trùng tên, cần chọn Team của mình' }); continue; }
    if (own && own === v.team_chon) { rejected.push({ ...v, ly_do: 'Bình chọn cho Team của mình' }); continue; }
    counted.push({ ...v, team_minh: own });
  }
  const doi = teamNumbers.map(so => ({ so, phieu: counted.filter(v => v.team_chon === so).length }));
  const max = Math.max(0, ...doi.map(d => d.phieu));
  return { tong_phieu: counted.length, so_phieu_loai: rejected.length, doi, dan_dau: max ? doi.filter(d => d.phieu === max).map(d => d.so) : [], counted, rejected };
}
