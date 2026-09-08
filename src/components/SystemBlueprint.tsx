/**
 * NeuroForge — System Blueprint
 *
 * Interactive clickable block diagram of the full NeuroForge architecture.
 * Includes "How It Works" guided walkthrough mode for expo presentations.
 */
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  x: number; y: number; w: number; h: number;
  desc: string;
  ioLabel?: string;
}

interface ArchArrow {
  from: string; to: string; label: string; color?: string;
}

const NODES: ArchNode[] = [
  { id: 'TASK', label: 'Task / Environment', sublabel: 'Goal-directed Benchmark', color: '#64748b', x: 300, y: 20, w: 200, h: 50, desc: 'Provides stimuli and reward signals representing a goal-directed learning task. The neural system must learn to produce correct responses.', ioLabel: 'INPUT' },
  { id: 'BNS', label: 'Biological Neural System', sublabel: '/ Digital Twin (Simulation Proxy)', color: '#22d3ee', x: 270, y: 110, w: 260, h: 60, desc: 'Computational model of a neural population. Simulates learning, fatigue, stability, and retention as model proxies. NOT a real organoid — a digital twin for research.', ioLabel: 'SIGNAL' },
  { id: 'SIGNAL', label: 'Signal Processing', sublabel: 'Feature Extraction', color: '#38bdf8', x: 295, y: 210, w: 210, h: 50, desc: 'Extracts population firing rate, synchrony, variability and stability features from the raw neural state vector.', ioLabel: 'FEATURES' },
  { id: 'STATE', label: 'State Estimation', sublabel: 'BiologicalState Classifier', color: '#a855f7', x: 300, y: 295, w: 200, h: 50, desc: 'Converts extracted neural activity features into an estimated biological learning state: LEARNING / FATIGUED / RECOVERING / PLATEAU / UNSTABLE.', ioLabel: 'STATE' },
  { id: 'CTRL', label: 'Adaptive AI Training Policy', sublabel: 'NeuroForge Controller', color: '#00f0ff', x: 285, y: 380, w: 230, h: 60, desc: 'Selects the next training intervention (protocol) based on performance, stability, fatigue, and retention signals. Uses a weighted scoring policy — no random selection.', ioLabel: 'DECISION' },
  { id: 'SAFETY', label: 'Safety Constraint Layer', sublabel: 'Fatigue / Stability Guard', color: '#f43f5e', x: 560, y: 380, w: 190, h: 60, desc: 'Prevents training when fatigue > 70% or stability < 30%. Forces a recovery/rest protocol to protect network integrity.', ioLabel: 'CONSTRAINT' },
  { id: 'STIM', label: 'Training / Stimulation Protocol', sublabel: 'LOW | MEDIUM | HIGH', color: '#f59e0b', x: 290, y: 470, w: 220, h: 50, desc: 'Applies the selected stimulation protocol. Tracks cumulative stimulation cost = Σ(intensity × cycles). Three protocols: Random (control), Fixed (schedule), Adaptive (NeuroForge).', ioLabel: 'TRAINING' },
  { id: 'LOG', label: 'Data Logger', sublabel: 'Experiment Record', color: '#10b981', x: 560, y: 470, w: 190, h: 50, desc: 'Automatically records every experiment run with ID, timestamp, config, metrics, and results. Supports JSON/CSV export.', ioLabel: 'STORAGE' },
  { id: 'FB', label: 'Feedback Channel', sublabel: 'Biological Response', color: '#10b981', x: 60, y: 380, w: 180, h: 60, desc: 'The neural system response to training is fed back to the State Estimator, closing the adaptive control loop. This is the core of closed-loop training.', ioLabel: 'FEEDBACK' },
  { id: 'VIZ', label: 'Visualization Layer', sublabel: '3D Neural Twin + Charts', color: '#7c3aed', x: 60, y: 470, w: 180, h: 50, desc: 'Renders the digital twin, spike raster, learning curves, retention analysis, and all real-time charts. All data comes from the simulation.', ioLabel: 'OUTPUT' },
];

const ARROWS: ArchArrow[] = [
  { from: 'TASK', to: 'BNS', label: 'INPUT', color: '#64748b' },
  { from: 'BNS', to: 'SIGNAL', label: 'SIGNAL', color: '#22d3ee' },
  { from: 'SIGNAL', to: 'STATE', label: 'FEATURES', color: '#38bdf8' },
  { from: 'STATE', to: 'CTRL', label: 'STATE', color: '#a855f7' },
  { from: 'CTRL', to: 'SAFETY', label: 'CHECK', color: '#f43f5e' },
  { from: 'CTRL', to: 'STIM', label: 'DECISION', color: '#00f0ff' },
  { from: 'STIM', to: 'LOG', label: 'RECORD', color: '#10b981' },
  { from: 'FB', to: 'STATE', label: 'FEEDBACK', color: '#10b981' },
  { from: 'VIZ', to: 'FB', label: 'MONITOR', color: '#7c3aed' },
];

