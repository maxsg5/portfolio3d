import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050a);

// Renderer
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

// Camera (orthographic isometric)
const frustumSize = 36;
let camera = new THREE.OrthographicCamera(
  -frustumSize,
  frustumSize,
  frustumSize,
  -frustumSize,
  0.1,
  200
);
camera.position.set(28, 26, 28);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = false;
controls.panSpeed = 1;
controls.zoomSpeed = 0.8;
controls.minZoom = 0.6;
controls.maxZoom = 2.5;
controls.target.set(0, 0, 0);

// Lights
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const fill = new THREE.HemisphereLight(0x74c7ff, 0x1f2b3a, 0.45);
scene.add(fill);

// Water
const waterSize = 120;
const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 120, 120);
const waterMaterial = new THREE.MeshToonMaterial({
  color: 0x3aa7ff,
  emissive: 0x0b2c44,
  gradientMap: null,
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.receiveShadow = true;
scene.add(water);

// Islands
const islandGroup = new THREE.Group();
scene.add(islandGroup);

function createIsland(x: number, z: number, radius = 6) {
  const baseMat = new THREE.MeshToonMaterial({ color: 0x3b5a2e });
  const sandMat = new THREE.MeshToonMaterial({ color: 0xc9b38c });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius, 2.2, 8),
    baseMat
  );
  base.position.set(x, 1.1, z);
  base.castShadow = true;
  base.receiveShadow = true;

  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.65, radius * 0.85, 1.4, 10),
    sandMat
  );
  sand.position.set(x, 2.1, z);
  sand.castShadow = true;
  sand.receiveShadow = true;

  // Stylized rock
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(radius * 0.4, 0),
    new THREE.MeshToonMaterial({ color: 0x7c6553 })
  );
  rock.position.set(x + radius * 0.2, 3.2, z - radius * 0.1);
  rock.castShadow = true;
  rock.receiveShadow = true;

  // Palm-ish cone
  const treeTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6),
    new THREE.MeshToonMaterial({ color: 0x8a5a44 })
  );
  treeTrunk.position.set(x - radius * 0.25, 3.2, z + radius * 0.15);
  treeTrunk.castShadow = true;

  const treeTop = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 2.3, 8),
    new THREE.MeshToonMaterial({ color: 0x3f9f6b })
  );
  treeTop.position.set(
    treeTrunk.position.x,
    treeTrunk.position.y + 2.2,
    treeTrunk.position.z
  );
  treeTop.castShadow = true;
  treeTop.receiveShadow = true;

  islandGroup.add(base, sand, rock, treeTrunk, treeTop);
}

createIsland(-20, -6, 7);
createIsland(15, 8, 6);
createIsland(-5, 22, 5);
createIsland(18, -18, 8);

// Boat
const boat = new THREE.Group();
scene.add(boat);

const hull = new THREE.Mesh(
  new THREE.BoxGeometry(2.6, 0.6, 5.2),
  new THREE.MeshToonMaterial({ color: 0xd7c2a1 })
);
hull.castShadow = true;
hull.receiveShadow = true;
boat.add(hull);

const keel = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.6, 1.4),
  new THREE.MeshToonMaterial({ color: 0x8c5b3c })
);
keel.position.set(0, -0.6, -1.2);
keel.castShadow = true;
boat.add(keel);

const mast = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8),
  new THREE.MeshToonMaterial({ color: 0xf5f5f5 })
);
mast.position.set(0, 2.2, 0);
mast.castShadow = true;
boat.add(mast);

const sail = new THREE.Mesh(
  new THREE.PlaneGeometry(3.2, 3.8, 1, 1),
  new THREE.MeshToonMaterial({ color: 0xffffff, side: THREE.DoubleSide })
);
sail.position.set(0, 2.4, -1.2);
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

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

// Helpers
const clock = new THREE.Clock();

function updateBoat(delta: number) {
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
  boat.position.addScaledVector(moveDir, boatSpeed * delta);

  boat.rotation.y = boatHeading + Math.PI; // align hull nose to heading

  // Gentle bobbing
  boat.position.y = 0.35 + Math.sin(clock.getElapsedTime() * 2) * 0.08;

  // Keep boat within water bounds
  const bounds = waterSize * 0.45;
  boat.position.x = THREE.MathUtils.clamp(boat.position.x, -bounds, bounds);
  boat.position.z = THREE.MathUtils.clamp(boat.position.z, -bounds, bounds);
}

function animateWater(time: number) {
  const pos = waterGeometry.attributes.position;
  const count = pos.count;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const wave =
      Math.sin((x * 0.15 + time * 0.6)) * 0.25 +
      Math.cos((z * 0.18 + time * 0.55)) * 0.22;
    pos.setY(i, wave);
  }
  pos.needsUpdate = true;
  waterGeometry.computeVertexNormals();
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  controls.update();
  updateBoat(delta);
  animateWater(elapsed);

  islandGroup.rotation.y = Math.sin(elapsed * 0.08) * 0.01; // subtle drift

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
