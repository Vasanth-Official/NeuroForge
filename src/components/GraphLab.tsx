import { useState, useMemo } from 'react';
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
import { BarChart3, CheckSquare, Square } from 'lucide-react';
import type { NeuralSystemState, BannTelemetry } from '../simulation';

interface GraphLabProps {
  systemState: NeuralSystemState;
}

type VariableKey = keyof BannTelemetry;

interface VariableConfig {
  key: VariableKey;
  label: string;
  color: string;
  unit: string;
  domain?: [number, number];
}

const VARIABLES: VariableConfig[] = [
  { key: 'cycle', label: 'Cycle Index', color: '#64748b', unit: '' },
  { key: 'accuracy', label: 'Accuracy (%)', color: '#00f0ff', unit: '%', domain: [0, 100] },
  { key: 'errorRate', label: 'Error Rate', color: '#f43f5e', unit: '' },
  { key: 'reactionTimeMs', label: 'Reaction Time (ms)', color: '#38bdf8', unit: 'ms' },
  { key: 'meanActivation', label: 'Neural Activity', color: '#a855f7', unit: '' },
  { key: 'totalWeightChange', label: 'Weight Change (ΔW)', color: '#f59e0b', unit: '' },
  { key: 'learningRate', label: 'Learning Rate (η)', color: '#10b981', unit: '' },
  { key: 'memoryRetention', label: 'Memory Retention', color: '#14b8a6', unit: '', domain: [0, 100] },
  { key: 'adaptationState', label: 'Adaptation / Fatigue', color: '#f97316', unit: '%', domain: [0, 100] },
  { key: 'difficulty', label: 'Difficulty', color: '#6366f1', unit: '' },
];

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(6, 12, 28, 0.95)',
  border: '1px solid #00f0ff',
  color: '#f8fafc',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  borderRadius: '8px',
  boxShadow: '0 0 15px rgba(0, 240, 255, 0.25)',
};

export function GraphLab({ systemState }: GraphLabProps) {
  const [xAxisKey, setXAxisKey] = useState<VariableKey>('cycle');
  const [selectedYKeys, setSelectedYKeys] = useState<VariableKey[]>(['accuracy', 'totalWeightChange', 'adaptationState']);

  // Extract telemetry data
  const chartData = useMemo(() => {
    if (systemState.bannTelemetryHistory && systemState.bannTelemetryHistory.length > 0) {
      return systemState.bannTelemetryHistory;
    }

    // Fallback telemetry generation if history ran under legacy engine
    return systemState.trainingHistory.map((rec) => ({
      cycle: rec.cycle,
      accuracy: parseFloat(rec.endState.learningScore.toFixed(1)),
      errorRate: parseFloat(((100 - rec.endState.learningScore) / 100).toFixed(3)),
      reactionTimeMs: Math.max(400, 2200 - rec.endState.learningScore * 15),
      meanActivation: parseFloat((rec.endState.synchrony / 100).toFixed(3)),
      totalWeightChange: parseFloat(Math.abs(rec.deltas.learningGain * 0.1).toFixed(4)),
      learningRate: 0.05,
      memoryRetention: parseFloat(rec.endState.retention.toFixed(1)),
      adaptationState: parseFloat(rec.endState.fatigue.toFixed(1)),
      difficulty: 0.5,
    }));
  }, [systemState]);

  const toggleYVariable = (key: VariableKey) => {
    if (selectedYKeys.includes(key)) {
      if (selectedYKeys.length > 1) {
        setSelectedYKeys(selectedYKeys.filter((k) => k !== key));
      }
    } else {
      setSelectedYKeys([...selectedYKeys, key]);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--blue-accent)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
            MULTIDIMENSIONAL TELEMETRY ANALYTICS
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 size={22} color="var(--cyan-bright)" />
            NEUROFORGE GRAPH LAB
          </h2>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          DATASETS: {chartData.length} SAMPLES RECORDED
        </span>
      </div>

      {/* ── Variable Selector Bar ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px', marginBottom: '24px', backgroundColor: 'rgba(6, 14, 32, 0.7)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px' }}>
        
        {/* X-Axis Selector */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-bright)', marginBottom: '8px' }}>
            X-AXIS VARIABLE:
          </div>
          <select
            value={xAxisKey}
            onChange={(e) => setXAxisKey(e.target.value as VariableKey)}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '8px 10px', border: '1px solid var(--border-cyan)', backgroundColor: 'var(--bg-input)', color: '#ffffff', borderRadius: '6px' }}
          >
            {VARIABLES.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Y-Axis Multi-Selector */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-bright)', marginBottom: '8px' }}>
            Y-AXIS VARIABLES (MULTI-SELECT):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {VARIABLES.filter((v) => v.key !== xAxisKey).map((v) => {
              const isChecked = selectedYKeys.includes(v.key);
              return (
                <button
                  key={v.key}
                  onClick={() => toggleYVariable(v.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600,
                    padding: '6px 10px', border: `1px solid ${isChecked ? v.color : 'var(--border-subtle)'}`,
                    backgroundColor: isChecked ? `${v.color}20` : 'transparent',
                    color: isChecked ? v.color : 'var(--text-muted)', cursor: 'pointer', borderRadius: '6px',
                    boxShadow: isChecked ? `0 0 10px ${v.color}30` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isChecked ? <CheckSquare size={13} color={v.color} /> : <Square size={13} />}
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Dynamic Chart View ────────────────────────────────────────────── */}
      <div style={{ height: '400px', backgroundColor: 'rgba(5, 11, 26, 0.9)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px' }}>
        {chartData.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-faint)' }}>
            No telemetry data recorded yet. Execute training trials or run batch simulation cycles.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.1)" />
              <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={11} fontFamily="var(--font-mono)" />
              <YAxis stroke="#64748b" fontSize={11} fontFamily="var(--font-mono)" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }} />
              {selectedYKeys.map((yKey) => {
                const conf = VARIABLES.find((v) => v.key === yKey);
                if (!conf) return null;
                return (
                  <Line
                    key={yKey}
                    type="monotone"
                    dataKey={yKey}
                    name={conf.label}
                    stroke={conf.color}
                    strokeWidth={2}
                    dot={chartData.length <= 50 ? { r: 3, fill: conf.color } : false}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