const WALKTHROUGH_STEPS = [
  { nodeId: 'TASK', title: 'Step 1: OBSERVE', desc: 'The task environment provides a stimulus. The neural system baseline activity is captured.' },
  { nodeId: 'BNS', title: 'Step 2: SIGNAL', desc: 'The digital twin generates simulated neural activity — firing rate, synchrony, variability, stability.' },
  { nodeId: 'SIGNAL', title: 'Step 3: ASSESS', desc: 'Signal processing extracts features from raw neural state for the state estimator.' },
  { nodeId: 'STATE', title: 'Step 4: PREDICT', desc: 'The state estimator classifies current biological state — is the system ready to learn, or fatigued?' },
  { nodeId: 'CTRL', title: 'Step 5: DECIDE', desc: 'The adaptive controller selects the optimal training protocol based on state, fatigue, and retention.' },
  { nodeId: 'SAFETY', title: 'Step 6: CONSTRAIN', desc: 'The safety layer prevents training if fatigue or instability exceeds safe thresholds.' },
  { nodeId: 'STIM', title: 'Step 7: TRAIN', desc: 'The selected protocol is applied. Learning, stability and fatigue all update based on stimulation.' },
  { nodeId: 'FB', title: 'Step 8: FEEDBACK', desc: 'The biological response feeds back to state estimation, closing the adaptive loop.' },
  { nodeId: 'LOG', title: 'Step 9: RECORD', desc: 'All metrics are logged — efficiency, learning gain, stimulation cost, retention change.' },
  { nodeId: 'VIZ', title: 'Step 10: VISUALIZE', desc: 'Results render in real-time. The loop repeats — the controller continues adapting.' },
];

