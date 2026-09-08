import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import type { NeuralSystemState, BannNeuron, BannSynapse } from '../simulation';


interface NeuralVisualization3DProps {
  systemState: NeuralSystemState;
  isRunning?: boolean;
}

interface SelectedElement {
  type: 'NEURON' | 'SYNAPSE';
  neuron?: BannNeuron;
  synapse?: BannSynapse;
  fromNeuron?: BannNeuron;
  toNeuron?: BannNeuron;
}

export function NeuralVisualization3D({ systemState, isRunning = false }: NeuralVisualization3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  // Reference for animation objects
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const connectionLinesRef = useRef<Map<string, THREE.Line>>(new Map());
  const pulseParticlesRef = useRef<Array<{ mesh: THREE.Mesh; fromPos: THREE.Vector3; toPos: THREE.Vector3; progress: number; speed: number }>>([]);

  const bannState = useMemo(() => {
    return systemState.bannState ?? null;
  }, [systemState.bannState]);

  const systemStateRef = useRef(systemState);
  useEffect(() => {
    systemStateRef.current = systemState;
  }, [systemState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Test WebGL support
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 900;
    const height = 440;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712); // Deep futuristic navy
    scene.fog = new THREE.FogExp2(0x030712, 0.035);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 11);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 20;
    controls.minDistance = 4;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xa855f7, 2, 15);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Grid Floor Helper
    const gridHelper = new THREE.GridHelper(16, 16, 0x334155, 0x1e293b);
    gridHelper.position.y = -4;
    scene.add(gridHelper);

    // Raycaster for user clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const nodeMeshes = Array.from(nodeMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        const neuronId = clickedMesh.userData.neuronId;
        const currentBann = systemStateRef.current.bannState;
        if (currentBann) {
          const foundNeuron = currentBann.neurons.find(n => n.id === neuronId);
          if (foundNeuron) {
            setSelected({ type: 'NEURON', neuron: foundNeuron });
            return;
          }
        }
      }

      // Check synapse connection clicks
      const lineObjects = Array.from(connectionLinesRef.current.values());
      const lineIntersects = raycaster.intersectObjects(lineObjects);
      if (lineIntersects.length > 0) {
        const clickedLine = lineIntersects[0].object;
        const synId = clickedLine.userData.synId;
        const currentBann = systemStateRef.current.bannState;
        if (currentBann) {
          const foundSyn = currentBann.synapses.find(s => s.id === synId);
          if (foundSyn) {
            const fromN = currentBann.neurons.find(n => n.id === foundSyn.fromId);
            const toN = currentBann.neurons.find(n => n.id === foundSyn.toId);
            setSelected({ type: 'SYNAPSE', synapse: foundSyn, fromNeuron: fromN, toNeuron: toN });
            return;
          }
        }
      }
    };


    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      controls.update();

      // Animate pulses along connection vectors
      pulseParticlesRef.current.forEach(p => {
        p.progress += p.speed * (isRunning ? 1.8 : 1.0);
        if (p.progress >= 1.0) p.progress = 0;
        p.mesh.position.lerpVectors(p.fromPos, p.toPos, p.progress);
      });

      // Gently rotate scene light or nodes
      pointLight.intensity = 1.5 + Math.sin(elapsedTime * 3) * 0.5;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isRunning]);

  // Re-build 3D Meshes & Lines when bannState or systemState updates
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !bannState) return;

    // Clear existing objects
    nodeMeshesRef.current.forEach(mesh => scene.remove(mesh));
    nodeMeshesRef.current.clear();

    connectionLinesRef.current.forEach(line => scene.remove(line));
    connectionLinesRef.current.clear();

    pulseParticlesRef.current.forEach(p => scene.remove(p.mesh));
    pulseParticlesRef.current = [];

    const neuronPosMap = new Map<string, THREE.Vector3>();

    // 1. Build Neurons (Spheres with dynamic glow scale)
    bannState.neurons.forEach(neuron => {
      const pos = new THREE.Vector3(...neuron.position);
      neuronPosMap.set(neuron.id, pos);

      // Color mapping based on layer and activation
      let baseColor = 0x38bdf8; // Blue input
      if (neuron.layer === 'HIDDEN') baseColor = 0xc084fc; // Purple plastic hidden
      if (neuron.layer === 'OUTPUT') baseColor = 0x4ade80; // Green output

      const act = neuron.activation;
      const radius = 0.35 + act * 0.35;

      const geometry = new THREE.IcosahedronGeometry(radius, 3);
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.3 + act * 0.9,
        roughness: 0.2,
        metalness: 0.8,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      mesh.userData = { neuronId: neuron.id };

      scene.add(mesh);
      nodeMeshesRef.current.set(neuron.id, mesh);

      // Outer Wireframe Glow Ring
      const ringGeo = new THREE.RingGeometry(radius + 0.1, radius + 0.2, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: baseColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4 * act,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos);
      ringMesh.rotation.y = Math.PI / 4;
      scene.add(ringMesh);
    });

    // 2. Build Synapse Connections (Lines & Pulses)
    bannState.synapses.forEach(syn => {
      const fromPos = neuronPosMap.get(syn.fromId);
      const toPos = neuronPosMap.get(syn.toId);
      if (!fromPos || !toPos) return;

      const weightNorm = (syn.weight + 0.5) / 3.0; // normalized weight 0 to 1

      // Connection Line
      const points = [fromPos, toPos];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      
      const isWeightHigh = syn.weight > 0.8;
      const lineColor = isWeightHigh ? 0xa855f7 : 0x64748b;
      
      const lineMat = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: Math.max(0.15, Math.min(0.85, weightNorm)),
        linewidth: 2,
      });

      const line = new THREE.Line(lineGeo, lineMat);
      line.userData = { synId: syn.id };
      scene.add(line);
      connectionLinesRef.current.set(syn.id, line);

      // Pulse Particle
      const pulseGeo = new THREE.SphereGeometry(0.08 + Math.abs(syn.lastDelta) * 0.4, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: syn.lastDelta > 0 ? 0x22c55e : syn.lastDelta < 0 ? 0xef4444 : 0x38bdf8,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      pulseMesh.position.copy(fromPos);
      scene.add(pulseMesh);

      pulseParticlesRef.current.push({
        mesh: pulseMesh,
        fromPos,
        toPos,
        progress: Math.random(),
        speed: 0.008 + weightNorm * 0.015,
      });
    });

  }, [bannState, systemState]);

  // Controls helper buttons
  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 2, 11);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const zoomIn = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(0.85);
    }
  };

  const zoomOut = () => {
    if (cameraRef.current) {
      cameraRef.current.position.multiplyScalar(1.15);
    }
  };

  if (!webGlSupported) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#1c1917', color: '#f5f5f4' }}>
        WebGL is unavailable in this environment. Showing active 2D Telemetry fallback.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '440px', backgroundColor: '#0c0a09', borderRadius: '4px', overflow: 'hidden', border: '1px solid #292524' }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating 3D Control Toolbar */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px',
        backgroundColor: 'rgba(12, 10, 9, 0.75)', backdropFilter: 'blur(6px)',
        padding: '6px', borderRadius: '6px', border: '1px solid #292524', zIndex: 10
      }}>
        <button onClick={zoomIn} title="Zoom In" className="ctrl-btn ctrl-btn-ghost" style={{ padding: '6px', color: '#f5f5f4' }}>
          <ZoomIn size={14} />
        </button>
        <button onClick={zoomOut} title="Zoom Out" className="ctrl-btn ctrl-btn-ghost" style={{ padding: '6px', color: '#f5f5f4' }}>
          <ZoomOut size={14} />
        </button>
        <button onClick={resetCamera} title="Reset View" className="ctrl-btn ctrl-btn-ghost" style={{ padding: '6px', color: '#f5f5f4' }}>
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Top Left Status Badge */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px',
        fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700,
        backgroundColor: 'rgba(12, 10, 9, 0.8)', border: '1px solid #334155',
        padding: '4px 10px', borderRadius: '4px', color: '#38bdf8', letterSpacing: '0.08em',
      }}>
        3D REAL BANN MODEL STATE &nbsp;|&nbsp; NEURONS: {bannState?.neurons.length ?? 0} &nbsp;|&nbsp; SYNAPSES: {bannState?.synapses.length ?? 0}
      </div>

      {/* Live Telemetry Inspector Overlay */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: '48px', left: '12px', width: '280px',
          backgroundColor: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(8px)',
          border: '1px solid #3b82f6', borderRadius: '6px', padding: '12px',
          color: '#f8fafc', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', zIndex: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>
              <Info size={13} style={{ display: 'inline', marginRight: '4px' }} />
              {selected.type === 'NEURON' ? `NEURON ${selected.neuron?.label}` : `SYNAPSE ${selected.synapse?.id}`}
            </span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
          </div>

          {selected.type === 'NEURON' && selected.neuron && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', lineHeight: 1.5 }}>
              <div><span style={{ color: '#94a3b8' }}>Layer:</span> {selected.neuron.layer}</div>
              <div><span style={{ color: '#94a3b8' }}>Activation:</span> <strong style={{ color: '#4ade80' }}>{selected.neuron.activation.toFixed(4)}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Threshold:</span> {selected.neuron.threshold.toFixed(2)}</div>
              <div><span style={{ color: '#94a3b8' }}>Potential:</span> {selected.neuron.membranePotential.toFixed(3)}</div>
            </div>
          )}

          {selected.type === 'SYNAPSE' && selected.synapse && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', lineHeight: 1.5 }}>
              <div><span style={{ color: '#94a3b8' }}>From:</span> {selected.fromNeuron?.label ?? selected.synapse.fromId}</div>
              <div><span style={{ color: '#94a3b8' }}>To:</span> {selected.toNeuron?.label ?? selected.synapse.toId}</div>
              <div><span style={{ color: '#94a3b8' }}>Synaptic Weight (W):</span> <strong style={{ color: '#a855f7' }}>{selected.synapse.weight.toFixed(4)}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Last Plastic Delta (ΔW):</span> <span style={{ color: selected.synapse.lastDelta >= 0 ? '#4ade80' : '#ef4444' }}>{selected.synapse.lastDelta >= 0 ? '+' : ''}{selected.synapse.lastDelta.toFixed(5)}</span></div>
              <div><span style={{ color: '#94a3b8' }}>Eligibility Trace:</span> {selected.synapse.eligibilityTrace.toFixed(4)}</div>
            </div>
          )}
        </div>
      )}

      {/* Legend Footer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(12, 10, 9, 0.9)', borderTop: '1px solid #292524',
        padding: '6px 12px', display: 'flex', gap: '16px', flexWrap: 'wrap',
        fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#94a3b8'
      }}>
        <div><span style={{ color: '#38bdf8' }}>●</span> INPUT NEURONS</div>
        <div><span style={{ color: '#c084fc' }}>●</span> PLASTIC HIDDEN ARRAY</div>
        <div><span style={{ color: '#4ade80' }}>●</span> OUTPUT DECISION</div>
        <div><span style={{ color: '#a855f7' }}>―</span> HIGH WEIGHT (W &gt; 0.8)</div>
        <div style={{ marginLeft: 'auto', color: '#64748b' }}>DRAG to rotate &nbsp;|&nbsp; SCROLL to zoom</div>
      </div>
    </div>
  );
}
