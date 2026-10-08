import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './AiYogiAvatar.css';

export type AiYogiState = 'idle' | 'listening' | 'thinking' | 'speaking';

type AvatarProps = {
  state: AiYogiState;
  audioLevel?: number;
  pose?: 'seated' | 'holding-card';
};

function curvedLine(points: number[][], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 5, false), material);
}

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => materials.add(material));
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function makeYogi(scene: THREE.Scene, holdingCard: boolean) {
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);
  function oval(parent: THREE.Object3D, material: THREE.Material, position: number[], size: number[]) {
    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(size[0], size[1], size[2]);
    parent.add(mesh);
    return mesh;
  }

  const figure = new THREE.Group();
  const upperBody = new THREE.Group();
  const head = new THREE.Group();
  const jaw = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#b97c54', roughness: 0.68 });
  const skinLight = new THREE.MeshStandardMaterial({ color: '#c18a64', roughness: 0.74 });
  const skinShade = new THREE.MeshStandardMaterial({ color: '#9b603f', roughness: 0.83 });
  const robe = new THREE.MeshStandardMaterial({ color: '#ce6a29', roughness: 0.93 });
  const robeLight = new THREE.MeshStandardMaterial({ color: '#ed9a49', roughness: 0.88 });
  const robeShade = new THREE.MeshStandardMaterial({ color: '#a54f21', roughness: 0.96 });
  const hair = new THREE.MeshStandardMaterial({ color: '#e4decb', roughness: 0.94 });
  const hairShade = new THREE.MeshStandardMaterial({ color: '#c5bda7', roughness: 0.96 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#e6d7ba', roughness: 0.56 });
  const irisMaterial = new THREE.MeshStandardMaterial({ color: '#3d2b22', roughness: 0.44 });
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: '#161d23', roughness: 0.35 });
  const eyeGlint = new THREE.MeshBasicMaterial({ color: '#fff7de' });
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#593528', roughness: 0.9 });
  const lipMaterial = new THREE.MeshStandardMaterial({ color: '#a1664e', roughness: 0.84 });
  const gold = new THREE.MeshStandardMaterial({ color: '#dfb879', roughness: 0.39, metalness: 0.58 });
  const beadMaterial = new THREE.MeshStandardMaterial({ color: '#6d452d', roughness: 0.92 });

  figure.add(upperBody);
  upperBody.add(head);
  head.add(jaw);
  scene.add(figure);

  const cushion = oval(figure, new THREE.MeshStandardMaterial({ color: '#263e46', roughness: 0.95 }), [0, -1.17, 0], [0.99, 0.16, 0.57]);
  cushion.rotation.y = -0.05;
  const cushionTrim = new THREE.Mesh(new THREE.TorusGeometry(0.89, 0.016, 8, 72), gold);
  cushionTrim.rotation.x = Math.PI / 2;
  cushionTrim.scale.y = 0.64;
  cushionTrim.position.y = -1.15;
  figure.add(cushionTrim);

  const leftLeg = oval(figure, robe, [-0.4, -0.94, 0.16], [0.58, 0.23, 0.36]);
  const rightLeg = oval(figure, robeLight, [0.37, -0.99, 0.26], [0.62, 0.21, 0.36]);
  leftLeg.rotation.z = -0.14;
  rightLeg.rotation.z = 0.13;
  leftLeg.rotation.y = -0.28;
  rightLeg.rotation.y = 0.3;
  oval(figure, skin, [0.55, -0.96, 0.52], [0.22, 0.095, 0.11]).rotation.z = 0.16;
  oval(figure, skin, [-0.44, -1.03, 0.57], [0.2, 0.085, 0.1]).rotation.z = -0.1;

  const torsoShape = [
    new THREE.Vector2(0.44, -0.87), new THREE.Vector2(0.49, -0.67),
    new THREE.Vector2(0.41, -0.38), new THREE.Vector2(0.4, -0.14),
    new THREE.Vector2(0.44, 0.03), new THREE.Vector2(0.32, 0.22),
    new THREE.Vector2(0.15, 0.28),
  ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoShape, 48), robe);
  torso.scale.z = 0.71;
  upperBody.add(torso);
  oval(upperBody, skin, [0, 0.3, 0.03], [0.17, 0.23, 0.15]);

  const shawl = new THREE.Shape();
  shawl.moveTo(-0.43, 0.13);
  shawl.bezierCurveTo(-0.39, 0.33, -0.21, 0.28, -0.08, 0.1);
  shawl.bezierCurveTo(0.03, -0.17, 0.21, -0.29, 0.44, -0.4);
  shawl.lineTo(0.43, -0.75);
  shawl.bezierCurveTo(0.14, -0.51, -0.06, -0.42, -0.19, -0.08);
  shawl.bezierCurveTo(-0.27, 0.08, -0.37, 0.11, -0.43, 0.13);
  const drape = new THREE.Mesh(new THREE.ExtrudeGeometry(shawl, { depth: 0.028, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 20 }), robeLight);
  drape.position.z = 0.27;
  upperBody.add(drape);
  for (let index = 0; index < 6; index += 1) {
    const offset = index * 0.061;
    upperBody.add(curvedLine([
      [-0.34 + offset * 0.43, 0.14 - offset * 0.8, 0.333],
      [-0.2 + offset * 0.42, -0.13 - offset * 0.8, 0.345],
      [0.05 + offset * 0.4, -0.36 - offset * 0.7, 0.344],
      [0.34 + offset * 0.23, -0.48 - offset * 0.6, 0.32],
    ], 0.008, index % 2 ? robeShade : robe));
  }
  for (const side of [-1, 1]) {
    const shoulder = oval(upperBody, robe, [side * 0.42, 0.04, -0.025], [0.23, 0.26, 0.21]);
    shoulder.rotation.z = side * 0.34;
    if (holdingCard) {
      const arm = oval(upperBody, robe, [side * 0.7, -0.2, 0.045], [0.18, 0.39, 0.19]);
      arm.rotation.z = side * 0.95;
      const forearm = oval(upperBody, skin, [side * 1.03, -0.43, 0.3], [0.105, 0.255, 0.11]);
      forearm.rotation.z = side * 1.35;
      forearm.rotation.x = -0.37;
      const hand = oval(upperBody, skinLight, [side * 1.27, -0.51, 0.55], [0.12, 0.075, 0.11]);
      hand.rotation.z = side * 0.08;
      for (let finger = 0; finger < 4; finger += 1) {
        oval(upperBody, skin, [side * (1.19 + finger * 0.045), -0.579 + finger * 0.003, 0.63], [0.027, 0.079 - Math.abs(finger - 1.5) * 0.008, 0.038]);
      }
      upperBody.add(curvedLine([[side * 1.18, -0.49, 0.6], [side * 1.14, -0.445, 0.65], [side * 1.13, -0.485, 0.675]], 0.025, skinLight));
    } else {
      const arm = oval(upperBody, robe, [side * 0.53, -0.29, 0.045], [0.18, 0.39, 0.19]);
      arm.rotation.z = side * 0.25;
      const forearm = oval(upperBody, skin, [side * 0.59, -0.63, 0.27], [0.16, 0.23, 0.14]);
      forearm.rotation.x = -0.54;
      forearm.rotation.z = side * 0.38;
      const hand = oval(upperBody, skinLight, [side * 0.64, -0.76, 0.48], [0.155, 0.075, 0.135]);
      hand.rotation.z = side * 0.15;
      for (let finger = 0; finger < 4; finger += 1) {
        const fingerMesh = oval(upperBody, skin, [side * (0.58 + finger * 0.041), -0.765 + finger * 0.003, 0.573], [0.024, 0.036, 0.073 - Math.abs(finger - 1.5) * 0.009]);
        fingerMesh.rotation.y = side * 0.1;
      }
      upperBody.add(curvedLine([[side * 0.54, -0.74, 0.54], [side * 0.55, -0.69, 0.58], [side * 0.59, -0.715, 0.61]], 0.023, skinLight));
    }
    for (let fold = 0; fold < 3; fold += 1) {
      figure.add(curvedLine([[side * 0.25, -0.78 - fold * 0.07, 0.49], [side * 0.51, -0.86 - fold * 0.055, 0.5], [side * 0.77, -0.98 - fold * 0.025, 0.42]], 0.012, robeShade));
    }
  }

  const headGeometry = new THREE.SphereGeometry(1, 48, 40);
  const headPositions = headGeometry.attributes.position;
  for (let index = 0; index < headPositions.count; index += 1) {
    const x = headPositions.getX(index);
    const y = headPositions.getY(index);
    const z = headPositions.getZ(index);
    const chin = y < -0.24 ? 1 + (y + 0.24) * 0.19 : 1;
    headPositions.setXYZ(index, x * 0.415 * chin, y * 0.535, z * 0.34 + (z > 0 ? 0.014 * (1 - y * y) : 0));
  }
  headGeometry.computeVertexNormals();
  const face = new THREE.Mesh(headGeometry, skinLight);
  face.position.set(0, 0.83, 0.01);
  head.add(face);
  for (const side of [-1, 1]) {
    oval(head, skin, [side * 0.41, 0.81, 0.015], [0.092, 0.145, 0.075]);
    oval(head, skinShade, [side * 0.442, 0.815, 0.065], [0.035, 0.078, 0.028]);
    oval(head, skinLight, [side * 0.213, 0.763, 0.278], [0.146, 0.093, 0.054]);
    oval(head, hair, [side * 0.348, 1.055, -0.005], [0.117, 0.263, 0.273]).rotation.z = side * -0.2;
  }

  const scalp = oval(head, hair, [0, 1.16, -0.07], [0.365, 0.246, 0.321]);
  scalp.rotation.x = -0.12;
  oval(head, hairShade, [0, 1.38, -0.1], [0.19, 0.146, 0.18]);
  oval(head, hair, [0, 1.42, -0.08], [0.164, 0.11, 0.16]);
  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.011, 8, 36), gold);
  hairTie.rotation.x = Math.PI / 2;
  hairTie.position.set(0, 1.405, -0.08);
  head.add(hairTie);
  for (let index = -5; index <= 5; index += 1) {
    const x = index * 0.047;
    head.add(curvedLine([[x * 0.95, 1.23 - Math.abs(x) * 0.1, 0.18], [x * 1.08, 1.34 - Math.abs(x) * 0.35, 0.09], [x * 0.72, 1.38, -0.05]], 0.007, hairShade));
  }

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.16, 0.91, 0.32);
    oval(eye, skinShade, [0, 0, -0.004], [0.103, 0.058, 0.038]);
    oval(eye, eyeWhite, [0, -0.003, 0.012], [0.083, 0.031, 0.027]);
    oval(eye, irisMaterial, [side * -0.005, -0.003, 0.037], [0.027, 0.028, 0.011]);
    oval(eye, pupilMaterial, [side * -0.005, -0.003, 0.046], [0.013, 0.016, 0.005]);
    oval(eye, eyeGlint, [-0.011, 0.008, 0.052], [0.006, 0.006, 0.003]);
    eye.add(curvedLine([[-0.083, -0.004, 0.028], [-0.04, 0.027, 0.035], [0.018, 0.031, 0.035], [0.084, -0.003, 0.021]], 0.009, skin));
    eye.add(curvedLine([[-0.08, -0.008, 0.025], [-0.036, -0.033, 0.029], [0.026, -0.033, 0.029], [0.083, -0.008, 0.021]], 0.006, skin));
    head.add(eye);
    eyes.push(eye);
    const brow = curvedLine([[side * 0.081, 1.004, 0.329], [side * 0.148, 1.033, 0.332], [side * 0.212, 1.021, 0.309], [side * 0.267, 0.995, 0.286]], 0.021, hairShade);
    head.add(brow);
    head.add(curvedLine([[side * 0.265, 0.851, 0.289], [side * 0.291, 0.841, 0.274], [side * 0.318, 0.825, 0.249]], 0.004, skinShade));
    head.add(curvedLine([[side * 0.105, 0.83, 0.337], [side * 0.151, 0.821, 0.331], [side * 0.206, 0.823, 0.308]], 0.0035, skinShade));
  }
  for (let line = 0; line < 2; line += 1) {
    head.add(curvedLine([[-0.12, 1.084 + line * 0.032, 0.283 - line * 0.024], [0, 1.092 + line * 0.032, 0.298 - line * 0.024], [0.12, 1.084 + line * 0.032, 0.283 - line * 0.024]], 0.003, skinShade));
  }
  oval(head, skin, [0, 0.84, 0.345], [0.051, 0.106, 0.054]);
  oval(head, skinLight, [0, 0.771, 0.392], [0.067, 0.051, 0.075]);
  for (const side of [-1, 1]) {
    oval(head, skin, [side * 0.054, 0.751, 0.363], [0.035, 0.03, 0.031]);
    oval(head, skinShade, [side * 0.044, 0.736, 0.386], [0.015, 0.008, 0.009]);
  }
  const tilak = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.083), new THREE.MeshStandardMaterial({ color: '#cd6339', roughness: 0.95, side: THREE.DoubleSide }));
  tilak.position.set(0, 1.045, 0.32);
  tilak.rotation.x = -0.15;
  head.add(tilak);
  oval(head, new THREE.MeshStandardMaterial({ color: '#e0ad75', roughness: 0.8 }), [0, 0.994, 0.345], [0.019, 0.013, 0.003]);

  const beardShape = new THREE.Shape();
  beardShape.moveTo(-0.31, 0.15);
  beardShape.bezierCurveTo(-0.37, 0.015, -0.315, -0.19, -0.17, -0.335);
  beardShape.bezierCurveTo(-0.125, -0.39, -0.062, -0.445, 0, -0.46);
  beardShape.bezierCurveTo(0.065, -0.44, 0.13, -0.39, 0.17, -0.335);
  beardShape.bezierCurveTo(0.315, -0.19, 0.37, 0.015, 0.31, 0.15);
  beardShape.bezierCurveTo(0.235, 0.125, 0.22, -0.055, 0.11, -0.043);
  beardShape.bezierCurveTo(0.065, -0.032, 0.04, -0.065, 0, -0.071);
  beardShape.bezierCurveTo(-0.043, -0.065, -0.065, -0.032, -0.11, -0.043);
  beardShape.bezierCurveTo(-0.22, -0.055, -0.235, 0.125, -0.31, 0.15);
  const beard = new THREE.Mesh(new THREE.ExtrudeGeometry(beardShape, { depth: 0.095, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 24 }), hair);
  beard.position.set(0, 0.61, 0.258);
  jaw.add(beard);
  for (let index = -6; index <= 6; index += 1) {
    const x = index * 0.041;
    const extent = 0.405 - Math.abs(x) * 0.6;
    jaw.add(curvedLine([[x, 0.551 + Math.abs(x) * 0.44, 0.391 - Math.abs(x) * 0.09], [x * 0.89, 0.405, 0.41 - Math.abs(x) * 0.1], [x * 0.52, 0.61 - extent, 0.373]], 0.005, hairShade));
  }

  const mouth = oval(head, mouthMaterial, [0, 0.632, 0.38], [0.078, 0.016, 0.02]);
  const lowerLip = oval(jaw, lipMaterial, [0, 0.617, 0.395], [0.063, 0.012, 0.015]);
  for (const side of [-1, 1]) {
    const moustache = curvedLine([[side * 0.013, 0.69, 0.414], [side * 0.068, 0.677, 0.416], [side * 0.127, 0.64, 0.377], [side * 0.183, 0.643, 0.343]], 0.033, hair);
    head.add(moustache);
    head.add(curvedLine([[side * 0.028, 0.699, 0.443], [side * 0.092, 0.673, 0.426], [side * 0.155, 0.655, 0.367]], 0.004, hairShade));
  }

  const necklace = new THREE.InstancedMesh(sphereGeometry, beadMaterial, 24);
  const beadTransform = new THREE.Object3D();
  beadTransform.scale.set(0.028, 0.032, 0.026);
  for (let bead = 0; bead < necklace.count; bead += 1) {
    const angle = bead / 23 * Math.PI;
    beadTransform.position.set(Math.cos(angle) * 0.26, 0.14 - Math.sin(angle) * 0.28, 0.322 + Math.sin(angle) * 0.025);
    beadTransform.updateMatrix();
    necklace.setMatrixAt(bead, beadTransform.matrix);
  }
  upperBody.add(necklace);
  oval(upperBody, gold, [0, -0.169, 0.356], [0.017, 0.026, 0.01]);

  const halo = new THREE.Group();
  halo.position.set(0, 0.83, -0.36);
  const haloMaterial = new THREE.MeshBasicMaterial({ color: '#cfa363', transparent: true, opacity: 0.72, depthWrite: false });
  const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.008, 6, 96), haloMaterial);
  halo.add(haloOuter);
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.665, 0.003, 5, 96), new THREE.MeshBasicMaterial({ color: '#ddbc81', transparent: true, opacity: 0.36, depthWrite: false })));
  for (let ray = 0; ray < 32; ray += 1) {
    const angle = ray / 32 * Math.PI * 2;
    halo.add(curvedLine([[Math.cos(angle) * 0.75, Math.sin(angle) * 0.75, 0], [Math.cos(angle) * (ray % 4 === 0 ? 0.84 : 0.79), Math.sin(angle) * (ray % 4 === 0 ? 0.84 : 0.79), 0]], 0.002, haloMaterial));
  }
  scene.add(halo);
  const listeningRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.012, 6, 96), new THREE.MeshBasicMaterial({ color: '#80c8c1', transparent: true, opacity: 0, depthWrite: false }));
  listeningRing.rotation.x = Math.PI / 2;
  listeningRing.position.y = -1.15;
  listeningRing.scale.y = 0.62;
  scene.add(listeningRing);

  const particlePositions = new Float32Array(25 * 3);
  for (let index = 0; index < 25; index += 1) {
    const angle = index * 2.399963;
    const radius = 0.8 + (index % 5) * 0.17;
    particlePositions[index * 3] = Math.cos(angle) * radius;
    particlePositions[index * 3 + 1] = Math.sin(angle) * radius * 1.04 + 0.17;
    particlePositions[index * 3 + 2] = -0.65;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: '#e0bc7e', size: 0.017, transparent: true, opacity: 0.56, depthWrite: false }));
  scene.add(particles);

  return { figure, upperBody, head, jaw, eyes, mouth, lowerLip, halo, haloMaterial, listeningRing, particles };
}

