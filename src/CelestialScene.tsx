import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './CelestialScene.css';

const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const ZODIAC_PATHS = [
  'M64 103V54C64 23 29 17 27 44C25 63 40 66 48 59M64 54C64 23 99 17 101 44C103 63 88 66 80 59',
  'M88 75A24 24 0 1 1 40 75A24 24 0 1 1 88 75M40 25C40 44 49 51 64 51C79 51 88 44 88 25',
  'M32 27Q64 38 96 27M32 101Q64 90 96 101M46 32V97M82 32V97',
  'M58 46A14 14 0 1 1 30 46A14 14 0 1 1 58 46M70 82A14 14 0 1 1 98 82A14 14 0 1 1 70 82M30 46C47 19 82 20 98 33M98 82C81 109 46 108 30 95',
  'M51 84A15 15 0 1 1 21 84A15 15 0 1 1 51 84M42 71C35 39 55 19 74 27C105 40 62 71 78 96C85 106 99 102 105 92',
  'M20 32V97M20 52C20 25 47 25 47 52V97M47 52C47 25 73 25 73 52V90M73 49C99 23 112 55 99 76C91 90 84 96 74 101M65 70C67 91 91 100 108 96',
  'M22 97H106M22 77H43C30 66 38 41 64 41C90 41 98 66 85 77H106',
  'M20 32V97M20 52C20 25 47 25 47 52V97M47 52C47 25 73 25 73 52V82C73 97 91 101 108 87M96 87H108V99',
  'M29 99L99 29M67 29H99V61M36 40L88 92',
  'M22 40C41 40 40 98 53 98C63 98 65 62 74 54C86 40 108 52 108 71C108 99 79 111 74 81M53 98C53 63 51 28 62 27',
  'M20 49L35 36L50 49L65 36L80 49L95 36L108 49M20 85L35 72L50 85L65 72L80 85L95 72L108 85',
  'M34 25C61 44 61 84 34 103M94 25C67 44 67 84 94 103M28 64H100',
];

