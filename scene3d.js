import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TIMELINE = window.TIMELINE_DATA;
const TOTAL_DURATION = TIMELINE.totalDuration;
const FPS = TIMELINE.fps || 60;

// Detect headless render mode (?render=1)
const urlParams = new URLSearchParams(window.location.search);
const IS_RENDER_MODE = urlParams.get('render') === '1';
const STYLE_OVERRIDE = urlParams.get('style') || 'all'; // 'all', '1', '2', '3'

if (IS_RENDER_MODE) {
  document.body.classList.remove('studio-mode');
  document.body.classList.add('render-mode');
} else {
  // Fit 1080x1920 stage cleanly into studio viewport
  function fitStudioStage() {
    const stage = document.getElementById('video-stage');
    if (!stage) return;
    const availH = window.innerHeight - 48;
    const availW = window.innerWidth - 520;
    const scale = Math.min(availH / 1920, availW / 1080, 0.52);
    stage.style.transform = `scale(${Math.max(0.25, scale)})`;
    stage.style.margin = `${-(1920 * (1 - scale)) / 2}px ${-(1080 * (1 - scale)) / 2}px`;
  }
  window.addEventListener('resize', fitStudioStage);
  fitStudioStage();
}

// ============================================================================
// MATH & EASING UTILITIES
// ============================================================================
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function easeOutBack(x) {
  const t = clamp(x, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOutCubic(x) {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ============================================================================
// THREE.JS WEBGL 2.0 RENDERER & POST-PROCESSING
// ============================================================================
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !IS_RENDER_MODE,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
if (IS_RENDER_MODE) {
  renderer.setSize(540, 960, false);
} else {
  renderer.setSize(1080, 1920, false);
}
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060911);
scene.fog = new THREE.FogExp2(0x060911, 0.018);

let composer = null;
if (!IS_RENDER_MODE) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
}

const camera = new THREE.PerspectiveCamera(46, 1080 / 1920, 0.1, 250);

if (!IS_RENDER_MODE) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1080, 1920), 0.24, 0.30, 0.88);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

// ============================================================================
// SHARED PBR MATERIALS & PROCEDURAL CANVAS TEXTURES
// ============================================================================
const matGold = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  metalness: 0.72,
  roughness: 0.24,
  emissive: 0xf59e0b,
  emissiveIntensity: 0.24
});

const matAmberGlow = new THREE.MeshStandardMaterial({
  color: 0xfbbf24,
  metalness: 0.35,
  roughness: 0.22,
  emissive: 0xf59e0b,
  emissiveIntensity: 0.88
});

const matCyanGlow = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  metalness: 0.35,
  roughness: 0.22,
  emissive: 0x06b6d4,
  emissiveIntensity: 0.88
});

const matEmeraldGlow = new THREE.MeshStandardMaterial({
  color: 0x34d399,
  metalness: 0.35,
  roughness: 0.22,
  emissive: 0x10b981,
  emissiveIntensity: 0.82
});

const matDarkMetal = new THREE.MeshStandardMaterial({
  color: 0x182234,
  metalness: 0.68,
  roughness: 0.28,
  emissive: 0x0f172a,
  emissiveIntensity: 0.25
});

const matObsidianGlass = new THREE.MeshPhysicalMaterial({
  color: 0x0c1322,
  metalness: 0.2,
  roughness: 0.12,
  transmission: 0.35,
  transparent: true,
  opacity: 0.92,
  clearcoat: 1.0
});

const matWireGold = new THREE.MeshBasicMaterial({
  color: 0xfbbf24,
  wireframe: true,
  transparent: true,
  opacity: 0.55
});

const matWireCyan = new THREE.MeshBasicMaterial({
  color: 0x38bdf8,
  wireframe: true,
  transparent: true,
  opacity: 0.48
});

function createLabelTexture(title, subtitle, accentHex = '#F59E0B', codeLines = []) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const ctx = c.getContext('2d');

  // Deep metallic slate card background
  const grad = ctx.createLinearGradient(0, 0, 1024, 640);
  grad.addColorStop(0, '#0E1525');
  grad.addColorStop(1, '#080C16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 640);

  // Top accent bar
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 1024, 18);

  // Subtle inner frame
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 36, 976, 580);

  // Header badge
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 34px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, 64, 110);

  // Main title
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 56px "Space Grotesk", sans-serif';
  ctx.fillText(title, 64, 185);

  // Divider line
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(64, 218, 896, 3);

  // Code / bullet lines
  ctx.font = '500 33px "JetBrains Mono", monospace';
  codeLines.forEach((line, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#E2E8F0' : accentHex;
    ctx.fillText(line, 64, 285 + idx * 62);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVideoMonolithTexture(numStr, badgeText = '60 FPS MP4', accent = '#F59E0B') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 910;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 910);
  grad.addColorStop(0, '#131C31');
  grad.addColorStop(0.5, '#0B101E');
  grad.addColorStop(1, '#161F33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 910);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, 476, 874);

  // Center glowing emblem circle
  ctx.beginPath();
  ctx.arc(256, 380, 120, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = accent;
  ctx.stroke();

  // Play triangle or number
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.font = 'bold 78px "Space Grotesk", sans-serif';
  ctx.fillText(numStr, 256, 406);

  ctx.fillStyle = accent;
  ctx.font = 'bold 36px "JetBrains Mono", monospace';
  ctx.fillText(badgeText, 256, 610);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 28px "Inter", sans-serif';
  ctx.fillText('1080 × 1920 · 9:16', 256, 675);

  // Fake waveform bars at bottom
  for (let i = 0; i < 16; i++) {
    const bh = 25 + Math.sin(i * 0.9) * 18 + (i % 3) * 12;
    ctx.fillStyle = i % 2 === 0 ? accent : '#38BDF8';
    ctx.fillRect(88 + i * 21, 790 - bh, 12, bh);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// GLOBAL LIGHTING & ATMOSPHERIC PARTICLES
// ============================================================================
const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffedd5, 2.6);
keyLight.position.set(12, 24, 18);
scene.add(keyLight);

const rimLightCyan = new THREE.PointLight(0x06b6d4, 18, 45, 1.5);
scene.add(rimLightCyan);

const rimLightAmber = new THREE.PointLight(0xf59e0b, 22, 45, 1.5);
scene.add(rimLightAmber);

// Global particle field spanning all 6 scene stages (x = -20 to 190)
const particleCount = 900;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(particleCount * 3);
const pCol = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  pPos[i * 3] = -25 + Math.random() * 220;
  pPos[i * 3 + 1] = -14 + Math.random() * 34;
  pPos[i * 3 + 2] = -22 + Math.random() * 36;
  const isAmber = i % 3 !== 0;
  pCol[i * 3] = isAmber ? 0.96 : 0.22;
  pCol[i * 3 + 1] = isAmber ? 0.65 : 0.74;
  pCol[i * 3 + 2] = isAmber ? 0.12 : 0.97;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({
  size: 0.24,
  vertexColors: true,
  transparent: true,
  opacity: 0.72
});
const particleField = new THREE.Points(pGeo, pMat);
scene.add(particleField);

// Reflective studio floor spanning all scenes
const floorGeo = new THREE.PlaneGeometry(280, 90);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x070b14,
  metalness: 0.85,
  roughness: 0.22
});
const studioFloor = new THREE.Mesh(floorGeo, floorMat);
studioFloor.rotation.x = -Math.PI / 2;
studioFloor.position.set(80, -5.2, 0);
scene.add(studioFloor);

// ============================================================================
// SCENE 1 (x = 0): STIL 1 · 3D STORYTELLING WORLD
// Shattering "Blender/AE" Cube -> Glowing Three.js WebGL Crystalline Core
// ============================================================================
const groupS1 = new THREE.Group();
groupS1.position.set(0, 0.8, 0);
scene.add(groupS1);

// Studio Pedestal
const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.7, 48), matDarkMetal);
pedBase.position.y = -4.6;
groupS1.add(pedBase);