function YogiFallback({ holdingCard }: { holdingCard: boolean }) {
  return (
    <svg className="ai-yogi-avatar__fallback" viewBox="0 0 260 260" focusable="false">
      <defs>
        <radialGradient id="yogi-fallback-halo"><stop stopColor="#ddb36f" stopOpacity=".22" /><stop offset="1" stopColor="#ddb36f" stopOpacity="0" /></radialGradient>
        <linearGradient id="yogi-fallback-robe" x2="1" y2="1"><stop stopColor="#eba254" /><stop offset="1" stopColor="#af5028" /></linearGradient>
        <linearGradient id="yogi-fallback-skin" x2="1" y2="1"><stop stopColor="#ce9a72" /><stop offset="1" stopColor="#a46b49" /></linearGradient>
      </defs>
      <circle cx="130" cy="87" r="74" fill="url(#yogi-fallback-halo)" />
      <circle cx="130" cy="87" r="57" fill="none" stroke="#d6b37b" strokeOpacity=".66" strokeWidth=".8" />
      <circle cx="130" cy="87" r="51" fill="none" stroke="#d6b37b" strokeOpacity=".25" strokeWidth=".5" />
      <ellipse cx="130" cy="229" rx="88" ry="12" fill="#29434b" />
      <path d="M126 174C90 172 62 183 49 207C44 220 71 229 117 225L130 210L150 225C190 227 216 218 208 206C193 184 174 174 145 174Z" fill="url(#yogi-fallback-robe)" />
      <path d="M103 125C84 131 87 159 80 191L107 207H154L179 192C169 173 171 134 155 126Z" fill="url(#yogi-fallback-robe)" />
      <path d="M101 127C109 122 117 126 122 139C134 166 147 168 165 187L150 202C126 176 109 171 103 146Z" fill="#efa654" />
      {holdingCard ? (
        <g>
          <path d="M93 150Q79 169 23 181M167 150Q181 169 237 181" fill="none" stroke="#c98b5c" strokeWidth="15" strokeLinecap="round" />
          <path d="M95 145L74 164M165 145L186 164" fill="none" stroke="#ce6a29" strokeWidth="21" strokeLinecap="round" />
          <ellipse cx="17" cy="183" rx="12" ry="8" fill="#c9956c" />
          <ellipse cx="243" cy="183" rx="12" ry="8" fill="#c9956c" />
          <path d="M10 183V193M15 183V195M20 183V195M25 183V193M235 183V193M240 183V195M245 183V195M250 183V193" fill="none" stroke="#c9956c" strokeWidth="3.8" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M92 155L78 190L70 200" fill="none" stroke="#c98b5c" strokeWidth="15" strokeLinecap="round" />
          <path d="M169 155L181 190L189 200" fill="none" stroke="#c98b5c" strokeWidth="15" strokeLinecap="round" />
          <ellipse cx="75" cy="202" rx="16" ry="6" fill="#c9956c" />
          <ellipse cx="186" cy="202" rx="16" ry="6" fill="#c9956c" />
        </g>
      )}
      <path d="M104 43C100 66 96 89 103 107H155C165 84 160 49 146 43Z" fill="#d6d0bb" />
      <ellipse cx="130" cy="37" rx="17" ry="11" fill="#e7dfc9" />
      <ellipse cx="130" cy="77" rx="32" ry="39" fill="url(#yogi-fallback-skin)" />
      <path d="M100 59Q110 31 135 38Q159 41 162 62Q146 48 130 49Q112 47 100 59" fill="#e7dfc9" />
      <path d="M109 72Q118 67 125 72M137 72Q146 67 154 72" fill="none" stroke="#dfd8c4" strokeWidth="3" strokeLinecap="round" />
      <path d="M111 78Q117 74 123 78M139 78Q145 74 151 78" fill="none" stroke="#423226" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M131 77L126 90Q130 93 136 90" fill="none" stroke="#a9714e" strokeWidth="2" strokeLinecap="round" />
      <path d="M100 90C100 125 115 141 130 151C151 137 162 117 160 91C154 97 153 107 141 105Q130 109 119 105C108 106 106 99 100 90Z" fill="#e9e1cb" />
      <path d="M128 97Q118 94 109 107M133 97Q144 94 153 107" fill="none" stroke="#eee6d2" strokeWidth="7" strokeLinecap="round" />
      <path d="M126 105Q131 108 136 105" fill="none" stroke="#9f6850" strokeWidth="2" strokeLinecap="round" />
      <path d="M113 110L124 140M123 113L130 143M141 112L136 141M150 108L142 133" fill="none" stroke="#ccc4af" strokeWidth="1" strokeLinecap="round" />
      <path d="M131 56V64" stroke="#c46439" strokeWidth="3" strokeLinecap="round" />
      <path d="M108 142Q130 170 153 143" fill="none" stroke="#674831" strokeWidth="4" strokeDasharray="1 6" strokeLinecap="round" />
      <path d="M73 213Q100 217 117 210M149 213Q180 218 196 208" fill="none" stroke="#a85629" strokeWidth="2" opacity=".55" />
    </svg>
  );
}

