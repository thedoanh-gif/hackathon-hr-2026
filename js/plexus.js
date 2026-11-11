// Nền lưới đa giác (plexus) rất mờ, trôi chậm. Thêm ngày 11/11/2026.
// Một canvas cố định sau toàn trang; màu nét đổi theo nền sáng/tối (biến --plx trên <html>).
// Giảm chuyển động: vẽ một khung tĩnh. Tab ẩn: dừng vẽ.
(() => {
  const cv = document.createElement('canvas');
  cv.className = 'plexus'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, pts = [], LINK = 150;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    LINK = Math.max(110, Math.min(170, W / 9));
    const n = Math.round(Math.min(90, Math.max(28, W * H / 16000)));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .14, vy: (Math.random() - .5) * .14,
      r: Math.random() * 1.4 + .6, hue: Math.random()
    }));
  }

  // màu: nền tối dùng xanh sáng + tím; nền sáng dùng navy rất nhạt
  function palette() {
    const dark = document.documentElement.dataset.ground !== 'light';
    return dark
      ? { a: [110, 160, 255], b: [168, 124, 232], line: .16, fill: .05, dot: .55 }
      : { a: [35, 76, 135], b: [120, 90, 190], line: .09, fill: .025, dot: .28 };
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function draw() {
    const P = palette();
    ctx.clearRect(0, 0, W, H);
    const L2 = LINK * LINK;
    // tam giác mờ: ba điểm gần nhau từng đôi một
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i];
      let q = null, r = null;
      for (let j = 0; j < pts.length && !r; j++) {
        if (j === i) continue;
        const o = pts[j], d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
        if (d < L2 * .55) { if (!q) q = o; else if ((o.x - q.x) ** 2 + (o.y - q.y) ** 2 < L2 * .55) r = o; }
      }
      if (q && r) {
        const c = mix(P.a, P.b, p.hue);
        ctx.fillStyle = `rgba(${c},${P.fill})`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill();
      }
    }
    // nét nối
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const o = pts[j], d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
        if (d > L2) continue;
        const c = mix(P.a, P.b, (p.hue + o.hue) / 2);
        ctx.strokeStyle = `rgba(${c},${(P.line * (1 - d / L2)).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(o.x, o.y); ctx.stroke();
      }
    }
    // điểm sáng
    for (const p of pts) {
      const c = mix(P.a, P.b, p.hue);
      ctx.fillStyle = `rgba(${c},${P.dot})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
  }

  function step() {
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -40) p.x = W + 40; else if (p.x > W + 40) p.x = -40;
      if (p.y < -40) p.y = H + 40; else if (p.y > H + 40) p.y = -40;
    }
  }

  let last = 0, raf = 0;
  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return;            // ~30 khung/giây là đủ cho chuyển động chậm
    last = t; step(); draw();
  }
  resize(); draw();
  addEventListener('resize', () => { resize(); draw(); }, { passive: true });
  if (!reduce) {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    });
  } else {
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ground'] });
  }
})();