const pedRing1 = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.09, 16, 64), matAmberGlow);
pedRing1.rotation.x = Math.PI / 2;
pedRing1.position.y = -4.22;
groupS1.add(pedRing1);

const pedRing2 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.07, 16, 64), matCyanGlow);
pedRing2.rotation.x = Math.PI / 2;
pedRing2.position.y = -4.18;
groupS1.add(pedRing2);

// Shattering Legacy Cube (27 3x3x3 sub-cubes that burst outward at t = 3.12s)
const shatterGroup = new THREE.Group();
groupS1.add(shatterGroup);
const legacyTex = createLabelTexture('BLENDER / AE?', 'MANUELLE TIMELINE', '#EF4444', [
  '× Stundenlanges Keyframing',
  '× Manuelles Modelling',
  '× Langsame Render-Zeiten'
]);
const matLegacyShard = new THREE.MeshStandardMaterial({
  map: legacyTex,
  color: 0xdbeafe,
  metalness: 0.6,
  roughness: 0.3,
  emissive: 0xef4444,
  emissiveIntensity: 0.22
});

const shards = [];
const shardGeo = new THREE.BoxGeometry(1.18, 1.18, 1.18);
for (let ix = -1; ix <= 1; ix++) {
  for (let iy = -1; iy <= 1; iy++) {
    for (let iz = -1; iz <= 1; iz++) {
      const m = new THREE.Mesh(shardGeo, matLegacyShard);
      const basePos = new THREE.Vector3(ix * 1.22, iy * 1.22, iz * 1.22);
      const dir = basePos.clone().normalize();
      if (dir.lengthSq() === 0) dir.set(0, 1, 0);
      shards.push({
        mesh: m,
        basePos,
        vel: dir.multiplyScalar(6.5 + (Math.abs(ix) + Math.abs(iy) + Math.abs(iz)) * 2.2),
        rotVel: new THREE.Vector3(iy * 3.4 + 1.2, iz * -2.8 + 0.9, ix * 3.1 - 1.1)
      });
      shatterGroup.add(m);
    }
  }
}

// Pure Code Crystalline Core (Revealed when cube shatters)
const codeCoreGroup = new THREE.Group();
groupS1.add(codeCoreGroup);

const coreIcosa = new THREE.Mesh(new THREE.IcosahedronGeometry(1.95, 1), matGold);
codeCoreGroup.add(coreIcosa);

const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.35, 2), matWireCyan);
codeCoreGroup.add(coreWire);

const coreKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.05, 0.26, 120, 24), matAmberGlow);
codeCoreGroup.add(coreKnot);

const s1GyroRings = [];
for (let r = 0; r < 3; r++) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.0 + r * 0.65, 0.07, 20, 96),
    r % 2 === 0 ? matAmberGlow : matCyanGlow
  );
  codeCoreGroup.add(ring);
  s1GyroRings.push(ring);
}

// 8 Orbiting Primitives around the Pure Code Core
const s1Primitives = [];
const primGeos = [
  new THREE.OctahedronGeometry(0.55, 0),
  new THREE.TorusGeometry(0.45, 0.16, 16, 42),
  new THREE.ConeGeometry(0.48, 0.95, 6),
  new THREE.DodecahedronGeometry(0.52, 0)
];
for (let i = 0; i < 8; i++) {
  const g = primGeos[i % primGeos.length];
  const mesh = new THREE.Mesh(g, i % 2 === 0 ? matGold : matCyanGlow);
  codeCoreGroup.add(mesh);
  s1Primitives.push({ mesh, angle: (i / 8) * Math.PI * 2, radius: 4.55 });
}

// Floating 3D Plaque on front of Studio Pedestal below Core
const s1PlaqueTex = createLabelTexture('100% REINER CODE', 'HTML5 + THREE.JS + WEBGL 2.0', '#F59E0B', [
  '✓ Prozedurale 3D-Meshes & PBR-Licht',
  '✓ Mathematische Kamera-Splines',
  '✓ Deterministischer 60 FPS Export'
]);
const s1Plaque = new THREE.Mesh(
  new THREE.BoxGeometry(5.4, 3.2, 0.18),
  new THREE.MeshStandardMaterial({ map: s1PlaqueTex, metalness: 0.3, roughness: 0.25 })
);
s1Plaque.position.set(0, -3.1, 2.4);
s1Plaque.rotation.x = -0.18;
s1Plaque.visible = false;
codeCoreGroup.add(s1Plaque);

// ============================================================================
// SCENE 2 (x = 40): STIL 2 · KINETIC 3D TECH-MOTION-GRAPHICS
// Floating 3D Code Cards + Golden Camera Spline + 3D Cinema Camera Rig
// ============================================================================
const groupS2 = new THREE.Group();
groupS2.position.set(40, 0.2, 0);
scene.add(groupS2);

const cardDataS2 = [
  {
    title: 'CLAUDE PROMPT',
    sub: 'SCHRITT 01 · STORY & SZENE',
    accent: '#F59E0B',
    lines: [
      '"Erstelle ein 9:16 3D-Kurzvideo',
      ' mit Three.js, Studio-Beleuchtung,',
      ' Kamerafahrt & Claude-Abo-Zahlen"',
      '→ Claude plant Szenen & Keyframes'
    ],
    pos: new THREE.Vector3(-3.3, 1.35, -1.8),
    rotY: 0.34
  },
  {
    title: 'THREE.JS ENGINE',
    sub: 'SCHRITT 02 · WEBGL 2.0 CODE',
    accent: '#38BDF8',
    lines: [
      'const scene = new THREE.Scene();',
      'const mat = new MeshPhysicalMaterial({',
      '  metalness: 0.9, clearcoat: 1.0',
      '});',
      'composer.addPass(bloomPass);'
    ],
    pos: new THREE.Vector3(0.0, 1.75, -2.8),
    rotY: 0.0
  },
  {
    title: 'KAMERA-SPLINES',
    sub: 'MATHEMATISCHE CHOREOGRAFIE',
    accent: '#10B981',
    lines: [
      'const curve = new CatmullRomCurve3([',
      '  vec3(0, 6, 16), vec3(40, 2, 12)',
      ']);',
      'camera.position.copy(curve.getPoint(t));',
      'camera.lookAt(targetSpline.getPoint(t));'
    ],
    pos: new THREE.Vector3(3.3, 1.35, -1.8),
    rotY: -0.34
  }
];

const s2Cards = [];
cardDataS2.forEach((cd) => {
  const tex = createLabelTexture(cd.title, cd.sub, cd.accent, cd.lines);
  const cardGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 2.9, 0.16),
    new THREE.MeshStandardMaterial({ map: tex, metalness: 0.35, roughness: 0.22 })
  );
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.74, 3.04, 0.12), matGold);
  frame.position.z = -0.04;
  cardGroup.add(body);
  cardGroup.add(frame);
  cardGroup.position.copy(cd.pos);
  cardGroup.rotation.y = cd.rotY;
  groupS2.add(cardGroup);
  s2Cards.push({ group: cardGroup, basePos: cd.pos.clone(), baseRotY: cd.rotY });
});

// 3D Golden Catmull-Rom Spline Ribbon in front of the Code Cards
const splinePoints = [
  new THREE.Vector3(-4.5, -2.6, 1.5),
  new THREE.Vector3(-2.2, -0.6, 3.0),
  new THREE.Vector3(0.0, -1.8, 1.8),
  new THREE.Vector3(2.3, -0.5, 2.8),
  new THREE.Vector3(4.5, -2.4, 1.2)
];
const s2Curve = new THREE.CatmullRomCurve3(splinePoints);
const splineTube = new THREE.Mesh(
  new THREE.TubeGeometry(s2Curve, 96, 0.10, 16, false),
  matAmberGlow
);
groupS2.add(splineTube);