export default function AiYogiAvatar({ state, audioLevel = 0, pose = 'seated' }: AvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ state, audioLevel });
  const renderRef = useRef<(() => void) | null>(null);
  const contextReleaseRef = useRef<number | null>(null);
  const [fallback, setFallback] = useState(false);
  inputRef.current = { state, audioLevel: Math.max(0, Math.min(1, Number.isFinite(audioLevel) ? audioLevel : 0)) };

  useEffect(() => {
    renderRef.current?.();
  }, [state, audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    if (contextReleaseRef.current !== null) {
      window.clearTimeout(contextReleaseRef.current);
      contextReleaseRef.current = null;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setFallback(true);
      return;
    }
    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0.2, 5.05);
    camera.lookAt(0, 0.13, 0);
    scene.add(new THREE.AmbientLight('#cfddde', 1.35));
    const keyLight = new THREE.DirectionalLight('#ffe0ad', 3.1);
    keyLight.position.set(-3, 4, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight('#a0cbdf', 0.9);
    fillLight.position.set(3, 2, 3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight('#eec17c', 2);
    rimLight.position.set(2, 3, -2);
    scene.add(rimLight);
    const yogi = makeYogi(scene, pose === 'holding-card');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previousTime = -Infinity;
    let disposed = false;
    let contextLost = false;
    let inView = true;
    let renderedState: AiYogiState | null = null;
    let smoothedAudio = 0;
    const startTime = performance.now();

    function render(time: number) {
      if (disposed || contextLost || document.hidden || !inView) return;
      const seconds = (time - startTime) / 1000;
      const input = inputRef.current;
      const still = reducedMotion.matches;
      smoothedAudio += (input.audioLevel - smoothedAudio) * 0.42;
      const speaking = input.state === 'speaking';
      const listening = input.state === 'listening';
      const thinking = input.state === 'thinking';
      const voice = speaking && !still ? smoothedAudio : 0;
      const breathing = still ? 0 : Math.sin(seconds * 1.35) * 0.007;
      yogi.upperBody.scale.y = 1 + breathing;
      yogi.head.rotation.y = still ? 0 : Math.sin(seconds * (thinking ? 0.9 : 0.45)) * (thinking ? 0.08 : 0.025);
      yogi.head.rotation.z = listening ? -0.035 : still ? 0 : Math.sin(seconds * 0.65) * 0.012;
      yogi.head.rotation.x = still ? 0 : (thinking ? -0.035 : 0) + Math.sin(seconds * (speaking ? 2.2 : 0.7)) * (speaking ? 0.013 * voice : 0.006);
      yogi.jaw.position.y = -voice * 0.037;
      yogi.mouth.scale.y = 0.016 + voice * 0.052;
      yogi.mouth.position.y = 0.632 - voice * 0.022;
      yogi.lowerLip.position.y = 0.617 - voice * 0.005;
      const blinkPhase = (seconds + 0.6) % 4.7;
      const blink = still ? 1 : blinkPhase < 0.18 ? 1 - Math.sin(blinkPhase / 0.18 * Math.PI) * 0.95 : 1;
      yogi.eyes.forEach((eye) => { eye.scale.y = blink; });
      yogi.halo.rotation.z = still ? 0 : seconds * (thinking ? 0.13 : 0.012);
      yogi.haloMaterial.opacity = 0.54 + (listening || thinking ? 0.14 : 0.04) * (still ? 1 : Math.sin(seconds * 2) + 1);
      yogi.particles.rotation.z = still ? 0 : seconds * 0.014;
      const ringMaterial = yogi.listeningRing.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = listening ? 0.35 + (still ? 0 : Math.sin(seconds * 3.8) * 0.16) : speaking ? 0.12 + voice * 0.3 : 0;
      const ringScale = listening && !still ? 1 + Math.sin(seconds * 3.8) * 0.045 : 1;
      yogi.listeningRing.scale.set(ringScale, ringScale * 0.62, 1);
      renderer.render(scene, camera);
      renderedState = input.state;
    }

    function animate(time: number) {
      frame = 0;
      if (disposed || contextLost || document.hidden || !inView || reducedMotion.matches) return;
      if (time - previousTime >= 1000 / 30) {
        render(time);
        previousTime = time;
      }
      frame = requestAnimationFrame(animate);
    }

    function restart() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (disposed || contextLost || document.hidden || !inView) return;
      render(performance.now());
      if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
    }

    function resize() {
      const dimensions = stageRef.current?.getBoundingClientRect();
      if (!dimensions) return;
      const { width, height } = dimensions;
      if (width < 1 || height < 1 || disposed || contextLost) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render(performance.now());
    }

    function onContextLost(event: Event) {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frame);
      frame = 0;
      setFallback(true);
    }

    function onContextRestored() {
      contextLost = false;
      setFallback(false);
      resize();
      restart();
    }

    renderRef.current = () => {
      if (reducedMotion.matches ? inputRef.current.state !== renderedState : !frame) render(performance.now());
    };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting;
      if (visible === inView) return;
      inView = visible;
      restart();
    });
    resizeObserver.observe(stage);
    intersectionObserver.observe(stage);
    document.addEventListener('visibilitychange', restart);
    reducedMotion.addEventListener('change', restart);
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    resize();
    restart();
    return () => {
      disposed = true;
      renderRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', restart);
      reducedMotion.removeEventListener('change', restart);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      disposeScene(scene);
      renderer.dispose();
      // Let an immediate effect restart reuse the canvas before releasing its context.
      contextReleaseRef.current = window.setTimeout(() => {
        renderer.forceContextLoss();
        contextReleaseRef.current = null;
      }, 0);
    };
  }, [pose]);

  return (
    <div ref={stageRef} className={`ai-yogi-avatar ai-yogi-avatar--${state} ai-yogi-avatar--${pose}`} aria-hidden="true" data-renderer={fallback ? 'svg' : 'webgl'}>
      <div className="ai-yogi-avatar__aura" />
      <canvas ref={canvasRef} className="ai-yogi-avatar__canvas" hidden={fallback} />
      {fallback && <YogiFallback holdingCard={pose === 'holding-card'} />}
    </div>
  );
}
