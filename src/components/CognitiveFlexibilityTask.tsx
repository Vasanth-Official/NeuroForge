import { useState } from 'react';
import { Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import type { BehavioralInputs } from '../simulation';

interface CognitiveFlexibilityTaskProps {
  onTaskComplete: (inputs: BehavioralInputs) => void;
  difficulty: number;
}

type RuleType = 'MATCH_SHAPE' | 'MATCH_COLOR';

interface CardItem {
  shape: 'CIRCLE' | 'SQUARE' | 'TRIANGLE';
  color: 'RED' | 'BLUE' | 'GREEN';
}

const SHAPE_MAP = { CIRCLE: '●', SQUARE: '■', TRIANGLE: '▲' };
const COLOR_MAP = { RED: '#ef4444', BLUE: '#3b82f6', GREEN: '#22c55e' };

export function CognitiveFlexibilityTask({ onTaskComplete, difficulty }: CognitiveFlexibilityTaskProps) {
  const [isActive, setIsActive] = useState(false);
  const [activeRule, setActiveRule] = useState<RuleType>('MATCH_SHAPE');
  const [targetCard, setTargetCard] = useState<CardItem | null>(null);
  const [choiceCards, setChoiceCards] = useState<CardItem[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; timeMs: number } | null>(null);

  const startTask = () => {
    const rules: RuleType[] = ['MATCH_SHAPE', 'MATCH_COLOR'];
    const selectedRule = rules[Math.floor(Math.random() * rules.length)];
    setActiveRule(selectedRule);

    const target: CardItem = {
      shape: ['CIRCLE', 'SQUARE', 'TRIANGLE'][Math.floor(Math.random() * 3)] as CardItem['shape'],
      color: ['RED', 'BLUE', 'GREEN'][Math.floor(Math.random() * 3)] as CardItem['color'],
    };

    // Option 1 matches shape, Option 2 matches color, Option 3 is distractor
    const choices: CardItem[] = (
      [
        { shape: target.shape, color: target.color === 'RED' ? 'BLUE' : 'RED' },
        { shape: target.shape === 'CIRCLE' ? 'SQUARE' : 'CIRCLE', color: target.color },
        { shape: target.shape === 'TRIANGLE' ? 'SQUARE' : 'TRIANGLE', color: target.color === 'GREEN' ? 'RED' : 'GREEN' },
      ] as CardItem[]
    ).sort(() => Math.random() - 0.5);


    setTargetCard(target);
    setChoiceCards(choices);
    setFeedback(null);
    setIsActive(true);
    setStartTime(Date.now());
  };

  const handleSelectChoice = (card: CardItem) => {
    if (!isActive || !targetCard) return;
    const timeMs = Date.now() - startTime;

    let isCorrect = false;
    if (activeRule === 'MATCH_SHAPE') {
      isCorrect = card.shape === targetCard.shape;
    } else {
      isCorrect = card.color === targetCard.color;
    }

    setIsActive(false);
    setFeedback({ isCorrect, timeMs });

    onTaskComplete({
      accuracy: isCorrect ? 100 : 0,
      errorRate: isCorrect ? 0.0 : 1.0,
      reactionTimeMs: timeMs,
      confidence: isCorrect ? 0.9 : 0.25,
      difficulty,
      taskType: 'COGNITIVE_FLEXIBILITY',
    });
  };

  return (
    <div style={{ backgroundColor: 'var(--paper-card)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-blue)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            MODULE 02 — COGNITIVE FLEXIBILITY &amp; SET SHIFTING
          </div>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--ink-dark)' }}>
            Dynamic Rule Switcher (Stroop Variant)
          </h3>
        </div>
        {!isActive && (
          <button onClick={startTask} className="ctrl-btn ctrl-btn-primary">
            <Play size={13} /> {feedback ? 'NEXT RULE TRIAL' : 'START FLEXIBILITY TRIAL'}
          </button>
        )}
      </div>

      {!targetCard && !feedback && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--ink-muted)', margin: 0 }}>
          Rule switches dynamically between trials (MATCH SHAPE vs MATCH COLOR). Adapt rapidly to task demand changes.
        </p>
      )}

      {targetCard && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {/* Dynamic Rule Banner */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700,
            padding: '6px 16px', borderRadius: '4px', letterSpacing: '0.1em',
            backgroundColor: activeRule === 'MATCH_SHAPE' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(168, 85, 247, 0.12)',
            border: `1px solid ${activeRule === 'MATCH_SHAPE' ? '#3b82f6' : '#a855f7'}`,
            color: activeRule === 'MATCH_SHAPE' ? '#1d4ed8' : '#6b21a8',
          }}>
            <RefreshCw size={13} style={{ display: 'inline', marginRight: '6px' }} />
            ACTIVE RULE: {activeRule === 'MATCH_SHAPE' ? 'MATCH BY SHAPE' : 'MATCH BY COLOR'}
          </div>

          {/* Target Card */}
          <div style={{
            width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.8rem', backgroundColor: 'var(--paper-sheet)', border: '2px solid var(--border-ink)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          }}>
            <span style={{ color: COLOR_MAP[targetCard.color] }}>{SHAPE_MAP[targetCard.shape]}</span>
          </div>

          {/* Choices */}
          {isActive && (
            <div style={{ display: 'flex', gap: '16px' }}>
              {choiceCards.map((card, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectChoice(card)}
                  style={{
                    width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2.4rem', backgroundColor: 'var(--paper-card)', border: '2px solid var(--border-ink)',
                    cursor: 'pointer', transition: 'all 0.1s ease',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                >
                  <span style={{ color: COLOR_MAP[card.color] }}>{SHAPE_MAP[card.shape]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700,
              color: feedback.isCorrect ? 'var(--color-green)' : 'var(--color-red)',
            }}>
              {feedback.isCorrect ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {feedback.isCorrect ? 'Correct! Rule set successfully shifted.' : 'Incorrect choice for active rule.'} &nbsp;|&nbsp; LATENCY: {(feedback.timeMs / 1000).toFixed(2)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
