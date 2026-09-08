import { useState, useRef } from 'react';
import { Play, Save, Upload, RotateCcw, Sliders, PlusCircle } from 'lucide-react';
import type { BannHyperparameters, NeuralSystemState } from '../simulation';
import { runBannBatch, createInitialBannState } from '../simulation';

interface TrainingLabProps {
  systemState: NeuralSystemState;
  onUpdateSystemState: (newState: NeuralSystemState) => void;
  onSaveSessionSnapshot: (label: string, state: NeuralSystemState) => void;
}

export function TrainingLab({ systemState, onUpdateSystemState, onSaveSessionSnapshot }: TrainingLabProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hyperparameter Sliders State
  const bannState = systemState.bannState ?? createInitialBannState(systemState.seed);
  const [params, setParams] = useState<BannHyperparameters>(bannState.hyperparams);
  const [batchCount, setBatchCount] = useState<number>(100);
  const [isSimulating, setIsSimulating] = useState(false);
  const [sessionLabel, setSessionLabel] = useState<string>('Experiment Alpha');

  const handleParamChange = (key: keyof BannHyperparameters, val: number) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  const handleApplyParameters = () => {
    const updatedState = { ...systemState };
    if (!updatedState.bannState) {
      updatedState.bannState = createInitialBannState(updatedState.seed);
    }
    updatedState.bannState.hyperparams = { ...params };
    onUpdateSystemState(updatedState);
  };

  // Run Batch Training Cycles (up to 10,000 cycles)
  const handleRunBatch = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const updatedState = JSON.parse(JSON.stringify(systemState)) as NeuralSystemState;
      if (!updatedState.bannState) {
        updatedState.bannState = createInitialBannState(updatedState.seed);
      }
      updatedState.bannState.hyperparams = { ...params };

      const telemetryList = runBannBatch(updatedState.bannState, batchCount);

      if (!updatedState.bannTelemetryHistory) {
        updatedState.bannTelemetryHistory = [];
      }
      updatedState.bannTelemetryHistory.push(...telemetryList);

      // Update aggregate metrics from last telemetry
      const last = telemetryList[telemetryList.length - 1];
      if (last) {
        updatedState.learningScore = parseFloat(last.accuracy.toFixed(1));
        updatedState.retention = parseFloat(last.memoryRetention.toFixed(1));
        updatedState.fatigue = parseFloat(last.adaptationState.toFixed(1));
      }

      onUpdateSystemState(updatedState);
      setIsSimulating(false);
    }, 50);
  };

  const handleNewExperiment = () => {
    const freshSeed = Math.floor(Math.random() * 99999);
    const freshBann = createInitialBannState(freshSeed, params);
    const newState: NeuralSystemState = {
      learningScore: 0,
      stability: 75,
      synchrony: 45,
      spikeRate: 12,
      variability: 0.35,
      retention: 0,
      fatigue: 0,
      seed: freshSeed,
      trainingHistory: [],
      bannState: freshBann,
      bannTelemetryHistory: [],
    };
    onUpdateSystemState(newState);
  };

  const handleSaveJson = () => {
    const jsonStr = JSON.stringify(systemState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeuroForge_BANN_State_Cycle_${systemState.bannState?.cycle ?? 0}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedState = JSON.parse(event.target?.result as string) as NeuralSystemState;
        if (loadedState && typeof loadedState.learningScore === 'number') {
          onUpdateSystemState(loadedState);
        }
      } catch {
        alert('Invalid NeuroForge model JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSnapshot = () => {
    onSaveSessionSnapshot(sessionLabel, systemState);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--cyan-bright)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
            HYPERPARAMETER CONTROL &amp; 10K CYCLE SIMULATOR
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={22} color="var(--cyan-bright)" />
            NEUROFORGE BANN TRAINING LAB
          </h2>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          BATCH ITERATOR &amp; PLASTICITY TUNER
        </span>
      </div>

      {/* ── Control Toolbar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <button onClick={handleRunBatch} disabled={isSimulating} className="cyber-btn cyber-btn-primary">
          <Play size={14} /> {isSimulating ? 'SIMULATING...' : `RUN BATCH (${batchCount} CYCLES)`}
        </button>
        <button onClick={handleApplyParameters} className="cyber-btn cyber-btn-secondary">
          <Sliders size={14} /> APPLY PARAMETER ADJUSTMENTS
        </button>
        <button onClick={handleNewExperiment} className="cyber-btn cyber-btn-danger">
          <RotateCcw size={14} /> NEW EXPERIMENT (RESET SEED)
        </button>
      </div>

      {/* ── Hyperparameters Grid ────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        {/* Sliders Box 1 */}
        <div className="neon-card">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '14px' }}>
            PLASTICITY &amp; LEARNING RATE (η)
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Base Learning Rate (η₀):</span>
              <strong style={{ color: 'var(--cyan-bright)' }}>{params.learningRate.toFixed(3)}</strong>
            </div>
            <input
              type="range" min="0.005" max="0.3" step="0.005"
              value={params.learningRate}
              onChange={(e) => handleParamChange('learningRate', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--cyan-bright)' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Memory Decay Rate (δ):</span>
              <strong style={{ color: 'var(--cyan-bright)' }}>{params.memoryDecay.toFixed(4)}</strong>
            </div>
            <input
              type="range" min="0.0005" max="0.03" step="0.0005"
              value={params.memoryDecay}
              onChange={(e) => handleParamChange('memoryDecay', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--cyan-bright)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Reward Modulation (R):</span>
              <strong style={{ color: 'var(--cyan-bright)' }}>{params.rewardFactor.toFixed(2)}</strong>
            </div>
            <input
              type="range" min="0.0" max="2.5" step="0.1"
              value={params.rewardFactor}
              onChange={(e) => handleParamChange('rewardFactor', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--cyan-bright)' }}
            />
          </div>
        </div>

        {/* Sliders Box 2 */}
        <div className="neon-card">
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--blue-accent)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '14px' }}>
            ENVIRONMENT &amp; HOMEOSTASIS
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Task Difficulty:</span>
              <strong style={{ color: 'var(--blue-accent)' }}>{params.difficulty.toFixed(2)}</strong>
            </div>
            <input
              type="range" min="0.1" max="1.0" step="0.05"
              value={params.difficulty}
              onChange={(e) => handleParamChange('difficulty', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--blue-accent)' }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Stimulus Noise (σ):</span>
              <strong style={{ color: 'var(--blue-accent)' }}>{params.noiseLevel.toFixed(3)}</strong>
            </div>
            <input
              type="range" min="0.0" max="0.1" step="0.005"
              value={params.noiseLevel}
              onChange={(e) => handleParamChange('noiseLevel', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--blue-accent)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Homeostasis Speed:</span>
              <strong style={{ color: 'var(--blue-accent)' }}>{params.adaptationSpeed.toFixed(3)}</strong>
            </div>
            <input
              type="range" min="0.001" max="0.05" step="0.002"
              value={params.adaptationSpeed}
              onChange={(e) => handleParamChange('adaptationSpeed', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--blue-accent)' }}
            />
          </div>
        </div>

        {/* Batch & Session Actions Box */}
        <div className="neon-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--purple-neon)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            BATCH CYCLES &amp; SESSION STATE
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              BATCH CYCLE COUNT:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[10, 100, 1000, 10000].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setBatchCount(cnt)}
                  className={`cyber-btn ${batchCount === cnt ? 'cyber-btn-primary' : 'cyber-btn-ghost'}`}
                  style={{ flex: 1, padding: '6px 0', fontSize: '0.72rem', justifyContent: 'center' }}
                >
                  {cnt >= 1000 ? `${cnt / 1000}k` : cnt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              MODEL STATE PERSISTENCE:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveJson} className="cyber-btn cyber-btn-ghost" style={{ flex: 1, fontSize: '0.72rem', justifyContent: 'center' }}>
                <Save size={12} /> EXPORT JSON
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="cyber-btn cyber-btn-ghost" style={{ flex: 1, fontSize: '0.72rem', justifyContent: 'center' }}>
                <Upload size={12} /> IMPORT JSON
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadJson} style={{ display: 'none' }} />
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              SNAPSHOT FOR COMPARISON:
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', padding: '6px 10px', border: '1px solid var(--border-cyan)', backgroundColor: 'var(--bg-input)', color: '#ffffff', borderRadius: '6px' }}
              />
              <button onClick={handleSnapshot} className="cyber-btn cyber-btn-secondary" style={{ fontSize: '0.72rem' }}>
                <PlusCircle size={12} /> SNAPSHOT
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
