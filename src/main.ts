import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Biome = {
  id: string;
  name: string;
  landColor: number;
  topColor: number;
  accentColor: number;
  leafColor: number;
  trunkColor: number;
  waterTint: number;
  description: string;
};

type Island = {
  id: string;
  biome: Biome;
  radius: number;
  position: THREE.Vector3;
  meshes: THREE.Object3D[];
  swayTargets: { obj: THREE.Object3D; phase: number; amp: number }[];
};

const biomes: Biome[] = [
  {
    id: 'tropical',
    name: 'Tropical Cay',
    landColor: 0x3b5a2e,
    topColor: 0xc9b38c,
    accentColor: 0x7c6553,
    leafColor: 0x37b26f,
    trunkColor: 0x8a5a44,
    waterTint: 0x51d6d3,
    description:
      'Warm sands, turquoise shallows, and palms swaying in a steady trade wind.',
  },
  {
    id: 'arctic',
    name: 'Arctic Shelf',
    landColor: 0x5b6c80,
    topColor: 0xe2f1ff,
    accentColor: 0xbcccdc,
    leafColor: 0xcde7ff,
    trunkColor: 0xd7e5f4,
    waterTint: 0x9ed4ff,
    description:
      'Frosted rock with snow caps and glassy blue water drifting with ice.',
  },
  {
    id: 'desert',
    name: 'Dune Key',
    landColor: 0x8c6a3b,
    topColor: 0xe3c48a,
    accentColor: 0xb98b54,
    leafColor: 0xc7b079,
    trunkColor: 0xa0723d,
    waterTint: 0x5ac2ff,
    description: 'Sun-bleached dunes and rocky outcrops with crisp blue edges.',
  },
];

// DOM references
const speechEl = document.getElementById('speech') as HTMLDivElement | null;
const speechTitle = document.getElementById('speech-title');
const speechBody = document.getElementById('speech-body');
const speechOpen = document.getElementById('speech-open');
const modalBackdrop = document.getElementById(
  'modal-backdrop'
) as HTMLDivElement | null;
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

// Scene basics
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const app = document.getElementById('app');
if (!app) throw new Error('Expected #app element to mount the renderer');
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
app.appendChild(renderer.domElement);

// Camera / controls
const frustumSize = 38;
let camera = new THREE.OrthographicCamera(
  -frustumSize,
  frustumSize,
  frustumSize,
  -frustumSize,
  0.1,
  200
);
camera.position.set(30, 26, 28);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = false;
controls.panSpeed = 1;
controls.zoomSpeed = 0.8;
controls.minZoom = 0.6;
controls.maxZoom = 2.6;
controls.target.set(0, 0, 0);

// Lighting
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(20, 32, 12);
sun.castShadow = true;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

scene.add(new THREE.HemisphereLight(0x8fc4ff, 0x1b2533, 0.45));

// Water (shader with UV scale to avoid zoomed look)
const waterSize = 240;
const waterSegments = 240; // more verts so waves/tiled details aren't chunky
const waterGeometry = new THREE.PlaneGeometry(
  waterSize,
  waterSize,
  waterSegments,
  waterSegments
);
const baseWaterColor = new THREE.Color(0x2acbff);


const waterUniforms = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Color(0x3bb9ff) },
  uDeep: { value: new THREE.Color(0x0a1f44) },
  uFoam: { value: new THREE.Color(0xffffff) },
  uSky: { value: new THREE.Color(0x7ec8ff) },
  uLightDir: { value: new THREE.Vector3(0.4, 1.0, 0.25).normalize() },
  uUVScale: { value: 10.0 }, // stronger tiling so shader pattern isn't zoomed in
};

