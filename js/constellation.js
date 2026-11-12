// Chòm sao 3D · 9 đội trong một khối lập phương
// Three.js r160 + OrbitControls (tải cục bộ trong vendor/, chạy được trên GitHub Pages).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GOLD = 0xB88A2D, GOLD_SOFT = 0xE3C27A, NAVY_LINE = 0x6F8FC0;
// Vị trí cố định, trải đều trong khối (±4): mỗi lần mở trang chòm sao giống nhau.
const POS = [
  [-2.6, 1.9, -1.4], [0.5, 2.8, 1.9], [2.8, 1.3, -2.3],
  [-1.5, -0.3, 2.7], [1.5, 0.1, 0.4], [-3.0, -1.7, -2.5],
  [0.1, -2.6, -1.0], [2.9, -2.3, 2.3], [-0.6, 0.9, -3.1]
];
const DEFAULT_DIR = new THREE.Vector3(0.62, 0.36, 1).normalize();

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const pad = n => String(n).padStart(2, '0');

function tex(draw, w = 256, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
// quầng sáng theo màu tiến độ của team
const glowTex = hex => tex((g, w, h) => {
  const [r0, g0, b0] = rgb(hex);
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.16, `rgba(${r0},${g0},${b0},.85)`);
  r.addColorStop(.45, `rgba(${r0},${g0},${b0},.24)`); r.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const ringTex = (hex = '#E3C27A') => tex((g, w, h) => {
  const [r0, g0, b0] = rgb(hex);
  g.strokeStyle = `rgba(${r0},${g0},${b0},1)`; g.lineWidth = 7;
  g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = `rgba(${r0},${g0},${b0},.35)`; g.lineWidth = 2;
  g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 26, 0, Math.PI * 2); g.stroke();
});
const labelTex = (so, label, hex) => tex((g, w, h) => {
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(10,18,30,.8)'; g.shadowBlur = 12;
  g.fillStyle = '#FFFFFF'; g.font = '700 92px DINRoundOT, system-ui, sans-serif';
  g.fillText(pad(so), w / 2, 104);
  g.fillStyle = hex === '#F4F6FA' ? '#FFFFFF' : hex; g.font = '500 34px DINRoundOT, system-ui, sans-serif';
  g.fillText(label.length > 16 ? label.slice(0, 15) + '…' : label, w / 2, 150);
}, 384, 176);

export function createGalaxy({ stage, canvas, tip, hint, teams, onSelect, isMobile }) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x16243A, 16, 34);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  let baseDist = 15;
  camera.position.copy(DEFAULT_DIR).multiplyScalar(baseDist);

  // --- khối lập phương: khung mảnh + chấm góc ---
  const S = 4;
  const cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S * 2, S * 2, S * 2)),
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: .38 }));
  scene.add(cube);
  // mặt khối rất mờ: đọc thành một "khối" chung, không chỉ là khung
  const shell = new THREE.Mesh(new THREE.BoxGeometry(S * 2, S * 2, S * 2),
    new THREE.MeshBasicMaterial({ color: 0x2F5D9F, transparent: true, opacity: .05, depthWrite: false, side: THREE.BackSide }));
  scene.add(shell);
  // nhãn "KHỐI NHÂN SỰ" trên nóc khối
  const cubeLabel = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, transparent: true, opacity: .9,
    map: tex((g, w, h) => { g.textAlign = 'center'; g.fillStyle = '#E3C27A'; g.font = '700 64px DINRoundOT, system-ui, sans-serif';
      g.fillText('KHỐI NHÂN SỰ', w / 2, 84); g.fillStyle = 'rgba(232,238,247,.6)'; g.font = '500 34px DINRoundOT, system-ui, sans-serif';
      g.fillText('Tập đoàn TH', w / 2, 136); }, 640, 160) }));
  cubeLabel.scale.set(4.4, 1.1, 1); cubeLabel.position.set(0, S + .95, 0); scene.add(cubeLabel);
  const corners = [];
  for (const x of [-S, S]) for (const y of [-S, S]) for (const z of [-S, S]) corners.push(x, y, z);
  const cornerGeo = new THREE.BufferGeometry(); cornerGeo.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
  scene.add(new THREE.Points(cornerGeo, new THREE.PointsMaterial({ color: GOLD_SOFT, size: .14, transparent: true, opacity: .9 })));
  // lưới đáy mờ để có cảm giác chiều sâu
  const grid = new THREE.GridHelper(S * 2, 8, NAVY_LINE, NAVY_LINE);
  grid.position.y = -S; grid.material.transparent = true; grid.material.opacity = .14; scene.add(grid);

  // --- bụi sáng ---
  const dust = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) dust.push((rnd() * 2 - 1) * S, (rnd() * 2 - 1) * S, (rnd() * 2 - 1) * S);
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xA9BEDD, size: .04, transparent: true, opacity: .55, depthWrite: false }));
  scene.add(dustPts);

  // --- 9 điểm sáng ---
  const texCache = {};
  const getTex = (k, f) => texCache[k] || (texCache[k] = f());
  const nodes = teams.map((t, i) => {
    const p = new THREE.Vector3(...(POS[i] || [0, 0, 0]));
    const group = new THREE.Group(); group.position.copy(p);
    const col = t.color || '#F4F6FA';
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('g' + col, () => glowTex(col)), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(1.9);
    const core = new THREE.Mesh(new THREE.SphereGeometry(.15, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).lerp(new THREE.Color(0xffffff), .55), transparent: true }));
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('r' + col, () => ringTex(col === '#F4F6FA' ? '#E3C27A' : col)), depthWrite: false, transparent: true, opacity: 0 }));
    ring.scale.setScalar(1.25);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(t.so, t.label, col), depthWrite: false, depthTest: false, transparent: true }));
    label.scale.set(1.75, .8, 1); label.position.y = .95; label.renderOrder = 10;
    group.add(glow, core, ring, label);
    scene.add(group);
    // đường thả xuống đáy: giúp mắt đoán độ sâu
    return { so: t.so, t, p, group, glow, core, ring, label, scale: 1, target: 1, alpha: 1, alphaT: 1, ringA: 0, ringT: 0, phase: i * 1.37 };
  });
  // nối mỗi điểm với 2 điểm gần nhất: hình chòm sao
  // tia sáng nối mỗi điểm với 2 điểm gần nhất: lõi sáng + quầng mờ, có luồng sáng chạy qua chạy lại
  const pairs = [], seen = new Set();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => ({ j, d: a.p.distanceTo(b.p) })).filter(o => o.j !== i).sort((x, y) => x.d - y.d).slice(0, 2)
      .forEach(({ j }) => { const k = [i, j].sort().join('-'); if (!seen.has(k)) { seen.add(k); pairs.push([i, j]); } });
  });
  const beamVS = `varying float vU; void main(){ vU = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
  const beamFS = `uniform float uT, uSpeed, uPhase, uDim, uBase, uPeak; uniform vec3 uColor; varying float vU;
    void main(){
      float p = 0.5 + 0.5 * sin(uT * uSpeed + uPhase);          // vị trí luồng sáng, chạy qua chạy lại
      float d = vU - p;
      float pulse = exp(-d * d * 55.0);                        // đầu luồng sáng
      float tail = exp(-d * d * 9.0) * 0.35;                    // vệt sáng mờ hai bên
      float a = (uBase + (pulse + tail) * uPeak) * uDim;
      gl_FragColor = vec4(uColor * a, a);
    }`;
  const UP = new THREE.Vector3(0, 1, 0);
  const photonTex = glowTex('#FFE7A8');
  const beams = pairs.map(([i, j], n) => {
    const a = nodes[i].p, b = nodes[j].p, len = a.distanceTo(b);
    const g = new THREE.Group();
    g.position.copy(a).add(b).multiplyScalar(.5);
    g.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    const speed = .55 + ((n * 37) % 10) / 14, phase = n * 1.9;
    const mk = (r, base, peak) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10, 1, true), new THREE.ShaderMaterial({
      vertexShader: beamVS, fragmentShader: beamFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uSpeed: { value: speed }, uPhase: { value: phase }, uDim: { value: 1 }, uBase: { value: base }, uPeak: { value: peak }, uColor: { value: new THREE.Color(0xF3D58F) } }
    }));
    const core = mk(.014, .28, 1.5), halo = mk(.06, .05, .45);
    const photon = new THREE.Sprite(new THREE.SpriteMaterial({ map: photonTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    photon.scale.setScalar(.55);
    g.add(core, halo, photon); scene.add(g);
    return { i, j, len, speed, phase, core, halo, photon, dim: 1 };
  });

  // lưới nối đủ mọi cặp Team (cả Khối liên kết với nhau): nét rất mảnh, rất mờ để không rối;
  // khi chọn/rê vào một Team, các đường của Team đó sáng lên, phần còn lại lặn xuống.
  const beamKeys = new Set(pairs.map(([i, j]) => i + '-' + j));
  const webs = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    if (beamKeys.has(i + '-' + j) || beamKeys.has(j + '-' + i)) continue;
    const geo = new THREE.BufferGeometry().setFromPoints([nodes[i].p, nodes[j].p]);
    const mat = new THREE.LineBasicMaterial({ color: GOLD_SOFT, transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat); scene.add(line);
    webs.push({ i, j, mat, a: .1 });
  }

  // --- điều khiển ---
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enablePan = false; controls.rotateSpeed = .7;
  controls.autoRotate = true; controls.autoRotateSpeed = .55;
  controls.enableZoom = false;              // con lăn chuột vẫn cuộn trang; phóng to bằng nút +/− hoặc 2 ngón
  controls.minDistance = 6;
  canvas.style.touchAction = '';            // OrbitControls tự đặt "none": trả lại để 1 ngón vẫn cuộn trang

  const btnActivate = stage.querySelector('#btn-activate');
  let mode = 'idle';
  function setMode(m) {
    mode = m; stage.dataset.mode = m;
    if (coarse) {
      controls.enabled = m === 'active';
      controls.enableZoom = m === 'active';
      canvas.style.touchAction = m === 'active' ? 'none' : 'pan-y';
      btnActivate.textContent = m === 'active' ? 'Xong' : 'Chạm để xoay';
    }
    hint.textContent = coarse
      ? (m === 'active' ? '1 ngón để xoay · 2 ngón để phóng to' : 'Chạm vào một điểm sáng để xem Team')
      : 'Kéo để xoay · Rê chuột tới một điểm sáng';
  }
  btnActivate.style.display = coarse ? 'inline-flex' : 'none';
  btnActivate.onclick = () => setMode(mode === 'active' ? 'idle' : 'active');
  setMode('idle');

  // --- bay camera ---
  let anim = null;
  function flyTo(target, dist, dur = 950) {
    const fromT = controls.target.clone(), fromP = camera.position.clone();
    const dir = camera.position.clone().sub(controls.target).normalize();
    const toP = target.clone().add(dir.multiplyScalar(dist));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) dur = 0;
    anim = { t0: performance.now(), dur, fromT, fromP, toT: target.clone(), toP };
  }
  function stepAnim(now) {
    if (!anim) return;
    const k = anim.dur ? Math.min(1, (now - anim.t0) / anim.dur) : 1, e = ease(k);
    controls.target.lerpVectors(anim.fromT, anim.toT, e);
    camera.position.lerpVectors(anim.fromP, anim.toP, e);
    if (k >= 1) anim = null;
  }
  const zoomBy = f => {
    const dist = camera.position.distanceTo(controls.target);
    const d = THREE.MathUtils.clamp(dist * f, controls.minDistance, controls.maxDistance);
    flyTo(controls.target.clone(), d, 350); pause();
  };
  stage.querySelector('#btn-zin').onclick = () => zoomBy(.78);
  stage.querySelector('#btn-zout').onclick = () => zoomBy(1.28);
  stage.querySelector('#btn-reset').onclick = () => {
    const fromT = controls.target.clone(), fromP = camera.position.clone();
    anim = { t0: performance.now(), dur: 900, fromT, fromP, toT: new THREE.Vector3(), toP: DEFAULT_DIR.clone().multiplyScalar(baseDist) };
    if (selected == null) resumeSoon(1200);
  };

  // --- tự xoay: dừng khi có tương tác, chạy lại sau 5 giây yên ---
  let resumeTimer = null;
  function pause() { controls.autoRotate = false; clearTimeout(resumeTimer); }
  function resumeSoon(ms = 5000) { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { if (selected == null) controls.autoRotate = true; }, ms); }
  controls.addEventListener('start', pause);
  controls.addEventListener('end', () => resumeSoon());

  // --- chọn / làm nổi bật ---
  let hovered = null, selected = null, armed = null; // armed: điểm vừa chạm 1 lần (điện thoại)
  const v = new THREE.Vector3();
  function screenPos(n) {
    v.copy(n.p).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, front: v.z < 1 };
  }
  function nearest(x, y, max) {
    let best = null, bd = max;
    for (const n of nodes) { const s = screenPos(n); if (!s.front) continue; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function showTip(n, text) {
    if (!n) { tip.classList.remove('show'); return; }
    const s = screenPos(n);
    tip.style.left = s.x + 'px'; tip.style.top = s.y + 'px';
    tip.innerHTML = `<b>Team ${pad(n.so)}</b> · ${n.t.label}<small><i class="dot" style="--c:${n.t.color}"></i>${n.t.stage} · ${n.t.people} thành viên · ${text}</small>`;
    tip.classList.add('show');
  }
  function refreshTargets(px = null, py = null) {
    const focus = selected ?? hovered?.so ?? armed?.so ?? null;
    for (const n of nodes) {
      let prox = 0;
      if (px != null) { const s = screenPos(n); prox = Math.max(0, 1 - Math.hypot(s.x - px, s.y - py) / 170); }
      n.target = 1 + .55 * prox + (n.so === focus ? .35 : 0);
      n.alphaT = focus == null || n.so === focus ? 1 : .28;
      n.ringT = n.so === focus ? 1 : 0;
    }
  }

  const pt = { x: 0, y: 0, down: null };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect(); pt.x = e.clientX - r.left; pt.y = e.clientY - r.top;
    hovered = pt.down ? null : nearest(pt.x, pt.y, 64);
    stage.classList.toggle('is-hovering', !!hovered);
    refreshTargets(pt.x, pt.y);
    if (selected == null) showTip(hovered, 'bấm để xem');
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; stage.classList.remove('is-hovering'); refreshTargets(); if (selected == null) showTip(null); });
  canvas.addEventListener('pointerdown', e => { pt.down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    const d = pt.down; pt.down = null; if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return; // là thao tác kéo, không phải chạm
    const r = canvas.getBoundingClientRect();
    const hit = nearest(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'mouse' ? 64 : 52);
    if (e.pointerType === 'mouse') { if (hit) onSelect(hit.so); return; }
    // cảm ứng: chạm 1 lần làm nổi bật, chạm lần 2 mở
    if (!hit) { armed = null; refreshTargets(); if (selected == null) showTip(null); return; }
    if (armed === hit || selected === hit.so) { armed = null; onSelect(hit.so); return; }
    armed = hit; pause(); refreshTargets(); showTip(hit, 'chạm lần nữa để mở'); resumeSoon(6000);
  });

  // --- kích thước ---
  let labelK = 1;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const prev = baseDist;
    baseDist = 15 * Math.max(1, 1.15 / camera.aspect) * (w < 640 ? 1.05 : 1);
    controls.maxDistance = baseDist * 1.6;
    labelK = w < 640 ? 1.35 : 1;
    cubeLabel.visible = w >= 640; // điện thoại: bảng chú thích đã ghi "Khối Nhân sự"
    if (!anim && selected == null) camera.position.sub(controls.target).setLength(camera.position.distanceTo(controls.target) * baseDist / prev).add(controls.target);
  }
  new ResizeObserver(resize).observe(stage); resize();
  camera.position.copy(DEFAULT_DIR).multiplyScalar(baseDist);

  // --- vòng lặp: chỉ vẽ khi khối đang hiện trên màn hình ---
  let visible = false, raf = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { threshold: 0 }).observe(stage);
  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    stepAnim(now);
    controls.update();
    const time = now / 1000;
    for (const n of nodes) {
      n.scale += (n.target - n.scale) * .14;
      n.alpha += (n.alphaT - n.alpha) * .12;
      n.ringA += (n.ringT - n.ringA) * .14;
      const breathe = 1 + Math.sin(time * 1.6 + n.phase) * .06;
      n.glow.scale.setScalar(1.9 * n.scale * breathe);
      n.core.scale.setScalar(n.scale);
      n.ring.scale.setScalar(1.25 * n.scale);
      n.ring.material.opacity = n.ringA;
      n.ring.material.rotation = time * .4;
      // điểm quá sát camera thì mờ dần, tránh che khung hình
      const near = THREE.MathUtils.smoothstep(camera.position.distanceTo(n.p), 3, 6.5);
      const a = n.alpha * near;
      n.glow.material.opacity = a;
      n.core.material.opacity = a;
      n.label.material.opacity = (n.alpha < .99 ? .12 + .5 * n.alpha : 1) * near;
      n.label.scale.set(1.75 * labelK, .8 * labelK, 1);
      n.label.position.y = .95 * n.scale;
    }
    dustPts.rotation.y = time * .015;
    const focusSo = selected ?? hovered?.so ?? armed?.so ?? null;
    for (const bm of beams) {
      const touch = focusSo == null || nodes[bm.i].so === focusSo || nodes[bm.j].so === focusSo;
      bm.dim += ((touch ? 1 : .18) - bm.dim) * .12;
      for (const m of [bm.core, bm.halo]) { m.material.uniforms.uT.value = time; m.material.uniforms.uDim.value = bm.dim; }
      const pp = .5 + .5 * Math.sin(time * bm.speed + bm.phase);
      bm.photon.position.set(0, (pp - .5) * bm.len, 0);
      bm.photon.material.opacity = .9 * bm.dim;
    }
    for (const w of webs) {
      const on = focusSo != null && (nodes[w.i].so === focusSo || nodes[w.j].so === focusSo);
      w.a += ((focusSo == null ? .1 : on ? .5 : .025) - w.a) * .12; w.mat.opacity = w.a;
    }
    if (selected != null || armed) { const n = nodes.find(x => x.so === (selected ?? armed?.so)); if (n && tip.classList.contains('show')) showTip(n, selected != null ? 'đang xem' : 'chạm lần nữa để mở'); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(loop); });

  return {
    focus(so, fly) {
      selected = so; armed = null; pause(); refreshTargets(); showTip(null); hint.style.opacity = '0';
      const n = nodes.find(x => x.so === so);
      if (n && fly) {
        // trên điện thoại, bảng che nửa dưới: đẩy điểm lên nửa trên khung hình
        // dịch tâm nhìn để điểm được chọn không bị bảng thông tin che
        camera.updateMatrixWorld();
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const off = isMobile() ? up.multiplyScalar(-2.2) : (innerWidth > 960 ? right.multiplyScalar(2.4) : new THREE.Vector3());
        flyTo(n.p.clone().add(off), isMobile() ? 11 : 10);
      }
      if (fly && stage.getBoundingClientRect().top > innerHeight * .4) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    release() {
      selected = null; refreshTargets(); hint.style.opacity = '';
      flyTo(new THREE.Vector3(), baseDist, 900); resumeSoon(2500);
    }
  };
}
