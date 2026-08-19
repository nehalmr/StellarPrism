import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Chart.js is lazy-loaded to reduce initial bundle size
type TempChartLike = {
  data: { datasets: { data: number[] }[] };
  update: (mode?: unknown) => void;
};
let tempChart: TempChartLike | null = null;

// Create UI HTML
const container = document.getElementById('container') as HTMLDivElement;
container.insertAdjacentHTML('beforebegin', `
  <div id="ui">
    <h3>Stellarator Controls</h3>
    <div class="row">
      <button id="addHeating">Add Heating</button>
      <button id="removeHeating">Remove</button>
      <button id="pulse">Trigger Pulse</button>
    </div>
    <label>Heating Power: <span id="powerVal">1.0</span></label>
    <input id="power" type="range" min="0" max="5" step="0.1" value="1">
    <label>Plasma Radius: <span id="pRadiusVal">6.0</span></label>
    <input id="pRadius" type="range" min="2" max="12" step="0.1" value="6">
    <label>Plasma Thickness: <span id="pThicknessVal">2.0</span></label>
    <input id="pThickness" type="range" min="0.5" max="6" step="0.1" value="2">
    <label class="row"><input id="autoRotate" type="checkbox"> Auto rotate</label>
  </div>
`);
container.insertAdjacentHTML('afterend', `
  <div id="analytics">
    <canvas id="tempChart"></canvas>
    <div class="stat">Heating elements: <strong id="heCount">0</strong></div>
    <div class="stat">Avg Temp: <strong id="avgTemp">0.00</strong></div>
  </div>
  <div class="credits">Built with Three.js + Chart.js</div>
`);

// Renderer setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 14, 40);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const dl = new THREE.DirectionalLight(0xffffff, 0.6);
dl.position.set(5, 10, 7);
scene.add(dl);

// Core geometry
const coreRadius = 12;
const coreTube = 3.5;
const coreGeom = new THREE.TorusGeometry(coreRadius, coreTube, 64, 200);
const coreMat = new THREE.MeshStandardMaterial({ color: 0x225577, metalness: 0.6, roughness: 0.4 });
const coreMesh = new THREE.Mesh(coreGeom, coreMat);
coreMesh.rotation.x = Math.PI * 0.5;
scene.add(coreMesh);

// Plasma: use shader material to compute per-vertex color on GPU
let plasmaRadius = 6;
let plasmaThickness = 2;
function makePlasmaGeometry(radius: number, thickness: number) {
  return new THREE.TorusGeometry(radius, thickness, 32, 160);
}

let plasmaGeom = makePlasmaGeometry(plasmaRadius, plasmaThickness);

// shader configuration
const MAX_HEAT = 16;
type UniformValue = number | THREE.Vector3[] | Float32Array | THREE.DataTexture | null | boolean;
type UniformRecord = Record<string, { value: UniformValue }>;
const plasmaUniforms: UniformRecord = {
  heatCount: { value: 0 },
  // fallback: heatPositions/powers arrays (if supported)
  heatPositions: { value: new Array(MAX_HEAT).fill(new THREE.Vector3()) },
  heatPowers: { value: new Float32Array(MAX_HEAT) },
  // texture-based fallback
  heatTexture: { value: null },
  useTexture: { value: false }
};

const plasmaVertexShader = `
  varying vec3 vWorldPos;
  void main(){
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const plasmaFragmentShader = `
  precision highp float;
  varying vec3 vWorldPos;
  uniform int heatCount;
  uniform vec3 heatPositions[${MAX_HEAT}];
  uniform float heatPowers[${MAX_HEAT}];
  uniform sampler2D heatTexture;
  uniform bool useTexture;

  vec3 tempToColor(float t){
    // map 0..1 to orange-red
    float h = mix(0.08, 0.02, t);
    return vec3(1.0, 0.5*(1.0-t), 0.2*(1.0-t));
  }

  void main(){
    float accum = 0.0;
    if(useTexture){
      // sample heat entries from texture
      for(int i=0;i<${MAX_HEAT};i++){
        if(i >= heatCount) break;
        float u = (float(i) + 0.5) / float(${MAX_HEAT});
        vec4 d = texture(heatTexture, vec2(u, 0.5));
        vec3 hp = d.xyz;
        float p = d.w;
        float d2 = distance(vWorldPos, hp);
        accum += p / (1.0 + d2*d2*0.1);
      }
    } else {
      for(int i=0;i<${MAX_HEAT};i++){
        if(i >= heatCount) break;
        float d2 = distance(vWorldPos, heatPositions[i]);
        accum += heatPowers[i] / (1.0 + d2*d2*0.1);
      }
    }
    float t = clamp(accum * 0.08, 0.0, 1.0);
    vec3 color = tempToColor(t);
    gl_FragColor = vec4(color, 0.95);
  }