const waterMaterial = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: `
    precision highp float;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uUVScale;

    // simple hash
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }

    void main() {
      vUv = uv * uUVScale;
      vec3 pos = position;
      float t = uTime * 0.6;
      float wave1 = sin(pos.x * 0.18 + t * 2.0);
      float wave2 = cos(pos.z * 0.22 + t * 1.6);
      float wave3 = sin((pos.x + pos.z) * 0.12 - t * 1.4);
      pos.y += (wave1 + wave2 + wave3) * 0.35;
      pos.y += hash(pos.xz * 0.05 + t) * 0.08;

      // approximate normal via gradient of displacement
      float dWx = cos(pos.x * 0.18 + t * 2.0) * 0.18 * 2.0
                + cos((pos.x + pos.z) * 0.12 - t * 1.4) * 0.12;
      float dWz = -sin(pos.z * 0.22 + t * 1.6) * 0.22 * 1.6
                + cos((pos.x + pos.z) * 0.12 - t * 1.4) * 0.12;
      vec3 n = normalize(vec3(-dWx, 1.0, -dWz));

      vec4 world = modelMatrix * vec4(pos, 1.0);
      vWorldPos = world.xyz;
      vNormal = normalize(mat3(normalMatrix) * n);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uFoam;
    uniform vec3 uSky;
    uniform vec3 uLightDir;
    uniform float uTime;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }

    void main() {
      float depth = clamp(1.0 - abs(vWorldPos.y) * 0.08, 0.0, 1.0);
      float shade = 0.7 + 0.3 * dot(normalize(vNormal), normalize(uLightDir));
      vec3 base = mix(uDeep, uShallow, depth);

      float foam = smoothstep(0.18, 0.3, vWorldPos.y);
      float ripple = sin(vUv.x * 30.0 + uTime * 3.5) * 0.5 + 0.5;
      foam *= ripple;

      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fres = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 3.0);

      vec3 color = base * shade;
      color = mix(color, uSky, fres * 0.3);
      color = mix(color, uFoam, foam * 0.8);

      float fog = clamp(length(vWorldPos) / 350.0, 0.0, 1.0);
      color = mix(color, uSky, fog * 0.1);

      gl_FragColor = vec4(color, 0.9);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  depthTest: true,
});

const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.receiveShadow = true;
scene.add(water);

// Islands
const islands: Island[] = [];
const islandGroup = new THREE.Group();
scene.add(islandGroup);

function addPalmTree(
  x: number,
  z: number,
  trunkColor: number,
  leafColor: number
) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.32, 2.4, 6),
    new THREE.MeshToonMaterial({ color: trunkColor })
  );
  trunk.position.set(x, 3.0, z);
  trunk.castShadow = true;

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 2.6, 8),
    new THREE.MeshToonMaterial({ color: leafColor })
  );
  crown.position.set(x, trunk.position.y + 2.1, z);
  crown.castShadow = true;
  crown.receiveShadow = true;

  return { trunk, crown };
}

function addIceSpire(x: number, z: number, color: number) {
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.3, 6),
    new THREE.MeshToonMaterial({ color })
  );
  spire.position.set(x, 2.2, z);
  spire.castShadow = true;
  spire.receiveShadow = true;
  return spire;
}

function createIsland(config: {
  position: THREE.Vector3;
  biome: Biome;
  radius: number;
}) {
  const { position, biome, radius } = config;
  const baseMat = new THREE.MeshToonMaterial({ color: biome.landColor });
  const topMat = new THREE.MeshToonMaterial({ color: biome.topColor });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius, 2.6, 10),
    baseMat
  );
  base.position.copy(position).setY(1.3);
  base.castShadow = true;
  base.receiveShadow = true;

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.65, radius * 0.88, 1.8, 12),
    topMat
  );
  top.position.copy(position).setY(2.7);
  top.castShadow = true;
  top.receiveShadow = true;

  const accent = new THREE.Mesh(
    new THREE.DodecahedronGeometry(radius * 0.5, 0),
    new THREE.MeshToonMaterial({ color: biome.accentColor })
  );
  accent.position.copy(position).add(new THREE.Vector3(radius * 0.2, 3.5, -radius * 0.15));
  accent.castShadow = true;
  accent.receiveShadow = true;

  const meshes: THREE.Object3D[] = [base, top, accent];
  const swayTargets: { obj: THREE.Object3D; phase: number; amp: number }[] = [];

  // Vegetation / features per biome
  if (biome.id === 'tropical') {
    const palm = addPalmTree(
      position.x - radius * 0.25,
      position.z + radius * 0.15,
      biome.trunkColor,
      biome.leafColor
    );
    meshes.push(palm.trunk, palm.crown);
    swayTargets.push(
      { obj: palm.crown, phase: Math.random() * Math.PI * 2, amp: 0.08 },
      { obj: palm.trunk, phase: Math.random() * Math.PI * 2, amp: 0.04 }
    );
  } else if (biome.id === 'arctic') {
    const spire1 = addIceSpire(
      position.x + radius * 0.15,
      position.z - radius * 0.1,
      biome.accentColor
    );
    const spire2 = addIceSpire(
      position.x - radius * 0.25,
      position.z + radius * 0.2,
      biome.topColor
    );
    meshes.push(spire1, spire2);
    swayTargets.push(
      { obj: spire1, phase: Math.random() * Math.PI * 2, amp: 0.03 },
      { obj: spire2, phase: Math.random() * Math.PI * 2, amp: 0.025 }
    );
  } else {
    // Desert / temperate shrubs
    const shrub = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.35, 6, 6),
      new THREE.MeshToonMaterial({ color: biome.leafColor })
    );
    shrub.position.copy(position).add(new THREE.Vector3(-radius * 0.15, 3.2, radius * 0.1));
    shrub.castShadow = true;
    shrub.receiveShadow = true;
    meshes.push(shrub);
    swayTargets.push({
      obj: shrub,
      phase: Math.random() * Math.PI * 2,
      amp: 0.04,
    });
  }

  islandGroup.add(...meshes);
  const island: Island = {
    id: `${biome.id}-${islands.length}`,
    biome,
    radius,
    position,
    meshes,
    swayTargets,
  };
  islands.push(island);
}

createIsland({ position: new THREE.Vector3(-24, 0, -6), biome: biomes[0], radius: 7.5 });
createIsland({ position: new THREE.Vector3(18, 0, 10), biome: biomes[2], radius: 6.5 });
createIsland({ position: new THREE.Vector3(-6, 0, 24), biome: biomes[1], radius: 6 });
createIsland({ position: new THREE.Vector3(20, 0, -20), biome: biomes[0], radius: 8 });

// Boat
const boat = new THREE.Group();
scene.add(boat);

const hull = new THREE.Mesh(
  new THREE.BoxGeometry(2.8, 0.7, 5.4),
  new THREE.MeshToonMaterial({ color: 0xd7c2a1 })
);
hull.castShadow = true;
hull.receiveShadow = true;
boat.add(hull);

const keel = new THREE.Mesh(
  new THREE.BoxGeometry(0.45, 0.6, 1.6),
  new THREE.MeshToonMaterial({ color: 0x8c5b3c })
);
keel.position.set(0, -0.65, -1.2);
keel.castShadow = true;
boat.add(keel);

const mast = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.12, 4.6, 8),
  new THREE.MeshToonMaterial({ color: 0xf5f5f5 })
);
mast.position.set(0, 2.3, -1.20);
mast.castShadow = true;
boat.add(mast);

const sail = new THREE.Mesh(
  new THREE.PlaneGeometry(3.3, 3.9, 1, 1),
  new THREE.MeshToonMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
sail.position.set(0, 2.4, -1.25);
sail.rotation.y = Math.PI;
sail.castShadow = true;
boat.add(sail);

boat.position.set(0, 0.35, 0);
boat.rotation.y = Math.PI;

// Movement state
const keys = new Set<string>();
let boatSpeed = 0;
let boatHeading = Math.PI; // radians, y-rotation
const maxSpeed = 12;
const acceleration = 12;
const turnRate = 1.8; // radians per second
const damping = 0.96;
const boatRadius = 1.6;
let modalOpen = false;
// Wake particles
const wakeCount = 80;
const wakeLife = 1.8;
const wakePool: { mesh: THREE.Mesh; age: number; alive: boolean }[] = [];
const wakeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
function initWake() {
  const geo = new THREE.PlaneGeometry(0.8, 0.8);
  for (let i = 0; i < wakeCount; i++) {
    const m = new THREE.Mesh(geo, wakeMaterial.clone());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    scene.add(m);
    wakePool.push({ mesh: m, age: 0, alive: false });
  }
}
initWake();
let wakeTimer = 0;

const waveDir1 = new THREE.Vector2(1, 0.2).normalize();
const waveDir2 = new THREE.Vector2(-0.4, 1).normalize();
const waveDir3 = new THREE.Vector2(0.7, -0.6).normalize();

function updateWake(delta: number) {
  wakeTimer += delta;
  if (boatSpeed > 1 && wakeTimer > 0.08) {
    const slot = wakePool.find((p) => !p.alive);
    if (slot) {
      const dir = new THREE.Vector3(Math.sin(boatHeading), 0, Math.cos(boatHeading));
      slot.mesh.position.copy(boat.position).addScaledVector(dir, -1.2);
      slot.mesh.position.y = 0.02;
      slot.mesh.visible = true;
      slot.mesh.scale.setScalar(0.6);
      slot.age = 0;
      slot.alive = true;
    }
    wakeTimer = 0;
  }

  wakePool.forEach((p) => {
    if (!p.alive) return;
    p.age += delta;
    const t = p.age / wakeLife;
    if (t >= 1) {
      p.mesh.visible = false;
      p.alive = false;
      return;
    }
    const fade = 1 - t;
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * fade;
    const s = 0.6 + t * 1.4;
    p.mesh.scale.setScalar(s);
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOpen) {
    closeModal();
    return;
  }
  keys.add(e.key.toLowerCase());
  if ((e.key === 'e' || e.key === 'Enter') && activeIsland) {
    openModal(activeIsland);
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

// Wind trails
const windCount = 80;
const windGeometry = new THREE.BufferGeometry();
const windPositions = new Float32Array(windCount * 3);
for (let i = 0; i < windCount; i++) {
  windPositions[i * 3] = (Math.random() - 0.5) * waterSize * 0.9;
  windPositions[i * 3 + 1] = 1 + Math.random() * 1.2;
  windPositions[i * 3 + 2] = (Math.random() - 0.5) * waterSize * 0.9;
}
windGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(windPositions, 3)
);
const windMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.25,
  transparent: true,
  opacity: 0.6,
});
const wind = new THREE.Points(windGeometry, windMaterial);
scene.add(wind);

// Birds
type Bird = { mesh: THREE.Mesh; orbitR: number; speed: number; height: number; phase: number; wobble: number };
const birds: Bird[] = [];
function initBirds() {
  const configs = [
    { r: 14, speed: 0.5, h: 9, wobble: 0.4 },
    { r: 18, speed: 0.35, h: 11, wobble: 0.6 },
    { r: 22, speed: 0.4, h: 10, wobble: 0.5 },
  ];
  configs.forEach((c) => {
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 4),
      new THREE.MeshToonMaterial({ color: 0xf0f4ff })
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    scene.add(body);
    birds.push({
      mesh: body,
      orbitR: c.r,
      speed: c.speed,
      height: c.h,
      wobble: c.wobble,
      phase: Math.random() * Math.PI * 2,
    });
  });
}
initBirds();

// Water tint by biome influence
function tintWaterVertices() {
  const pos = waterGeometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const base = baseWaterColor.clone();

    islands.forEach((island) => {
      const d = Math.hypot(x - island.position.x, z - island.position.z);
      const influence = island.radius * 3.0;
      if (d < influence) {
        const w = THREE.MathUtils.smoothstep(1 - d / influence, 0, 1);
        base.lerp(new THREE.Color(island.biome.waterTint), w * 0.75);
      }
    });

    colors[i * 3] = base.r;
    colors[i * 3 + 1] = base.g;
    colors[i * 3 + 2] = base.b;
  }

  waterGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  waterGeometry.attributes.color.needsUpdate = true;
}

tintWaterVertices();

// UI helpers
function showSpeech(island: Island | null) {
  if (!speechEl || !speechTitle || !speechBody || !speechOpen) return;
  if (!island) {
    speechEl.style.display = 'none';
    return;
  }
  speechTitle.textContent = island.biome.name;
  speechBody.textContent = 'Press E or click Dock to visit.';
  speechEl.style.display = 'flex';
}

function openModal(island: Island) {
  if (!modalBackdrop || !modalTitle || !modalBody) return;
  modalTitle.textContent = island.biome.name;
  modalBody.textContent = island.biome.description;
  modalBackdrop.style.display = 'flex';
  modalOpen = true;
}

function closeModal() {
  if (!modalBackdrop) return;
  modalBackdrop.style.display = 'none';
  modalOpen = false;
}

if (speechOpen) {
  speechOpen.onclick = () => {
    if (activeIsland) openModal(activeIsland);
  };
}
if (modalClose) {
  modalClose.onclick = closeModal;
}
if (modalBackdrop) {
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
}

// Boat + proximity + collisions
let activeIsland: Island | null = null;
const clock = new THREE.Clock();

function updateBoat(delta: number) {
  if (modalOpen) {
    boatSpeed *= 0.9;
    return;
  }

  const forward =
    (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
    (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const turn =
    (keys.has('a') || keys.has('arrowleft') ? 1 : 0) -
    (keys.has('d') || keys.has('arrowright') ? 1 : 0);
  const boosting = keys.has('shift');

  if (forward !== 0) {
    boatSpeed += forward * acceleration * delta * (boosting ? 1.4 : 1);
    boatSpeed = THREE.MathUtils.clamp(
      boatSpeed,
      -maxSpeed * 0.5,
      maxSpeed * (boosting ? 1.4 : 1)
    );
  } else {
    boatSpeed *= damping;
    if (Math.abs(boatSpeed) < 0.05) boatSpeed = 0;
  }

  if (turn !== 0) {
    boatHeading += turn * turnRate * delta * (1 + Math.abs(boatSpeed) * 0.05);
  }

  const moveDir = new THREE.Vector3(
    Math.sin(boatHeading),
    0,
    Math.cos(boatHeading)
  );

  const nextPos = boat.position.clone().addScaledVector(moveDir, boatSpeed * delta);

  // Collision with islands
  islands.forEach((island) => {
    const dx = nextPos.x - island.position.x;
    const dz = nextPos.z - island.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = island.radius + boatRadius;
    if (dist < minDist) {
      const n = new THREE.Vector3(dx, 0, dz).normalize();
      nextPos.copy(island.position).addScaledVector(n, minDist);
      boatSpeed = 0;
    }
  });

  // Bounds
  const bounds = waterSize * 0.45;
  nextPos.x = THREE.MathUtils.clamp(nextPos.x, -bounds, bounds);
  nextPos.z = THREE.MathUtils.clamp(nextPos.z, -bounds, bounds);
  boat.position.copy(nextPos);
  boat.rotation.y = boatHeading + Math.PI;

  // Bobbing
  boat.position.y = 0.35 + Math.sin(clock.getElapsedTime() * 2) * 0.08;
}

function animateWater(time: number) {
  waterUniforms.uTime.value = time;
}

function animateWind(delta: number) {
  const dir = new THREE.Vector3(0.6, 0, -0.4).normalize();
  for (let i = 0; i < windCount; i++) {
    const ix = i * 3;
    windPositions[ix] += dir.x * delta * 12;
    windPositions[ix + 1] += Math.sin(clock.elapsedTime * 3 + i) * 0.004;
    windPositions[ix + 2] += dir.z * delta * 12;
    if (
      Math.abs(windPositions[ix]) > waterSize * 0.5 ||
      Math.abs(windPositions[ix + 2]) > waterSize * 0.5
    ) {
      windPositions[ix] = (Math.random() - 0.5) * waterSize * 0.3;
      windPositions[ix + 1] = 1 + Math.random() * 1.2;
      windPositions[ix + 2] = (Math.random() - 0.5) * waterSize * 0.3;
    }
  }
  windGeometry.attributes.position.needsUpdate = true;
}

function animateBirds(time: number) {
  birds.forEach((bird, i) => {
    const angle = time * bird.speed + bird.phase;
    const wobble = Math.sin(time * 2 + i) * bird.wobble;
    const x = Math.cos(angle) * bird.orbitR;
    const z = Math.sin(angle) * bird.orbitR;
    const y = bird.height + Math.sin(angle * 1.3 + i) * 0.6;
    const nextX = Math.cos(angle + 0.02) * bird.orbitR;
    const nextZ = Math.sin(angle + 0.02) * bird.orbitR;
    const nextY = bird.height + Math.sin((angle + 0.02) * 1.3 + i) * 0.6;
    bird.mesh.position.set(x, y, z);

    const vel = new THREE.Vector3(nextX - x, nextY - y, nextZ - z);
    if (vel.lengthSq() > 0.0001) {
      vel.normalize();
      // Cone tip assumed along +Y in local space; align +Y to velocity
      bird.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel);
      // small bank about velocity
      bird.mesh.rotateOnAxis(vel, wobble * 0.2);
    }
  });
}

function swayIslands(time: number) {
  islands.forEach((island) => {
    island.swayTargets.forEach(({ obj, phase, amp }) => {
      obj.rotation.z = Math.sin(time * 1.4 + phase) * amp;
    });
  });
}

function updateProximityUI() {
  let nearest: Island | null = null;
  let nearestDist = Infinity;
  islands.forEach((island) => {
    const d = Math.hypot(
      boat.position.x - island.position.x,
      boat.position.z - island.position.z
    );
    if (d < nearestDist) {
      nearestDist = d;
      nearest = island;
    }
  });

  const reachDistance = (nearest?.radius ?? 0) + 4;
  if (nearest && nearestDist < reachDistance) {
    activeIsland = nearest;
    showSpeech(nearest);
  } else {
    activeIsland = null;
    showSpeech(null);
  }
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  controls.update();
  updateBoat(delta);
  animateWater(elapsed);
  animateWind(delta);
  animateBirds(elapsed);
  updateWake(delta);
  swayIslands(elapsed);
  updateProximityUI();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const viewSize = frustumSize;
  camera.left = (-viewSize * aspect) / 2;
  camera.right = (viewSize * aspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener('resize', handleResize);
handleResize();
animate();
