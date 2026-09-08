/**
 * NeuroForge — Human-in-the-Loop Lab
 *
 * Interactive Geometry-Dash-inspired cognitive task that captures REAL human
 * behavioral data and feeds it simultaneously to:
 *   A) AI Baseline (slow adapter, window-based)
 *   B) NeuroForge BANN (fast adapter, plasticity-driven)
 *
 * PRIMARY USP:
 * "We don't just measure whether a model is correct.
 *  We measure how quickly it adapts when the environment changes."
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis,
} from 'recharts';
import {
  Play, Pause, RotateCcw, Zap, AlertTriangle, Trophy, Activity,
  Brain, Cpu, Clock, Target, TrendingUp, Download,
  ChevronRight, Eye,
} from 'lucide-react';
import {
  AIBaselineModel,
  NeuroforgeBannModel,
  computeBehavioralSimilarity,
  generateSessionId,
  getRuleSet,
  type BehavioralEvent,
  type ModelMetrics,
  type GamePhase,
  type StimulusColor,
  type RequiredAction,
  type RuleSet,
} from '../simulation/humanBehaviorEngine';
import type { NeuralSystemState } from '../simulation';

// ── Canvas game constants ────────────────────────────────────────────────────
const CW = 700;   // canvas width
const CH = 220;   // canvas height
const GROUND_Y = 160;
const PLAYER_X = 90;
const PLAYER_W = 32;
const PLAYER_H = 32;
const GRAVITY = 0.55;
const JUMP_FORCE = -12.5;
const OBS_SPEED_BASE = 4.5;
const ACTION_ZONE_X = PLAYER_X + PLAYER_W + 80; // where obstacle triggers decision window
const DECISION_WINDOW_MS = 600; // ms to respond after stimulus appears in zone

interface Obstacle {
  id: string;
  x: number;
  width: number;
  height: number;
  color: StimulusColor;
  stimulusShownAt: number | null;
  responded: boolean;
  correctAction: RequiredAction;
  result: 'HIT' | 'CORRECT' | 'MISSED' | null;
}

interface PlayerState {
  y: number;
  vy: number;
  grounded: boolean;
}

// ── Chart tooltip style ──────────────────────────────────────────────────────
const TT = {
  backgroundColor: 'rgba(6, 12, 28, 0.95)',
  border: '1px solid rgba(0, 240, 255, 0.4)',
  borderRadius: '8px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '11px',
  color: '#ffffff',
};

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  systemState: NeuralSystemState;
}

// ── Component ────────────────────────────────────────────────────────────────
export function HumanInTheLoopLab({ systemState }: Props) {
  // Session state
  const [sessionId] = useState(() => generateSessionId());
  const [phase, setPhase] = useState<GamePhase>('IDLE');
  const [ruleSet, setRuleSet] = useState<RuleSet>('ORIGINAL');
  const [round, setRound] = useState(1);
  const [difficulty, setDifficulty] = useState(0.5);
  const [events, setEvents] = useState<BehavioralEvent[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showRuleChangeFlash, setShowRuleChangeFlash] = useState(false);

  // Live session metrics
  const [liveMetrics, setLiveMetrics] = useState({
    accuracy: 0,
    avgReactionTime: 0,
    totalTrials: 0,
    totalErrors: 0,
    currentStreak: 0,
  });

  // Model comparison state
  const [aiMetrics, setAiMetrics] = useState<ModelMetrics>({
    modelId: 'AI_BASELINE',
    accuracy: 0, avgLatencyMs: 0, errorRate: 0,
    adaptationCycles: 0, recoveryTimeMs: 0, convergenceScore: 0,
    predictions: [], postChangeAccHistory: [],
  });
  const [bannMetrics, setBannMetrics] = useState<ModelMetrics>({
    modelId: 'NEUROFORGE_BANN',
    accuracy: 0, avgLatencyMs: 0, errorRate: 0,
    adaptationCycles: 0, recoveryTimeMs: 0, convergenceScore: 0,
    predictions: [], postChangeAccHistory: [],
  });

  // Models (refs so game loop can access them without stale closures)
  const aiModelRef = useRef(new AIBaselineModel());
  const bannModelRef = useRef(new NeuroforgeBannModel());

  // Canvas / game refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const gameRunning = useRef(false);
  const phaseRef = useRef<GamePhase>('IDLE');
  const ruleSetRef = useRef<RuleSet>('ORIGINAL');
  const roundRef = useRef(1);
  const difficultyRef = useRef(0.5);
  const sessionStartRef = useRef(0);
  const eventsRef = useRef<BehavioralEvent[]>([]);
  const eventIdxRef = useRef(0);

  // Game state refs (avoid stale closures in rAF loop)
  const playerRef = useRef<PlayerState>({ y: GROUND_Y - PLAYER_H, vy: 0, grounded: true });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastSpawnRef = useRef(0);
  const spawnIntervalRef = useRef(1800);
  const pendingObsRef = useRef<Obstacle | null>(null); // obstacle in decision window
  const decisionWindowStartRef = useRef<number | null>(null);
  const jumpPressedRef = useRef(false);
  const scoreRef = useRef({ correct: 0, total: 0, streak: 0, errors: 0 });
  const reactionTimesRef = useRef<number[]>([]);

  // Chart data
  const [chartData, setChartData] = useState<{ trial: number; human: number; ai: number; bann: number; }[]>([]);
  const [adaptData, setAdaptData] = useState<{ cycle: number; ai: number; bann: number; }[]>([]);

  // ── Game helpers ──────────────────────────────────────────────────────────
  const spawnInterval = useCallback(() => {
    const d = difficultyRef.current;
    return Math.max(900, 2200 - d * 1200 + (Math.random() - 0.5) * 300);
  }, []);

  const pickStimulusColor = useCallback((): StimulusColor => {
    return Math.random() < 0.55 ? 'BLUE' : 'GREEN';
  }, []);

  const getCorrectAction = useCallback((color: StimulusColor, rs: RuleSet): RequiredAction => {
    return getRuleSet(rs)[color];
  }, []);

  // ── Jump handler ──────────────────────────────────────────────────────────
  const handleJump = useCallback(() => {
    if (!gameRunning.current) return;
    const player = playerRef.current;
    if (player.grounded) {
      player.vy = JUMP_FORCE;
      player.grounded = false;
      jumpPressedRef.current = true;
    }
  }, []);

  // ── Record a behavioral event + feed to models ────────────────────────────
  const recordEvent = useCallback((
    obs: Obstacle,
    actionTaken: RequiredAction | 'NONE',
    reactionMs: number,
  ) => {
    const correct = actionTaken !== 'NONE' && actionTaken === obs.correctAction
      || (actionTaken === 'NONE' && obs.correctAction === 'STAY');
    const isError = !correct;
    const now = Date.now() - sessionStartRef.current;
    const rs = ruleSetRef.current;
    const r = roundRef.current;

    const event: BehavioralEvent = {
      id: `evt_${eventIdxRef.current++}`,
      timestamp: now,
      stimulus: obs.color,
      requiredAction: obs.correctAction,
      actionTaken: actionTaken === 'NONE' ? 'STAY' : actionTaken,
      correct,
      reactionTimeMs: reactionMs,
      decisionTimeMs: reactionMs,
      isError,
      ruleSet: rs,
      round: r,
      difficulty: difficultyRef.current,
      isAdaptationEvent: rs === 'CHANGED',
    };

    eventsRef.current = [...eventsRef.current, event];

    // Feed to models
    const aiPred = aiModelRef.current.predict(obs.color, eventsRef.current.length);
    const bannPred = bannModelRef.current.predict(obs.color, eventsRef.current.length);
    aiModelRef.current.update(aiPred, event);
    bannModelRef.current.update(bannPred, event);

    // Update scores
    const s = scoreRef.current;
    s.total++;
    if (correct) { s.correct++; s.streak++; } else { s.errors++; s.streak = 0; }
    reactionTimesRef.current.push(reactionMs);

    // Update state
    const newEvents = eventsRef.current;
    setEvents([...newEvents]);
    setLiveMetrics({
      accuracy: s.total > 0 ? (s.correct / s.total) * 100 : 0,
      avgReactionTime: reactionTimesRef.current.reduce((a, b) => a + b, 0) / reactionTimesRef.current.length,
      totalTrials: s.total,
      totalErrors: s.errors,
      currentStreak: s.streak,
    });

    const newAi = aiModelRef.current.getMetrics();
    const newBann = bannModelRef.current.getMetrics();
    setAiMetrics(newAi);
    setBannMetrics(newBann);

    // Update chart data
    const trialNum = s.total;
    const humanAcc = (s.correct / s.total) * 100;
    setChartData(prev => [...prev.slice(-40), {
      trial: trialNum,
      human: +humanAcc.toFixed(1),
      ai: +newAi.accuracy.toFixed(1),
      bann: +newBann.accuracy.toFixed(1),
    }]);

    if (rs === 'CHANGED') {
      const aiPCA = newAi.postChangeAccHistory;
      const bannPCA = newBann.postChangeAccHistory;
      const cycle = Math.max(aiPCA.length, bannPCA.length);
      setAdaptData(prev => [...prev.slice(-20), {
        cycle,
        ai: +(aiPCA[aiPCA.length - 1] ?? 0).toFixed(1),
        bann: +(bannPCA[bannPCA.length - 1] ?? 0).toFixed(1),
      }]);
    }

    // Auto-complete after 30 trials per round
    if (rs === 'ORIGINAL' && s.total >= 20) {
      // Prompt rule change after round 1
    }
    if (rs === 'CHANGED' && newEvents.filter(e => e.ruleSet === 'CHANGED').length >= 20) {
      endSession();
    }
  }, []);

  // ── Main game loop ────────────────────────────────────────────────────────
  const gameLoop = useCallback((timestamp: number) => {
    if (!gameRunning.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const obstacles = obstaclesRef.current;
    const speed = OBS_SPEED_BASE * (1 + difficultyRef.current * 0.6);

    // ── Physics ──────────────────────────────────────────────────────────
    if (!player.grounded) {
      player.vy += GRAVITY;
      player.y += player.vy;
      if (player.y >= GROUND_Y - PLAYER_H) {
        player.y = GROUND_Y - PLAYER_H;
        player.vy = 0;
        player.grounded = true;
      }
    }

    // ── Spawn obstacles ───────────────────────────────────────────────────
    if (timestamp - lastSpawnRef.current > spawnIntervalRef.current) {
      lastSpawnRef.current = timestamp;
      spawnIntervalRef.current = spawnInterval();
      const color = pickStimulusColor();
      const rs = ruleSetRef.current;
      const newObs: Obstacle = {
        id: `obs_${Date.now()}`,
        x: CW + 20,
        width: 30 + difficultyRef.current * 20,
        height: 50 + difficultyRef.current * 20,
        color,
        stimulusShownAt: null,
        responded: false,
        correctAction: getCorrectAction(color, rs),
        result: null,
      };
      obstaclesRef.current = [...obstacles, newObs];
    }

    // ── Move obstacles ────────────────────────────────────────────────────
    const updated: Obstacle[] = [];
    for (const obs of obstaclesRef.current) {
      obs.x -= speed;

      // Enter decision window
      if (!obs.responded && obs.x < ACTION_ZONE_X && obs.stimulusShownAt === null) {
        obs.stimulusShownAt = timestamp;
        pendingObsRef.current = obs;
        decisionWindowStartRef.current = timestamp;
        jumpPressedRef.current = false;
      }

      // Decision window active
      if (pendingObsRef.current?.id === obs.id && obs.stimulusShownAt !== null) {
        const elapsed = timestamp - obs.stimulusShownAt;
        if (jumpPressedRef.current && !obs.responded) {
          obs.responded = true;
          pendingObsRef.current = null;
          const rt = Math.min(elapsed, DECISION_WINDOW_MS);
          obs.result = obs.correctAction === 'JUMP' ? 'CORRECT' : 'HIT';
          recordEvent(obs, 'JUMP', rt);
          jumpPressedRef.current = false;
        } else if (elapsed > DECISION_WINDOW_MS && !obs.responded) {
          obs.responded = true;
          pendingObsRef.current = null;
          obs.result = obs.correctAction === 'STAY' ? 'CORRECT' : 'MISSED';
          recordEvent(obs, 'NONE', DECISION_WINDOW_MS);
        }
      }

      // Keep obstacles until off-screen
      if (obs.x > -60) updated.push(obs);
    }
    obstaclesRef.current = updated;

    // ── Draw ──────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, CW, CH);

    // Background
    ctx.fillStyle = 'rgba(3, 7, 18, 0.95)';
    ctx.fillRect(0, 0, CW, CH);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CW; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
    }
    for (let y = 0; y < CH; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
    }

    // Ground
    const grad = ctx.createLinearGradient(0, GROUND_Y, 0, CH);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.02)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CW, GROUND_Y); ctx.stroke();

    // Decision zone indicator
    if (pendingObsRef.current) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.05)';
      ctx.fillRect(PLAYER_X - 10, 0, 150, CH);
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PLAYER_X - 10, 0);
      ctx.lineTo(PLAYER_X - 10, CH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw player
    const px = PLAYER_X;
    const py = player.y;
    // Glow
    const pglow = ctx.createRadialGradient(px + PLAYER_W / 2, py + PLAYER_H / 2, 2, px + PLAYER_W / 2, py + PLAYER_H / 2, 30);
    pglow.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
    pglow.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = pglow;
    ctx.fillRect(px - 10, py - 10, PLAYER_W + 20, PLAYER_H + 20);
    // Body
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, PLAYER_W, PLAYER_H, 6);
    ctx.fill();
    ctx.stroke();
    // Eye
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.arc(px + PLAYER_W * 0.7, py + PLAYER_H * 0.35, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw obstacles
    for (const obs of obstaclesRef.current) {
      const oy = GROUND_Y - obs.height;
      const isInWindow = obs.stimulusShownAt !== null && !obs.responded;

      // Obstacle color
      const baseColor = obs.color === 'BLUE' ? '#3b82f6' : '#10b981';

      if (isInWindow) {
        // Pulse glow for active stimulus
        const pulse = 0.5 + 0.5 * Math.sin(timestamp / 80);
        const oglow = ctx.createRadialGradient(obs.x + obs.width / 2, GROUND_Y, 0, obs.x + obs.width / 2, GROUND_Y, 60);
        oglow.addColorStop(0, obs.color === 'BLUE' ? `rgba(59,130,246,${0.3 * pulse})` : `rgba(16,185,129,${0.3 * pulse})`);
        oglow.addColorStop(1, 'transparent');
        ctx.fillStyle = oglow;
        ctx.fillRect(obs.x - 30, oy - 30, obs.width + 60, obs.height + 60);
      }

      // Body
      ctx.fillStyle = obs.result === 'HIT' ? '#ef4444' : obs.result === 'CORRECT' ? '#a3e635' : baseColor;
      ctx.strokeStyle = isInWindow ? '#ffffff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = isInWindow ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(obs.x, oy, obs.width, obs.height, 4);
      ctx.fill();
      ctx.stroke();

      // Color label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 9px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(obs.color, obs.x + obs.width / 2, oy - 6);

      // Required action label (when in decision window)
      if (isInWindow) {
        const rs = ruleSetRef.current;
        const req = getRuleSet(rs)[obs.color];
        ctx.fillStyle = req === 'JUMP' ? '#fbbf24' : '#a78bfa';
        ctx.font = `bold 10px "JetBrains Mono", monospace`;
        ctx.fillText(req === 'JUMP' ? '↑ JUMP' : '• STAY', obs.x + obs.width / 2, oy - 18);
      }
    }

    // HUD overlay (score)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.font = `700 12px "JetBrains Mono", monospace`;
    const s = scoreRef.current;
    ctx.fillText(`SCORE: ${s.correct}/${s.total}`, 10, 20);
    ctx.fillText(`ROUND ${roundRef.current} — ${ruleSetRef.current === 'ORIGINAL' ? 'ORIGINAL RULES' : '⚠ RULES CHANGED!'}`, 10, 36);

    // Rule reminder (top right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.font = `700 11px "JetBrains Mono", monospace`;
    const rs = ruleSetRef.current;
    ctx.fillText(`BLUE=${getRuleSet(rs).BLUE}  GREEN=${getRuleSet(rs).GREEN}`, CW - 10, 20);

    rafRef.current = requestAnimationFrame(gameLoop);
  }, [spawnInterval, pickStimulusColor, getCorrectAction, recordEvent]);

  // ── Session controls ──────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    // Reset all
    aiModelRef.current = new AIBaselineModel();
    bannModelRef.current = new NeuroforgeBannModel();
    eventsRef.current = [];
    eventIdxRef.current = 0;
    playerRef.current = { y: GROUND_Y - PLAYER_H, vy: 0, grounded: true };
    obstaclesRef.current = [];
    pendingObsRef.current = null;
    lastSpawnRef.current = 0;
    jumpPressedRef.current = false;
    scoreRef.current = { correct: 0, total: 0, streak: 0, errors: 0 };
    reactionTimesRef.current = [];
    sessionStartRef.current = Date.now();

    setEvents([]);
    setChartData([]);
    setAdaptData([]);
    setLiveMetrics({ accuracy: 0, avgReactionTime: 0, totalTrials: 0, totalErrors: 0, currentStreak: 0 });
    setAiMetrics({ modelId: 'AI_BASELINE', accuracy: 0, avgLatencyMs: 0, errorRate: 0, adaptationCycles: 0, recoveryTimeMs: 0, convergenceScore: 0, predictions: [], postChangeAccHistory: [] });
    setBannMetrics({ modelId: 'NEUROFORGE_BANN', accuracy: 0, avgLatencyMs: 0, errorRate: 0, adaptationCycles: 0, recoveryTimeMs: 0, convergenceScore: 0, predictions: [], postChangeAccHistory: [] });

    phaseRef.current = 'ROUND_1';
    ruleSetRef.current = 'ORIGINAL';
    roundRef.current = 1;
    difficultyRef.current = difficulty;
    setPhase('ROUND_1');
    setRuleSet('ORIGINAL');
    setRound(1);
    gameRunning.current = true;
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [difficulty, gameLoop]);

  const pauseSession = useCallback(() => {
    if (phase === 'IDLE' || phase === 'COMPLETE') return;
    if (gameRunning.current) {
      gameRunning.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPhase(p => p === 'ROUND_1' ? 'ROUND_1' : p);
    } else {
      gameRunning.current = true;
      rafRef.current = requestAnimationFrame(gameLoop);
    }
  }, [phase, gameLoop]);

  const resetSession = useCallback(() => {
    gameRunning.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    phaseRef.current = 'IDLE';
    ruleSetRef.current = 'ORIGINAL';
    roundRef.current = 1;
    obstaclesRef.current = [];
    playerRef.current = { y: GROUND_Y - PLAYER_H, vy: 0, grounded: true };
    scoreRef.current = { correct: 0, total: 0, streak: 0, errors: 0 };
    reactionTimesRef.current = [];
    eventsRef.current = [];
    setPhase('IDLE');
    setRound(1);
    setRuleSet('ORIGINAL');
    setEvents([]);
    setChartData([]);
    setAdaptData([]);
    setShowRuleChangeFlash(false);
    setLiveMetrics({ accuracy: 0, avgReactionTime: 0, totalTrials: 0, totalErrors: 0, currentStreak: 0 });
    // Clear canvas
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = 'rgba(3,7,18,0.95)'; ctx.fillRect(0, 0, CW, CH); }
  }, []);

  const triggerRuleChange = useCallback(() => {
    if (phaseRef.current !== 'ROUND_1') return;
    phaseRef.current = 'ROUND_2';
    ruleSetRef.current = 'CHANGED';
    roundRef.current = 2;
    setPhase('ROUND_2');
    setRuleSet('CHANGED');
    setRound(2);
    setShowRuleChangeFlash(true);
    setTimeout(() => setShowRuleChangeFlash(false), 3000);
  }, []);

  const endSession = useCallback(() => {
    gameRunning.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    phaseRef.current = 'COMPLETE';
    setPhase('COMPLETE');
  }, []);

  // ── Keyboard / touch events ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleJump]);

  useEffect(() => {
    return () => {
      gameRunning.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Behavioral similarity ─────────────────────────────────────────────────
  const aiSim = computeBehavioralSimilarity(events, aiMetrics);
  const bannSim = computeBehavioralSimilarity(events, bannMetrics);

  // ── Radar data ────────────────────────────────────────────────────────────
  const radarData = [
    { metric: 'Accuracy', AI: aiMetrics.accuracy, BANN: bannMetrics.accuracy },
    { metric: 'Latency', AI: Math.max(0, 100 - aiMetrics.avgLatencyMs * 2), BANN: Math.max(0, 100 - bannMetrics.avgLatencyMs * 2) },
    { metric: 'Adaptation', AI: Math.max(0, 100 - aiMetrics.adaptationCycles * 5), BANN: Math.max(0, 100 - bannMetrics.adaptationCycles * 5) },
    { metric: 'Recovery', AI: Math.max(0, 100 - aiMetrics.recoveryTimeMs / 100), BANN: Math.max(0, 100 - bannMetrics.recoveryTimeMs / 100) },
    { metric: 'Convergence', AI: aiMetrics.convergenceScore, BANN: bannMetrics.convergenceScore },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  const isRunning = phase === 'ROUND_1' || phase === 'ROUND_2';
  const round1Events = events.filter(e => e.ruleSet === 'ORIGINAL');
  const round2Events = events.filter(e => e.ruleSet === 'CHANGED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header ── */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '3px' }}>
              🧠 HUMAN-IN-THE-LOOP LAB
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #00f0ff, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              FROM HUMAN BEHAVIOR TO ADAPTIVE INTELLIGENCE
            </h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Session: <span style={{ color: 'var(--cyan-bright)' }}>{sessionId}</span>
              &nbsp;|&nbsp; Round {round} &nbsp;|&nbsp;
              <span style={{ color: ruleSet === 'CHANGED' ? 'var(--rose-neon)' : 'var(--emerald-neon)' }}>
                {ruleSet === 'ORIGINAL' ? 'ORIGINAL RULES' : '⚠ RULES CHANGED'}
              </span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '380px', textAlign: 'right', lineHeight: 1.5 }}>
            <span style={{ color: 'var(--cyan-bright)', fontWeight: 700 }}>PRIMARY USP: </span>
            "We don't just measure whether a model is correct —
            we measure how quickly it adapts when the environment changes."
          </div>
        </div>
      </div>

      {/* ── Rule Change Flash ── */}
      {showRuleChangeFlash && (
        <div style={{ padding: '16px 24px', background: 'rgba(244, 63, 94, 0.15)', border: '2px solid var(--rose-neon)', borderRadius: '12px', textAlign: 'center', animation: 'pulse 0.5s ease-in-out', boxShadow: '0 0 30px rgba(244, 63, 94, 0.3)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 900, color: 'var(--rose-neon)', letterSpacing: '0.1em' }}>
            ⚠ RULE CHANGE TRIGGERED
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#ffffff', marginTop: '6px' }}>
            BLUE now means STAY &nbsp;|&nbsp; GREEN now means JUMP
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Watch how quickly each model re-adapts!
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'rgba(6,14,32,0.6)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
        {phase === 'IDLE' || phase === 'COMPLETE' ? (
          <button onClick={startSession} className="cyber-btn cyber-btn-primary">
            <Play size={14} /> START SESSION
          </button>
        ) : (
          <button onClick={pauseSession} className="cyber-btn cyber-btn-secondary">
            {gameRunning.current ? <><Pause size={14} /> PAUSE</> : <><Play size={14} /> RESUME</>}
          </button>
        )}
        <button onClick={resetSession} className="cyber-btn cyber-btn-ghost">
          <RotateCcw size={14} /> RESET SESSION
        </button>
        {phase === 'ROUND_1' && (
          <button onClick={triggerRuleChange} className="cyber-btn cyber-btn-danger">
            <AlertTriangle size={14} /> TRIGGER RULE CHANGE
          </button>
        )}
        {isRunning && (
          <button onClick={endSession} className="cyber-btn cyber-btn-ghost">
            <Trophy size={14} /> END SESSION
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            DIFFICULTY
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={difficulty}
              onChange={e => { const v = parseFloat(e.target.value); setDifficulty(v); difficultyRef.current = v; }}
              style={{ width: '100px', accentColor: 'var(--cyan-bright)' }}
              disabled={isRunning}
            />
            <span style={{ color: 'var(--cyan-bright)', minWidth: '28px' }}>{(difficulty * 100).toFixed(0)}%</span>
          </label>
          <button onClick={() => setShowReport(r => !r)} className="cyber-btn cyber-btn-ghost" style={{ fontSize: '0.7rem' }}>
            <Download size={13} /> {showReport ? 'HIDE REPORT' : 'BENCHMARK REPORT'}
          </button>
        </div>
      </div>

      {/* ── Main Row: Game + Live Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', alignItems: 'start' }}>

        {/* Canvas Game */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>🎮 COGNITIVE TASK — OBSTACLE REACTION LAB</span>
            <span style={{ color: 'var(--text-muted)' }}>SPACE / CLICK = JUMP</span>
          </div>
          <canvas
            ref={canvasRef}
            width={CW} height={CH}
            style={{ width: '100%', maxWidth: `${CW}px`, height: `${CH}px`, borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-cyan)', display: 'block' }}
            onClick={handleJump}
            onTouchStart={e => { e.preventDefault(); handleJump(); }}
          />
          {phase === 'IDLE' && (
            <div style={{ textAlign: 'center', marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click START SESSION above to begin. Use <strong style={{ color: 'var(--cyan-bright)' }}>SPACE</strong> or <strong style={{ color: 'var(--cyan-bright)' }}>CLICK</strong> on the canvas to jump.<br/>
              <span style={{ color: 'var(--amber-neon)' }}>BLUE = {getRuleSet(ruleSet).BLUE}</span> &nbsp;|&nbsp; <span style={{ color: 'var(--emerald-neon)' }}>GREEN = {getRuleSet(ruleSet).GREEN}</span>
            </div>
          )}
          {phase === 'COMPLETE' && (
            <div style={{ textAlign: 'center', marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--cyan-bright)', fontWeight: 700 }}>
              ✅ SESSION COMPLETE — {liveMetrics.totalTrials} trials recorded. Check the Benchmark Report below!
            </div>
          )}

          {/* Rule Guide */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
            <div style={{ padding: '8px 16px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#60a5fa', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', marginBottom: '2px' }}>BLUE OBSTACLE</div>
              <strong style={{ color: ruleSet === 'ORIGINAL' ? 'var(--cyan-bright)' : 'var(--rose-neon)' }}>
                → {getRuleSet(ruleSet).BLUE}
              </strong>
            </div>
            <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#34d399', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', marginBottom: '2px' }}>GREEN OBSTACLE</div>
              <strong style={{ color: ruleSet === 'ORIGINAL' ? 'var(--emerald-neon)' : 'var(--amber-neon)' }}>
                → {getRuleSet(ruleSet).GREEN}
              </strong>
            </div>
          </div>
        </div>

        {/* Live Metrics Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { label: 'ACCURACY', value: `${liveMetrics.accuracy.toFixed(1)}%`, icon: <Target size={16} />, color: 'var(--cyan-bright)' },
            { label: 'AVG REACTION TIME', value: `${liveMetrics.avgReactionTime.toFixed(0)} ms`, icon: <Clock size={16} />, color: 'var(--amber-neon)' },
            { label: 'TOTAL TRIALS', value: liveMetrics.totalTrials, icon: <Activity size={16} />, color: 'var(--blue-accent)' },
            { label: 'ERRORS', value: liveMetrics.totalErrors, icon: <AlertTriangle size={16} />, color: 'var(--rose-neon)' },
            { label: 'CURRENT STREAK', value: liveMetrics.currentStreak, icon: <Zap size={16} />, color: 'var(--purple-neon)' },
            { label: 'ROUND 1 TRIALS', value: round1Events.length, icon: <Eye size={16} />, color: 'var(--emerald-neon)' },
            { label: 'ROUND 2 TRIALS', value: round2Events.length, icon: <TrendingUp size={16} />, color: 'var(--rose-neon)' },
          ].map(m => (
            <div key={m.label} className="glass-panel" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: m.color, opacity: 0.7 }}>{m.icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Human → Model Pipeline Diagram ── */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '12px' }}>
          LIVE HUMAN → MODEL PIPELINE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'HUMAN ACTION', sub: `${liveMetrics.totalTrials} events`, color: '#00f0ff', icon: '👤' },
            { label: 'BEHAVIORAL DATA', sub: `RT: ${liveMetrics.avgReactionTime.toFixed(0)}ms`, color: '#38bdf8', icon: '📊' },
            { label: 'NEURAL STATE', sub: `Stability: ${systemState.stability.toFixed(0)}%`, color: '#a855f7', icon: '🧠' },
            { label: 'PREDICTION', sub: `AI: ${aiMetrics.accuracy.toFixed(0)}% | NF: ${bannMetrics.accuracy.toFixed(0)}%`, color: '#f59e0b', icon: '🎯' },
            { label: 'ERROR SIGNAL', sub: `AI: ${(aiMetrics.errorRate * 100).toFixed(0)}% | NF: ${(bannMetrics.errorRate * 100).toFixed(0)}%`, color: '#f43f5e', icon: '⚡' },
            { label: 'ADAPTATION', sub: `AI: ${aiMetrics.adaptationCycles}c | NF: ${bannMetrics.adaptationCycles}c`, color: '#10b981', icon: '🔄' },
          ].map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(6,14,32,0.8)', border: `1px solid ${step.color}40`, borderRadius: '8px', minWidth: '100px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{step.icon}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: step.color, fontWeight: 700, letterSpacing: '0.06em' }}>{step.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-faint)', marginTop: '2px' }}>{step.sub}</div>
              </div>
              {i < 5 && <ChevronRight size={14} color="var(--text-faint)" />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Model Comparison (side-by-side) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* AI Baseline */}
        <div className="glass-panel" style={{ padding: '18px', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Cpu size={18} color="var(--blue-accent)" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--blue-accent)' }}>AI BASELINE</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)' }}>Window-based classifier · Fixed learning rate · Slow adaptation</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'ACCURACY', value: `${aiMetrics.accuracy.toFixed(1)}%`, color: 'var(--blue-accent)' },
              { label: 'AVG LATENCY', value: `${aiMetrics.avgLatencyMs.toFixed(1)} ms`, color: 'var(--amber-neon)' },
              { label: 'ERROR RATE', value: `${(aiMetrics.errorRate * 100).toFixed(1)}%`, color: 'var(--rose-neon)' },
              { label: 'ADAPT CYCLES', value: aiMetrics.adaptationCycles, color: 'var(--purple-neon)' },
              { label: 'RECOVERY TIME', value: aiMetrics.recoveryTimeMs > 0 ? `${aiMetrics.recoveryTimeMs.toFixed(0)} ms` : '—', color: 'var(--amber-neon)' },
              { label: 'CONVERGENCE', value: `${aiMetrics.convergenceScore.toFixed(0)}%`, color: 'var(--emerald-neon)' },
            ].map(m => (
              <div key={m.label} style={{ padding: '8px', background: 'rgba(6,14,32,0.6)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* NeuroForge BANN */}
        <div className="glass-panel" style={{ padding: '18px', border: '1px solid rgba(0, 240, 255, 0.5)', boxShadow: '0 0 20px rgba(0, 240, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Brain size={18} color="var(--cyan-bright)" />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--cyan-bright)' }}>NEUROFORGE BANN</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)' }}>Plasticity-driven · Hebbian LR · Fast adaptation (↑ recovery)</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'ACCURACY', value: `${bannMetrics.accuracy.toFixed(1)}%`, color: 'var(--cyan-bright)' },
              { label: 'AVG LATENCY', value: `${bannMetrics.avgLatencyMs.toFixed(1)} ms`, color: 'var(--amber-neon)' },
              { label: 'ERROR RATE', value: `${(bannMetrics.errorRate * 100).toFixed(1)}%`, color: 'var(--rose-neon)' },
              { label: 'ADAPT CYCLES', value: bannMetrics.adaptationCycles, color: 'var(--purple-neon)' },
              { label: 'RECOVERY TIME', value: bannMetrics.recoveryTimeMs > 0 ? `${bannMetrics.recoveryTimeMs.toFixed(0)} ms` : '—', color: 'var(--amber-neon)' },
              { label: 'CONVERGENCE', value: `${bannMetrics.convergenceScore.toFixed(0)}%`, color: 'var(--emerald-neon)' },
            ].map(m => (
              <div key={m.label} style={{ padding: '8px', background: 'rgba(6,14,32,0.6)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Performance Timeline */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            LIVE PERFORMANCE TIMELINE — HUMAN vs MODELS
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
              Run session to populate
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                <XAxis dataKey="trial" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" label={{ value: 'Trial', position: 'insideBottomRight', fontSize: 10, fill: '#475569' }} />
                <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="human" stroke="#10b981" name="Human" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ai" stroke="#38bdf8" name="AI Baseline" strokeWidth={2} dot={false} strokeDasharray="4 4" isAnimationActive={false} />
                <Line type="monotone" dataKey="bann" stroke="#00f0ff" name="NeuroForge BANN" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Adaptation Curve */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            ADAPTATION CURVE — POST RULE CHANGE
          </div>
          {adaptData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
              Trigger rule change to compare adaptation speed
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={adaptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
                <XAxis dataKey="cycle" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" label={{ value: 'Cycles after change', position: 'insideBottomRight', fontSize: 9, fill: '#475569' }} />
                <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                <Tooltip contentStyle={TT} />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="ai" stroke="#38bdf8" name="AI Baseline" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="bann" stroke="#00f0ff" name="NeuroForge BANN" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar comparison */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            ADAPTATION RACE — KEY METRICS
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { metric: 'Accuracy', AI: +aiMetrics.accuracy.toFixed(1), BANN: +bannMetrics.accuracy.toFixed(1) },
              { metric: 'Convergence', AI: +aiMetrics.convergenceScore.toFixed(1), BANN: +bannMetrics.convergenceScore.toFixed(1) },
              { metric: 'Adapt Speed', AI: Math.max(0, 100 - aiMetrics.adaptationCycles * 5), BANN: Math.max(0, 100 - bannMetrics.adaptationCycles * 5) },
            ]} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
              <XAxis type="number" domain={[0, 100]} stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
              <YAxis type="category" dataKey="metric" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" width={80} />
              <Tooltip contentStyle={TT} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#94a3b8' }} />
              <Bar dataKey="AI" name="AI Baseline" fill="rgba(56,189,248,0.6)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              <Bar dataKey="BANN" name="NeuroForge BANN" fill="rgba(0,240,255,0.6)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '12px' }}>
            MODEL CAPABILITIES RADAR
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(56,189,248,0.15)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: '#94a3b8' }} />
              <Radar name="AI Baseline" dataKey="AI" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} isAnimationActive={false} />
              <Radar name="NeuroForge BANN" dataKey="BANN" stroke="#00f0ff" fill="#00f0ff" fillOpacity={0.2} isAnimationActive={false} />
              <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#94a3b8' }} />
              <Tooltip contentStyle={TT} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Behavioral Similarity ── */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '4px' }}>
          HUMAN-MODEL BEHAVIORAL SIMILARITY ANALYSIS
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', marginBottom: '14px' }}>
          Interpretable similarity between observed HUMAN task behavior and each MODEL's predicted behavior.
          This is BEHAVIORAL SIMILARITY — not a claim that the model reproduces a biological brain.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { title: 'AI BASELINE', sim: aiSim, color: 'var(--blue-accent)' },
            { title: 'NEUROFORGE BANN', sim: bannSim, color: 'var(--cyan-bright)' },
          ].map(({ title, sim, color }) => (
            <div key={title}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color, fontWeight: 700, marginBottom: '10px' }}>
                {title} — Overall Similarity: <span style={{ fontSize: '1rem' }}>{sim.overall.toFixed(1)}%</span>
              </div>
              {[
                { label: 'Reaction Pattern', value: sim.reactionPattern },
                { label: 'Decision Pattern', value: sim.decisionPattern },
                { label: 'Error Pattern', value: sim.errorPattern },
                { label: 'Adaptation Pattern', value: sim.adaptationPattern },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    <span>{item.label}</span>
                    <span style={{ color }}>{item.value.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, item.value)}%`, background: color, borderRadius: '3px', boxShadow: `0 0 6px ${color}`, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Scientific Positioning Disclaimer ── */}
      <div style={{ padding: '12px 16px', background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--purple-neon)' }}>⚗ SCIENTIFIC POSITIONING: </strong>
        NeuroForge experimentally compares an adaptive neural model against a conventional AI baseline using identical human-generated behavioral data.
        We do NOT claim the neural model is inherently faster or superior — performance depends on task type, data volume, and session conditions.
        All metrics are computed from real live session data. Anonymous session ID: <span style={{ color: 'var(--cyan-bright)' }}>{sessionId}</span>.
      </div>

      {/* ── Benchmark Report ── */}
      {showReport && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--cyan-bright)' }}>
              📋 BENCHMARK REPORT
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-faint)' }}>
              {new Date().toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            <div style={{ padding: '12px', background: 'rgba(6,14,32,0.7)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <div style={{ color: 'var(--emerald-neon)', fontWeight: 700, marginBottom: '8px' }}>HUMAN METRICS</div>
              <div style={{ color: 'var(--text-muted)', lineHeight: 2 }}>
                Session ID: <span style={{ color: '#fff' }}>{sessionId}</span><br/>
                Total Trials: <span style={{ color: '#fff' }}>{liveMetrics.totalTrials}</span><br/>
                Accuracy: <span style={{ color: '#fff' }}>{liveMetrics.accuracy.toFixed(1)}%</span><br/>
                Avg RT: <span style={{ color: '#fff' }}>{liveMetrics.avgReactionTime.toFixed(0)} ms</span><br/>
                Total Errors: <span style={{ color: 'var(--rose-neon)' }}>{liveMetrics.totalErrors}</span><br/>
                Round 1 Trials: <span style={{ color: '#fff' }}>{round1Events.length}</span><br/>
                Round 2 Trials: <span style={{ color: '#fff' }}>{round2Events.length}</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(6,14,32,0.7)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px' }}>
              <div style={{ color: 'var(--blue-accent)', fontWeight: 700, marginBottom: '8px' }}>AI BASELINE</div>
              <div style={{ color: 'var(--text-muted)', lineHeight: 2 }}>
                Accuracy: <span style={{ color: '#fff' }}>{aiMetrics.accuracy.toFixed(1)}%</span><br/>
                Avg Latency: <span style={{ color: '#fff' }}>{aiMetrics.avgLatencyMs.toFixed(1)} ms</span><br/>
                Error Rate: <span style={{ color: 'var(--rose-neon)' }}>{(aiMetrics.errorRate * 100).toFixed(1)}%</span><br/>
                Adapt Cycles: <span style={{ color: 'var(--amber-neon)' }}>{aiMetrics.adaptationCycles}</span><br/>
                Recovery Time: <span style={{ color: '#fff' }}>{aiMetrics.recoveryTimeMs > 0 ? `${aiMetrics.recoveryTimeMs.toFixed(0)} ms` : 'N/A'}</span><br/>
                Convergence: <span style={{ color: '#fff' }}>{aiMetrics.convergenceScore.toFixed(1)}%</span><br/>
                Similarity: <span style={{ color: '#fff' }}>{aiSim.overall.toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(6,14,32,0.7)', border: '1px solid var(--border-cyan)', borderRadius: '8px' }}>
              <div style={{ color: 'var(--cyan-bright)', fontWeight: 700, marginBottom: '8px' }}>NEUROFORGE BANN</div>
              <div style={{ color: 'var(--text-muted)', lineHeight: 2 }}>
                Accuracy: <span style={{ color: '#fff' }}>{bannMetrics.accuracy.toFixed(1)}%</span><br/>
                Avg Latency: <span style={{ color: '#fff' }}>{bannMetrics.avgLatencyMs.toFixed(1)} ms</span><br/>
                Error Rate: <span style={{ color: 'var(--rose-neon)' }}>{(bannMetrics.errorRate * 100).toFixed(1)}%</span><br/>
                Adapt Cycles: <span style={{ color: 'var(--amber-neon)' }}>{bannMetrics.adaptationCycles}</span><br/>
                Recovery Time: <span style={{ color: '#fff' }}>{bannMetrics.recoveryTimeMs > 0 ? `${bannMetrics.recoveryTimeMs.toFixed(0)} ms` : 'N/A'}</span><br/>
                Convergence: <span style={{ color: '#fff' }}>{bannMetrics.convergenceScore.toFixed(1)}%</span><br/>
                Similarity: <span style={{ color: '#fff' }}>{bannSim.overall.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(0,240,255,0.04)', border: '1px solid var(--border-cyan)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--cyan-bright)' }}>BENCHMARK CONCLUSION: </strong>
            {bannMetrics.adaptationCycles < aiMetrics.adaptationCycles && adaptData.length > 0
              ? `NeuroForge BANN converged in ${bannMetrics.adaptationCycles} cycles post-rule-change vs AI Baseline's ${aiMetrics.adaptationCycles} cycles — demonstrating faster plasticity-driven adaptation.`
              : adaptData.length === 0
              ? 'Trigger a rule change mid-session to compare adaptation speed between models.'
              : `Both models were tracked across ${liveMetrics.totalTrials} human-generated behavioral events. Adaptation cycles and recovery times vary with session conditions.`}
          </div>
        </div>
      )}
    </div>
  );
}
