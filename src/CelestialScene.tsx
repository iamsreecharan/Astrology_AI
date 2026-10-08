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

function surfaceTexture(kind: 'saturn' | 'moon' | 'sun') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const pixels = context.createImageData(canvas.width, canvas.height);
  const random = randomSource(kind === 'saturn' ? 27 : kind === 'moon' ? 9 : 12);
  for (let y = 0; y < canvas.height; y += 1) {
    const bands = Math.sin(y * 0.18) * 7 + Math.sin(y * 0.061) * 14 + Math.sin(y * 0.49) * 3;
    for (let x = 0; x < canvas.width; x += 1) {
      const grain = (random() - 0.5) * (kind === 'moon' ? 26 : 11);
      const offset = (y * canvas.width + x) * 4;
      const color = kind === 'saturn' ? [214, 190, 151] : kind === 'moon' ? [164, 156, 137] : [246, 171, 65];
      const variation = kind === 'moon' ? grain : kind === 'sun' ? grain + Math.sin(x * 0.7 + y * 0.31) * 6 : bands + grain;
      pixels.data[offset] = color[0] + variation;
      pixels.data[offset + 1] = color[1] + variation;
      pixels.data[offset + 2] = color[2] + variation;
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
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
    </defs>
    <g stroke="#ac946f" strokeOpacity=".3">
      <circle cx="320" cy="320" r="265" />
      <circle cx="320" cy="320" r="237" strokeDasharray="2 9" />
      <circle cx="320" cy="320" r="215" />
      {ZODIAC.map((symbol, index) => {
        const angle = index * Math.PI / 6 - Math.PI / 2;
        return <path key={symbol} d={ZODIAC_PATHS[index]} transform={`translate(${320 + Math.cos(angle) * 252 - 10} ${320 + Math.sin(angle) * 252 - 10}) scale(.15625)`} stroke="#9d7b48" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </g>
    <ellipse cx="320" cy="320" rx="200" ry="64" transform="rotate(-24 320 320)" stroke="url(#celestial-ring)" strokeWidth="28" />
    <circle cx="320" cy="320" r="96" fill="url(#celestial-planet)" />
    <path d="M 153 383 C 211 393 400 350 493 247" stroke="url(#celestial-ring)" strokeWidth="25" />
    <circle cx="531" cy="177" r="14" fill="#d4ccba" />
  </svg>;
}

export default function CelestialScene() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    let renderer: THREE.WebGLRenderer;
    try {
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
      if (!context) return;
      renderer = new THREE.WebGLRenderer({ canvas: probe, context, alpha: true, antialias: false, powerPreference: 'low-power' });
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
    scene.add(new THREE.AmbientLight(0xdce1dd, 1.65));
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
    const starCoordinates = new Float32Array(95 * 3);
    for (let index = 0; index < 95; index += 1) {
      starCoordinates[index * 3] = (random() - 0.5) * 22;
      starCoordinates[index * 3 + 1] = (random() - 0.5) * 11;
      starCoordinates[index * 3 + 2] = -2 - random() * 4;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starCoordinates, 3));
    const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xa98a55, size: 0.025, transparent: true, opacity: 0.32 }));
    scene.add(stars);

    let frame = 0;
    let previousFrame = 0;
    let elapsed = 0;
    let lastTime = 0;
    let disposed = false;
    let contextUnavailable = false;
    let narrow = false;
    const pointer = new THREE.Vector2();
    const drift = new THREE.Vector2();

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
      planet.rotation.y = elapsed * 0.05;
      planetarySystem.rotation.y = Math.sin(elapsed * 0.06) * 0.12 + drift.x;
      planetarySystem.rotation.x = 0.27 + drift.y;
      zodiacWheel.rotation.z = -0.14 + elapsed * 0.009;
      moon.position.set(Math.cos(elapsed * 0.075 + 0.8) * 2.35, Math.sin(elapsed * 0.075 + 0.8) * 0.58, Math.sin(elapsed * 0.075 + 0.8) * 1.6);
      sun.rotation.y = elapsed * 0.025;
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
      camera.left = -aspect * 5;
      camera.right = aspect * 5;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5));
      renderer.setSize(width, height, false);
      planetarySystem.scale.setScalar(narrow ? 0.65 : 0.91);
      planetarySystem.position.set(aspect * 5 - (narrow ? 0.75 : 2.1), narrow ? 3.02 : 2.8, 0);
      zodiacWheel.scale.setScalar(narrow ? 0.64 : 0.91);
      zodiacWheel.position.copy(planetarySystem.position);
      sunGroup.position.set(-aspect * 5 + (narrow ? 0.25 : 0.65), -2.35, 0);
      sunGroup.scale.setScalar(narrow ? 0.75 : 1);
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

  return <div ref={host} className={`celestial-scene${ready ? ' is-ready' : ''}`} aria-hidden="true">
    <div className="celestial-wash" />
    <CelestialFallback />
  </div>;
}