// 3D Cinema Camera Rig riding along the Golden Spline
const camRig = new THREE.Group();
const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 1.25), matDarkMetal);
const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.65, 24), matGold);
camLens.rotation.x = Math.PI / 2;
camLens.position.z = 0.85;
const camReel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.18, 24), matGold);
camReel1.rotation.z = Math.PI / 2;
camReel1.position.set(0, 0.62, -0.25);
const camReel2 = camReel1.clone();
camReel2.position.set(0, 0.62, 0.32);
// Translucent cyan view frustum cone
const camFrustum = new THREE.Mesh(
  new THREE.ConeGeometry(1.45, 3.2, 4, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.55 })
);
camFrustum.rotation.x = -Math.PI / 2;
camFrustum.rotation.y = Math.PI / 4;
camFrustum.position.z = 2.6;
camRig.add(camBody, camLens, camReel1, camReel2, camFrustum);
groupS2.add(camRig);

// Central Spawned 3D Sculpture & Laser Scanner Ring
const s2Sculpture = new THREE.Group();
s2Sculpture.position.set(0, -1.9, -0.2);
const s2MorphMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1.18, 0.34, 128, 32, 2, 3), matGold);
const s2MorphWire = new THREE.Mesh(new THREE.TorusKnotGeometry(1.24, 0.36, 64, 16, 2, 3), matWireCyan);
const s2ScanRing = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.06, 16, 64), matCyanGlow);
s2ScanRing.rotation.x = Math.PI / 2;
s2Sculpture.add(s2MorphMesh, s2MorphWire, s2ScanRing);
groupS2.add(s2Sculpture);

// ============================================================================
// SCENE 3 (x = 80): STIL 1+2 · 3D RENDER-PIPELINE FABRIK
// 48-Bar 3D Audio Equalizer Ring + 60 FPS Headless Chrome / FFmpeg Turbine Portal
// ============================================================================
const groupS3 = new THREE.Group();
groupS3.position.set(80, 0.5, 0);
scene.add(groupS3);

// Upper Stage: 48-Bar 3D Audio Equalizer Ring (Python TTS + SFX + Sync)
const audioRingGroup = new THREE.Group();
audioRingGroup.position.set(0, 3.5, -1.0);
groupS3.add(audioRingGroup);

const audioCoreSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 2), matCyanGlow);
audioRingGroup.add(audioCoreSphere);

const eqBars3D = [];
const numEq3D = 48;
const barGeo3D = new THREE.BoxGeometry(0.14, 1.0, 0.14);
for (let i = 0; i < numEq3D; i++) {
  const angle = (i / numEq3D) * Math.PI * 2;
  const bar = new THREE.Mesh(barGeo3D, i % 2 === 0 ? matAmberGlow : matCyanGlow);
  bar.position.set(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, 0);
  bar.rotation.z = angle - Math.PI / 2;
  audioRingGroup.add(bar);
  eqBars3D.push(bar);
}

// Lower Stage: 60 FPS Headless Chrome + FFmpeg Turbine Portal & Conveyor
const conveyorGroup = new THREE.Group();
conveyorGroup.position.set(0, -1.6, 0.5);
groupS3.add(conveyorGroup);

// Central FFmpeg Turbine Portal Ring
const portalOuter = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.24, 24, 96), matDarkMetal);
portalOuter.rotation.y = Math.PI / 2;
const portalGlowRing = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.10, 20, 96), matAmberGlow);
portalGlowRing.rotation.y = Math.PI / 2;
const portalCyanRing = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.07, 16, 96), matCyanGlow);
portalCyanRing.rotation.y = Math.PI / 2;
conveyorGroup.add(portalOuter, portalGlowRing, portalCyanRing);

// Conveyor Rails
const railGeo = new THREE.CylinderGeometry(0.08, 0.08, 18, 16);
railGeo.rotateZ(Math.PI / 2);
const rail1 = new THREE.Mesh(railGeo, matGold);
rail1.position.set(0, -2.1, 0.9);
const rail2 = new THREE.Mesh(railGeo, matGold);
rail2.position.set(0, -2.1, -0.9);
conveyorGroup.add(rail1, rail2);

// 14 Moving 9:16 Frame Plates passing through the Portal
const s3FramePlates = [];
const mp4PlateTex = createVideoMonolithTexture('60 FPS', 'MP4 RENDERED', '#10B981');
const rawPlateTex = createVideoMonolithTexture('RAW', 'WEBGL FRAME', '#38BDF8');
const matMp4Plate = new THREE.MeshStandardMaterial({ map: mp4PlateTex, metalness: 0.4, roughness: 0.2 });
const matRawPlate = new THREE.MeshStandardMaterial({ map: rawPlateTex, metalness: 0.3, roughness: 0.3, wireframe: false });

for (let i = 0; i < 14; i++) {
  const plateGroup = new THREE.Group();
  const solidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 1.8), matMp4Plate);
  const rawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 1.8), matRawPlate);
  const wireRim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.28, 1.88), matWireCyan);
  plateGroup.add(solidMesh, rawMesh, wireRim);
  conveyorGroup.add(plateGroup);
  s3FramePlates.push({ group: plateGroup, solidMesh, rawMesh, wireRim, index: i });
}

// ============================================================================
// SCENE 4 (x = 120): STIL 3 · HYPNOTIC 3D MACHINE & CLAUDE PRO 5h-FENSTER
// 4 Counter-Rotating Gear Gyroscopes + 45 Prompt Orbs on Helix + 15 Video Monoliths
// ============================================================================
const groupS4 = new THREE.Group();
groupS4.position.set(120, 0.4, 0);
scene.add(groupS4);

// Hypnotic 3D Clockwork / Gyroscope Core
const gyroMachine = new THREE.Group();
gyroMachine.position.set(0, 0.95, -0.5);
groupS4.add(gyroMachine);

const gyroCoreBadgeTex = createLabelTexture('5h FENSTER', 'CLAUDE PRO · 20 $', '#F59E0B', [
  '★ ~45 Prompts / Session',
  '★ 3–4 Prompts je Video',
  '→ 10–15 Videos / 5h'
]);
const gyroCenterCylinder = new THREE.Mesh(
  new THREE.BoxGeometry(3.1, 2.0, 0.22),
  new THREE.MeshStandardMaterial({ map: gyroCoreBadgeTex, metalness: 0.45, roughness: 0.22 })
);
gyroMachine.add(gyroCenterCylinder);

const s4GearRings = [];
for (let g = 0; g < 4; g++) {
  const gearGroup = new THREE.Group();
  const radius = 2.1 + g * 0.68;
  const ringMat = g % 2 === 0 ? matGold : matCyanGlow;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.11, 20, 96), ringMat);
  gearGroup.add(torus);

  // Add 18 mechanical teeth around each gyroscope ring
  const teethCount = 18 + g * 4;
  const toothGeo = new THREE.BoxGeometry(0.18, 0.28, 0.18);
  for (let k = 0; k < teethCount; k++) {
    const a = (k / teethCount) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, ringMat);
    tooth.position.set(Math.cos(a) * (radius + 0.16), Math.sin(a) * (radius + 0.16), 0);
    tooth.rotation.z = a;
    gearGroup.add(tooth);
  }
  gyroMachine.add(gearGroup);
  s4GearRings.push(gearGroup);
}

// Helical Spiral Track for the 45 Prompt Orbs
const helixPts = [];
for (let i = 0; i <= 120; i++) {
  const u = i / 120;
  const ang = u * Math.PI * 6;
  const rad = 4.6 - u * 0.8;
  const y = 3.8 - u * 6.8;
  helixPts.push(new THREE.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad - 0.5));
}
const helixCurve = new THREE.CatmullRomCurve3(helixPts);
const helixRail = new THREE.Mesh(
  new THREE.TubeGeometry(helixCurve, 140, 0.045, 12, false),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38 })
);
groupS4.add(helixRail);

