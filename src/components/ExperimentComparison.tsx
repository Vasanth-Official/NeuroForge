import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity, Play, RotateCcw } from 'lucide-react';
import {
  initializeNeuralSystem,
  runTrainingCycle,
  selectAdaptiveProtocol,
  type NeuralSystemState,
  type CycleRecord,
} from '../simulation';

interface ComparisonResult {
  finalLearning: number;
  learningGain: number;
  avgStability: number;
  finalRetention: number;
  avgFatigue: number;
  avgEfficiency: number;
  protocolSwitches: number;
  history: CycleRecord[];
}

export function ExperimentComparison() {
  const [hasRun, setHasRun] = useState(false);
  const [controlResult, setControlResult] = useState<ComparisonResult | null>(null);
  const [adaptiveResult, setAdaptiveResult] = useState<ComparisonResult | null>(null);

  const runExperiment = () => {
    // Generate a single starting state with a specific random seed to ensure exact parity
    const baseState = initializeNeuralSystem();
    baseState.seed = Math.floor(Math.random() * 10000); // Set common seed

    // Deep clone state (since it's a plain data object, JSON is safe)
    const controlState: NeuralSystemState = JSON.parse(JSON.stringify(baseState));
    const adaptiveState: NeuralSystemState = JSON.parse(JSON.stringify(baseState));

    // Run Control Condition (Fixed MEDIUM protocol)
    for (let i = 0; i < 10; i++) {
      runTrainingCycle(controlState, 'MEDIUM');
    }

    // Run Adaptive Condition (NeuroForge Controller)
    let adaptiveSwitches = 0;
    let lastProtocol = '';
    for (let i = 0; i < 10; i++) {
      const decision = selectAdaptiveProtocol(adaptiveState);
      if (lastProtocol && decision.protocol !== lastProtocol) {
        adaptiveSwitches++;
      }
      lastProtocol = decision.protocol;
      runTrainingCycle(adaptiveState, decision.protocol);
    }

    // Extraction helper
    const summarize = (state: NeuralSystemState, switches: number): ComparisonResult => {
      const history = state.trainingHistory;
      const initialLearning = 0; // initializeNeuralSystem starts at 0
      const finalLearning = state.learningScore;
      
      const sumStability = history.reduce((acc, rec) => acc + rec.endState.stability, 0);
      const sumFatigue = history.reduce((acc, rec) => acc + rec.endState.fatigue, 0);
      const sumEfficiency = history.reduce((acc, rec) => acc + rec.efficiency, 0);

      return {
        finalLearning,
        learningGain: finalLearning - initialLearning,
        avgStability: sumStability / history.length,
        finalRetention: state.retention,
        avgFatigue: sumFatigue / history.length,
        avgEfficiency: sumEfficiency / history.length,
        protocolSwitches: switches,
        history,
      };
    };

    setControlResult(summarize(controlState, 0));
    setAdaptiveResult(summarize(adaptiveState, adaptiveSwitches));
    setHasRun(true);
  };

  const resetExperiment = () => {
    setHasRun(false);
    setControlResult(null);
    setAdaptiveResult(null);
  };

  // Prepare chart data
  const chartData = [];
  if (hasRun && controlResult && adaptiveResult) {
    for (let i = 0; i < 10; i++) {
      chartData.push({
        cycle: i + 1,
        controlLearning: controlResult.history[i].endState.learningScore,
        adaptiveLearning: adaptiveResult.history[i].endState.learningScore,
      });
    }
  }

  return (
    <section className="lab-panel" style={{ border: '2px solid var(--border-ink)' }}>
      <div className="lab-panel-header" style={{ borderBottom: '2px solid var(--border-ink)' }}>
        <h2 className="lab-title" style={{ fontSize: '1.4rem' }}>
          <Activity size={20} color="var(--ink-dark)"/> EXPERIMENT 002: CONTROL VS NEUROFORGE ADAPTIVE
        </h2>
        <span className="fig-caption">N=10 CYCLES / IDENTICAL INITIAL SEED</span>
      </div>

      <div style={{ 
        backgroundColor: '#fffbeb', 
        color: '#b45309', 
        padding: '8px 16px', 
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        marginBottom: '24px',
        border: '1px solid #fde68a',
        letterSpacing: '0.12em'
      }}>
        CLASSIFICATION NOTICE: COMPUTATIONAL SIMULATION — NOT BIOLOGICAL EXPERIMENTAL DATA
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={runExperiment}
          style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 700,
            backgroundColor: 'var(--ink-dark)',
            color: 'var(--paper-sheet)',
            border: '1px solid var(--ink-dark)',
            padding: '10px 24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Play size={16}/> RUN 10-CYCLE COMPARISON
        </button>
        <button 
          onClick={resetExperiment}
          style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            fontWeight: 700,
            backgroundColor: 'transparent',
            color: 'var(--ink-dark)',
            border: '1px solid var(--border-ink)',
            padding: '10px 24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RotateCcw size={16}/> RESET
        </button>
      </div>

      {hasRun && controlResult && adaptiveResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          {/* Comparison Chart */}
          <div style={{ border: '1px solid var(--border-subtle)', padding: '16px', backgroundColor: 'var(--paper-card)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: '1.1rem', textAlign: 'center' }}>
              FIG. 06 — LEARNING TRAJECTORY COMPARISON
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eae4d5" />
                  <XAxis dataKey="cycle" stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                  <YAxis domain={[0, 100]} stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fcfaf4', border: '1px solid #292524', fontFamily: 'var(--font-mono)', fontSize: '12px' }} 
                  />
                  <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="controlLearning" 
                    name="Control (Fixed MEDIUM)" 
                    stroke="#8a8378" 
                    strokeWidth={2} 
                    strokeDasharray="4 4"
                    dot={{ r: 3 }} 
                    isAnimationActive={false} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="adaptiveLearning" 
                    name="NeuroForge (Adaptive)" 
                    stroke="#6b21a8" 
                    strokeWidth={3} 
                    dot={{ r: 4 }} 
                    isAnimationActive={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data Table */}
          <div style={{ border: '1px solid var(--border-subtle)', padding: '16px', backgroundColor: 'var(--paper-card)' }}>
             <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: '1.1rem', textAlign: 'center' }}>
              TABLE I — AGGREGATE PERFORMANCE METRICS
            </h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-ink)' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>METRIC</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#8a8378' }}>CONTROL</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-purple)' }}>NEUROFORGE</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>Final Learning Score</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{controlResult.finalLearning.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{adaptiveResult.finalLearning.toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>Average Stability</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{controlResult.avgStability.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{adaptiveResult.avgStability.toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>Average Fatigue</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{controlResult.avgFatigue.toFixed(2)}%</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{adaptiveResult.avgFatigue.toFixed(2)}%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>Final Retention</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-green)' }}>{controlResult.finalRetention.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-green)' }}>{adaptiveResult.finalRetention.toFixed(2)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>Training Efficiency</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{controlResult.avgEfficiency.toFixed(2)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{adaptiveResult.avgEfficiency.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>Protocol Switches</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>0 (Fixed)</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{adaptiveResult.protocolSwitches}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'var(--paper-sheet)', border: '1px dashed var(--border-dashed)', fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
              <strong>EXPERIMENTAL PARAMETERS:</strong><br/>
              Condition A: Fixed [MEDIUM] Intensity<br/>
              Condition B: Dynamic [LOW/MEDIUM/HIGH] Optimization<br/>
              N = 10 Cycles. State Initialized with Seed: {controlResult.history[0]?.endState.seed || 'RANDOM'}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
