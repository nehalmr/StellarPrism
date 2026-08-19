import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Chart from 'chart.js/auto';

// Create UI HTML
const container = document.getElementById('container');
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

// Renderer
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
const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(5,10,7); scene.add(dl);

// Core
const coreRadius = 12, coreTube = 3.5;
const coreGeom = new THREE.TorusGeometry(coreRadius, coreTube, 64, 200);
const coreMat = new THREE.MeshStandardMaterial({ color:0x225577, metalness:0.6, roughness:0.4 });
const coreMesh = new THREE.Mesh(coreGeom, coreMat); coreMesh.rotation.x = Math.PI*0.5; scene.add(coreMesh);

// Plasma
let plasmaRadius = 6, plasmaThickness = 2;
function makePlasmaGeometry(radius, thickness){ return new THREE.TorusBufferGeometry(radius, thickness, 32, 160); }
let plasmaGeom = makePlasmaGeometry(plasmaRadius, plasmaThickness);
const plasmaMat = new THREE.MeshStandardMaterial({ vertexColors:true, transparent:true, opacity:0.95, emissive:0xff3300, emissiveIntensity:1.2, side:THREE.DoubleSide, roughness:0.2 });
function initVertexColors(geom){ const count = geom.attributes.position.count; const colors = new Float32Array(count*3); for(let i=0;i<count;i++){ colors[i*3+0]=1; colors[i*3+1]=0.2; colors[i*3+2]=0.1; } geom.setAttribute('color', new THREE.BufferAttribute(colors, 3)); }
initVertexColors(plasmaGeom);
let plasmaMesh = new THREE.Mesh(plasmaGeom, plasmaMat); plasmaMesh.rotation.x = Math.PI*0.5; scene.add(plasmaMesh);

// Heating
const heatingElems = [];
function addHeatingElementAt(pos, power=1){ const geo = new THREE.SphereGeometry(0.5,12,12); const mat = new THREE.MeshStandardMaterial({ color:0xffff66, emissive:0xffaa22, emissiveIntensity:1 }); const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.userData.power = power; scene.add(m); heatingElems.push(m); updateCounts(); }
function addHeatingRandom(){ const u = Math.random()*Math.PI*2; const v = Math.PI*(Math.random()-0.5); const x=(coreRadius+coreTube*Math.cos(v))*Math.cos(u); const y=(coreRadius+coreTube*Math.cos(v))*Math.sin(u); const z=coreTube*Math.sin(v); addHeatingElementAt(new THREE.Vector3(x,z,y), parseFloat(document.getElementById('power').value)); }
function removeLastHeating(){ const h = heatingElems.pop(); if(h){ scene.remove(h); updateCounts(); }}

// UI wiring
document.getElementById('addHeating').addEventListener('click', addHeatingRandom);
document.getElementById('removeHeating').addEventListener('click', removeLastHeating);
document.getElementById('pulse').addEventListener('click', ()=>{ plasmaMesh.material.emissiveIntensity=3.5; setTimeout(()=>plasmaMesh.material.emissiveIntensity=1.2,400); });
const powerEl = document.getElementById('power'); powerEl.addEventListener('input', ()=>document.getElementById('powerVal').textContent = powerEl.value);
const pRadEl = document.getElementById('pRadius'); const pThEl = document.getElementById('pThickness');
pRadEl.addEventListener('input', ()=>{ plasmaRadius = parseFloat(pRadEl.value); document.getElementById('pRadiusVal').textContent = pRadEl.value; rebuildPlasma(); });
pThEl.addEventListener('input', ()=>{ plasmaThickness = parseFloat(pThEl.value); document.getElementById('pThicknessVal').textContent = pThEl.value; rebuildPlasma(); });
document.getElementById('autoRotate').addEventListener('change', (e)=>autoRotate = e.target.checked);