// 45 Glowing Prompt Orbs (representing ~45 Prompts per 5-hour window)
const promptOrbs = [];
const orbGeo = new THREE.SphereGeometry(0.19, 16, 16);
for (let i = 0; i < 45; i++) {
  const orb = new THREE.Mesh(orbGeo, i % 4 === 0 ? matCyanGlow : matAmberGlow);
  groupS4.add(orb);
  promptOrbs.push({ mesh: orb, index: i });
}

// 15 Finished 9:16 3D Video Monoliths arranged in a Semicircle Amphitheater
// (45 Prompts / 3 Prompts per Video = 15 Finished 3D Videos per 5h Window!)
const s4Monoliths = [];
for (let i = 0; i < 15; i++) {
  const numLabel = `#${String(i + 1).padStart(2, '0')}`;
  const tex = createVideoMonolithTexture(numLabel, '3D SHORT', i % 2 === 0 ? '#F59E0B' : '#38BDF8');
  const mGroup = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 2.15, 0.18),
    new THREE.MeshStandardMaterial({ map: tex, metalness: 0.45, roughness: 0.2 })
  );
  const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(1.23, 2.23, 0.12), matGold);
  goldTrim.position.z = -0.04;
  mGroup.add(slab, goldTrim);

  // Semicircle layout in front/around the machine facing the camera
  const frac = (i / 14) - 0.5; // -0.5 to +0.5
  const arcAngle = frac * Math.PI * 0.86;
  const arcRad = 5.8;
  const targetPos = new THREE.Vector3(
    Math.sin(arcAngle) * arcRad,
    -2.75 + Math.abs(frac) * 0.75,
    Math.cos(arcAngle) * 2.8 + 0.6
  );
  mGroup.position.copy(targetPos);
  mGroup.lookAt(0, -1.6, 14);
  groupS4.add(mGroup);
  s4Monoliths.push({ group: mGroup, targetPos, index: i });
}

// ============================================================================
// SCENE 5 (x = 160): ALLE 3 STILE · 400 VIDEOS MONATS-MATRIX & 5-CENT COIN
// 20x20 = 400 Instanced 3D Video Towers + Hero 5-Cent Brushed-Gold Emblem
// ============================================================================
const groupS5 = new THREE.Group();
groupS5.position.set(160, 0, 0);
scene.add(groupS5);

const GRID_N = 20; // 20 x 20 = 400 Video Towers!
const TOWER_COUNT = GRID_N * GRID_N;
const towerBodyGeo = new THREE.BoxGeometry(0.62, 1.0, 0.36);
// Shift geometry so y=0 is bottom of tower
towerBodyGeo.translate(0, 0.5, 0);

const towerBodyInst = new THREE.InstancedMesh(towerBodyGeo, matDarkMetal, TOWER_COUNT);
const towerCapGeo = new THREE.BoxGeometry(0.66, 0.12, 0.40);
const towerCapInst = new THREE.InstancedMesh(towerCapGeo, matAmberGlow, TOWER_COUNT);

groupS5.add(towerBodyInst);
groupS5.add(towerCapInst);

const towerCoords = [];
let tIdx = 0;
for (let gx = 0; gx < GRID_N; gx++) {
  for (let gz = 0; gz < GRID_N; gz++) {
    const wx = (gx - (GRID_N - 1) / 2) * 1.15;
    const wz = (gz - (GRID_N - 1) / 2) * 1.15 - 2.0;
    const dist = Math.sqrt(wx * wx + (wz + 2.0) * (wz + 2.0));
    towerCoords.push({ id: tIdx++, wx, wz, dist });
  }
}

// Hero Floating Centerpiece above the 400 Towers: "400+ VIDEOS / ~0,05 $"
const s5HeroGroup = new THREE.Group();
s5HeroGroup.position.set(0, 1.75, -1.2);
groupS5.add(s5HeroGroup);

const coinTexFront = createLabelTexture('~0,05 $ PRO VIDEO', 'CLAUDE PRO · 20 $ / MONAT', '#10B981', [
  '★ ~400 fertige 3D-Videos / Monat',
  '★ 10–15 Videos pro 5h-Session',
  '★ 100% Code · Keine Zusatzkosten'
]);
const heroBillboard = new THREE.Mesh(
  new THREE.BoxGeometry(6.8, 4.1, 0.24),
  new THREE.MeshStandardMaterial({ map: coinTexFront, metalness: 0.4, roughness: 0.2 })
);
const heroBillboardRim = new THREE.Mesh(new THREE.BoxGeometry(7.0, 4.3, 0.18), matGold);
heroBillboardRim.position.z = -0.05;
s5HeroGroup.add(heroBillboard, heroBillboardRim);

// Orbiting Golden Crown Crystals around the 400-Video Hero Billboard
const s5CrownCrystals = [];
const crystalGeo = new THREE.OctahedronGeometry(0.42, 0);
for (let c = 0; c < 12; c++) {
  const cr = new THREE.Mesh(crystalGeo, c % 2 === 0 ? matAmberGlow : matEmeraldGlow);
  s5HeroGroup.add(cr);
  s5CrownCrystals.push({ mesh: cr, angle: (c / 12) * Math.PI * 2 });
}

// ============================================================================
// DOM HUD & OVERLAY UPDATER (Deterministic per Timestamp t)
// ============================================================================
const elSceneKicker = document.getElementById('hud-scene-kicker');
const elStyleTitle = document.getElementById('hud-style-title');
const elTimecode = document.getElementById('hud-timecode');
const elEqBars = Array.from(document.querySelectorAll('#hud-eq-bars .hud-eq-bar'));
const elSceneOverlay = document.getElementById('scene-overlay');
const elCaptionWrap = document.getElementById('caption-words-wrap');
const elProgSegs = [
  document.getElementById('prog-seg-1'),
  document.getElementById('prog-seg-2'),
  document.getElementById('prog-seg-3'),
  document.getElementById('prog-seg-4'),
  document.getElementById('prog-seg-5'),
  document.getElementById('prog-seg-6')
];

let lastOverlayStateKey = '';
let lastPhraseId = '';

