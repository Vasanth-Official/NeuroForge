/**
 * NeuroForge — What-If Lab
 *
 * Interactive "What-If" experiment: modify parameters via sliders,
 * run before/after comparison, see impact on all metrics.
 * Designed for live expo jury interactions.
 */
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Zap, Brain, Shield, Activity, Target, TrendingUp, RefreshCw } from 'lucide-react';
import { runExperiment, DEFAULT_EXPERIMENT_CONFIG, type ExperimentConfig, type ExperimentResult } from '../simulation';

const TT = {
  backgroundColor: 'rgba(6,12,28,0.95)',
  border: '1px solid rgba(0,240,255,0.4)',
  borderRadius: '8px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  color: '#fff',
};

interface SliderParam {
  key: keyof ExperimentConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  color: string;
  icon: React.ReactNode;
  desc: string;
}

const PARAMS: SliderParam[] = [
  { key: 'noiseLevel', label: 'Biological Noise', min: 0, max: 1, step: 0.05, format: v => `${(v * 100).toFixed(0)}%`, color: '#f43f5e', icon: <Activity size={14} />, desc: 'Simulates signal noise and biological variability. Higher noise degrades learning consistency.' },
  { key: 'plasticityFactor', label: 'Plasticity Factor', min: 0, max: 1, step: 0.05, format: v => `${(v * 100).toFixed(0)}%`, color: '#a855f7', icon: <Brain size={14} />, desc: 'Model proxy for synaptic plasticity. Higher values amplify learning gains but also fatigue.' },
  { key: 'taskDifficulty', label: 'Task Difficulty', min: 0, max: 1, step: 0.05, format: v => `${(v * 100).toFixed(0)}%`, color: '#f59e0b', icon: <Target size={14} />, desc: 'Difficulty of the goal-directed benchmark task. Higher difficulty reduces learning efficiency.' },
  { key: 'episodes', label: 'Training Episodes', min: 10, max: 80, step: 5, format: v => `${v}`, color: '#22d3ee', icon: <TrendingUp size={14} />, desc: 'Number of training cycles per experiment run. More episodes → higher learning but more fatigue.' },
  { key: 'restCycles', label: 'Rest Duration', min: 1, max: 15, step: 1, format: v => `${v} cycles`, color: '#10b981', icon: <Shield size={14} />, desc: 'Duration of the rest/recovery phase after training. Longer rest → better retention consolidation.' },
];

function makeBaseConfig(): ExperimentConfig {
  return { ...DEFAULT_EXPERIMENT_CONFIG, episodes: 25 };
}