`;

const plasmaMat = new THREE.ShaderMaterial({
  vertexShader: plasmaVertexShader,
  fragmentShader: plasmaFragmentShader,
  uniforms: plasmaUniforms,
  transparent: true,
  depthWrite: false
});

let plasmaMesh = new THREE.Mesh(plasmaGeom, plasmaMat);
plasmaMesh.rotation.x = Math.PI * 0.5;
scene.add(plasmaMesh);

// Heating elements management
type Heating = { mesh: THREE.Mesh; power: number };
const heatingElems: Heating[] = [];

function updateUniformsFromHeating() {
  const positions: THREE.Vector3[] = [];
  const powers = new Float32Array(MAX_HEAT);
  for (let i = 0; i < MAX_HEAT; i++) {
    if (i < heatingElems.length) {
      positions.push(heatingElems[i].mesh.position);
      powers[i] = heatingElems[i].power;
    } else {
      positions.push(new THREE.Vector3(0, 0, 0));
      powers[i] = 0;
    }
  }
  plasmaMat.uniforms.heatCount.value = Math.min(heatingElems.length, MAX_HEAT);
  // update heatPositions uniform array
  // try to use texture-based data if supported
  try {
    const size = MAX_HEAT;
    const data = new Float32Array(size * 4);
    for (let i = 0; i < size; i++) {
      const p = positions[i];
      data[i * 4 + 0] = p.x;
      data[i * 4 + 1] = p.y;
      data[i * 4 + 2] = p.z;
      data[i * 4 + 3] = powers[i];
    }
    const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    plasmaMat.uniforms.heatTexture.value = tex;
    plasmaMat.uniforms.useTexture.value = true;
    // still set arrays for compatibility
    for (let i = 0; i < MAX_HEAT; i++) {
      plasmaMat.uniforms.heatPositions.value[i] = positions[i];
      plasmaMat.uniforms.heatPowers.value[i] = powers[i];
    }
  } catch {
    // fallback to uniforms
    plasmaMat.uniforms.useTexture.value = false;
    for (let i = 0; i < MAX_HEAT; i++) {
      plasmaMat.uniforms.heatPositions.value[i] = positions[i];
      plasmaMat.uniforms.heatPowers.value[i] = powers[i];
    }
  }
}

function addHeatingElementAt(pos: THREE.Vector3, power = 1) {
  const geo = new THREE.SphereGeometry(0.5, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffff66, emissive: 0xffaa22, emissiveIntensity: 1 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos);
  scene.add(m);
  heatingElems.push({ mesh: m, power });
  updateCounts();
  updateUniformsFromHeating();
}

function removeLastHeating() {
  const h = heatingElems.pop();
  if (h) {
    scene.remove(h.mesh);
    updateCounts();
    updateUniformsFromHeating();
  }
}

function addHeatingRandom() {
  const u = Math.random() * Math.PI * 2;
  const v = Math.PI * (Math.random() - 0.5);
  const x = (coreRadius + coreTube * Math.cos(v)) * Math.cos(u);
  const y = (coreRadius + coreTube * Math.cos(v)) * Math.sin(u);
  const z = coreTube * Math.sin(v);
  addHeatingElementAt(new THREE.Vector3(x, z, y), parseFloat((document.getElementById('power') as HTMLInputElement).value));
}

// UI wiring
(document.getElementById('addHeating') as HTMLButtonElement).addEventListener('click', addHeatingRandom);
(document.getElementById('removeHeating') as HTMLButtonElement).addEventListener('click', removeLastHeating);
(document.getElementById('pulse') as HTMLButtonElement).addEventListener('click', () => {
  // pulse effect
  plasmaMat.uniforms.heatCount.value = Math.min(heatingElems.length, MAX_HEAT);
});
const powerEl = document.getElementById('power') as HTMLInputElement;
powerEl.addEventListener('input', () => (document.getElementById('powerVal')!.textContent = powerEl.value));
const pRadEl = document.getElementById('pRadius') as HTMLInputElement;
const pThEl = document.getElementById('pThickness') as HTMLInputElement;
pRadEl.addEventListener('input', () => {
  plasmaRadius = parseFloat(pRadEl.value);
  document.getElementById('pRadiusVal')!.textContent = pRadEl.value;
  rebuildPlasma();
});
pThEl.addEventListener('input', () => {
  plasmaThickness = parseFloat(pThEl.value);
  document.getElementById('pThicknessVal')!.textContent = pThEl.value;
  rebuildPlasma();
});
(document.getElementById('autoRotate') as HTMLInputElement).addEventListener('change', (e) => (autoRotate = (e.target as HTMLInputElement).checked));

function rebuildPlasma() {
  scene.remove(plasmaMesh);
  plasmaGeom.dispose();
  plasmaGeom = makePlasmaGeometry(plasmaRadius, plasmaThickness);
  plasmaMesh = new THREE.Mesh(plasmaGeom, plasmaMat);
  plasmaMesh.rotation.x = Math.PI * 0.5;
  scene.add(plasmaMesh);
}

// raycast placement
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('dblclick', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObject(coreMesh);
  if (hits.length) addHeatingElementAt(hits[0].point.clone(), parseFloat(powerEl.value));
});

function updateCounts() {
  document.getElementById('heCount')!.textContent = String(heatingElems.length);
}

// Chart
async function initChart() {
  const ChartModule = await import('chart.js/auto');
  const Chart = ChartModule.default || ChartModule;
  const tempCtx = (document.getElementById('tempChart') as HTMLCanvasElement).getContext('2d')!;
  tempChart = new Chart(tempCtx, {
    type: 'line',
    data: { labels: Array(100).fill(''), datasets: [{ label: 'Avg Temp', data: Array(100).fill(0), borderColor: '#ff8844', backgroundColor: 'rgba(255,136,68,0.12)', tension: 0.2 }] },
    options: { animation: false, responsive: true, maintainAspectRatio: false }
  });
}

// initialize chart asynchronously
initChart().catch(() => { /* non-fatal */ });

function computeAvgTemp() {
  if (heatingElems.length === 0) return 0;
  let sum = 0;
  for (const h of heatingElems) sum += h.power;
  return sum * 5;
}

// import custom data
document.getElementById('analytics')!.insertAdjacentHTML('beforeend', '<label class="stat">Import data: <input id="importFile" type="file" accept=".json,.csv"></label>');
document.getElementById('importFile')!.addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  const f = input.files ? input.files[0] : undefined;
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const txt = reader.result as string;
      if (f.name.endsWith('.json')) {
        const arr = JSON.parse(txt);
        if (tempChart) {
          tempChart.data.datasets[0].data = arr.slice(0, tempChart.data.labels!.length as number);
          tempChart.update();
        }
      } else {
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const vals = lines.map((l) => parseFloat(l.split(',')[1] || l));
        if (tempChart) {
          tempChart.data.datasets[0].data = vals.slice(0, tempChart.data.labels!.length as number);
          tempChart.update();
        }
      }
    } catch {
        alert('Failed to parse');
      }
  };
  reader.readAsText(f);
});

// main loop
let autoRotate = false;
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  // Update chart and avg temp
  const avg = computeAvgTemp();
  document.getElementById('avgTemp')!.textContent = avg.toFixed(2);
  if (tempChart) {
    tempChart.data.datasets[0].data.push(avg);
    tempChart.data.datasets[0].data.shift();
    tempChart.update('none');
  }
  if (autoRotate) {
    coreMesh.rotation.z += 0.002;
    plasmaMesh.rotation.z += 0.002;
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// init
(document.getElementById('powerVal') as HTMLElement).textContent = powerEl.value;
(document.getElementById('pRadiusVal') as HTMLElement).textContent = pRadEl.value;
(document.getElementById('pThicknessVal') as HTMLElement).textContent = pThEl.value;
updateCounts();