export function SystemBlueprint() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [walkthroughMode, setWalkthroughMode] = useState(false);
  const [walkStep, setWalkStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    if (!walkthroughMode || !autoPlay) return;
    const id = setInterval(() => {
      setWalkStep(s => {
        if (s >= WALKTHROUGH_STEPS.length - 1) { setAutoPlay(false); return s; }
        return s + 1;
      });
    }, 2200);
    return () => clearInterval(id);
  }, [walkthroughMode, autoPlay]);

  useEffect(() => {
    if (walkthroughMode) setActiveNode(WALKTHROUGH_STEPS[walkStep].nodeId);
  }, [walkStep, walkthroughMode]);

  const activeNodeData = NODES.find(n => n.id === (walkthroughMode ? WALKTHROUGH_STEPS[walkStep].nodeId : activeNode));

  // SVG viewport
  const VW = 800, VH = 560;

  // Helper: get node center
  const nc = (id: string) => {
    const n = NODES.find(n => n.id === id);
    return n ? { x: n.x + n.w / 2, y: n.y + n.h / 2 } : { x: 0, y: 0 };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '3px' }}>🗺 SYSTEM BLUEPRINT</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>NEUROFORGE ARCHITECTURE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '2px' }}>Click any component to view its description. Use walkthrough mode for expo presentations.</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setWalkthroughMode(w => !w); setWalkStep(0); setAutoPlay(false); }} className={`cyber-btn ${walkthroughMode ? 'cyber-btn-primary' : 'cyber-btn-secondary'}`}>
              {walkthroughMode ? '✕ EXIT WALKTHROUGH' : '▶ HOW IT WORKS'}
            </button>
            {walkthroughMode && (
              <button onClick={() => setAutoPlay(a => !a)} className={`cyber-btn ${autoPlay ? 'cyber-btn-danger' : 'cyber-btn-ghost'}`}>
                {autoPlay ? '⏸ PAUSE' : '▶ AUTO'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>

        {/* SVG Blueprint */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(0,240,255,0.04)" strokeWidth="0.5" />
              </pattern>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(0,240,255,0.5)" />
              </marker>
            </defs>
            <rect width={VW} height={VH} fill="url(#grid)" />

            {/* Arrows */}
            {ARROWS.map(arr => {
              const f = nc(arr.from), t = nc(arr.to);
              const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
              return (
                <g key={`${arr.from}-${arr.to}`}>
                  <line x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                    stroke={arr.color ?? 'rgba(0,240,255,0.3)'}
                    strokeWidth={1.5} strokeDasharray="5,3"
                    markerEnd="url(#arrow)" opacity={0.6} />
                  <text x={mx} y={my - 4} fill={arr.color ?? '#94a3b8'}
                    fontSize="9" fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle" opacity={0.8}>{arr.label}</text>
                </g>
              );
            })}

            {/* Nodes */}
            {NODES.map(node => {
              const isActive = walkthroughMode
                ? WALKTHROUGH_STEPS[walkStep].nodeId === node.id
                : activeNode === node.id;
              return (
                <g key={node.id} onClick={() => !walkthroughMode && setActiveNode(activeNode === node.id ? null : node.id)}
                  style={{ cursor: walkthroughMode ? 'default' : 'pointer' }}>
                  {/* Glow */}
                  {isActive && (
                    <rect x={node.x - 4} y={node.y - 4} width={node.w + 8} height={node.h + 8}
                      rx="10" fill={`${node.color}22`} stroke={node.color} strokeWidth="2"
                      filter="url(#glow)" opacity={0.9} />
                  )}
                  {/* Box */}
                  <rect x={node.x} y={node.y} width={node.w} height={node.h}
                    rx="7" fill={isActive ? `${node.color}18` : 'rgba(6,14,32,0.85)'}
                    stroke={isActive ? node.color : 'rgba(148,163,184,0.25)'} strokeWidth={isActive ? 1.5 : 1} />
                  {/* Label */}
                  <text x={node.x + node.w / 2} y={node.y + (node.sublabel ? node.h / 2 - 6 : node.h / 2 + 4)}
                    fill={isActive ? node.color : '#cbd5e1'}
                    fontSize="11" fontFamily="Orbitron, monospace" fontWeight="700"
                    textAnchor="middle">{node.label}</text>
                  {node.sublabel && (
                    <text x={node.x + node.w / 2} y={node.y + node.h / 2 + 10}
                      fill={isActive ? `${node.color}cc` : '#64748b'}
                      fontSize="9" fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle">{node.sublabel}</text>
                  )}
                  {/* IO label badge */}
                  {node.ioLabel && (
                    <>
                      <rect x={node.x + node.w - 50} y={node.y + 2} width={48} height={14} rx="3"
                        fill={`${node.color}25`} stroke={`${node.color}60`} strokeWidth="0.5" />
                      <text x={node.x + node.w - 26} y={node.y + 12}
                        fill={node.color} fontSize="7.5" fontFamily="JetBrains Mono, monospace"
                        textAnchor="middle" fontWeight="700">{node.ioLabel}</text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Feedback loop curved arrow */}
            <path d="M 400 530 Q 30 530 30 410 Q 30 290 150 290 Q 200 290 295 318"
              fill="none" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5"
              strokeDasharray="6,3" markerEnd="url(#arrow)" />
            <text x="30" y="525" fill="#10b981" fontSize="9" fontFamily="JetBrains Mono, monospace">CLOSED LOOP</text>
          </svg>
        </div>

        {/* Detail panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Walkthrough controls */}
          {walkthroughMode && (
            <div className="glass-panel" style={{ padding: '14px', borderColor: 'rgba(0,240,255,0.4)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-faint)', marginBottom: '6px' }}>
                STEP {walkStep + 1} / {WALKTHROUGH_STEPS.length}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cyan-bright)', marginBottom: '8px' }}>
                {WALKTHROUGH_STEPS[walkStep].title}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                {WALKTHROUGH_STEPS[walkStep].desc}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => setWalkStep(s => Math.max(0, s - 1))} disabled={walkStep === 0} className="cyber-btn cyber-btn-ghost" style={{ flex: 1, fontSize: '0.75rem' }}>
                  <ChevronLeft size={13} /> PREV
                </button>
                <button onClick={() => setWalkStep(s => Math.min(WALKTHROUGH_STEPS.length - 1, s + 1))} disabled={walkStep === WALKTHROUGH_STEPS.length - 1} className="cyber-btn cyber-btn-primary" style={{ flex: 1, fontSize: '0.75rem' }}>
                  NEXT <ChevronRight size={13} />
                </button>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                {WALKTHROUGH_STEPS.map((_, i) => (
                  <div key={i} onClick={() => setWalkStep(i)} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= walkStep ? 'var(--cyan-bright)' : 'var(--border-subtle)', cursor: 'pointer', transition: 'background 0.3s' }} />
                ))}
              </div>
            </div>
          )}

          {/* Active node description */}
          {activeNodeData ? (
            <div className="glass-panel" style={{ padding: '16px', border: `1px solid ${activeNodeData.color}60` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: activeNodeData.color, letterSpacing: '0.1em', marginBottom: '6px' }}>
                {activeNodeData.ioLabel ?? 'COMPONENT'}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: activeNodeData.color, marginBottom: '10px' }}>
                {activeNodeData.label}
              </div>
              {activeNodeData.sublabel && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginBottom: '8px' }}>
                  {activeNodeData.sublabel}
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.7 }}>
                {activeNodeData.desc}
              </div>
            </div>
          ) : !walkthroughMode ? (
            <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>Click any component in the diagram to view its description</div>
            </div>
          ) : null}

          {/* Component index */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '10px' }}>COMPONENT INDEX</div>
            {NODES.map(n => (
              <div key={n.id} onClick={() => !walkthroughMode && setActiveNode(n.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', borderRadius: '5px', marginBottom: '3px', cursor: 'pointer', background: activeNode === n.id ? `${n.color}15` : 'transparent', transition: 'background 0.2s' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.color, flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: activeNode === n.id ? n.color : 'var(--text-muted)' }}>{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
