/**
 * NeuroForge — Research Dashboard
 *
 * The scientific landing page. Shows the research question, hypothesis,
 * experiment timeline, system architecture overview, and live neural state.
 *
 * DISCLAIMER: NeuroForge is a simulation-based research prototype. It does
 * not contain living biological tissue and does not claim to reproduce
 * consciousness or the full functionality of a biological brain.
 */
import { useEffect, useState } from 'react';
import { Brain, Zap, Shield, Activity, TrendingUp, Target, AlertCircle } from 'lucide-react';
import type { NeuralSystemState, ControllerDecision } from '../simulation';
import {
  classifyBiologicalState,
  biologicalStateColor,
  biologicalStateDescription,
} from '../simulation';

interface Props {
  systemState: NeuralSystemState;
  decision: ControllerDecision | null;
  isRunning: boolean;
  currentPhase: string | null;
}

const PIPELINE_STEPS = [
  { id: 'OBSERVE', label: 'OBSERVE', desc: 'Capture baseline neural activity metrics', icon: '👁' },
  { id: 'ASSESS', label: 'ASSESS', desc: 'Evaluate readiness — fatigue, stability, plasticity', icon: '📊' },
  { id: 'PREDICT', label: 'PREDICT', desc: 'Controller estimates outcome of each protocol', icon: '🔮' },
  { id: 'TRAIN', label: 'TRAIN', desc: 'Apply selected stimulation protocol', icon: '⚡' },
  { id: 'MEASURE', label: 'MEASURE', desc: 'Record efficiency and post-training state', icon: '📏' },
  { id: 'REST', label: 'REST', desc: 'Recovery phase — fatigue clears, retention consolidates', icon: '🌙' },
  { id: 'RETEST', label: 'RETEST', desc: 'Assess retained performance after rest', icon: '🔁' },
  { id: 'ADAPT', label: 'ADAPT', desc: 'Update training policy based on results', icon: '🧬' },
];

const ARCH_NODES = [
  { id: 'TASK', label: 'Task / Environment', color: '#64748b', desc: 'Goal-directed benchmark task providing stimuli and reward signals to the neural system.' },
  { id: 'BNS', label: 'Biological Neural System\n/ Digital Twin', color: '#22d3ee', desc: 'Computational model of a neural population. Simulates learning, fatigue, stability, and retention as model proxies.' },
  { id: 'SIGNAL', label: 'Signal Processing', color: '#38bdf8', desc: 'Extracts population firing rate, synchrony, variability and stability features from raw neural state.' },
  { id: 'STATE', label: 'State Estimation', color: '#a855f7', desc: 'Converts neural activity features into an estimated biological learning state (BiologicalState classifier).' },
  { id: 'CTRL', label: 'Adaptive AI\nTraining Policy', color: '#00f0ff', desc: 'Selects the next training intervention based on performance, stability, fatigue, and retention signals.' },
  { id: 'STIM', label: 'Training /\nStimulation Protocol', color: '#f59e0b', desc: 'Applies LOW / MEDIUM / HIGH intensity training. Tracks stimulation cost per cycle.' },
  { id: 'SAFETY', label: 'Safety Constraint Layer', color: '#f43f5e', desc: 'Prevents training when fatigue > 70% or stability < 30%. Forces recovery protocol.' },
  { id: 'FB', label: 'Feedback Channel', color: '#10b981', desc: 'Biological response fed back to state estimator, closing the adaptive control loop.' },
];

