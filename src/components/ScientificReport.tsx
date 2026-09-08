import { Printer, Download, FileText } from 'lucide-react';
import type { NeuralSystemState } from '../simulation';

interface ScientificReportProps {
  systemState: NeuralSystemState;
  sessionLabel?: string;
}

export function ScientificReport({ systemState, sessionLabel = 'NeuroForge Experiment 001' }: ScientificReportProps) {
  const bann = systemState.bannState;
  const history = systemState.bannTelemetryHistory ?? [];
  const cycleCount = history.length > 0 ? history.length : systemState.trainingHistory.length;

  const initialAcc = history[0]?.accuracy ?? (systemState.trainingHistory[0]?.endState?.learningScore ?? 0);
  const finalAcc = history[history.length - 1]?.accuracy ?? systemState.learningScore;

  const initialRet = history[0]?.memoryRetention ?? (systemState.trainingHistory[0]?.endState?.retention ?? 0);
  const finalRet = history[history.length - 1]?.memoryRetention ?? systemState.retention;

  const initialFat = history[0]?.adaptationState ?? (systemState.trainingHistory[0]?.endState?.fatigue ?? 0);
  const finalFat = history[history.length - 1]?.adaptationState ?? systemState.fatigue;

  const handlePrint = () => {
    window.print();
  };

  const handleExportRawText = () => {
    const textReport = `
================================================================================
NEUROFORGE BANN ADAPTIVE SYSTEM REPORT — LABORATORY PROTOCOL NF-2026-01
================================================================================
CLASSIFICATION: COMPUTATIONAL BIO-INSPIRED ADAPTIVE MODEL (PLASTICITY-INSPIRED)
NOTE: THIS SYSTEM DOES NOT SIMULATE BIOLOGICAL BRAIN TISSUES OR HUMAN COGNITION.

SESSION: ${sessionLabel}
CYCLES COMPLETED: ${cycleCount}
TIMESTAMP: ${new Date().toISOString()}

1. HYPERPARAMETER CONFIGURATION
--------------------------------------------------------------------------------
Base Learning Rate (η₀): ${bann?.hyperparams.learningRate ?? 0.05}
Difficulty Level:        ${bann?.hyperparams.difficulty ?? 0.5}
Stimulus Noise (σ):      ${bann?.hyperparams.noiseLevel ?? 0.02}
Memory Decay (δ):        ${bann?.hyperparams.memoryDecay ?? 0.005}
Reward Factor (R):       ${bann?.hyperparams.rewardFactor ?? 1.0}
Homeostasis Speed:       ${bann?.hyperparams.adaptationSpeed ?? 0.01}

2. INITIAL VS FINAL METRICS SUMMARY
--------------------------------------------------------------------------------
Accuracy (%):           Initial: ${initialAcc.toFixed(1)}%  ->  Final: ${finalAcc.toFixed(1)}%  (Δ: ${(finalAcc - initialAcc).toFixed(1)}%)
Memory Retention:        Initial: ${initialRet.toFixed(1)}   ->  Final: ${finalRet.toFixed(1)}   (Δ: ${(finalRet - initialRet).toFixed(1)})
Adaptation / Fatigue:    Initial: ${initialFat.toFixed(1)}%  ->  Final: ${finalFat.toFixed(1)}%  (Δ: ${(finalFat - initialFat).toFixed(1)}%)

3. MODEL STRUCTURE & PLASTICITY
--------------------------------------------------------------------------------
Total Network Neurons:   ${bann?.neurons.length ?? 14}
Total Plastic Synapses:  ${bann?.synapses.length ?? 42}
Mean Network Activation: ${bann?.meanActivation ?? 0.25}
Current Learning Rate:   ${bann?.currentLearningRate.toFixed(4) ?? 0.05}
Total Weight Δ (Last):   ${bann?.totalWeightChange.toFixed(4) ?? 0}

================================================================================
    `;

    const blob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NeuroForge_Scientific_Report_${sessionLabel.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel printable-report" style={{ padding: '28px' }}>
      
      {/* ── Report Action Toolbar (hidden on print) ────────────────────── */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--emerald-neon)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
            PUBLICATION-GRADE LAB REPORT GENERATOR
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="var(--emerald-neon)" />
            NEUROFORGE BANN SESSION REPORT
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handlePrint} className="cyber-btn cyber-btn-primary">
            <Printer size={14} /> PRINT / EXPORT PDF
          </button>
          <button onClick={handleExportRawText} className="cyber-btn cyber-btn-secondary">
            <Download size={14} /> EXPORT TEXT REPORT
          </button>
        </div>
      </div>

      {/* ── Printable Document Body ──────────────────────────────────────── */}
      <div style={{ color: 'var(--text-main)', lineHeight: 1.6 }}>
        
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid var(--border-cyan)', paddingBottom: '14px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--cyan-bright)', textTransform: 'uppercase' }}>
            JOURNAL OF COMPUTATIONAL NEUROSCIENCE &nbsp;|&nbsp; LAB PROTOCOL NF-2026-01
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', margin: '6px 0', fontSize: '1.8rem', fontWeight: 700, color: '#ffffff' }}>
            NEUROFORGE BANN SYSTEM EVALUATION REPORT
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            SESSION IDENTIFIER: <strong style={{ color: 'var(--cyan-bright)' }}>{sessionLabel}</strong> &nbsp;|&nbsp; COMPLETED CYCLES: <strong style={{ color: '#ffffff' }}>{cycleCount}</strong>
          </div>
        </div>

        {/* Classification Disclaimer */}
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--amber-neon)', padding: '10px 14px', borderRadius: '6px', marginBottom: '24px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--amber-neon)', fontWeight: 600 }}>
          CLASSIFICATION NOTICE: COMPUTATIONAL BIO-INSPIRED NEURAL NETWORK MODEL (PLASTICITY-INSPIRED) — DOES NOT REPRODUCE BIOLOGICAL BRAIN TISSUES OR HUMAN COGNITION.
        </div>

        {/* Section 1: Initial vs Final Telemetry */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cyan-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '14px' }}>
            I. INITIAL VS FINAL METRICS PERFORMANCE
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px' }}>METRIC</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>INITIAL CYCLE</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>FINAL CYCLE</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>NET DELTA (Δ)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px' }}>Accuracy Index (%)</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{initialAcc.toFixed(1)}%</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{finalAcc.toFixed(1)}%</td>
                <td style={{ padding: '8px', textAlign: 'right', color: finalAcc >= initialAcc ? 'var(--emerald-neon)' : 'var(--rose-neon)' }}>
                  {finalAcc >= initialAcc ? '+' : ''}{(finalAcc - initialAcc).toFixed(1)}%
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px' }}>Memory Retention Score</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{initialRet.toFixed(1)}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{finalRet.toFixed(1)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: finalRet >= initialRet ? 'var(--emerald-neon)' : 'var(--rose-neon)' }}>
                  {finalRet >= initialRet ? '+' : ''}{(finalRet - initialRet).toFixed(1)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px' }}>Adaptation / Metabolic Fatigue (%)</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{initialFat.toFixed(1)}%</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>{finalFat.toFixed(1)}%</td>
                <td style={{ padding: '8px', textAlign: 'right', color: finalFat <= initialFat ? 'var(--emerald-neon)' : 'var(--amber-neon)' }}>
                  {finalFat >= initialFat ? '+' : ''}{(finalFat - initialFat).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Model State & Hyperparameters */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cyan-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '14px' }}>
            II. MODEL HYPERPARAMETERS &amp; PLASTICITY STATE
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
            <div className="neon-card">
              <strong style={{ color: 'var(--cyan-bright)' }}>HYPERPARAMETERS:</strong>
              <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>• Base Learning Rate (η₀): <span style={{ color: '#fff' }}>{bann?.hyperparams.learningRate ?? 0.05}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Task Difficulty: <span style={{ color: '#fff' }}>{bann?.hyperparams.difficulty ?? 0.5}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Stimulus Noise (σ): <span style={{ color: '#fff' }}>{bann?.hyperparams.noiseLevel ?? 0.02}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Memory Decay (δ): <span style={{ color: '#fff' }}>{bann?.hyperparams.memoryDecay ?? 0.005}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Reward Factor (R): <span style={{ color: '#fff' }}>{bann?.hyperparams.rewardFactor ?? 1.0}</span></div>
            </div>
            <div className="neon-card">
              <strong style={{ color: 'var(--purple-neon)' }}>PLASTICITY METRICS:</strong>
              <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>• Total Network Neurons: <span style={{ color: '#fff' }}>{bann?.neurons.length ?? 14}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Total Plastic Synapses: <span style={{ color: '#fff' }}>{bann?.synapses.length ?? 42}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Mean Activation: <span style={{ color: '#fff' }}>{bann?.meanActivation ?? 0.25}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Current Learning Rate (η): <span style={{ color: '#fff' }}>{bann?.currentLearningRate.toFixed(4) ?? 0.05}</span></div>
              <div style={{ color: 'var(--text-muted)' }}>• Last Weight Change (ΔW): <span style={{ color: '#fff' }}>{bann?.totalWeightChange.toFixed(4) ?? 0}</span></div>
            </div>
          </div>
        </div>

        {/* Section 3: Training History Snapshot Table */}
        {history.length > 0 && (
          <div>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cyan-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '14px' }}>
              III. SAMPLE TRAINING HISTORY TELEMETRY
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px' }}>CYCLE</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>ACCURACY</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>REACTION TIME</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>MEAN ACT.</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>LEARNING RATE</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>RETENTION</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px' }}>Cycle {h.cycle}</td>
                    <td style={{ padding: '6px', textAlign: 'right', color: 'var(--cyan-bright)' }}>{h.accuracy.toFixed(1)}%</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{h.reactionTimeMs.toFixed(0)} ms</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{h.meanActivation.toFixed(3)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{h.learningRate.toFixed(4)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{h.memoryRetention.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
