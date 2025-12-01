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

// Water
const waterSize = 140;
const waterSegments = 140;
const waterGeometry = new THREE.PlaneGeometry(
  waterSize,
  waterSize,
  waterSegments,
  waterSegments
);
const baseWaterColor = new THREE.Color(0x6bd8ff);
const waterMaterial = new THREE.MeshToonMaterial({
  color: baseWaterColor,
  emissive: 0x0a2a45,
  vertexColors: true,
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
mast.position.set(0, 2.3, 0);
mast.castShadow = true;
boat.add(mast);

const sail = new THREE.Mesh(
  new THREE.PlaneGeometry(3.3, 3.9, 1, 1),
  new THREE.MeshToonMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
sail.position.set(0, 2.4, -1.25);
sail.rotation.y = Math.PI / 2;
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
type Bird = { mesh: THREE.Object3D; radius: number; speed: number; height: number; offset: number };
const birds: Bird[] = [];
function createBird(radius: number, speed: number, height: number) {
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.9, 4),
    new THREE.MeshToonMaterial({ color: 0xf0f4ff })
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  const bird: Bird = {
    mesh: body,
    radius,
    speed,
    height,
    offset: Math.random() * Math.PI * 2,
  };
  scene.add(body);
  birds.push(bird);
}
createBird(12, 0.6, 8);
createBird(18, 0.45, 11);
createBird(22, 0.5, 9.5);

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
  const pos = waterGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const wave =
      Math.sin(x * 0.12 + time * 0.9) * 0.28 +
      Math.cos(z * 0.14 + time * 0.85) * 0.25;
    pos.setY(i, wave);
  }
  pos.needsUpdate = true;
  waterGeometry.computeVertexNormals();
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
  birds.forEach((bird, index) => {
    const angle = time * bird.speed + bird.offset;
    const x = Math.cos(angle) * bird.radius;
    const z = Math.sin(angle) * bird.radius;
    bird.mesh.position.set(x, bird.height + Math.sin(angle * 2) * 0.4, z);
    bird.mesh.rotation.y = -angle + Math.PI / 2;
    bird.mesh.rotation.z = Math.sin(angle * 4) * 0.2;
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
