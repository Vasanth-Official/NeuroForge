/**
 * NeuroForge — Experiment Lab
 *
 * The primary experimental workstation. Runs RANDOM vs FIXED vs
 * NEUROFORGE_ADAPTIVE in parallel and displays all metrics live.
 *
 * All chart data comes from the simulation — no hardcoded values.
 */
import { useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
} from 'recharts';
import {
  Play, RotateCcw, Activity, Download, FlaskConical,
} from 'lucide-react';
import {
  runExperiment, runBenchmark,
  classifyBiologicalState, biologicalStateColor,
  DEFAULT_EXPERIMENT_CONFIG,
  type ExperimentConfig, type ExperimentResult, type BenchmarkResult,
  type ExperimentLogEntry, type ComparisonProtocol,
} from '../simulation';
import type { NeuralSystemState } from '../simulation';

const TT = {
  backgroundColor: 'rgba(6,12,28,0.95)',
  border: '1px solid rgba(0,240,255,0.4)',
  borderRadius: '8px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  color: '#fff',
};

const PROTO_COLORS: Record<string, string> = {
  RANDOM: '#ef4444',
  FIXED: '#f59e0b',
  NEUROFORGE_ADAPTIVE: '#00f0ff',
};
const PROTO_LABELS: Record<string, string> = {
  RANDOM: 'Random',
  FIXED: 'Fixed',
  NEUROFORGE_ADAPTIVE: 'NeuroForge Adaptive',
};

interface Props {
  systemState: NeuralSystemState;
  onLogEntry?: (e: ExperimentLogEntry) => void;
}

type AnalyticsTab = 'learning' | 'activity' | 'retention' | 'fatigue' | 'stability' | 'comparison';

