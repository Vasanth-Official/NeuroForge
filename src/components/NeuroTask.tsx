import { useState, useEffect } from 'react';
import type { ControllerDecision, NeuralSystemState, CycleRecord } from '../simulation';
import { Play, ChevronRight } from 'lucide-react';

const SYMBOLS = ['●', '▲', '■', '◆'];
const NF_PHASES = ['OBSERVE', 'ASSESS', 'ADAPT', 'TRAIN', 'REASSESS'] as const;

type TrialPhase = 'IDLE' | 'PRESENTING' | 'RESPONDING' | 'RESULT';

interface NeuroTaskProps {
  systemState: NeuralSystemState;
  decision: ControllerDecision | null;
  lastRecord: CycleRecord | null;
  onTrialComplete: (accuracy: number, responseTimeMs: number) => void;
  onManualCycle: () => void;
}

export function NeuroTask({
  systemState, decision, lastRecord, onTrialComplete, onManualCycle
}: NeuroTaskProps) {
  // ── Existing trial state (logic unchanged) ───────────────────────────────
  const [phase, setPhase] = useState<TrialPhase>('IDLE');
  const [sequence, setSequence] = useState<string[]>([]);
  const [userResponse, setUserResponse] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [result, setResult] = useState<{ accuracy: number; timeMs: number } | null>(null);

  // ── NeuroForge response phase animation ──────────────────────────────────
  const [nfPhaseIndex, setNfPhaseIndex] = useState<number>(-1); // -1 = idle

  const trialNumber = (systemState.trainingHistory?.length || 0) + 1;
  const sequenceLength = 3 + Math.floor(systemState.learningScore / 25);

  // Existing start-trial logic
  const startTrial = () => {
    const length = 3 + Math.floor(systemState.learningScore / 25);
    const newSeq = Array.from({ length }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    setSequence(newSeq);
    setUserResponse([]);
    setResult(null);
    setNfPhaseIndex(-1);
    setPhase('PRESENTING');
  };

  // Existing PRESENTING → RESPONDING timer
  useEffect(() => {
    if (phase === 'PRESENTING') {
      const timer = setTimeout(() => {
        setPhase('RESPONDING');
        setStartTime(Date.now());
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Animate NeuroForge response phases after trial result
  useEffect(() => {
    if (phase !== 'RESULT') { setNfPhaseIndex(-1); return; }
    let i = 0;
    const timers: number[] = [];
    const run = () => {
      setNfPhaseIndex(i);
      if (i < NF_PHASES.length - 1) {
        const t = window.setTimeout(() => { i++; run(); }, 550);
        timers.push(t);
      }
    };
    const startT = window.setTimeout(run, 400);
    timers.push(startT);
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  // Existing symbol click handler (logic unchanged)
  const handleSymbolClick = (symbol: string) => {
    if (phase !== 'RESPONDING') return;
    const newResponse = [...userResponse, symbol];
    setUserResponse(newResponse);
    if (newResponse.length === sequence.length) {
      const timeMs = Date.now() - startTime;
      let correct = 0;
      for (let i = 0; i < sequence.length; i++) {
        if (newResponse[i] === sequence[i]) correct++;
      }
      const accuracy = (correct / sequence.length) * 100;
      setResult({ accuracy, timeMs });
      onTrialComplete(accuracy, timeMs);
      setPhase('RESULT');
    }
  };

  return (
    <section className="lab-panel" style={{ marginBottom: '24px' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="lab-panel-header">
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700,
            letterSpacing: '0.14em', color: 'var(--color-orange)', textTransform: 'uppercase',
            marginBottom: '3px',
          }}>
            APPARATUS: TACHISTOSCOPIC VISUAL RECALL — EXPERIMENT NF-001
          </div>
          <h2 className="lab-title" style={{ fontSize: '1.4rem' }}>
            NEUROTASK — INTERACTIVE NEURAL RESPONSE EXPERIMENT
          </h2>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink-dark)' }}>
            TRIAL {String(trialNumber).padStart(3, '0')}
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: '0.68rem', marginTop: '2px' }}>
            SEQUENCE LENGTH: {sequenceLength} SYMBOLS
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: '0.68rem' }}>
            CONDITION: CLOSED-LOOP ADAPTIVE
          </div>
        </div>
      </div>

      {/* ── Phase indicator strip ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '10px',
      }}>
        {(['IDLE', 'PRESENTING', 'RESPONDING', 'RESULT'] as TrialPhase[]).map((p, i) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {i > 0 && (
              <ChevronRight size={12} style={{ color: 'var(--border-dashed)', margin: '0 4px' }} />
            )}
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700,
              letterSpacing: '0.08em', padding: '3px 8px',
              color: phase === p ? 'var(--color-orange)' : 'var(--ink-faint)',
              background: phase === p ? 'var(--color-orange-bg)' : 'transparent',
              border: `1px solid ${phase === p ? 'var(--color-orange)' : 'transparent'}`,
              transition: 'all 0.2s ease',
            }}>
              {p === 'IDLE' ? 'STAGE 0: READY' : p === 'PRESENTING' ? 'STAGE I: ENCODING' : p === 'RESPONDING' ? 'STAGE II: RECALL' : 'STAGE III: RESULT'}
            </div>
          </div>
        ))}
      </div>

      {/* ── Stimulus Chamber ────────────────────────────────────────────────── */}
      <div style={{
        minHeight: '180px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border-ink)', backgroundColor: 'var(--paper-card)',
        marginBottom: '20px', position: 'relative',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)',
      }}>
        {/* Phase label (top-left corner tag) */}
        <div style={{
          position: 'absolute', top: '8px', left: '12px',
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: phase === 'PRESENTING' ? 'var(--color-orange)' : phase === 'RESPONDING' ? 'var(--color-blue)' : 'var(--ink-muted)',
          backgroundColor: 'var(--paper-sheet)', padding: '2px 8px',
          border: '1px solid var(--border-subtle)',
        }}>
          {phase === 'IDLE'      && 'AWAITING INITIATION'}
          {phase === 'PRESENTING' && '⬛ STIMULUS ENCODING — MEMORISE SEQUENCE'}
          {phase === 'RESPONDING' && '◉ RECALL PHASE — RECONSTRUCT FROM MEMORY'}
          {phase === 'RESULT'    && '✓ TRIAL EVALUATED — ADAPTIVE RESPONSE LOGGED'}
        </div>

        {/* IDLE */}
        {phase === 'IDLE' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{
              fontFamily: 'var(--font-serif)', fontSize: '1.05rem',
              color: 'var(--ink-muted)', marginBottom: '18px', lineHeight: '1.5',
            }}>
              A sequence of {sequenceLength} symbols will be displayed for 2.5 seconds.
              <br />Memorise the order, then reconstruct it from memory.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={startTrial} className="ctrl-btn ctrl-btn-primary">
                <Play size={14} /> INITIATE TRIAL {String(trialNumber).padStart(3, '0')}
              </button>
              <button onClick={onManualCycle} className="ctrl-btn ctrl-btn-ghost">
                [AUTO CYCLE — NO TASK]
              </button>
            </div>
          </div>
        )}

        {/* PRESENTING — show stimulus */}
        {phase === 'PRESENTING' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.12em',
              color: 'var(--ink-faint)', marginBottom: '12px', textTransform: 'uppercase',
            }}>
              STIMULUS SEQUENCE — MEMORISE ORDER
            </div>
            <div style={{
              fontSize: '3rem', letterSpacing: '28px', color: 'var(--color-orange)',
              fontFamily: 'sans-serif', paddingLeft: '28px', lineHeight: 1,
            }}>
              {sequence.join(' ')}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-faint)',
              marginTop: '12px', letterSpacing: '0.08em',
            }}>
              DISPLAY DURATION: 2.5 SECONDS
            </div>
          </div>
        )}

        {/* RESPONDING — response input */}
        {phase === 'RESPONDING' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.12em',
              color: 'var(--color-blue)', marginBottom: '12px', textTransform: 'uppercase',
            }}>
              RECALL PHASE — SELECT SYMBOLS IN ORDER
            </div>
            <div style={{
              fontSize: '3rem', letterSpacing: '28px', color: 'var(--color-blue)',
              fontFamily: 'sans-serif', paddingLeft: '28px', minHeight: '68px', lineHeight: 1,
            }}>
              {userResponse.map((s, i) => (
                <span key={i} style={{ display: 'inline-block' }}>{s}</span>
              ))}
              {Array.from({ length: sequence.length - userResponse.length }).map((_, i) => (
                <span key={`empty-${i}`} style={{ opacity: 0.2, color: 'var(--ink-muted)' }}>_</span>
              ))}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--ink-faint)',
              marginTop: '8px',
            }}>
              {userResponse.length} / {sequence.length} SYMBOLS ENTERED
            </div>
          </div>
        )}

        {/* RESULT */}
        {phase === 'RESULT' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--color-green)', letterSpacing: '0.1em', marginBottom: '10px',
            }}>
              ✓ TRIAL {String(trialNumber - 1).padStart(3, '0')} EVALUATION COMPLETE
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700,
              color: result.accuracy >= 75 ? 'var(--color-green)' : 'var(--color-red)', lineHeight: 1,
            }}>
              {result.accuracy.toFixed(0)}%
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
              RECONSTRUCTION ACCURACY
            </div>
            <button onClick={startTrial} className="ctrl-btn ctrl-btn-primary" style={{ marginTop: '14px' }}>
              PROCEED TO TRIAL {String(trialNumber).padStart(3, '0')} →
            </button>
          </div>
        )}
      </div>

      {/* ── Symbol Input (RESPONDING phase) ────────────────────────────────── */}
      {phase === 'RESPONDING' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => handleSymbolClick(sym)}
              style={{
                fontSize: '1.9rem', width: '72px', height: '72px',
                backgroundColor: 'var(--paper-sheet)',
                border: '2px solid var(--border-ink)',
                cursor: 'pointer', color: 'var(--ink-dark)',
                transition: 'all 0.1s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'sans-serif',
              }}
              onMouseDown={(e) => (e.currentTarget.style.backgroundColor = 'var(--paper-accent)')}
              onMouseUp={(e) => (e.currentTarget.style.backgroundColor = 'var(--paper-sheet)')}
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      {/* ── Trial Result Details ────────────────────────────────────────────── */}
      {phase === 'RESULT' && result && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px',
          borderTop: '1px dashed var(--border-ink)', paddingTop: '18px',
        }}>
          {/* Performance measurements */}
          <div style={{
            backgroundColor: 'var(--paper-card)', border: '1px solid var(--border-subtle)', padding: '16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.08em', color: 'var(--color-green)',
              borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '10px',
            }}>
              OBSERVATION 01 — BEHAVIORAL PERFORMANCE
            </div>
            <table style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--ink-muted)', padding: '5px 0' }}>RECONSTRUCTION ACCURACY</td>
                  <td style={{ fontWeight: 700, textAlign: 'right', color: result.accuracy >= 75 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {result.accuracy.toFixed(0)}%
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--ink-muted)', padding: '5px 0' }}>LATENCY (RESPONSE TIME)</td>
                  <td style={{ fontWeight: 700, textAlign: 'right' }}>{(result.timeMs / 1000).toFixed(2)} s</td>
                </tr>
                {lastRecord && (
                  <>
                    <tr>
                      <td style={{ color: 'var(--ink-muted)', padding: '5px 0' }}>Δ LEARNING INDEX</td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: 'var(--color-green)' }}>
                        {lastRecord.deltas.learningGain >= 0 ? '+' : ''}{lastRecord.deltas.learningGain.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--ink-muted)', padding: '5px 0' }}>Δ STABILITY</td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: lastRecord.deltas.stabilityChange >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {lastRecord.deltas.stabilityChange >= 0 ? '+' : ''}{lastRecord.deltas.stabilityChange.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--ink-muted)', padding: '5px 0' }}>Δ FATIGUE</td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: lastRecord.deltas.fatigueChange > 0 ? 'var(--color-orange)' : 'var(--color-green)' }}>
                        {lastRecord.deltas.fatigueChange >= 0 ? '+' : ''}{lastRecord.deltas.fatigueChange.toFixed(2)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* NeuroForge adaptive response */}
          <div style={{
            backgroundColor: 'var(--color-purple-bg)', border: '1px solid var(--color-purple)', padding: '16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.08em', color: 'var(--color-purple)',
              borderBottom: '1px solid rgba(107,33,168,0.2)', paddingBottom: '6px', marginBottom: '12px',
            }}>
              OBSERVATION 02 — NEUROFORGE ADAPTIVE RESPONSE
            </div>

            {/* Phase animation sequence */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--ink-faint)', marginBottom: '6px', letterSpacing: '0.08em' }}>
                SYSTEM CYCLE PHASES:
              </div>
              <div className="nf-response-sequence">
                {NF_PHASES.map((ph, i) => (
                  <div key={ph} style={{ display: 'flex', alignItems: 'center' }}>
                    {i > 0 && <span className="nf-phase-arrow">›</span>}
                    <span className={`nf-phase-chip ${nfPhaseIndex === i ? 'nf-active' : nfPhaseIndex > i ? 'nf-done' : ''}`}>
                      {ph}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Controller decision */}
            {decision ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>PROTOCOL SELECTED → </span>
                  <span style={{ fontWeight: 700, color: 'var(--color-purple)' }}>{decision.protocol}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginLeft: '8px' }}>
                    (CONFIDENCE: {(decision.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-dark)', fontStyle: 'italic' }}>
                  Gain: {decision.predictedEffect.learningGainLabel} · Stability: {decision.predictedEffect.stabilityImpactLabel} · Fatigue: {decision.predictedEffect.fatigueChangeLabel}
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-faint)' }}>
                Initial trial — no prior adaptive decision recorded.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