function rebuildPlasma(){ scene.remove(plasmaMesh); plasmaGeom.dispose(); plasmaGeom = makePlasmaGeometry(plasmaRadius, plasmaThickness); initVertexColors(plasmaGeom); plasmaMesh = new THREE.Mesh(plasmaGeom, plasmaMat); plasmaMesh.rotation.x = Math.PI*0.5; scene.add(plasmaMesh); }

// Raycast placement
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('dblclick', (e)=>{ const rect = renderer.domElement.getBoundingClientRect(); mouse.x = ((e.clientX-rect.left)/rect.width)*2 - 1; mouse.y = -((e.clientY-rect.top)/rect.height)*2 + 1; ray.setFromCamera(mouse, camera); const hits = ray.intersectObject(coreMesh); if(hits.length) addHeatingElementAt(hits[0].point.clone(), parseFloat(powerEl.value)); });

function updateCounts(){ document.getElementById('heCount').textContent = heatingElems.length; }

// Charts
const tempCtx = document.getElementById('tempChart').getContext('2d');
const tempChart = new Chart(tempCtx, { type:'line', data:{ labels: Array(100).fill(''), datasets:[{label:'Avg Temp', data:Array(100).fill(0), borderColor:'#ff8844', backgroundColor:'rgba(255,136,68,0.12)', tension:0.2 }]}, options:{animation:false,responsive:true,maintainAspectRatio:false} });

// compute per-vertex temperatures
let lastColorUpdate = 0;
function computeVertexTemperatures(){ const pos = plasmaGeom.attributes.position; const colorAttr = plasmaGeom.attributes.color; const count = pos.count; const v = new THREE.Vector3(); for(let i=0;i<count;i++){ v.fromBufferAttribute(pos,i); plasmaMesh.localToWorld(v.copy(v)); let accum=0; for(const h of heatingElems){ const d2 = h.position.distanceToSquared(v); accum += (h.userData.power||1)/(1 + d2); } const temp = Math.min(100, accum*8); const t = Math.max(0, Math.min(1, temp/80)); const col = new THREE.Color(); col.setHSL(0.05*(1-t),1,0.5+0.25*t); colorAttr.array[i*3+0]=col.r; colorAttr.array[i*3+1]=col.g; colorAttr.array[i*3+2]=col.b; } colorAttr.needsUpdate = true; }

// computeMagneticFieldSamples removed (unused) to satisfy linter

function computeAvgTemp(){ if(heatingElems.length===0) return 0; let sum=0; for(const h of heatingElems) sum += (h.userData.power||1); return sum*5; }

// data import
document.getElementById('analytics').insertAdjacentHTML('beforeend', '<label class="stat">Import data: <input id="importFile" type="file" accept=".json,.csv"></label>');
document.getElementById('importFile').addEventListener('change', (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const txt = reader.result;
      if(f.name.endsWith('.json')){
        const arr = JSON.parse(txt);
        tempChart.data.datasets[0].data = arr.slice(0, tempChart.data.labels.length);
        tempChart.update();
      } else {
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const vals = lines.map(l=>parseFloat(l.split(',')[1]||l));
        tempChart.data.datasets[0].data = vals.slice(0, tempChart.data.labels.length);
        tempChart.update();
      }
    } catch {
      alert('Failed to parse');
    }
  };
  reader.readAsText(f);
});

// loop
let autoRotate = false;
function animate(){ requestAnimationFrame(animate); controls.update(); const now = performance.now(); if(now - lastColorUpdate > 120) { computeVertexTemperatures(); lastColorUpdate = now; } const avg = computeAvgTemp(); document.getElementById('avgTemp').textContent = avg.toFixed(2); tempChart.data.datasets[0].data.push(avg); tempChart.data.datasets[0].data.shift(); tempChart.update('none'); if(autoRotate){ coreMesh.rotation.z += 0.002; plasmaMesh.rotation.z += 0.002; } renderer.render(scene, camera); }
animate();

window.addEventListener('resize', ()=>{ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// init
document.getElementById('powerVal').textContent = powerEl.value; document.getElementById('pRadiusVal').textContent = pRadEl.value; document.getElementById('pThicknessVal').textContent = pThEl.value; updateCounts();
