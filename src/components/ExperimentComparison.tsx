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
import { Activity, Play } from 'lucide-react';
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

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(6, 12, 28, 0.95)',
  border: '1px solid #00f0ff',
  borderRadius: '8px',
  color: '#ffffff',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
};

interface SavedSessionSnapshot {
  id: string;
  label: string;
  timestamp: string;
  state: NeuralSystemState;
}

interface ExperimentComparisonProps {
  savedSessions?: SavedSessionSnapshot[];
}

export function ExperimentComparison({ savedSessions = [] }: ExperimentComparisonProps) {
  const [hasRun, setHasRun] = useState(false);
  const [controlResult, setControlResult] = useState<ComparisonResult | null>(null);
  const [adaptiveResult, setAdaptiveResult] = useState<ComparisonResult | null>(null);

  const runExperiment = () => {
    const baseState = initializeNeuralSystem();
    baseState.seed = Math.floor(Math.random() * 10000);

    const controlState: NeuralSystemState = JSON.parse(JSON.stringify(baseState));
    const adaptiveState: NeuralSystemState = JSON.parse(JSON.stringify(baseState));

    for (let i = 0; i < 10; i++) {
      runTrainingCycle(controlState, 'MEDIUM');
    }

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

    const summarize = (state: NeuralSystemState, switches: number): ComparisonResult => {
      const history = state.trainingHistory;
      const finalLearning = state.learningScore;
      const sumStability = history.reduce((acc, rec) => acc + rec.endState.stability, 0);
      const sumFatigue = history.reduce((acc, rec) => acc + rec.endState.fatigue, 0);
      const sumEfficiency = history.reduce((acc, rec) => acc + rec.efficiency, 0);
      return {
        finalLearning,
        learningGain: finalLearning,
        avgStability: sumStability / (history.length || 1),
        finalRetention: state.retention,
        avgFatigue: sumFatigue / (history.length || 1),
        avgEfficiency: sumEfficiency / (history.length || 1),
        protocolSwitches: switches,
        history,
      };
    };

    setControlResult(summarize(controlState, 0));
    setAdaptiveResult(summarize(adaptiveState, adaptiveSwitches));
    setHasRun(true);
  };

  const chartData = hasRun && controlResult && adaptiveResult
    ? Array.from({ length: 10 }, (_, i) => ({
        cycle: i + 1,
        controlLearning: controlResult.history[i]?.endState.learningScore ?? 0,
        adaptiveLearning: adaptiveResult.history[i]?.endState.learningScore ?? 0,
        controlStability: controlResult.history[i]?.endState.stability ?? 0,
        adaptiveStability: adaptiveResult.history[i]?.endState.stability ?? 0,
      }))
    : [];

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--purple-neon)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
            BENCHMARKING ENGINE
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={22} color="var(--purple-neon)" />
            EXPERIMENT BENCHMARK &amp; COMPARISON
          </h2>
        </div>
        <button onClick={runExperiment} className="cyber-btn cyber-btn-primary">
          <Play size={14} /> RUN BENCHMARK EVALUATION
        </button>
      </div>

      {/* ── Saved Snapshots Summary Bar ──────────────────────────────────── */}
      {savedSessions.length > 0 && (
        <div style={{ marginBottom: '24px', backgroundColor: 'rgba(6, 14, 32, 0.7)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-bright)', marginBottom: '10px' }}>
            SAVED EXPERIMENT SNAPSHOTS ({savedSessions.length}):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {savedSessions.map((snap) => (
              <div key={snap.id} className="neon-card" style={{ padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>{snap.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{snap.timestamp}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cyan-bright)', marginTop: '4px' }}>
                  Score: {snap.state.learningScore.toFixed(1)}% | Ret: {snap.state.retention.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Benchmarking Results ────────────────────────────────────────── */}
      {hasRun && controlResult && adaptiveResult ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div className="neon-card">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '10px' }}>
                CONTROL RUN (FIXED MEDIUM PROTOCOL)
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>
                {controlResult.finalLearning.toFixed(1)}%
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Avg Stability: {controlResult.avgStability.toFixed(1)} | Avg Fatigue: {controlResult.avgFatigue.toFixed(1)}%
              </div>
            </div>

            <div className="neon-card" style={{ borderColor: 'var(--cyan-bright)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '10px' }}>
                ADAPTIVE CONTROLLER RUN (DYNAMIC PROTOCOLS)
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--cyan-bright)' }}>
                {adaptiveResult.finalLearning.toFixed(1)}%
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Avg Stability: {adaptiveResult.avgStability.toFixed(1)} | Avg Fatigue: {adaptiveResult.avgFatigue.toFixed(1)}% | Switches: {adaptiveResult.protocolSwitches}
              </div>
            </div>
          </div>

          <div style={{ height: '360px', backgroundColor: 'rgba(5, 11, 26, 0.9)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.1)" />
                <XAxis dataKey="cycle" stroke="#64748b" fontSize={11} fontFamily="var(--font-mono)" />
                <YAxis stroke="#64748b" fontSize={11} fontFamily="var(--font-mono)" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="controlLearning" name="Control Learning" stroke="#94a3b8" strokeWidth={2} />
                <Line type="monotone" dataKey="adaptiveLearning" name="Adaptive Learning" stroke="#00f0ff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Click "RUN BENCHMARK EVALUATION" to compare fixed vs adaptive protocol outcomes side-by-side.
        </div>
      )}
    </div>
  );
}