export function ResearchDashboard({ systemState, decision, isRunning, currentPhase }: Props) {
  const [activeArch, setActiveArch] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  // Animate through pipeline steps when training is running
  useEffect(() => {
    if (!isRunning) { setStepIdx(0); return; }
    const phaseMap: Record<string, number> = {
      OBSERVE: 0, ASSESS: 1, ENGINE: 2, TRAIN: 3, MEASURE: 4,
    };
    if (currentPhase && phaseMap[currentPhase] !== undefined) {
      setStepIdx(phaseMap[currentPhase]);
    }
  }, [currentPhase, isRunning]);

  // Pulse through steps automatically when idle (for demo)
  useEffect(() => {
    if (isRunning) return;
    const id = setInterval(() => setStepIdx(i => (i + 1) % PIPELINE_STEPS.length), 1400);
    return () => clearInterval(id);
  }, [isRunning]);

  const bioState = classifyBiologicalState(systemState);
  const stateColor = biologicalStateColor(bioState);
  const stateDesc = biologicalStateDescription(bioState);

  const bann = systemState.bannState;
  const accuracy = bann ? Math.min(99.9, Math.max(10, systemState.learningScore * 0.9 + 10)) : systemState.learningScore;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* Disclaimer Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <AlertCircle size={16} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: '#eab308' }}>SIMULATION PROTOTYPE — </strong>
          NeuroForge does not contain living biological tissue and does not claim to reproduce consciousness or full brain functionality.
          Neural activity, learning, fatigue, plasticity and retention are <strong style={{ color: '#eab308' }}>computational model proxies</strong> used for experimentation.
        </div>
      </div>

      {/* Research Question + Hypothesis */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px', borderColor: 'rgba(0,240,255,0.4)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '10px' }}>
            🔬 PRIMARY RESEARCH QUESTION
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            "Can an adaptive AI control policy improve learning efficiency and retention in a simulated biological neural network while maintaining network stability, limiting fatigue, and minimizing stimulation cost?"
          </p>
        </div>
        <div className="glass-panel" style={{ padding: '20px', borderColor: 'rgba(168,85,247,0.4)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--purple-neon)', letterSpacing: '0.15em', marginBottom: '10px' }}>
            🧪 HYPOTHESIS
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            "Adaptive closed-loop training will achieve a better learning–retention–stability trade-off than random or fixed training protocols under simulated biological constraints."
          </p>
          <div style={{ marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
            ⚠ This hypothesis is tested by the simulation — not pre-determined.
          </div>
        </div>
      </div>

      {/* Main content: Pipeline + Live State */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', alignItems: 'start' }}>

        {/* Experiment Loop Timeline */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '16px' }}>
            ADAPTIVE CLOSED-LOOP EXPERIMENT PIPELINE
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap', rowGap: '10px' }}>
            {PIPELINE_STEPS.map((step, i) => {
              const isActive = i === stepIdx;
              const isPast = i < stepIdx;
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      padding: '12px 14px',
                      background: isActive
                        ? 'rgba(0,240,255,0.15)'
                        : isPast ? 'rgba(0,240,255,0.05)' : 'rgba(6,14,32,0.6)',
                      border: `1px solid ${isActive ? 'var(--cyan-bright)' : isPast ? 'rgba(0,240,255,0.25)' : 'var(--border-subtle)'}`,
                      borderRadius: '8px',
                      textAlign: 'center',
                      minWidth: '90px',
                      transition: 'all 0.3s ease',
                      boxShadow: isActive ? '0 0 15px rgba(0,240,255,0.3)' : 'none',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{step.icon}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: isActive ? 'var(--cyan-bright)' : isPast ? 'rgba(0,240,255,0.6)' : 'var(--text-muted)', letterSpacing: '0.08em' }}>{step.label}</div>
                    {isActive && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text-faint)', marginTop: '4px', lineHeight: 1.3 }}>{step.desc}</div>
                    )}
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div style={{ color: isPast ? 'var(--cyan-bright)' : 'var(--text-faint)', fontSize: '1rem', padding: '0 4px', opacity: isPast ? 1 : 0.4 }}>↓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Biological State Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: '16px', border: `1px solid ${stateColor}60` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '8px' }}>BIOLOGICAL STATE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: stateColor, marginBottom: '6px' }}>{bioState}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: 'var(--text-faint)', lineHeight: 1.5 }}>{stateDesc}</div>
          </div>

          {[
            { label: 'LEARNING', value: systemState.learningScore, color: 'var(--cyan-bright)', icon: <Brain size={13}/> },
            { label: 'STABILITY', value: systemState.stability, color: 'var(--emerald-neon)', icon: <Shield size={13}/> },
            { label: 'RETENTION', value: systemState.retention, color: 'var(--purple-neon)', icon: <TrendingUp size={13}/> },
            { label: 'SYNCHRONY', value: systemState.synchrony, color: '#38bdf8', icon: <Activity size={13}/> },
            { label: 'FATIGUE', value: systemState.fatigue, color: 'var(--rose-neon)', icon: <Zap size={13}/>, invert: true },
            { label: 'ACCURACY', value: accuracy, color: 'var(--amber-neon)', icon: <Target size={13}/> },
          ].map(m => (
            <div key={m.label} className="glass-panel" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  <span style={{ color: m.color }}>{m.icon}</span> {m.label}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: m.color }}>
                  {m.value.toFixed(1)}%
                </div>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                <div style={{ height: '100%', width: `${Math.min(100, m.value)}%`, background: m.color, borderRadius: '2px', boxShadow: `0 0 6px ${m.color}`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}

          {decision && (
            <div className="glass-panel" style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CONTROLLER DECISION</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan-bright)', fontWeight: 700 }}>{decision.protocol}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: '4px', lineHeight: 1.4 }}>
                {decision.firedConditions[0]?.fragment ?? 'Nominal state — maintaining optimal protocol.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Architecture Block Diagram */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '16px' }}>
          NEUROFORGE SYSTEM ARCHITECTURE — Click a component for details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr 24px 1fr 24px 1fr', gap: '6px', alignItems: 'center' }}>
          {ARCH_NODES.map((node, i) => (
            <>
              <div
                key={node.id}
                onClick={() => setActiveArch(activeArch === node.id ? null : node.id)}
                style={{
                  padding: '12px',
                  background: activeArch === node.id ? `${node.color}22` : 'rgba(6,14,32,0.7)',
                  border: `1px solid ${activeArch === node.id ? node.color : 'var(--border-subtle)'}`,
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  boxShadow: activeArch === node.id ? `0 0 14px ${node.color}40` : 'none',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: node.color, lineHeight: 1.3, whiteSpace: 'pre-line' }}>{node.label}</div>
              </div>
              {i < ARCH_NODES.length - 1 && (
                <div key={`arr-${i}`} style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.9rem' }}>→</div>
              )}
            </>
          ))}
        </div>
        {activeArch && (() => {
          const node = ARCH_NODES.find(n => n.id === activeArch)!;
          return (
            <div style={{ marginTop: '14px', padding: '12px 16px', background: `${node.color}10`, border: `1px solid ${node.color}40`, borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.6 }}>
              <strong style={{ color: node.color }}>{node.label}: </strong>{node.desc}
            </div>
          );
        })()}
      </div>

      {/* Concept intro cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { title: 'ADAPTIVE CONTROL', body: 'The training policy observes neural state and dynamically adjusts stimulation intensity, frequency and rest intervals. More stimulation is not always better.', color: 'var(--cyan-bright)' },
          { title: 'RETENTION ≠ LEARNING', body: 'Peak learning performance during training does not guarantee retention after rest. NeuroForge explicitly measures both and optimises the trade-off.', color: 'var(--purple-neon)' },
          { title: 'FATIGUE AS CONSTRAINT', body: 'Repeated stimulation accumulates fatigue that degrades network stability. The adaptive controller learns to insert rest phases before critical thresholds.', color: 'var(--rose-neon)' },
        ].map(c => (
          <div key={c.title} className="glass-panel" style={{ padding: '16px', borderColor: `${c.color}40` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: c.color, letterSpacing: '0.12em', marginBottom: '8px' }}>{c.title}</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
