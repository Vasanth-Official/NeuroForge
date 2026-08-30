import { useState, useEffect } from 'react';
import type { ControllerDecision, NeuralSystemState, CycleRecord } from '../simulation';
import { Play } from 'lucide-react';

const SYMBOLS = ['●', '▲', '■', '◆'];

type Phase = 'IDLE' | 'PRESENTING' | 'RESPONDING' | 'RESULT';

interface NeuroTaskProps {
  systemState: NeuralSystemState;
  decision: ControllerDecision | null;
  lastRecord: CycleRecord | null;
  onTrialComplete: (accuracy: number, responseTimeMs: number) => void;
  onManualCycle: () => void;
}

export function NeuroTask({ 
  systemState, 
  decision, 
  lastRecord, 
  onTrialComplete,
  onManualCycle
}: NeuroTaskProps) {
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [sequence, setSequence] = useState<string[]>([]);
  const [userResponse, setUserResponse] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [result, setResult] = useState<{ accuracy: number; timeMs: number } | null>(null);

  const trialNumber = (systemState.trainingHistory?.length || 0) + 1;

  const startTrial = () => {
    // Generate difficulty based on learning score (scales sequence length from 3 to 7)
    const length = 3 + Math.floor(systemState.learningScore / 25);
    const newSeq = Array.from({ length }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    setSequence(newSeq);
    setUserResponse([]);
    setResult(null);
    setPhase('PRESENTING');
  };

  useEffect(() => {
    if (phase === 'PRESENTING') {
      const timer = setTimeout(() => {
        setPhase('RESPONDING');
        setStartTime(Date.now());
      }, 2500); // Display stimulus for 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [phase]);

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
      
      // Update simulation state & adaptive controller
      onTrialComplete(accuracy, timeMs);
      setPhase('RESULT');
    }
  };

  return (
    <div style={{ 
      border: '2px solid var(--border-ink)', 
      backgroundColor: 'var(--paper-sheet)', 
      padding: '24px', 
      marginBottom: '24px',
      position: 'relative'
    }}>
      {/* Laboratory Experiment Apparatus Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '2px solid var(--border-ink)', 
        paddingBottom: '12px', 
        marginBottom: '20px' 
      }}>
        <div>
          <div style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.7rem', 
            fontWeight: 700, 
            letterSpacing: '0.12em', 
            color: 'var(--color-orange)',
            textTransform: 'uppercase' 
          }}>
            APPARATUS: TACHISTOSCOPIC VISUAL RECALL
          </div>
          <h2 style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 700 }}>
            NEUROTASK — COGNITIVE TRIAL ENCODING
          </h2>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--ink-dark)' }}>
            TRIAL SEQUENCE #{String(trialNumber).padStart(3, '0')}
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: '0.7rem' }}>
            CONDITION: CLOSED-LOOP ADAPTIVE
          </div>
        </div>
      </div>

      {/* Experimental Stimulus Chamber */}
      <div style={{ 
        height: '160px', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid var(--border-ink)',
        backgroundColor: 'var(--paper-card)',
        marginBottom: '20px',
        position: 'relative',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)'
      }}>
        {/* Phase Indicator Tag */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: phase === 'PRESENTING' ? 'var(--color-orange)' : phase === 'RESPONDING' ? 'var(--color-blue)' : 'var(--ink-muted)',
          backgroundColor: 'var(--paper-sheet)',
          padding: '2px 8px',
          border: '1px solid var(--border-subtle)'
        }}>
          {phase === 'IDLE' && 'STAGE 0: READY FOR STIMULUS INITIATION'}
          {phase === 'PRESENTING' && 'STAGE I: STIMULUS ENCODING (2.5s DISPLAY)'}
          {phase === 'RESPONDING' && 'STAGE II: RECALL PHASE & BEHAVIORAL RESPONSE'}
          {phase === 'RESULT' && 'STAGE III: TRIAL EVALUATION & SYSTEM ADAPTATION'}
        </div>

        {phase === 'IDLE' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--ink-muted)', marginBottom: '14px' }}>
              Initiate controlled visual sequence presentation ({3 + Math.floor(systemState.learningScore / 25)} symbols)
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={startTrial}
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
                  gap: '8px',
                  letterSpacing: '0.05em'
                }}
              >
                <Play size={15}/> INITIATE EXPERIMENTAL TRIAL
              </button>
              <button 
                onClick={onManualCycle} 
                style={{ 
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  backgroundColor: 'transparent',
                  color: 'var(--ink-muted)',
                  border: '1px dashed var(--border-ink)',
                  padding: '8px 14px',
                  cursor: 'pointer'
                }}
              >
                [AUTO CYCLE PASSTHROUGH]
              </button>
            </div>
          </div>
        )}

        {phase === 'PRESENTING' && (
          <div style={{ 
            fontSize: '2.8rem', 
            letterSpacing: '24px', 
            color: 'var(--color-orange)',
            fontFamily: 'sans-serif',
            paddingLeft: '24px'
          }}>
            {sequence.join(' ')}
          </div>
        )}

        {phase === 'RESPONDING' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2.8rem', 
              letterSpacing: '24px', 
              color: 'var(--color-blue)',
              fontFamily: 'sans-serif',
              paddingLeft: '24px',
              minHeight: '60px'
            }}>
              {userResponse.map((s, i) => (
                <span key={i} style={{ display: 'inline-block' }}>{s}</span>
              ))}
              {Array.from({ length: sequence.length - userResponse.length }).map((_, i) => (
                <span key={`empty-${i}`} style={{ opacity: 0.25, color: 'var(--ink-muted)' }}>_</span>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '8px' }}>
              RECONSTRUCT SYMBOL SEQUENCE FROM MEMORY
            </div>
          </div>
        )}

        {phase === 'RESULT' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink-dark)' }}>
              TRIAL EVALUATION COMPLETE
            </div>
            <button 
              onClick={startTrial}
              style={{ 
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                backgroundColor: 'var(--ink-dark)',
                color: 'var(--paper-sheet)',
                border: '1px solid var(--ink-dark)',
                padding: '8px 20px',
                marginTop: '12px',
                cursor: 'pointer'
              }}
            >
              PROCEED TO NEXT TRIAL (#{String(trialNumber + 1).padStart(3, '0')})
            </button>
          </div>
        )}
      </div>

      {/* Behavioral Input Console (During RESPONDING Phase) */}
      {phase === 'RESPONDING' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '16px' }}>
          {SYMBOLS.map((sym) => (
            <button 
              key={sym} 
              onClick={() => handleSymbolClick(sym)}
              style={{ 
                fontSize: '1.8rem', 
                width: '68px', 
                height: '68px',
                backgroundColor: 'var(--paper-sheet)',
                border: '2px solid var(--border-ink)',
                cursor: 'pointer',
                color: 'var(--ink-dark)',
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseDown={(e) => (e.currentTarget.style.backgroundColor = 'var(--paper-accent)')}
              onMouseUp={(e) => (e.currentTarget.style.backgroundColor = 'var(--paper-sheet)')}
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      {/* Trial Results & Adaptive Observation Notebook Entry */}
      {phase === 'RESULT' && result && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1.3fr', 
          gap: '20px', 
          marginTop: '20px',
          borderTop: '1px dashed var(--border-ink)',
          paddingTop: '16px'
        }}>
          {/* Performance Measurements */}
          <div style={{ 
            backgroundColor: 'var(--paper-card)', 
            border: '1px solid var(--border-subtle)', 
            padding: '16px' 
          }}>
            <div style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              letterSpacing: '0.08em', 
              color: 'var(--color-green)',
              marginBottom: '10px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '4px'
            }}>
              OBSERVATION 01: BEHAVIORAL PERFORMANCE
            </div>
            <table style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--ink-muted)', padding: '4px 0' }}>RECONSTRUCTION ACCURACY:</td>
                  <td style={{ fontWeight: 700, textAlign: 'right', color: result.accuracy >= 75 ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {result.accuracy.toFixed(0)}%
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--ink-muted)', padding: '4px 0' }}>LATENCY (RESPONSE TIME):</td>
                  <td style={{ fontWeight: 700, textAlign: 'right' }}>
                    {(result.timeMs / 1000).toFixed(2)}s
                  </td>
                </tr>
                {lastRecord && (
                  <>
                    <tr>
                      <td style={{ color: 'var(--ink-muted)', padding: '4px 0' }}>Δ LEARNING INDEX:</td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: 'var(--color-green)' }}>
                        {lastRecord.deltas.learningGain >= 0 ? '+' : ''}{lastRecord.deltas.learningGain.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--ink-muted)', padding: '4px 0' }}>Δ POPULATION STABILITY:</td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: lastRecord.deltas.stabilityChange >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {lastRecord.deltas.stabilityChange >= 0 ? '+' : ''}{lastRecord.deltas.stabilityChange.toFixed(2)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Controller Reasoning (Formatted as Experimental Notebook Log) */}
          <div style={{ 
            backgroundColor: 'var(--color-purple-bg)', 
            border: '1px solid var(--color-purple)', 
            padding: '16px',
            position: 'relative'
          }}>
            <div style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              letterSpacing: '0.08em', 
              color: 'var(--color-purple)',
              marginBottom: '10px',
              borderBottom: '1px solid rgba(107, 33, 168, 0.2)',
              paddingBottom: '4px'
            }}>
              OBSERVATION 02: ADAPTIVE CONTROLLER SYSTEM LOG
            </div>
            {decision ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>SYSTEM OBSERVATION: </span>
                  <span>{decision.reason}</span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>ADAPTIVE RESPONSE: </span>
                  <span style={{ fontWeight: 700, color: 'var(--color-purple)' }}>
                    PROTOCOL SELECTED → {decision.protocol}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginLeft: '8px' }}>
                    (CONFIDENCE: {(decision.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>PREDICTED OUTCOME: </span>
                  <span style={{ fontStyle: 'italic', color: 'var(--ink-dark)' }}>
                    Gain: {decision.predictedEffect.learningGainLabel} | Stability: {decision.predictedEffect.stabilityImpactLabel} | Fatigue: {decision.predictedEffect.fatigueChangeLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
                NO CONTROLLER DECISION RECORDED FOR INITIAL TRIAL.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