function updateDOMOverlays(t, frameIdx, voiceAmp, bassAmp) {
  // 1. Timecode & Audio Equalizer Bars
  const mins = Math.floor(t / 60);
  const secs = (t % 60).toFixed(2).padStart(5, '0');
  elTimecode.textContent = `0${mins}:${secs} · 60 FPS`;

  elEqBars.forEach((bar, i) => {
    const wave = Math.sin(t * 14 + i * 0.85) * 0.5 + 0.5;
    const h = 8 + (voiceAmp * 22 + bassAmp * 12) * (0.45 + 0.55 * wave);
    bar.style.height = `${clamp(h, 6, 36).toFixed(1)}px`;
    bar.style.backgroundColor = i % 3 === 0 ? 'var(--accent-cyan)' : 'var(--accent-amber)';
  });

  // 2. Scene Progress Segments (1..6)
  TIMELINE.scenes.forEach((sc, idx) => {
    const seg = elProgSegs[idx];
    if (!seg) return;
    const p = clamp((t - sc.start) / (sc.end - sc.start), 0, 1) * 100;
    seg.style.width = `${p.toFixed(1)}%`;
  });

  // 3. Determine active Scene & Phrase
  let activeSceneObj = TIMELINE.scenes[0];
  for (const sc of TIMELINE.scenes) {
    if (t >= sc.start && t <= sc.end) {
      activeSceneObj = sc;
      break;
    }
  }
  const sNum = activeSceneObj.scene;
  elSceneKicker.textContent = `SZENE 0${sNum} / 06 · CLAUDE CODE PIPELINE`;
  elStyleTitle.textContent = activeSceneObj.style;

  // 4. Scene-Specific Infographic / Telemetry Card
  updateSceneInfographic(sNum, t, frameIdx);

  // 5. Viral Word-by-Word Highlighted Captions
  let activePhrase = TIMELINE.phrases[0];
  for (const ph of TIMELINE.phrases) {
    if (t >= ph.start - 0.12 && t <= ph.end + 0.25) {
      activePhrase = ph;
      break;
    }
  }

  if (activePhrase.id !== lastPhraseId) {
    lastPhraseId = activePhrase.id;
    elCaptionWrap.innerHTML = activePhrase.words
      .map(
        (w, idx) =>
          `<span class="cap-word ${w.highlight ? 'kw-highlight' : ''}" data-widx="${idx}">${w.word}</span>`
      )
      .join('');
  }

  const wordSpans = elCaptionWrap.children;
  for (let i = 0; i < activePhrase.words.length; i++) {
    const wObj = activePhrase.words[i];
    const span = wordSpans[i];
    if (!span) continue;
    if (t >= wObj.start && t <= wObj.end + 0.04) {
      span.classList.add('active');
      span.classList.remove('spoken');
    } else if (t > wObj.end + 0.04) {
      span.classList.remove('active');
      span.classList.add('spoken');
    } else {
      span.classList.remove('active', 'spoken');
    }
  }

  // Subtle spring entrance on caption card at start of each phrase
  const phraseAge = Math.max(0, t - activePhrase.start);
  const capCard = document.getElementById('caption-card');
  if (capCard) {
    const springScale = phraseAge < 0.22 ? easeOutBack(phraseAge / 0.22) : 1.0;
    capCard.style.transform = `scale(${(0.92 + 0.08 * springScale).toFixed(3)})`;
  }
}

