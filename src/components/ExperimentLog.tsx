/**
 * NeuroForge — Experiment Log
 *
 * Auto-logged list of every experiment run in the current session.
 * Supports view details, duplicate config, JSON/CSV export.
 */
import { useState } from 'react';
import { Database, Download, Trash2, Copy, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { ExperimentLogEntry } from '../simulation';

interface Props {
  entries: ExperimentLogEntry[];
  onDelete: (id: string) => void;
  onDuplicate: (entry: ExperimentLogEntry) => void;
}

const PROTO_COLORS: Record<string, string> = {
  RANDOM: '#ef4444',
  FIXED: '#f59e0b',
  NEUROFORGE_ADAPTIVE: '#00f0ff',
};

const PROTO_LABELS: Record<string, string> = {
  RANDOM: 'Random',
  FIXED: 'Fixed',
  NEUROFORGE_ADAPTIVE: 'Adaptive',
};

function exportJSON(entry: ExperimentLogEntry) {
  const blob = new Blob([JSON.stringify(entry.result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${entry.id}.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(entry: ExperimentLogEntry) {
  const { result } = entry;
  const rows = [
    ['Protocol', 'Learning', 'Retention%', 'Stability', 'Fatigue', 'StimCost', 'Score'],
    ['RANDOM', result.random.finalLearning, result.random.rest.retentionPct, result.random.finalStability, result.random.finalFatigue, result.random.totalStimCost, result.objectiveScores.RANDOM],
    ['FIXED', result.fixed.finalLearning, result.fixed.rest.retentionPct, result.fixed.finalStability, result.fixed.finalFatigue, result.fixed.totalStimCost, result.objectiveScores.FIXED],
    ['NEUROFORGE_ADAPTIVE', result.adaptive.finalLearning, result.adaptive.rest.retentionPct, result.adaptive.finalStability, result.adaptive.finalFatigue, result.adaptive.totalStimCost, result.objectiveScores.NEUROFORGE_ADAPTIVE],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${entry.id}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportReport(entry: ExperimentLogEntry) {
  const { result, config } = entry;
  const best = result.bestProtocol;
  const bestR = best === 'RANDOM' ? result.random : best === 'FIXED' ? result.fixed : result.adaptive;
  const report = `
NEUROFORGE EXPERIMENT REPORT
============================
ID: ${entry.id}
Date: ${new Date(entry.timestamp).toLocaleString()}
Label: ${entry.label}

CONFIGURATION (Simulation Parameters)
--------------------------------------
Episodes: ${config.episodes}
Rest Cycles: ${config.restCycles}
Noise Level: ${(config.noiseLevel * 100).toFixed(0)}%
Plasticity Factor: ${(config.plasticityFactor * 100).toFixed(0)}%
Task Difficulty: ${(config.taskDifficulty * 100).toFixed(0)}%
Random Seed: ${config.seed}

RESULTS (Simulated Data — Model Proxies)
-----------------------------------------
Protocol         | Learning | Retention% | Stability | Fatigue | StimCost | Score
-----------------+----------+------------+-----------+---------+----------+------
Random           | ${result.random.finalLearning.toFixed(1).padStart(8)} | ${result.random.rest.retentionPct.toFixed(1).padStart(10)} | ${result.random.finalStability.toFixed(1).padStart(9)} | ${result.random.finalFatigue.toFixed(1).padStart(7)} | ${result.random.totalStimCost.toFixed(0).padStart(8)} | ${result.objectiveScores.RANDOM.toFixed(1)}
Fixed            | ${result.fixed.finalLearning.toFixed(1).padStart(8)} | ${result.fixed.rest.retentionPct.toFixed(1).padStart(10)} | ${result.fixed.finalStability.toFixed(1).padStart(9)} | ${result.fixed.finalFatigue.toFixed(1).padStart(7)} | ${result.fixed.totalStimCost.toFixed(0).padStart(8)} | ${result.objectiveScores.FIXED.toFixed(1)}
NeuroForge Adapt | ${result.adaptive.finalLearning.toFixed(1).padStart(8)} | ${result.adaptive.rest.retentionPct.toFixed(1).padStart(10)} | ${result.adaptive.finalStability.toFixed(1).padStart(9)} | ${result.adaptive.finalFatigue.toFixed(1).padStart(7)} | ${result.adaptive.totalStimCost.toFixed(0).padStart(8)} | ${result.objectiveScores.NEUROFORGE_ADAPTIVE.toFixed(1)}

BEST PROTOCOL: ${PROTO_LABELS[best]}

INTERPRETATION (In this simulation)
-------------------------------------
${result.bestProtocol === 'NEUROFORGE_ADAPTIVE'
  ? `Adaptive training achieved the best trade-off between learning (${bestR.finalLearning.toFixed(1)}%), retention (${bestR.rest.retentionPct.toFixed(1)}%) and stability (${bestR.finalStability.toFixed(1)}%) in this simulation run.`
  : `The best protocol was ${PROTO_LABELS[best]} with a score of ${result.objectiveScores[best].toFixed(1)}. Results vary with different configurations and seeds.`
}

LIMITATIONS
-----------
- All values are computational model proxies, not biological measurements.
- The simulation does not reproduce actual organoid or biological tissue behavior.
- Results are specific to this parameter configuration and seed.

DISCLAIMER
----------
NeuroForge is a simulation-based research prototype. It does not contain living
biological tissue and does not claim to reproduce consciousness or the full
functionality of a biological brain.
  `.trim();

  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${entry.id}_report.txt`; a.click();
  URL.revokeObjectURL(url);
}

export function ExperimentLog({ entries, onDelete, onDuplicate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '2px' }}>📋 EXPERIMENT LOG</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>SESSION EXPERIMENT RECORDS</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '2px' }}>Every experiment run is auto-logged with full config and results</div>
          </div>
          <div className="glass-panel" style={{ padding: '10px 16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)' }}>TOTAL RUNS</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--cyan-bright)', textAlign: 'center' }}>{entries.length}</div>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Database size={40} color="var(--text-faint)" style={{ margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No experiments run yet</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '6px' }}>Run an experiment in the Experiment Lab to see it logged here</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {entries.slice().reverse().map(entry => {
            const isOpen = expanded === entry.id;
            const best = entry.result.bestProtocol;
            const bestColor = PROTO_COLORS[best];
            return (
              <div key={entry.id} className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: isOpen ? `1px solid ${bestColor}50` : '1px solid var(--border-subtle)' }}>
                {/* Row header */}
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* ID + timestamp */}
                  <div style={{ flex: '0 0 auto' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--cyan-bright)' }}>{entry.id}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)' }}>{new Date(entry.timestamp).toLocaleString()}</div>
                  </div>

                  {/* Config summary */}
                  <div style={{ flex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      `${entry.config.episodes} eps`,
                      `noise ${(entry.config.noiseLevel * 100).toFixed(0)}%`,
                      `plasticity ${(entry.config.plasticityFactor * 100).toFixed(0)}%`,
                    ].map(tag => (
                      <span key={tag} style={{ padding: '2px 8px', background: 'rgba(71,85,105,0.25)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{tag}</span>
                    ))}
                  </div>

                  {/* Best protocol badge */}
                  <div style={{ padding: '4px 10px', background: `${bestColor}18`, border: `1px solid ${bestColor}50`, borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: bestColor, fontWeight: 700 }}>
                    🏆 {PROTO_LABELS[best]}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                    <button onClick={() => exportJSON(entry)} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.68rem', padding: '4px 8px' }} title="Export JSON"><Download size={12} /> JSON</button>
                    <button onClick={() => exportCSV(entry)} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.68rem', padding: '4px 8px' }} title="Export CSV"><Download size={12} /> CSV</button>
                    <button onClick={() => exportReport(entry)} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.68rem', padding: '4px 8px' }} title="Export Report"><FileText size={12} /></button>
                    <button onClick={() => onDuplicate(entry)} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.68rem', padding: '4px 8px' }} title="Duplicate Config"><Copy size={12} /></button>
                    <button onClick={() => onDelete(entry.id)} className="cyber-btn cyber-btn-danger" style={{ fontSize: '0.68rem', padding: '4px 8px' }} title="Delete"><Trash2 size={12} /></button>
                    <button onClick={() => setExpanded(isOpen ? null : entry.id)} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.68rem', padding: '4px 8px' }}>
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
                      {(['RANDOM', 'FIXED', 'NEUROFORGE_ADAPTIVE'] as const).map(p => {
                        const r = p === 'RANDOM' ? entry.result.random : p === 'FIXED' ? entry.result.fixed : entry.result.adaptive;
                        const isBest = entry.result.bestProtocol === p;
                        return (
                          <div key={p} style={{ padding: '12px', background: 'rgba(6,14,32,0.6)', border: `1px solid ${isBest ? PROTO_COLORS[p] : 'var(--border-subtle)'}`, borderRadius: '8px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: PROTO_COLORS[p], marginBottom: '6px' }}>{PROTO_LABELS[p]}{isBest ? ' 🏆' : ''}</div>
                            {[
                              ['Learning', r.finalLearning.toFixed(1) + '%'],
                              ['Retention', r.rest.retentionPct.toFixed(1) + '%'],
                              ['Stability', r.finalStability.toFixed(1) + '%'],
                              ['Fatigue', r.finalFatigue.toFixed(1) + '%'],
                              ['Stim Cost', r.totalStimCost.toFixed(0)],
                            ].map(([l, v]) => (
                              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.67rem', marginBottom: '3px' }}>
                                <span style={{ color: 'var(--text-faint)' }}>{l}</span>
                                <span style={{ color: '#e2e8f0' }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