export function ExperimentLab({ systemState, onLogEntry }: Props) {
  const [config, setConfig] = useState<ExperimentConfig>({ ...DEFAULT_EXPERIMENT_CONFIG });
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [running, setRunning] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchProgress, setBenchProgress] = useState(0);
  const [benchTrials, setBenchTrials] = useState(10);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('learning');
  const [selectedProtocols, setSelectedProtocols] = useState<Set<ComparisonProtocol>>(
    new Set(['RANDOM', 'FIXED', 'NEUROFORGE_ADAPTIVE'])
  );

  const runRef = useRef(false);

  const bioState = classifyBiologicalState(systemState);
  const stateColor = biologicalStateColor(bioState);

  const runExp = useCallback(() => {
    setRunning(true);
    runRef.current = true;
    setTimeout(() => {
      const res = runExperiment(config);
      setResult(res);
      setRunning(false);
      onLogEntry?.({
        id: res.id,
        label: `Experiment ${new Date().toLocaleTimeString()}`,
        timestamp: res.timestamp,
        config,
        result: res,
      });
    }, 80); // allow UI to update before synchronous compute
  }, [config, onLogEntry]);

  const runBench = useCallback(() => {
    setBenchRunning(true);
    setBenchProgress(0);
    setTimeout(() => {
      const b = runBenchmark(config, benchTrials, (done, total) => {
        setBenchProgress(Math.round((done / total) * 100));
      });
      setBenchmark(b);
      setBenchRunning(false);
    }, 80);
  }, [config, benchTrials]);

  const exportJSON = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${result.id}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  // Build comparison chart data from merged episode histories
  const compChartData = result ? (() => {
    const maxLen = Math.max(
      result.random.history.length,
      result.fixed.history.length,
      result.adaptive.history.length,
    );
    return Array.from({ length: maxLen }, (_, i) => ({
      episode: i + 1,
      RANDOM: result.random.history[i]?.learning ?? null,
      FIXED: result.fixed.history[i]?.learning ?? null,
      NEUROFORGE_ADAPTIVE: result.adaptive.history[i]?.learning ?? null,
    }));
  })() : [];

  const fatigueChartData = result ? (() => {
    const maxLen = Math.max(result.random.history.length, result.fixed.history.length, result.adaptive.history.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      episode: i + 1,
      RANDOM: result.random.history[i]?.fatigue ?? null,
      FIXED: result.fixed.history[i]?.fatigue ?? null,
      NEUROFORGE_ADAPTIVE: result.adaptive.history[i]?.fatigue ?? null,
    }));
  })() : [];

  const stabilityChartData = result ? (() => {
    const maxLen = Math.max(result.random.history.length, result.fixed.history.length, result.adaptive.history.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      episode: i + 1,
      RANDOM: result.random.history[i]?.stability ?? null,
      FIXED: result.fixed.history[i]?.stability ?? null,
      NEUROFORGE_ADAPTIVE: result.adaptive.history[i]?.stability ?? null,
    }));
  })() : [];

  const retentionCompare = result ? [
    { name: 'Pre-Rest', RANDOM: result.random.rest.preRestLearning, FIXED: result.fixed.rest.preRestLearning, NEUROFORGE_ADAPTIVE: result.adaptive.rest.preRestLearning },
    { name: 'Post-Rest', RANDOM: result.random.rest.postRestLearning, FIXED: result.fixed.rest.postRestLearning, NEUROFORGE_ADAPTIVE: result.adaptive.rest.postRestLearning },
    { name: 'Retention%', RANDOM: result.random.rest.retentionPct, FIXED: result.fixed.rest.retentionPct, NEUROFORGE_ADAPTIVE: result.adaptive.rest.retentionPct },
  ] : [];

  const PROTO_KEYS: ComparisonProtocol[] = ['RANDOM', 'FIXED', 'NEUROFORGE_ADAPTIVE'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '2px' }}>⚗ EXPERIMENT LAB</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>
              ADAPTIVE vs BASELINE PROTOCOL COMPARISON
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '2px' }}>
              SIMULATION PROXY — All values are model outputs, not biological measurements
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="glass-panel" style={{ padding: '8px 12px', borderColor: `${stateColor}60` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-faint)' }}>LIVE STATE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, color: stateColor }}>{bioState}</div>
            </div>
            {result && (
              <button onClick={exportJSON} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.7rem' }}>
                <Download size={13} /> EXPORT JSON
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main grid: Config + Results */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* LEFT — Config Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '12px' }}>
              🧬 MODEL PARAMETERS <span style={{ color: 'var(--text-faint)', fontSize: '0.58rem' }}>(Simulation Parameters)</span>
            </div>
            {[
              { key: 'episodes', label: 'Episodes', min: 5, max: 100, step: 5 },
              { key: 'restCycles', label: 'Rest Cycles', min: 1, max: 20, step: 1 },
              { key: 'noiseLevel', label: 'Noise Level', min: 0, max: 1, step: 0.05, pct: true },
              { key: 'plasticityFactor', label: 'Plasticity', min: 0, max: 1, step: 0.05, pct: true },
              { key: 'taskDifficulty', label: 'Task Difficulty', min: 0, max: 1, step: 0.05, pct: true },
            ].map(({ key, label, min, max, step, pct }) => (
              <div key={key} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>{label}</span>
                  <span style={{ color: 'var(--cyan-bright)' }}>
                    {pct ? `${((config as any)[key] * 100).toFixed(0)}%` : (config as any)[key]}
                  </span>
                </div>
                <input
                  type="range" min={min} max={max} step={step}
                  value={(config as any)[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: 'var(--cyan-bright)' }}
                  disabled={running}
                />
              </div>
            ))}
          </div>

          {/* Protocol selector */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '10px' }}>VISIBLE PROTOCOLS</div>
            {PROTO_KEYS.map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedProtocols.has(p)}
                  onChange={() => setSelectedProtocols(sp => {
                    const next = new Set(sp);
                    next.has(p) ? next.delete(p) : next.add(p);
                    return next;
                  })}
                  style={{ accentColor: PROTO_COLORS[p] }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: PROTO_COLORS[p] }}>{PROTO_LABELS[p]}</span>
              </label>
            ))}
          </div>

          {/* Action buttons */}
          <button onClick={runExp} disabled={running} className="cyber-btn cyber-btn-primary" style={{ width: '100%' }}>
            {running ? <><Activity size={14} /> RUNNING…</> : <><Play size={14} /> RUN EXPERIMENT</>}
          </button>
          <button onClick={resetConfig} className="cyber-btn cyber-btn-ghost" style={{ width: '100%' }}>
            <RotateCcw size={14} /> RESET CONFIG
          </button>

          {/* Benchmark section */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '10px' }}>
              📊 MULTI-TRIAL BENCHMARK
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {[10, 50, 100].map(n => (
                <button key={n} onClick={() => setBenchTrials(n)} className={`cyber-btn cyber-btn-ghost`} style={{ fontSize: '0.7rem', padding: '4px 10px', border: benchTrials === n ? '1px solid var(--cyan-bright)' : undefined, color: benchTrials === n ? 'var(--cyan-bright)' : undefined }}>
                  {n}×
                </button>
              ))}
            </div>
            {benchRunning && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Progress: {benchProgress}%</div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${benchProgress}%`, background: 'var(--cyan-bright)', borderRadius: '2px', transition: 'width 0.1s' }} />
                </div>
              </div>
            )}
            <button onClick={runBench} disabled={benchRunning || running} className="cyber-btn cyber-btn-secondary" style={{ width: '100%', fontSize: '0.75rem' }}>
              <FlaskConical size={13} /> RUN {benchTrials}× BENCHMARK
            </button>
          </div>
        </div>

        {/* RIGHT — Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!result ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <FlaskConical size={40} color="var(--text-faint)" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure parameters and click RUN EXPERIMENT</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '6px' }}>All three protocols (RANDOM, FIXED, ADAPTIVE) will run in parallel</div>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {(['RANDOM', 'FIXED', 'NEUROFORGE_ADAPTIVE'] as const).map(p => {
                  const r = p === 'RANDOM' ? result.random : p === 'FIXED' ? result.fixed : result.adaptive;
                  const isBest = result.bestProtocol === p;
                  return (
                    <div key={p} className="glass-panel" style={{ padding: '14px', border: `1px solid ${isBest ? PROTO_COLORS[p] : 'var(--border-subtle)'}`, boxShadow: isBest ? `0 0 16px ${PROTO_COLORS[p]}30` : 'none' }}>
                      {isBest && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: PROTO_COLORS[p], marginBottom: '4px' }}>🏆 BEST OVERALL</div>}
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, color: PROTO_COLORS[p], marginBottom: '8px' }}>{PROTO_LABELS[p]}</div>
                      {[
                        { l: 'Learning', v: r.finalLearning },
                        { l: 'Retention', v: r.rest.retentionPct },
                        { l: 'Stability', v: r.finalStability },
                        { l: 'Fatigue', v: r.finalFatigue },
                        { l: 'Stim Cost', v: r.totalStimCost, noPercent: true },
                      ].map(m => (
                        <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.67rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{m.l}</span>
                          <span style={{ color: '#e2e8f0' }}>{m.v.toFixed(1)}{m.noPercent ? '' : '%'}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: '8px', padding: '4px 8px', background: `${PROTO_COLORS[p]}15`, borderRadius: '4px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: PROTO_COLORS[p] }}>
                        Score: {result.objectiveScores[p].toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Analytics tabs */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  {(['learning', 'activity', 'retention', 'fatigue', 'stability', 'comparison'] as AnalyticsTab[]).map(t => (
                    <button key={t} onClick={() => setAnalyticsTab(t)} className={`nav-tab-btn ${analyticsTab === t ? 'active' : ''}`} style={{ fontSize: '0.67rem', padding: '5px 10px' }}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                {analyticsTab === 'learning' && (
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '10px' }}>
                      LEARNING SCORE vs EPISODE — SIMULATED DATA
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={compChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                        <XAxis dataKey="episode" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                        {PROTO_KEYS.filter(p => selectedProtocols.has(p)).map(p => (
                          <Line key={p} type="monotone" dataKey={p} name={PROTO_LABELS[p]} stroke={PROTO_COLORS[p]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}

                {analyticsTab === 'activity' && (
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '10px' }}>
                      STIMULATION COST (CUMULATIVE) — SIMULATED DATA
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={compChartData.map((d, i) => ({
                        episode: d.episode,
                        RANDOM: result!.random.history[i]?.stimCost ?? null,
                        FIXED: result!.fixed.history[i]?.stimCost ?? null,
                        NEUROFORGE_ADAPTIVE: result!.adaptive.history[i]?.stimCost ?? null,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                        <XAxis dataKey="episode" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <YAxis stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                        {PROTO_KEYS.filter(p => selectedProtocols.has(p)).map(p => (
                          <Area key={p} type="monotone" dataKey={p} name={PROTO_LABELS[p]} stroke={PROTO_COLORS[p]} fill={`${PROTO_COLORS[p]}18`} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}

                {analyticsTab === 'retention' && (
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '10px' }}>
                      RETENTION ANALYSIS — PRE-REST vs POST-REST — SIMULATED DATA
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={retentionCompare}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                        <XAxis dataKey="name" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                        {PROTO_KEYS.filter(p => selectedProtocols.has(p)).map(p => (
                          <Bar key={p} dataKey={p} name={PROTO_LABELS[p]} fill={PROTO_COLORS[p]} isAnimationActive={false} radius={[4, 4, 0, 0]} fillOpacity={0.75} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}

                {analyticsTab === 'fatigue' && (
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--rose-neon)', marginBottom: '10px' }}>
                      FATIGUE ACCUMULATION vs EPISODE — SIMULATED DATA
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={fatigueChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                        <XAxis dataKey="episode" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                        {PROTO_KEYS.filter(p => selectedProtocols.has(p)).map(p => (
                          <Line key={p} type="monotone" dataKey={p} name={PROTO_LABELS[p]} stroke={PROTO_COLORS[p]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}

                {analyticsTab === 'stability' && (
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--emerald-neon)', marginBottom: '10px' }}>
                      NETWORK STABILITY vs EPISODE — SIMULATED DATA
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={stabilityChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                        <XAxis dataKey="episode" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                        {PROTO_KEYS.filter(p => selectedProtocols.has(p)).map(p => (
                          <Line key={p} type="monotone" dataKey={p} name={PROTO_LABELS[p]} stroke={PROTO_COLORS[p]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}

                {analyticsTab === 'comparison' && result && (
                  <>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '12px' }}>
                      PROTOCOL COMPARISON TABLE — SIMULATED DATA
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                        <thead>
                          <tr>
                            {['Protocol', 'Learning', 'Peak', 'Retention%', 'Stability', 'Fatigue', 'Stim Cost', 'Score'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(['RANDOM', 'FIXED', 'NEUROFORGE_ADAPTIVE'] as const).map(p => {
                            const r = p === 'RANDOM' ? result.random : p === 'FIXED' ? result.fixed : result.adaptive;
                            const isBest = result.bestProtocol === p;
                            return (
                              <tr key={p} style={{ background: isBest ? `${PROTO_COLORS[p]}0a` : 'transparent' }}>
                                <td style={{ padding: '8px 12px', color: PROTO_COLORS[p], fontWeight: 700 }}>{PROTO_LABELS[p]}{isBest ? ' 🏆' : ''}</td>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{r.finalLearning.toFixed(1)}%</td>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{r.peakLearning.toFixed(1)}%</td>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{r.rest.retentionPct.toFixed(1)}%</td>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{r.finalStability.toFixed(1)}%</td>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{r.finalFatigue.toFixed(1)}%</td>
                                <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>{r.totalStimCost.toFixed(0)}</td>
                                <td style={{ padding: '8px 12px', color: PROTO_COLORS[p], fontWeight: 700 }}>{result.objectiveScores[p].toFixed(1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0,240,255,0.05)', border: '1px solid var(--border-cyan)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--cyan-bright)' }}>IN THIS SIMULATION: </strong>
                      {result.bestProtocol === 'NEUROFORGE_ADAPTIVE'
                        ? `Adaptive training achieved higher retention while using lower stimulation cost. Score: ${result.objectiveScores.NEUROFORGE_ADAPTIVE.toFixed(1)}.`
                        : `Best overall protocol: ${PROTO_LABELS[result.bestProtocol]} (Score: ${result.objectiveScores[result.bestProtocol].toFixed(1)}). Results vary with configuration.`}
                    </div>
                  </>
                )}
              </div>

              {/* Benchmark results */}
              {benchmark && (
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', marginBottom: '12px' }}>
                    MULTI-TRIAL BENCHMARK — {benchmark.trials} TRIALS — MEAN ± SD — SIMULATED DATA
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                      <thead>
                        <tr>
                          {['Protocol', 'Learning (mean±sd)', 'Retention (mean±sd)', 'Stability (mean±sd)', 'Fatigue (mean±sd)', 'Best %'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PROTO_KEYS.map(p => (
                          <tr key={p}>
                            <td style={{ padding: '7px 10px', color: PROTO_COLORS[p], fontWeight: 700 }}>{PROTO_LABELS[p]}</td>
                            <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{benchmark.learning[p].mean.toFixed(1)} ± {benchmark.learning[p].sd.toFixed(1)}</td>
                            <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{benchmark.retention[p].mean.toFixed(1)} ± {benchmark.retention[p].sd.toFixed(1)}</td>
                            <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{benchmark.stability[p].mean.toFixed(1)} ± {benchmark.stability[p].sd.toFixed(1)}</td>
                            <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{benchmark.fatigue[p].mean.toFixed(1)} ± {benchmark.fatigue[p].sd.toFixed(1)}</td>
                            <td style={{ padding: '7px 10px', color: PROTO_COLORS[p] }}>{((benchmark.bestProtocolFrequency[p] / benchmark.trials) * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  function resetConfig() {
    setConfig({ ...DEFAULT_EXPERIMENT_CONFIG });
    setResult(null);
    setBenchmark(null);
  }
}
