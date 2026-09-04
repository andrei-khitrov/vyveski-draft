/* VELES — единственная 3D-сцена сайта: объёмный логотип клиента в первом экране.
   Логотип не картинка и не стоковая модель: вектор из презентации разбирается в
   контуры, выдавливается в объём и медленно вращается вокруг своей оси.
   Светлый фон страницы просвечивает насквозь — сцена живёт в общей палитре сайта.
   Ни слежения за курсором, ни задних стенок, ни bloom: тянуть можно мышью. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Узкий экран: геометрия и свет те же (иначе кольцо логотипа становится гранёным),
// экономим только на плотности пикселей; орбитальное управление выключено — OrbitControls
// ставит канвасу touch-action: none, и страница перестала бы скроллиться пальцем.
const compact = matchMedia('(max-width: 900px)').matches;
const TEAL = 0x008574, TEAL_DEEP = 0x0b6e63;

/* Разбор SVG-path логотипа (M L C H V Z) → THREE.ShapePath */
function parsePathD(d, sp) {
  const re = /([MLCHVZmlchvz])([^MLCHVZmlchvz]*)/g; let m, cx = 0, cy = 0, sx = 0, sy = 0;
  while ((m = re.exec(d))) {
    const cmd = m[1]; const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === 'M') { cx = n[0]; cy = n[1]; sx = cx; sy = cy; sp.moveTo(cx, -cy); for (let i = 2; i < n.length; i += 2) { cx = n[i]; cy = n[i + 1]; sp.lineTo(cx, -cy); } }
    else if (cmd === 'L') { for (let i = 0; i < n.length; i += 2) { cx = n[i]; cy = n[i + 1]; sp.lineTo(cx, -cy); } }
    else if (cmd === 'H') { cx = n[0]; sp.lineTo(cx, -cy); }
    else if (cmd === 'V') { cy = n[0]; sp.lineTo(cx, -cy); }
    else if (cmd === 'C') { for (let i = 0; i < n.length; i += 6) { sp.bezierCurveTo(n[i], -n[i + 1], n[i + 2], -n[i + 3], n[i + 4], -n[i + 5]); cx = n[i + 4]; cy = n[i + 5]; } }
    else if (cmd === 'Z' || cmd === 'z') { sp.currentPath && sp.currentPath.closePath(); cx = sx; cy = sy; }
  }
}

async function initLogo(el) {
  const canvas = el.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.75 : 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-3, 5, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfeeea, 0.5); fill.position.set(5, -1, -3); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 4000);

  // Контуры логотипа → объём
  const doc = new DOMParser().parseFromString(await (await fetch(`${window.__BASE || ''}/assets/img/brand/logo-full.svg`)).text(), 'image/svg+xml');
  const shapes = [];
  for (const p of doc.querySelectorAll('path')) { const sp = new THREE.ShapePath(); parsePathD(p.getAttribute('d'), sp); shapes.push(...sp.toShapes(true)); }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 17, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 3, curveSegments: 16 });
  geo.center();
  const mesh = new THREE.Mesh(geo, [
    new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.4, metalness: 0.15 }),        // лицо
    new THREE.MeshStandardMaterial({ color: TEAL_DEEP, roughness: 0.32, metalness: 0.5 }),   // борт
  ]);
  const group = new THREE.Group(); group.add(mesh); scene.add(group);

  // Кадрирование под размер контейнера
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = maxDim / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.32;
  camera.position.set(Math.sin(0.42) * dist, 0.16 * dist, Math.cos(0.42) * dist);
  camera.lookAt(0, 0, 0);
  group.rotation.x = 0.1;

  // На узких экранах логотип просто вращается сам: палец должен листать страницу, а не сцену
  let controls = null;
  if (compact) {
    canvas.style.touchAction = 'pan-y';
  } else {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.07;
    controls.enablePan = false; controls.enableZoom = false;
    controls.minDistance = dist * 0.6; controls.maxDistance = dist * 1.8;
    controls.minPolarAngle = Math.PI * 0.3; controls.maxPolarAngle = Math.PI * 0.66;
  }

  const resize = () => {
    const w = el.clientWidth || 600, h = el.clientHeight || 400;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(el); resize();

  const clock = new THREE.Clock();
  let visible = false;
  const loop = () => {
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduce) group.rotation.y += dt * 0.22; // полный оборот примерно за 28 секунд
    if (controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop(); }, { rootMargin: '10% 0px' }).observe(el);
  el.classList.add('is-ready');
}

/* Сцену грузим везде, где она по карману: телефон тоже её тянет, но не при экономии
   трафика, не на слабых устройствах и не при просьбе уменьшить движение.
   И только после полной загрузки страницы. */
const allowed = () => {
  if (reduce) return false;
  const c = navigator.connection;
  if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  return true;
};
const boot = () => {
  const el = document.querySelector('[data-scene="logo"]');
  if (!el) return;
  if (!allowed()) { el.classList.add('is-static'); return; } // остаётся плоский логотип, макет не прыгает
  const start = () => initLogo(el).catch(err => { console.warn('scene logo', err); el.classList.add('is-failed'); });
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(start, { timeout: 2000 });
  else addEventListener('load', () => idle(start, { timeout: 2000 }), { once: true });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
