import { useState } from 'react';
import { Play, CheckCircle, AlertCircle } from 'lucide-react';
import type { BehavioralInputs } from '../simulation';

interface PatternRecognitionTaskProps {
  onTaskComplete: (inputs: BehavioralInputs) => void;
  difficulty: number;
}

interface PatternProblem {
  matrix: string[][];
  options: string[];
  correctIndex: number;
  ruleExplanation: string;
}

export function PatternRecognitionTask({ onTaskComplete, difficulty }: PatternRecognitionTaskProps) {
  const [isActive, setIsActive] = useState(false);
  const [problem, setProblem] = useState<PatternProblem | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; timeMs: number } | null>(null);

  // Generate a non-linear spatial matrix problem
  const generateProblem = (): PatternProblem => {
    const symbols = ['◆', '▲', '●', '■', '★', '✚'];
    const idx1 = Math.floor(Math.random() * symbols.length);
    const idx2 = (idx1 + 1) % symbols.length;
    const idx3 = (idx1 + 2) % symbols.length;

    const symA = symbols[idx1];
    const symB = symbols[idx2];
    const symC = symbols[idx3];

    // 3x3 matrix pattern rule (Latin square row shift)
    const matrix = [
      [symA, symB, symC],
      [symB, symC, symA],
      [symC, symB, '?'],
    ];

    const correctAnswer = symA;
    const options = [symA, symB, symC, symbols[(idx1 + 3) % symbols.length]].sort(() => Math.random() - 0.5);
    const correctIndex = options.indexOf(correctAnswer);

    return {
      matrix,
      options,
      correctIndex,
      ruleExplanation: 'Cyclic row-shift pattern symmetry across 3×3 grid.',
    };
  };

  const handleStart = () => {
    const p = generateProblem();
    setProblem(p);
    setFeedback(null);
    setIsActive(true);
    setStartTime(performance.now());
  };

  const handleSelectOption = (chosenIdx: number) => {
    if (!problem || !isActive) return;
    const timeMs = Math.max(120, performance.now() - startTime);
    const isCorrect = chosenIdx === problem.correctIndex;
    setIsActive(false);

    setFeedback({ isCorrect, timeMs });

    const inputs: BehavioralInputs = {
      accuracy: isCorrect ? 100 : 0,
      errorRate: isCorrect ? 0.0 : 1.0,
      reactionTimeMs: timeMs,
      confidence: isCorrect ? 0.95 : 0.2,
      difficulty,
      taskType: 'PATTERN_RECOGNITION',
    };

    onTaskComplete(inputs);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--cyan-bright)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            VISUOSPATIAL PATTERN RECOGNITION
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            RAVEN-TYPE MATRIX REASONING
          </h3>
        </div>
        <button
          onClick={handleStart}
          disabled={isActive}
          className="cyber-btn cyber-btn-primary"
        >
          <Play size={13} /> {isActive ? 'TRIAL IN PROGRESS...' : 'START PATTERN TRIAL'}
        </button>
      </div>

      {!problem && !feedback && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          Evaluate spatial rules across the 3×3 matrix and select the symbol that completes the non-linear sequence.
        </p>
      )}

      {problem && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {/* Matrix Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: '8px', backgroundColor: 'rgba(6, 14, 32, 0.9)', padding: '12px', border: '1px solid var(--border-cyan)', borderRadius: '10px' }}>
            {problem.matrix.map((row, r) =>
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'sans-serif', fontSize: '1.6rem', fontWeight: 'bold',
                    backgroundColor: cell === '?' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                    border: `1px solid ${cell === '?' ? 'var(--amber-neon)' : 'var(--border-subtle)'}`,
                    color: cell === '?' ? 'var(--amber-neon)' : 'var(--cyan-bright)',
                    borderRadius: '6px',
                  }}
                >
                  {cell}
                </div>
              ))
            )}
          </div>

          {/* Options */}
          {isActive && (
            <div style={{ display: 'flex', gap: '12px' }}>
              {problem.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectOption(i)}
                  style={{
                    width: '56px', height: '56px', fontSize: '1.6rem',
                    backgroundColor: 'rgba(10, 20, 42, 0.9)', border: '1px solid var(--cyan-bright)',
                    color: '#ffffff', cursor: 'pointer', fontFamily: 'sans-serif', borderRadius: '8px',
                    boxShadow: '0 0 10px rgba(0, 240, 255, 0.2)', transition: 'all 0.15s ease',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700,
              color: feedback.isCorrect ? 'var(--emerald-neon)' : 'var(--rose-neon)',
            }}>
              {feedback.isCorrect ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {feedback.isCorrect ? 'Correct! Matrix rule identified.' : 'Incorrect pattern choice.'} &nbsp;|&nbsp; LATENCY: {(feedback.timeMs / 1000).toFixed(2)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