function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function surfaceTexture(kind: 'saturn' | 'moon' | 'sun' | 'earth' | 'jupiter' | 'mars') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const pixels = context.createImageData(canvas.width, canvas.height);
  const random = randomSource({ saturn: 27, moon: 9, sun: 12, earth: 31, jupiter: 42, mars: 19 }[kind]);
  const base = { saturn: [214, 190, 151], moon: [164, 156, 137], sun: [246, 171, 65], earth: [56, 103, 129], jupiter: [196, 156, 112], mars: [178, 106, 75] }[kind];
  for (let y = 0; y < canvas.height; y += 1) {
    const bands = Math.sin(y * 0.18) * 7 + Math.sin(y * 0.061) * 14 + Math.sin(y * 0.49) * 3;
    for (let x = 0; x < canvas.width; x += 1) {
      const grain = (random() - 0.5) * (kind === 'moon' || kind === 'mars' ? 26 : 11);
      const offset = (y * canvas.width + x) * 4;
      const variation = kind === 'moon' || kind === 'earth' ? grain
        : kind === 'sun' ? grain + Math.sin(x * 0.7 + y * 0.31) * 6
          : kind === 'mars' ? grain + Math.sin(x * 0.023 + y * 0.013) * 12 + Math.sin(x * 0.04 - y * 0.065) * 9
            : kind === 'jupiter' ? bands * 1.8 + Math.sin(y * 0.11 + Math.sin(x * 0.027) * 0.65) * 12 + grain : bands + grain;
      pixels.data[offset] = base[0] + variation;
      pixels.data[offset + 1] = base[1] + variation;
      pixels.data[offset + 2] = base[2] + variation;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  if (kind === 'earth') {
    const continents = [
      [[-168, 65], [-150, 60], [-136, 58], [-124, 49], [-123, 38], [-116, 32], [-109, 24], [-97, 16], [-87, 20], [-81, 24], [-81, 31], [-70, 45], [-57, 54], [-64, 60], [-83, 67], [-110, 72], [-143, 70]],
      [[-73, 59], [-55, 60], [-20, 76], [-37, 83], [-57, 80]],
      [[-81, 12], [-66, 10], [-51, 2], [-35, -7], [-40, -21], [-52, -33], [-68, -55], [-77, -30], [-78, -9]],
      [[-10, 36], [-6, 55], [8, 58], [21, 71], [44, 68], [75, 73], [113, 72], [151, 60], [179, 65], [166, 49], [142, 46], [130, 34], [122, 22], [108, 6], [99, 15], [78, 8], [68, 24], [50, 30], [36, 41], [20, 40]],
      [[-17, 35], [10, 37], [32, 30], [43, 12], [51, 11], [40, -12], [33, -27], [18, -35], [10, -20], [-1, 4], [-17, 16]],
      [[113, -22], [129, -11], [143, -13], [153, -25], [146, -39], [129, -34], [114, -34]],
      [[47, -13], [50, -17], [45, -26], [43, -23]],
      [[129, 32], [143, 44], [145, 41], [137, 33]],
    ];
    const land = context.createLinearGradient(0, 40, 0, 210);
    land.addColorStop(0, '#b0b694');
    land.addColorStop(0.32, '#76916c');
    land.addColorStop(0.52, '#b9ad7d');
    land.addColorStop(0.72, '#6e8864');
    land.addColorStop(1, '#bcc1a0');
    context.fillStyle = land;
    for (const coastline of continents) {
      context.beginPath();
      coastline.forEach(([longitude, latitude], index) => {
        const x = (longitude + 180) / 360 * canvas.width;
        const y = (90 - latitude) / 180 * canvas.height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.closePath();
      context.fill();
    }
    context.fillStyle = '#e2e8de';
    context.fillRect(0, 0, canvas.width, 9);
    context.fillRect(0, 243, canvas.width, 13);
  }
  if (kind === 'jupiter') {
    const storm = context.createRadialGradient(343, 163, 2, 346, 165, 43);
    storm.addColorStop(0, '#ad6a47cc');
    storm.addColorStop(0.6, '#bc7d5499');
    storm.addColorStop(1, '#dfbb8200');
    context.fillStyle = storm;
    context.beginPath();
    context.ellipse(346, 165, 45, 19, -0.07, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ead6b245';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(346, 165, 38, 14, -0.07, 0, Math.PI * 2);
    context.stroke();
  }
  if (kind === 'moon') {
    for (let index = 0; index < 65; index += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const radius = 2 + random() * 12;
      const crater = context.createRadialGradient(x - radius * 0.2, y - radius * 0.2, 0, x, y, radius);
      crater.addColorStop(0, '#6c665853');
      crater.addColorStop(0.7, '#6c66582a');
      crater.addColorStop(0.86, '#f7edce50');
      crater.addColorStop(1, '#f7edce00');
      context.fillStyle = crater;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const random = randomSource(63);
  for (let index = 0; index < 95; index += 1) {
    const x = random() * canvas.width;
    const y = 22 + random() * 212;
    const width = 7 + random() * 34;
    const height = 2 + random() * 6;
    const cloud = context.createRadialGradient(x, y, 0, x, y, width);
    cloud.addColorStop(0, '#fffefa8f');
    cloud.addColorStop(1, '#fffefa00');
    context.fillStyle = cloud;
    context.beginPath();
    context.ellipse(x, y, width, height, (random() - 0.5) * 0.4, 0, Math.PI * 2);
    context.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  return map;
}

function sparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, '#c7a264ee');
  glow.addColorStop(0.17, '#c7a264b0');
  glow.addColorStop(0.6, '#c7a26420');
  glow.addColorStop(1, '#c7a26400');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = '#b8975bc7';
  context.beginPath();
  context.moveTo(32, 7);
  context.quadraticCurveTo(34, 29, 57, 32);
  context.quadraticCurveTo(34, 35, 32, 57);
  context.quadraticCurveTo(29, 35, 7, 32);
  context.quadraticCurveTo(29, 29, 32, 7);
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, '#f3b851b8');
  glow.addColorStop(0.16, '#edbf7555');
  glow.addColorStop(0.5, '#e0c28e1b');
  glow.addColorStop(1, '#e0c28e00');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function orbitLine(radius: number, color: number, opacity: number, dashed = false) {
  const points = Array.from({ length: 161 }, (_, index) => {
    const angle = index / 160 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.06, gapSize: 0.12 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return line;
}

function zodiacSprite(index: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.strokeStyle = '#9d7b48';
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke(new Path2D(ZODIAC_PATHS[index]));
  const map = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0.46, depthWrite: false }));
  sprite.scale.setScalar(0.37);
  return sprite;
}

function disposeScene(scene: THREE.Scene) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse((object) => {
    if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
    if ('material' in object) {
      const items = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of items) {
        if (!(material instanceof THREE.Material)) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function CelestialFallback() {
  return <svg className="celestial-fallback" viewBox="0 0 640 640" fill="none">
    <defs>
      <radialGradient id="celestial-planet" cx="30%" cy="26%" r="78%">
        <stop stopColor="#f0d6a4" />
        <stop offset=".53" stopColor="#cfb685" />
        <stop offset="1" stopColor="#8e887c" />
      </radialGradient>
      <linearGradient id="celestial-ring" x1="130" y1="250" x2="500" y2="400" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ceb98c" stopOpacity=".65" />
        <stop offset=".5" stopColor="#ad8e60" stopOpacity=".2" />
        <stop offset="1" stopColor="#ceb98c" stopOpacity=".7" />
      </linearGradient>
      <radialGradient id="celestial-earth" cx="28%" cy="25%" r="79%">
        <stop stopColor="#94bdc7" />
        <stop offset=".55" stopColor="#56859a" />
        <stop offset="1" stopColor="#3d5765" />
      </radialGradient>
      <radialGradient id="celestial-jupiter" cx="27%" cy="22%" r="82%">
        <stop stopColor="#dfc69e" />
        <stop offset=".58" stopColor="#c69e71" />
        <stop offset="1" stopColor="#8e7962" />
      </radialGradient>
      <radialGradient id="celestial-mars" cx="28%" cy="24%" r="78%">
        <stop stopColor="#d0a483" />
        <stop offset=".6" stopColor="#b97958" />
        <stop offset="1" stopColor="#8e6552" />
      </radialGradient>
      <clipPath id="celestial-earth-clip"><circle cx="128" cy="239" r="38" /></clipPath>
      <clipPath id="celestial-jupiter-clip"><circle cx="534" cy="459" r="49" /></clipPath>
    </defs>
    <g className="celestial-fallback-zodiac" stroke="#ac946f" strokeOpacity=".3">
      <circle cx="320" cy="320" r="265" />
      <circle cx="320" cy="320" r="237" strokeDasharray="2 9" />
      <circle cx="320" cy="320" r="215" />
      {ZODIAC.map((symbol, index) => {
        const angle = index * Math.PI / 6 - Math.PI / 2;
        return <path key={symbol} d={ZODIAC_PATHS[index]} transform={`translate(${320 + Math.cos(angle) * 252 - 10} ${320 + Math.sin(angle) * 252 - 10}) scale(.15625)`} stroke="#9d7b48" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </g>
    <g className="celestial-fallback-saturn">
      <ellipse cx="320" cy="320" rx="200" ry="64" transform="rotate(-24 320 320)" stroke="url(#celestial-ring)" strokeWidth="28" />
      <circle cx="320" cy="320" r="96" fill="url(#celestial-planet)" />
      <path d="M 153 383 C 211 393 400 350 493 247" stroke="url(#celestial-ring)" strokeWidth="25" />
    </g>
    <g className="celestial-fallback-moon"><circle cx="531" cy="177" r="14" fill="#d4ccba" /></g>
    <g className="celestial-fallback-earth">
      <circle cx="128" cy="239" r="38" fill="url(#celestial-earth)" />
      <g clipPath="url(#celestial-earth-clip)" fill="#a7b292" opacity=".85">
        <path d="M100 207L111 215L106 226L116 238L110 250L99 243L92 227ZM124 242L137 245L139 261L131 275L126 264ZM136 205L155 213L149 228L132 229L130 222ZM148 240L160 246L157 259L145 253Z" />
      </g>
    </g>
    <g className="celestial-fallback-jupiter">
      <circle cx="534" cy="459" r="49" fill="url(#celestial-jupiter)" />
      <g clipPath="url(#celestial-jupiter-clip)" stroke="#ad8059" strokeWidth="7" strokeOpacity=".35">
        <path d="M480 433Q533 441 586 432M480 452Q533 461 586 451M480 473Q533 483 586 472" />
        <ellipse cx="553" cy="474" rx="13" ry="5" fill="#b87d56" stroke="none" />
      </g>
    </g>
    <g className="celestial-fallback-mars"><circle cx="207" cy="447" r="24" fill="url(#celestial-mars)" /></g>
    <g fill="#b39865" opacity=".55">
      <path d="M77 318L80 330L92 333L80 336L77 348L74 336L62 333L74 330Z" />
      <path d="M430 83L432 92L441 94L432 96L430 105L428 96L419 94L428 92Z" />
      <path d="M410 526L412 535L421 537L412 539L410 548L408 539L399 537L408 535Z" />
    </g>
  </svg>;
}

export default function CelestialScene({ intro = false }: { intro?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const introMode = useRef(intro);
  const refreshLayout = useRef<(() => void) | null>(null);

  useEffect(() => {
    introMode.current = intro;
    refreshLayout.current?.();
  }, [intro]);

  useEffect(() => {
    const syncFallbackVisibility = () => setPageHidden(document.hidden);
    syncFallbackVisibility();
    document.addEventListener('visibilitychange', syncFallbackVisibility);
    return () => document.removeEventListener('visibilitychange', syncFallbackVisibility);
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    let renderer: THREE.WebGLRenderer;
    try {
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
      if (!context) return;
      renderer = new THREE.WebGLRenderer({ canvas: probe, context, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.className = 'celestial-canvas';
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 80);
    camera.position.set(0, 0, 18);
    const ambientLight = new THREE.AmbientLight(0xdce1dd, 1.65);
    scene.add(ambientLight);
    const sunlight = new THREE.DirectionalLight(0xffefd0, 3.4);
    sunlight.position.set(-5, 6, 8);
    scene.add(sunlight);
    const rimLight = new THREE.DirectionalLight(0x819aa6, 0.85);
    rimLight.position.set(5, -2, -3);
    scene.add(rimLight);

    const planetarySystem = new THREE.Group();
    planetarySystem.rotation.z = 0.38;
    planetarySystem.rotation.x = 0.27;
    scene.add(planetarySystem);
    const planetMaterial = new THREE.MeshStandardMaterial({ map: surfaceTexture('saturn'), roughness: 0.94, metalness: 0 });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), planetMaterial);
    planetarySystem.add(planet);
    const rings = new THREE.Group();
    rings.rotation.x = -Math.PI / 2 + 0.34;
    planetarySystem.add(rings);
    const ringBands = [
      [1.14, 1.19, 0xb3a087, 0.3], [1.2, 1.44, 0xd6c49e, 0.74],
      [1.45, 1.53, 0xb49d77, 0.45], [1.6, 1.83, 0xd3be96, 0.72],
      [1.84, 1.89, 0xae9165, 0.45], [1.91, 1.98, 0xd8c4a1, 0.4],
    ];
    for (const [inner, outer, color, opacity] of ringBands) {
      rings.add(new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128), new THREE.MeshStandardMaterial({
        color, transparent: true, opacity, side: THREE.DoubleSide, roughness: 1, depthWrite: false,
      })));
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), new THREE.MeshStandardMaterial({
      map: surfaceTexture('moon'), roughness: 1,
    }));
    planetarySystem.add(moon);

    const neighboringPlanets = new THREE.Group();
    scene.add(neighboringPlanets);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.43, 32, 24), new THREE.MeshStandardMaterial({
      map: surfaceTexture('earth'), roughness: 0.78, metalness: 0,
    }));
    earth.rotation.set(0.17, -1.55, 0.18);
    neighboringPlanets.add(earth);
    const earthClouds = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), new THREE.MeshStandardMaterial({
      map: cloudTexture(), transparent: true, opacity: 0.62, roughness: 1, depthWrite: false,
    }));
    earth.add(earthClouds);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(0.455, 24, 16), new THREE.MeshBasicMaterial({
      color: 0x91bbca, transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false,
    }));
    earth.add(atmosphere);
    const jupiter = new THREE.Mesh(new THREE.SphereGeometry(0.59, 32, 24), new THREE.MeshStandardMaterial({
      map: surfaceTexture('jupiter'), roughness: 0.94, metalness: 0,
    }));
    jupiter.rotation.set(0.05, -0.65, -0.12);
    neighboringPlanets.add(jupiter);
    const mars = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), new THREE.MeshStandardMaterial({
      map: surfaceTexture('mars'), roughness: 1, metalness: 0,
    }));
    mars.rotation.set(0.15, 0.8, -0.2);
    neighboringPlanets.add(mars);

    const zodiacWheel = new THREE.Group();
    zodiacWheel.rotation.x = 0.36;
    zodiacWheel.rotation.z = -0.14;
    scene.add(zodiacWheel);
    zodiacWheel.add(orbitLine(2.55, 0xab8c56, 0.26));
    zodiacWheel.add(orbitLine(2.82, 0xab8c56, 0.26, true));
    zodiacWheel.add(orbitLine(3.15, 0xb8a179, 0.2));
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI / 6;
      const symbol = zodiacSprite(index);
      if (symbol) {
        symbol.position.set(Math.cos(angle) * 2.99, Math.sin(angle) * 2.99, 0);
        zodiacWheel.add(symbol);
      }
      const points = [2.55, 2.68].map((radius) => new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
      zodiacWheel.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
        color: 0xab8c56, transparent: true, opacity: 0.3,
      })));
    }

    const sunGroup = new THREE.Group();
    scene.add(sunGroup);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), new THREE.MeshBasicMaterial({ map: surfaceTexture('sun') }));
    sunGroup.add(sun);
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.5, depthWrite: false }));
    sunGlow.scale.setScalar(3);
    sunGroup.add(sunGlow);
    const outerOrbit = orbitLine(4.25, 0xae9061, 0.14);
    outerOrbit.rotation.x = 0.9;
    outerOrbit.rotation.z = 0.2;
    sunGroup.add(outerOrbit);

    const random = randomSource(108);
    const starCoordinates = new Float32Array(230 * 3);
    for (let index = 0; index < 230; index += 1) {
      starCoordinates[index * 3] = (random() - 0.5) * 22;
      starCoordinates[index * 3 + 1] = (random() - 0.5) * 11;
      starCoordinates[index * 3 + 2] = -2 - random() * 4;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starCoordinates, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xa98a55, size: 0.032, transparent: true, opacity: 0.39 });
    const stars = new THREE.Points(starsGeometry, starMaterial);
    scene.add(stars);
    const sparkles = new THREE.Group();
    scene.add(sparkles);
    const sparkMap = sparkleTexture();
    const sparklePositions = [[-3.1, 1.02], [1.35, 1.25], [-2.9, -1.78], [2.23, -0.9], [-0.9, -2.45], [-4.02, -0.5]];
    const sparkleMaterials: THREE.SpriteMaterial[] = [];
    for (let index = 0; index < sparklePositions.length; index += 1) {
      const material = new THREE.SpriteMaterial({ map: sparkMap, transparent: true, opacity: 0.47, depthWrite: false });
      const sparkle = new THREE.Sprite(material);
      sparkle.position.set(...sparklePositions[index] as [number, number], -0.3);
      sparkle.scale.setScalar(index % 2 ? 0.22 : 0.31);
      sparkles.add(sparkle);
      sparkleMaterials.push(material);
    }

    let frame = 0;
    let previousFrame = 0;
    let elapsed = 0;
    let lastTime = 0;
    let disposed = false;
    let contextUnavailable = false;
    let narrow = false;
    const pointer = new THREE.Vector2();
    const drift = new THREE.Vector2();
    const earthHome = new THREE.Vector3();
    const jupiterHome = new THREE.Vector3();
    const marsHome = new THREE.Vector3();
    const moveAlongOrbit = (body: THREE.Mesh, home: THREE.Vector3, speed: number) => {
      const angle = elapsed * speed;
      body.position.set(
        home.x * Math.cos(angle) - home.y / 0.75 * Math.sin(angle),
        home.x * 0.75 * Math.sin(angle) + home.y * Math.cos(angle),
        home.z + Math.sin(angle) * 0.55,
      );
    };

    const render = () => {
      if (!contextUnavailable) renderer.render(scene, camera);
    };
    const update = (time: number) => {
      if (disposed || contextUnavailable || document.hidden || reducedMotion.matches) return;
      frame = requestAnimationFrame(update);
      if (time - previousFrame < (narrow ? 1000 / 24 : 1000 / 30)) return;
      elapsed += lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
      lastTime = time;
      previousFrame = time;
      drift.lerp(pointer, 0.025);
      const welcoming = introMode.current;
      planet.rotation.y = elapsed * (welcoming ? 0.22 : 0.05);
      planetarySystem.rotation.y = Math.sin(elapsed * (welcoming ? 0.36 : 0.06)) * 0.12 + drift.x;
      planetarySystem.rotation.x = 0.27 + (welcoming ? Math.sin(elapsed * 0.3) * 0.08 : 0) + drift.y;
      planetarySystem.rotation.z = 0.38 + (welcoming ? Math.sin(elapsed * 0.28) * 0.06 : 0);
      neighboringPlanets.rotation.y = drift.x * 0.4;
      earth.rotation.y = -1.55 + elapsed * (welcoming ? 0.3 : 0.095);
      earthClouds.rotation.y = elapsed * (welcoming ? 0.075 : 0.025);
      jupiter.rotation.y = -0.65 + elapsed * (welcoming ? 0.18 : 0.058);
      mars.rotation.y = 0.8 + elapsed * (welcoming ? 0.25 : 0.078);
      if (welcoming) {
        moveAlongOrbit(earth, earthHome, 0.16);
        moveAlongOrbit(jupiter, jupiterHome, 0.12);
        moveAlongOrbit(mars, marsHome, 0.21);
      } else {
        earth.position.set(earthHome.x + Math.cos(elapsed * 0.13) * 0.08, earthHome.y + Math.sin(elapsed * 0.15) * 0.1, earthHome.z);
        jupiter.position.set(jupiterHome.x + Math.sin(elapsed * 0.09) * 0.07, jupiterHome.y + Math.sin(elapsed * 0.12 + 2) * 0.07, jupiterHome.z);
        mars.position.set(marsHome.x + Math.sin(elapsed * 0.17) * 0.1, marsHome.y + Math.sin(elapsed * 0.14 + 1) * 0.07, marsHome.z);
      }
      zodiacWheel.rotation.z = -0.14 + elapsed * (welcoming ? 0.025 : 0.009);
      const moonAngle = elapsed * (welcoming ? 0.38 : 0.075) + 0.8;
      moon.position.set(Math.cos(moonAngle) * 2.35, Math.sin(moonAngle) * 0.58, Math.sin(moonAngle) * 1.6);
      sun.rotation.y = elapsed * 0.025;
      starMaterial.opacity = (introMode.current ? 0.75 : 0.39) + Math.sin(elapsed * 0.48) * 0.07;
      sparkleMaterials.forEach((material, index) => {
        material.opacity = (introMode.current ? 0.75 : 0.4) + Math.sin(elapsed * (0.55 + index * 0.06) + index * 1.4) * 0.18;
      });
      stars.position.set(drift.x * 0.6, drift.y * 0.6, 0);
      render();
    };
    const stopAnimation = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = 0;
      lastTime = 0;
    };
    const syncAnimation = () => {
      stopAnimation();
      if (disposed || contextUnavailable) return;
      render();
      if (!document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(update);
    };
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const aspect = width / height;
      narrow = width < 640;
      const welcoming = introMode.current;
      const compactIntro = welcoming && width <= 900;
      camera.left = -aspect * 5;
      camera.right = aspect * 5;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5));
      renderer.setSize(width, height, false);
      ambientLight.intensity = welcoming ? 0.9 : 1.65;
      sunlight.intensity = welcoming ? 2.7 : 3.4;
      starMaterial.color.setHex(welcoming ? 0xc5d6e2 : 0xa98a55);
      starMaterial.size = welcoming ? 0.04 : 0.032;
      starMaterial.opacity = welcoming ? 0.75 : 0.39;
      planetarySystem.scale.setScalar(welcoming ? compactIntro ? 0.74 : 1.32 : narrow ? 0.65 : 0.91);
      planetarySystem.position.set(welcoming ? compactIntro ? 0.15 : aspect * 5 - 3 : aspect * 5 - (narrow ? 0.75 : 2.1), welcoming ? compactIntro ? 2.25 : 0.4 : narrow ? 3.02 : 2.8, 0);
      neighboringPlanets.position.copy(planetarySystem.position);
      neighboringPlanets.scale.setScalar(welcoming ? compactIntro ? 0.7 : 1.15 : narrow ? 0.53 : 0.88);
      earthHome.set(compactIntro ? -1.62 : narrow ? -1.45 : -2.21, compactIntro ? 0.65 : narrow ? -0.95 : 0.54, 0.9);
      jupiterHome.set(compactIntro ? 1.5 : narrow ? 0.75 : 1.52, compactIntro ? -1.27 : narrow ? -2.53 : -1.7, -0.5);
      marsHome.set(compactIntro ? -1.18 : narrow ? -0.48 : -2.05, compactIntro ? -1.73 : narrow ? -3.13 : -1.17, 0.4);
      earth.position.copy(earthHome);
      jupiter.position.copy(jupiterHome);
      mars.position.copy(marsHome);
      sparkles.position.copy(planetarySystem.position);
      sparkles.scale.setScalar(welcoming ? compactIntro ? 0.62 : 1.18 : narrow ? 0.46 : 0.9);
      sparkleMaterials.forEach(material => { material.opacity = welcoming ? 0.75 : 0.47; });
      zodiacWheel.scale.setScalar(welcoming ? compactIntro ? 0.65 : 1.2 : narrow ? 0.64 : 0.91);
      zodiacWheel.position.copy(planetarySystem.position);
      sunGroup.position.set((welcoming ? 1 : -1) * (aspect * 5 - (narrow ? 0.25 : 0.65)), welcoming ? -3.5 : -2.35, 0);
      sunGroup.scale.setScalar(narrow ? 0.75 : 1);
      sunGroup.visible = !compactIntro;
      moon.position.set(1.64, 0.42, 1.1);
      render();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion.matches || !finePointer.matches || narrow) return;
      pointer.set((event.clientX / window.innerWidth - 0.5) * 0.08, (event.clientY / window.innerHeight - 0.5) * 0.05);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      contextUnavailable = true;
      stopAnimation();
      setReady(false);
    };
    const contextRestored = () => {
      contextUnavailable = false;
      resize();
      setReady(true);
      syncAnimation();
    };
    const observer = new ResizeObserver(resize);
    refreshLayout.current = () => {
      resize();
      syncAnimation();
    };
    observer.observe(element);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', syncAnimation);
    reducedMotion.addEventListener('change', syncAnimation);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
    resize();
    syncAnimation();
    setReady(true);

    return () => {
      disposed = true;
      refreshLayout.current = null;
      stopAnimation();
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', syncAnimation);
      reducedMotion.removeEventListener('change', syncAnimation);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={`celestial-scene${ready ? ' is-ready' : ''}${intro ? ' is-intro' : ''}${pageHidden ? ' is-paused' : ''}`} aria-hidden="true">
    <div className="celestial-wash" />
    <CelestialFallback />
  </div>;
}