export function WhatIfLab() {
  const [baseline, setBaseline] = useState<ExperimentConfig>(makeBaseConfig());
  const [modified, setModified] = useState<ExperimentConfig>(makeBaseConfig());
  const [baseResult, setBaseResult] = useState<ExperimentResult | null>(null);
  const [modResult, setModResult] = useState<ExperimentResult | null>(null);
  const [running, setRunning] = useState<'none' | 'both'>('none');
  const [highlightedParam, setHighlightedParam] = useState<string | null>(null);

  const runBoth = () => {
    setRunning('both');
    setTimeout(() => {
      setBaseResult(runExperiment(baseline));
      setModResult(runExperiment(modified));
      setRunning('none');
    }, 80);
  };

  const resetModified = () => setModified({ ...baseline });

  // Build comparison bar data
  const compData = baseResult && modResult ? [
    { metric: 'Learning', before: baseResult.adaptive.finalLearning, after: modResult.adaptive.finalLearning },
    { metric: 'Retention%', before: baseResult.adaptive.rest.retentionPct, after: modResult.adaptive.rest.retentionPct },
    { metric: 'Stability', before: baseResult.adaptive.finalStability, after: modResult.adaptive.finalStability },
    { metric: 'Fatigue', before: baseResult.adaptive.finalFatigue, after: modResult.adaptive.finalFatigue },
    { metric: 'Stim Cost', before: Math.min(100, baseResult.adaptive.totalStimCost), after: Math.min(100, modResult.adaptive.totalStimCost) },
  ] : [];

  const radarData = baseResult && modResult ? [
    { subject: 'Learning', before: baseResult.adaptive.finalLearning, after: modResult.adaptive.finalLearning, fullMark: 100 },
    { subject: 'Retention', before: baseResult.adaptive.rest.retentionPct, after: modResult.adaptive.rest.retentionPct, fullMark: 100 },
    { subject: 'Stability', before: baseResult.adaptive.finalStability, after: modResult.adaptive.finalStability, fullMark: 100 },
    { subject: 'Low Fatigue', before: 100 - baseResult.adaptive.finalFatigue, after: 100 - modResult.adaptive.finalFatigue, fullMark: 100 },
    { subject: 'Efficiency', before: baseResult.adaptive.avgEfficiency, after: modResult.adaptive.avgEfficiency, fullMark: 100 },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '2px' }}>🔬 WHAT-IF LAB</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>INTERACTIVE PARAMETER EXPLORER</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '2px' }}>Change parameters and see how the adaptive controller responds — designed for live demo use</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={runBoth} disabled={running !== 'none'} className="cyber-btn cyber-btn-primary">
              {running !== 'none' ? <><Activity size={14} /> COMPUTING…</> : <><Zap size={14} /> COMPARE</>}
            </button>
            <button onClick={resetModified} className="cyber-btn cyber-btn-ghost"><RefreshCw size={14} /> RESET</button>
          </div>
        </div>
      </div>

      {/* Parameter comparison grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Baseline config */}
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'rgba(100,116,139,0.4)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.12em', marginBottom: '14px' }}>
            ⚖ BASELINE CONFIGURATION
          </div>
          {PARAMS.map(p => (
            <div key={`base-${p.key}`} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#94a3b8' }}>
                  <span style={{ color: '#64748b' }}>{p.icon}</span>{p.label}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                  {p.format((baseline as any)[p.key])}
                </span>
              </div>
              <input type="range" min={p.min} max={p.max} step={p.step}
                value={(baseline as any)[p.key]}
                onChange={e => setBaseline(c => ({ ...c, [p.key]: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: '#64748b' }} />
            </div>
          ))}
        </div>

        {/* Modified config */}
        <div className="glass-panel" style={{ padding: '16px', borderColor: 'rgba(0,240,255,0.4)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '14px' }}>
            ⚡ MODIFIED CONFIGURATION — Adjust sliders then hit COMPARE
          </div>
          {PARAMS.map(p => {
            const baseVal = (baseline as any)[p.key];
            const modVal = (modified as any)[p.key];
            const changed = modVal !== baseVal;
            return (
              <div key={`mod-${p.key}`} style={{ marginBottom: '12px' }}
                onMouseEnter={() => setHighlightedParam(p.key)}
                onMouseLeave={() => setHighlightedParam(null)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: changed ? p.color : 'var(--text-muted)' }}>
                    <span style={{ color: p.color }}>{p.icon}</span>{p.label}
                    {changed && <span style={{ fontSize: '0.6rem', color: p.color }}>MODIFIED</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {changed && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', textDecoration: 'line-through' }}>{p.format(baseVal)}</span>}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: p.color, fontWeight: 700 }}>
                      {p.format(modVal)}
                    </span>
                  </div>
                </div>
                <input type="range" min={p.min} max={p.max} step={p.step}
                  value={modVal}
                  onChange={e => setModified(c => ({ ...c, [p.key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: p.color }} />
                {highlightedParam === p.key && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--text-faint)', marginTop: '3px', lineHeight: 1.4 }}>{p.desc}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Results comparison */}
      {baseResult && modResult ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Bar chart */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '12px' }}>
              BEFORE vs AFTER — ADAPTIVE PROTOCOL — SIMULATED DATA
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={compData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                <XAxis dataKey="metric" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                <Bar dataKey="before" name="Baseline" fill="#64748b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="after" name="Modified" fill="#00f0ff" radius={[3, 3, 0, 0]} isAnimationActive={false} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar chart */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '12px' }}>
              PERFORMANCE PROFILE RADAR — SIMULATED DATA
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(56,189,248,0.12)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Baseline" dataKey="before" stroke="#64748b" fill="#64748b" fillOpacity={0.2} isAnimationActive={false} />
                <Radar name="Modified" dataKey="after" stroke="#00f0ff" fill="#00f0ff" fillOpacity={0.25} isAnimationActive={false} />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Impact summary */}
          <div className="glass-panel" style={{ padding: '14px', gridColumn: '1 / -1' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '10px' }}>IMPACT SUMMARY</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {compData.map(d => {
                const delta = d.after - d.before;
                const pct = d.before > 0 ? ((delta / d.before) * 100) : 0;
                const positive = d.metric === 'Fatigue' || d.metric === 'Stim Cost' ? delta < 0 : delta > 0;
                return (
                  <div key={d.metric} style={{ padding: '10px 14px', background: 'rgba(6,14,32,0.6)', border: `1px solid ${positive ? 'rgba(16,185,129,0.35)' : Math.abs(delta) < 1 ? 'var(--border-subtle)' : 'rgba(244,63,94,0.35)'}`, borderRadius: '8px', minWidth: '120px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{d.metric}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: positive ? '#10b981' : Math.abs(delta) < 1 ? 'var(--text-muted)' : '#f43f5e' }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(0)}% change
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center' }}>
          <Zap size={36} color="var(--text-faint)" style={{ margin: '0 auto 14px', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Adjust the sliders in the right column, then click COMPARE
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '6px' }}>
            The adaptive controller will run against both configurations and show the difference
          </div>
        </div>
      )}
    </div>
  );
}