function updateSceneInfographic(sNum, t, frameIdx) {
  if (sNum === 1) {
    const isShattered = t >= 3.12;
    const key = `s1_${isShattered}`;
    if (lastOverlayStateKey !== key) {
      lastOverlayStateKey = key;
      elSceneOverlay.innerHTML = isShattered
        ? `<div class="info-panel">
            <div class="panel-header-row">
              <span class="panel-tag">✓ 100% CODE-GENERATED 3D</span>
              <span class="panel-sub">THREE.JS + WEBGL 2.0 · 60 FPS</span>
            </div>
            <div class="hero-stat-row">
              <div class="hero-stat-main">Kein Blender. Kein After Effects. <span class="hero-stat-highlight">Reiner Code!</span></div>
            </div>
          </div>`
        : `<div class="info-panel">
            <div class="panel-header-row">
              <span class="panel-tag">MYTHOS VS. REALITÄT</span>
              <span class="panel-sub">WIE ENTSTEHEN VIRALE 3D-SHORTS?</span>
            </div>
            <div class="hero-stat-row">
              <div class="hero-stat-main">Manuelle 3D-Tools? <span class="hero-stat-highlight">Nein – automatisiert per Code!</span></div>
            </div>
          </div>`;
    }
  } else if (sNum === 2) {
    const step2Active = t >= 13.2;
    const key = `s2_${step2Active}`;
    if (lastOverlayStateKey !== key) {
      lastOverlayStateKey = key;
      elSceneOverlay.innerHTML = `<div class="info-panel">
        <div class="panel-header-row">
          <span class="panel-tag">DIE 4-SCHRITTE PIPELINE</span>
          <span class="panel-sub">SCHRITT 1 & 2 · PROMPT → THREE.JS</span>
        </div>
        <div class="pipeline-steps-row">
          <div class="pipe-step ${!step2Active ? 'active' : ''}">
            <span class="pipe-step-num">01 · PROMPT</span>
            <span class="pipe-step-label">Story & Stil</span>
          </div>
          <div class="pipe-step ${step2Active ? 'active' : ''}">
            <span class="pipe-step-num">02 · THREE.JS</span>
            <span class="pipe-step-label">3D & Splines</span>
          </div>
          <div class="pipe-step">
            <span class="pipe-step-num">03 · PYTHON</span>
            <span class="pipe-step-label">Voice & SFX</span>
          </div>
          <div class="pipe-step">
            <span class="pipe-step-num">04 · FFMPEG</span>
            <span class="pipe-step-label">60 FPS MP4</span>
          </div>
        </div>
        <div class="code-window">${
          !step2Active
            ? `<span class="code-com">// 1. Dein Prompt an Claude:</span>\n<span class="code-str">"Erstelle ein 9:16 Three.js 3D-Video mit Kamerafahrt, PBR-Licht & Infografik"</span>`
            : `<span class="code-kw">const</span> camSpline = <span class="code-kw">new</span> THREE.<span class="code-fn">CatmullRomCurve3</span>(keyframes);\ncamera.position.<span class="code-fn">copy</span>(camSpline.<span class="code-fn">getPointAt</span>(progress));`
        }</div>
      </div>`;
    }
  } else if (sNum === 3) {
    const step4Active = t >= 24.1;
    const curFrameNum = Math.min(3563, Math.floor(((t - 19.5) / 10.9) * 3563));
    elSceneOverlay.innerHTML = `<div class="info-panel">
      <div class="panel-header-row">
        <span class="panel-tag">AUTOMATISIERTE PRODUKTION</span>
        <span class="panel-sub">FRAME ${String(Math.max(1, curFrameNum)).padStart(4, '0')} / 3563 · 60.0 FPS</span>
      </div>
      <div class="pipeline-steps-row">
        <div class="pipe-step"><span class="pipe-step-num">01 · PROMPT</span><span class="pipe-step-label">Fertig ✓</span></div>
        <div class="pipe-step"><span class="pipe-step-num">02 · THREE.JS</span><span class="pipe-step-label">Fertig ✓</span></div>
        <div class="pipe-step ${!step4Active ? 'active' : ''}"><span class="pipe-step-num">03 · PYTHON</span><span class="pipe-step-label">Voice & Sync</span></div>
        <div class="pipe-step ${step4Active ? 'active' : ''}"><span class="pipe-step-num">04 · FFMPEG</span><span class="pipe-step-label">60 FPS Render</span></div>
      </div>
      <div class="code-window">${
        !step4Active
          ? `<span class="code-com"># 3. Python generiert Voiceover, Beat & Wort-Timestamps</span>\nvoice.<span class="code-fn">synthesize_wav</span>(script, syn_config=cfg) <span class="code-str"># → master_audio.wav</span>`
          : `<span class="code-com"># 4. Headless Chromium + FFmpeg 60 FPS Render-Pipeline</span>\n<span class="code-kw">await</span> page.<span class="code-fn">evaluate</span>(t => window.<span class="code-fn">setVideoTime</span>(t)); <span class="code-str">// → 1080x1920 MP4</span>`
      }</div>
    </div>`;
    lastOverlayStateKey = 's3_dynamic';
  } else if (sNum === 4) {
    // Animate counters deterministically based on timestamp t
    const promptsProg = smoothstep(34.9, 37.8, t);
    const promptsCount = Math.round(promptsProg * 45);
    const videosProg = smoothstep(38.7, 41.2, t);
    const videosCount = Math.round(videosProg * 15);
    const videoMetricStr = videosProg >= 0.95 ? '10–15' : videosCount > 0 ? `${videosCount} Videos` : '3–4 Prompts';

    elSceneOverlay.innerHTML = `<div class="info-panel">
      <div class="panel-header-row">
        <span class="panel-tag">CLAUDE PRO ABO-KALKULATION (20 $ / MONAT)</span>
        <span class="panel-sub">5-STUNDEN-FENSTER RECHNUNG</span>
      </div>
      <div class="claude-math-grid">
        <div class="math-metric-box">
          <span class="math-metric-val">20 $</span>
          <span class="math-metric-lbl">Claude Pro / Monat</span>
        </div>
        <div class="math-metric-box ${t >= 34.8 && t < 38.7 ? 'featured' : ''}">
          <span class="math-metric-val">~${promptsCount > 0 ? promptsCount : 45}</span>
          <span class="math-metric-lbl">Prompts je 5h-Fenster</span>
        </div>
        <div class="math-metric-box ${t >= 38.7 ? 'featured' : ''}">
          <span class="math-metric-val">${videoMetricStr}</span>
          <span class="math-metric-lbl">${videosCount > 0 ? 'Fertige 3D-Videos / 5h' : 'Iterationen je Video'}</span>
        </div>
      </div>
    </div>`;
    lastOverlayStateKey = 's4_dynamic';
  } else if (sNum === 5) {
    const monthProg = smoothstep(44.6, 48.0, t);
    const monthVideos = Math.round(lerp(15, 400, monthProg));
    const showCents = t >= 49.0;
    const centVal = showCents ? smoothstep(49.0, 50.1, t) : 0;
    const priceDisplay = showCents ? `~${lerp(0.50, 0.05, centVal).toFixed(2).replace('.', ',')} $` : '20,00 $';

    elSceneOverlay.innerHTML = `<div class="info-panel">
      <div class="panel-header-row">
        <span class="panel-tag">MONATS-OUTPUT MIT EINEM CLAUDE PRO ABO</span>
        <span class="panel-sub">30 TAGE SKALIERUNG</span>
      </div>
      <div class="claude-math-grid">
        <div class="math-metric-box featured">
          <span class="math-metric-val">~${monthVideos}</span>
          <span class="math-metric-lbl">3D-Videos pro Monat</span>
        </div>
        <div class="math-metric-box">
          <span class="math-metric-val">10–15</span>
          <span class="math-metric-lbl">Videos je 5h-Session</span>
        </div>
        <div class="math-metric-box ${showCents ? 'featured' : ''}">
          <span class="math-metric-val">${priceDisplay}</span>
          <span class="math-metric-lbl">Kosten pro 3D-Video</span>
        </div>
      </div>
    </div>`;
    lastOverlayStateKey = 's5_dynamic';
  } else {
    const key = 's6_finale';
    if (lastOverlayStateKey !== key) {
      lastOverlayStateKey = key;
      elSceneOverlay.innerHTML = `<div class="info-panel">
        <div class="panel-header-row">
          <span class="panel-tag">DEINE 3D-VIDEO-FABRIK IST BEREIT</span>
          <span class="panel-sub">KOMPLETT-ZUSAMMENFASSUNG</span>
        </div>
        <div class="claude-math-grid">
          <div class="math-metric-box">
            <span class="math-metric-val">Three.js</span>
            <span class="math-metric-lbl">HTML + WebGL 2.0</span>
          </div>
          <div class="math-metric-box">
            <span class="math-metric-val">60 FPS</span>
            <span class="math-metric-lbl">Headless FFmpeg MP4</span>
          </div>
          <div class="math-metric-box featured">
            <span class="math-metric-val">~400 / Mo</span>
            <span class="math-metric-lbl">Mit Claude Pro (20 $)</span>
          </div>
        </div>
      </div>`;
    }
  }
}

// ============================================================================
// MASTER DETERMINISTIC 3D SCENE & CAMERA CHOREOGRAPHY: window.setVideoTime(t)
// ============================================================================
const dummyMatrix = new THREE.Matrix4();
const dummyPos = new THREE.Vector3();
const dummyQuat = new THREE.Quaternion();
const dummyScale = new THREE.Vector3();

export function setVideoTime(rawTime) {
  const t = clamp(rawTime, 0, TOTAL_DURATION);
  const frameIdx = Math.min(
    TIMELINE.voiceEnvelope.length - 1,
    Math.max(0, Math.floor(t * FPS))
  );
  const voiceAmp = TIMELINE.voiceEnvelope[frameIdx] || 0.0;
  const bassAmp = TIMELINE.bassEnvelope[frameIdx] || 0.0;

  // Update DOM HUD, Infographic Cards & Word-by-Word Captions
  updateDOMOverlays(t, frameIdx, voiceAmp, bassAmp);

  // Subtle global particle drift
  particleField.rotation.y = Math.sin(t * 0.12) * 0.04;
  particleField.position.y = Math.cos(t * 0.25) * 0.35;

  // Determine active scene visibility first so we only update & upload active scene buffers
  groupS1.visible = t < 8.2 || t > 52.5;
  groupS2.visible = t >= 7.0 && t < 20.4;
  groupS3.visible = t >= 19.2 && t < 31.3;
  groupS4.visible = t >= 30.1 && t < 45.5;
  groupS5.visible = t >= 44.2 && t < 54.5;

  // ==========================================================================
  // UPDATE SCENE 1 OBJECTS (x = 0)
  // ==========================================================================
  if (groupS1.visible) {
    const shatterTime = 3.12;
    if (t < shatterTime) {
      shatterGroup.visible = true;
      const tension = smoothstep(1.2, shatterTime, t);
      shards.forEach((sh, idx) => {
        const jitter = tension * 0.12 * Math.sin(t * 48 + idx * 1.7);
        sh.mesh.position.copy(sh.basePos).multiplyScalar(1 + tension * 0.14).addScalar(jitter);
        sh.mesh.rotation.set(jitter * 2, -jitter * 2, jitter);
        sh.mesh.scale.setScalar(1.0);
      });
      shatterGroup.rotation.y = t * 0.85;
      shatterGroup.rotation.x = Math.sin(t * 1.4) * 0.22;
      codeCoreGroup.scale.setScalar(0.001);
    } else {
      const dt = t - shatterTime;
      const coreScale = easeOutBack(clamp(dt / 0.55, 0, 1));
      codeCoreGroup.scale.setScalar(Math.max(0.01, coreScale));

      if (dt < 2.5) {
        shatterGroup.visible = true;
        shards.forEach((sh) => {
          sh.mesh.position
            .copy(sh.basePos)
            .addScaledVector(sh.vel, dt)
            .add(new THREE.Vector3(0, -3.8 * dt * dt, 0));
          sh.mesh.rotation.set(sh.rotVel.x * dt, sh.rotVel.y * dt, sh.rotVel.z * dt);
          const sScale = Math.max(0, 1 - dt * 0.42);
          sh.mesh.scale.setScalar(sScale);
        });
      } else {
        shatterGroup.visible = false;
      }
    }

    const corePulse = 1.0 + voiceAmp * 0.14 + bassAmp * 0.10;
    coreIcosa.scale.setScalar(corePulse);
    coreIcosa.rotation.y = t * 1.1;
    coreIcosa.rotation.x = t * 0.7;
    coreWire.rotation.y = -t * 0.8;
    coreWire.scale.setScalar(1.0 + bassAmp * 0.18);
    coreKnot.rotation.z = t * 1.6;
    coreKnot.rotation.x = t * 1.2;

    s1GyroRings.forEach((ring, rIdx) => {
      ring.rotation.x = t * (0.9 + rIdx * 0.35) + rIdx;
      ring.rotation.y = t * (0.7 - rIdx * 0.25);
    });

    s1Primitives.forEach((pr, idx) => {
      const a = pr.angle + t * 1.15;
      pr.mesh.position.set(
        Math.cos(a) * pr.radius,
        Math.sin(t * 2.4 + idx) * 1.1,
        Math.sin(a) * pr.radius
      );
      pr.mesh.rotation.x = t * 2.0 + idx;
      pr.mesh.rotation.y = t * 1.5;
    });
  }

  // ==========================================================================
  // UPDATE SCENE 2 OBJECTS (x = 40): KINETIC CODE CARDS & CAMERA SPLINE
  // ==========================================================================
  if (groupS2.visible) {
    const s2LocalT = Math.max(0, t - 7.25);
    s2Cards.forEach((cObj, idx) => {
      const appearDelay = idx * 1.6;
      const prog = easeOutBack(clamp((s2LocalT - appearDelay) / 0.65, 0, 1));
      cObj.group.scale.setScalar(Math.max(0.001, prog));
      cObj.group.position.y = cObj.basePos.y + Math.sin(t * 2.1 + idx * 1.4) * 0.18;
      cObj.group.rotation.y = cObj.baseRotY + Math.sin(t * 1.3 + idx) * 0.06;
    });

    const splineU = (t * 0.22) % 1.0;
    const rigPos = s2Curve.getPointAt(splineU);
    camRig.position.copy(rigPos);
    camRig.lookAt(0, -1.8, -0.2);

    s2MorphMesh.rotation.y = t * 1.25;
    s2MorphMesh.rotation.x = t * 0.85;
    s2MorphMesh.scale.setScalar(1.0 + voiceAmp * 0.15);
    s2MorphWire.rotation.y = t * 1.25;
    s2MorphWire.rotation.x = t * 0.85;
    s2ScanRing.position.y = Math.sin(t * 3.4) * 1.45;
  }

  // ==========================================================================
  // UPDATE SCENE 3 OBJECTS (x = 80): AUDIO EQUALIZER RING & 60 FPS PORTAL
  // ==========================================================================
  if (groupS3.visible) {
    audioCoreSphere.scale.setScalar(1.0 + voiceAmp * 0.28 + bassAmp * 0.16);
    audioCoreSphere.rotation.y = t * 1.5;
    eqBars3D.forEach((bar, i) => {
      const wave = Math.sin(t * 16 + i * 0.45) * 0.5 + 0.5;
      const scaleY = 0.35 + (voiceAmp * 1.85 + bassAmp * 1.1) * (0.35 + 0.65 * wave);
      bar.scale.y = scaleY;
    });

    portalGlowRing.rotation.z = t * 2.5;
    portalCyanRing.rotation.z = -t * 1.8;

    const conveyorSpan = 16.0;
    s3FramePlates.forEach((fp) => {
      const rawX = (((fp.index / s3FramePlates.length) * conveyorSpan + t * 4.2) % conveyorSpan) - conveyorSpan / 2;
      fp.group.position.set(rawX, 0, 0);
      const isEncoded = rawX >= 0;
      fp.solidMesh.visible = isEncoded;
      fp.rawMesh.visible = !isEncoded;
      fp.wireRim.material = isEncoded ? matWireGold : matWireCyan;
      const portalProx = Math.exp(-rawX * rawX * 1.8);
      fp.group.scale.setScalar(1.0 + portalProx * 0.24);
    });
  }

  // ==========================================================================
  // UPDATE SCENE 4 OBJECTS (x = 120): HYPNOTIC GYRO MACHINE & 15 MONOLITHS
  // ==========================================================================
  if (groupS4.visible) {
    s4GearRings.forEach((gear, gIdx) => {
      const dir = gIdx % 2 === 0 ? 1 : -1;
      gear.rotation.z = t * dir * (0.85 + gIdx * 0.22);
      gear.rotation.x = Math.sin(t * 0.7 + gIdx) * 0.28;
      gear.rotation.y = Math.cos(t * 0.6 + gIdx) * 0.28;
    });

    promptOrbs.forEach((po) => {
      const u = ((po.index / 45) + t * 0.14) % 1.0;
      const pt = helixCurve.getPointAt(u);
      po.mesh.position.copy(pt);
      const pulse = 1.0 + 0.35 * Math.sin(t * 8 + po.index);
      po.mesh.scale.setScalar(pulse);
    });

    s4Monoliths.forEach((mono) => {
      const triggerT = 38.4 + (mono.index / 15) * 3.2;
      const riseProg = easeOutBack(clamp((t - triggerT) / 0.65, 0, 1));
      const activeProg = t < 30.0 ? 1.0 : riseProg;
      mono.group.scale.setScalar(Math.max(0.001, activeProg));
      mono.group.position.y =
        mono.targetPos.y - (1 - activeProg) * 3.5 + Math.sin(t * 2.5 + mono.index * 0.5) * 0.12;
    });
  }

  // ==========================================================================
  // UPDATE SCENE 5 OBJECTS (x = 160): 400 VIDEO TOWERS MATRIX & 5-CENT HERO
  // ==========================================================================
  if (groupS5.visible) {
    const s5RiseGlobal = smoothstep(44.4, 47.5, t);
    dummyQuat.identity();

    for (let i = 0; i < TOWER_COUNT; i++) {
      const tc = towerCoords[i];
      const wave = Math.sin(tc.dist * 0.65 - t * 3.8) * 0.5 + 0.5;
      const baseH = 0.4 + (1.45 + wave * 1.9 + bassAmp * 0.75) * (0.25 + 0.75 * s5RiseGlobal);

      dummyPos.set(tc.wx, -5.1, tc.wz);
      dummyScale.set(1, baseH, 1);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      towerBodyInst.setMatrixAt(i, dummyMatrix);

      dummyPos.set(tc.wx, -5.1 + baseH + 0.08, tc.wz);
      dummyScale.set(1, 1, 1);
      dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
      towerCapInst.setMatrixAt(i, dummyMatrix);
    }
    towerBodyInst.instanceMatrix.needsUpdate = true;
    towerCapInst.instanceMatrix.needsUpdate = true;

    s5HeroGroup.position.y = 1.75 + Math.sin(t * 2.0) * 0.18;
    s5HeroGroup.rotation.y = Math.sin(t * 0.85) * 0.14;
    s5CrownCrystals.forEach((cr, idx) => {
      const a = cr.angle + t * 1.4;
      cr.mesh.position.set(Math.cos(a) * 4.4, Math.sin(t * 3 + idx) * 0.45, Math.sin(a) * 2.0);
      cr.mesh.rotation.y = t * 2.5;
      cr.mesh.rotation.x = t * 1.8;
    });
  }

  // ==========================================================================
  // CAMERA CHOREOGRAPHY ACROSS ALL 6 SCENES (Seamless Spline & Whip-Transitions)
  // ==========================================================================
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  let camRoll = 0.0;

  if (t < 7.292) {
    // SCENE 1 (x = 0): Dramatic swoop in & orbit around Shattering Cube -> Pure Code Core
    const u = t / 7.292;
    const shake = t >= 3.12 && t < 3.65 ? Math.sin(t * 95) * 0.22 * (1 - (t - 3.12) / 0.53) : 0;
    const orbitAngle = Math.sin(u * Math.PI) * 0.48;
    const dist = lerp(16.2, 11.8, easeInOutCubic(u));
    const height = lerp(5.4, 1.9, easeInOutCubic(u));
    camPos.set(Math.sin(orbitAngle) * dist + shake, height + shake, Math.cos(orbitAngle) * dist);
    camTarget.set(0, 1.45, 0);
  } else if (t < 19.497) {
    // SCENE 2 (x = 40): Kinetic Whip-Pan & Multi-Angle Code-to-3D Showcase
    const whip = easeInOutCubic(clamp((t - 7.292) / 0.65, 0, 1));
    const localT = t - 7.292;
    const swayX = Math.sin(localT * 0.65) * 2.6;
    const swayY = 1.6 + Math.cos(localT * 0.5) * 0.75;
    const zDist = localT < 5.8 ? 12.6 : lerp(12.6, 10.8, smoothstep(5.8, 8.5, localT));

    const s1EndPos = new THREE.Vector3(Math.sin(0) * 11.8, 1.9, 11.8);
    const s2ActivePos = new THREE.Vector3(40 + swayX, swayY, zDist);
    camPos.lerpVectors(s1EndPos, s2ActivePos, whip);
    camTarget.set(lerp(0, 40 + swayX * 0.25, whip), lerp(1.45, 1.25, whip), -0.8);
    camRoll = Math.sin(whip * Math.PI) * -0.08 + Math.sin(localT * 0.9) * 0.025;
  } else if (t < 30.402) {
    // SCENE 3 (x = 80): Glide from 3D Audio Equalizer Ring down to 60 FPS FFmpeg Portal
    const whip = easeInOutCubic(clamp((t - 19.497) / 0.65, 0, 1));
    const localT = t - 19.497;
    const stageShift = smoothstep(4.2, 5.6, localT); // 0 = Upper Audio Ring, 1 = Lower FFmpeg Portal
    const targetY = lerp(2.8, -0.8, stageShift);
    const camY = lerp(3.4, 0.2, stageShift);
    const camX = 80 + Math.sin(localT * 0.55) * 2.4;
    const camZ = lerp(11.5, 10.6, stageShift);

    const prevPos = new THREE.Vector3(40, 1.6, 11.0);
    camPos.lerpVectors(prevPos, new THREE.Vector3(camX, camY, camZ), whip);
    camTarget.set(lerp(40, 80, whip), targetY, 0);
  } else if (t < 44.546) {
    // SCENE 4 (x = 120): Hypnotic Orbital Glide around 5h Clockwork Machine & 15 Monoliths
    const whip = easeInOutCubic(clamp((t - 30.402) / 0.70, 0, 1));
    const localT = t - 30.402;
    const pullBack = smoothstep(7.5, 11.0, localT); // Pull back slightly as 15 monoliths rise
    const orbitA = Math.sin(localT * 0.45) * 0.42;
    const dist = lerp(11.8, 14.6, pullBack);
    const camY = lerp(2.2, 1.4, pullBack);

    const targetS4 = new THREE.Vector3(
      120 + Math.sin(orbitA) * dist,
      camY,
      Math.cos(orbitA) * dist
    );
    camPos.lerpVectors(new THREE.Vector3(80, 0.2, 10.6), targetS4, whip);
    camTarget.set(lerp(80, 120, whip), lerp(1.6, 0.4, pullBack), -0.5);
  } else if (t < 53.033) {
    // SCENE 5 (x = 160): Epic Crane Pull-Back over the 400 Video Towers Matrix!
    const whip = easeInOutCubic(clamp((t - 44.546) / 0.75, 0, 1));
    const localT = t - 44.546;
    const craneU = smoothstep(0.0, 5.5, localT);
    const orbitA = Math.sin(localT * 0.4) * 0.36;
    const dist = lerp(13.5, 17.5, craneU);
    const height = lerp(3.2, 6.2, craneU);

    const targetS5 = new THREE.Vector3(
      160 + Math.sin(orbitA) * dist,
      height,
      Math.cos(orbitA) * dist
    );
    camPos.lerpVectors(new THREE.Vector3(120, 1.4, 14.6), targetS5, whip);
    camTarget.set(lerp(120, 160, whip), lerp(1.0, 1.8, craneU), -1.5);
  } else {
    // SCENE 6 (53.033 -> 59.382): Finale & Seamless Return to Scene 1 Origin (0, 5.4, 16.2)
    const u = clamp((t - 53.033) / (TOTAL_DURATION - 53.033), 0, 1);
    const flyBack = easeInOutCubic(clamp(u / 0.28, 0, 1));
    const settleLoop = smoothstep(0.65, 1.0, u);

    const s5LastPos = new THREE.Vector3(160, 6.2, 17.5);
    const s6OrbitPos = new THREE.Vector3(
      Math.sin((1 - settleLoop) * 0.6) * lerp(12.2, 16.2, settleLoop),
      lerp(2.4, 5.4, settleLoop),
      Math.cos((1 - settleLoop) * 0.6) * lerp(12.2, 16.2, settleLoop)
    );
    camPos.lerpVectors(s5LastPos, s6OrbitPos, flyBack);
    camTarget.set(lerp(160, 0, flyBack), 1.45, 0);
  }

  // Only render scene groups that are in or near the active camera view
  groupS1.visible = t < 8.2 || t > 52.5;
  groupS2.visible = t >= 7.0 && t < 20.4;
  groupS3.visible = t >= 19.2 && t < 31.3;
  groupS4.visible = t >= 30.1 && t < 45.5;
  groupS5.visible = t >= 44.2 && t < 54.5;

  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  camera.rotation.z += camRoll;

  // Position dynamic point lights near the active camera target for rich specular highlights
  rimLightCyan.position.set(camTarget.x - 8, camTarget.y + 6, camTarget.z + 6);
  rimLightAmber.position.set(camTarget.x + 8, camTarget.y + 4, camTarget.z + 7);
  rimLightAmber.intensity = 24 + bassAmp * 16;
  rimLightCyan.intensity = 20 + voiceAmp * 14;

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

// Expose globally for Puppeteer deterministic frame-by-frame capture
window.setVideoTime = setVideoTime;
window.TOTAL_DURATION = TOTAL_DURATION;
window.VIDEO_READY = true;

// Initial render at t = 0
setVideoTime(0);

// ============================================================================
// INTERACTIVE STUDIO PLAYBACK CONTROLLER (When opened in normal browser)
// ============================================================================
if (!IS_RENDER_MODE) {
  const audioEl = document.getElementById('master-audio-el');
  const btnPlay = document.getElementById('btn-play-pause');
  const scrubber = document.getElementById('timeline-scrubber');
  const timeReadout = document.getElementById('studio-time-readout');
  const sceneBtns = Array.from(document.querySelectorAll('.scene-btn'));

  let isPlaying = false;
  let fallbackTime = 0;
  let lastWallTime = performance.now();

  function togglePlay() {
    if (!isPlaying) {
      isPlaying = true;
      lastWallTime = performance.now();
      if (audioEl) {
        audioEl.currentTime = fallbackTime;
        audioEl.play().catch(() => {});
      }
      btnPlay.textContent = '⏸ Pause';
    } else {
      isPlaying = false;
      if (audioEl) audioEl.pause();
      btnPlay.textContent = '▶ Abspielen (mit Audio)';
    }
  }

  if (btnPlay) btnPlay.addEventListener('click', togglePlay);

  if (scrubber) {
    scrubber.max = TOTAL_DURATION.toFixed(2);
    scrubber.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      fallbackTime = val;
      if (audioEl) audioEl.currentTime = val;
      setVideoTime(val);
      if (timeReadout) timeReadout.textContent = `${val.toFixed(2)}s / ${TOTAL_DURATION.toFixed(2)}s`;
    });
  }

  sceneBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tJump = parseFloat(btn.getAttribute('data-time') || '0');
      fallbackTime = tJump;
      if (audioEl) audioEl.currentTime = tJump;
      if (scrubber) scrubber.value = tJump;
      setVideoTime(tJump);
      sceneBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  function studioLoop(now) {
    const dt = (now - lastWallTime) / 1000;
    lastWallTime = now;

    if (isPlaying) {
      if (audioEl && !audioEl.paused) {
        fallbackTime = audioEl.currentTime;
      } else {
        fallbackTime += dt;
      }
      if (fallbackTime >= TOTAL_DURATION) {
        fallbackTime = 0;
        if (audioEl) {
          audioEl.currentTime = 0;
          audioEl.play().catch(() => {});
        }
      }
      setVideoTime(fallbackTime);
      if (scrubber) scrubber.value = fallbackTime;
      if (timeReadout) {
        timeReadout.textContent = `${fallbackTime.toFixed(2)}s / ${TOTAL_DURATION.toFixed(2)}s`;
      }
    }
    requestAnimationFrame(studioLoop);
  }
  requestAnimationFrame(studioLoop);
}
