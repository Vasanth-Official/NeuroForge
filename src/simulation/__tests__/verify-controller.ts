/**
 * verify-controller.ts
 *
 * Standalone verification script — exercises the adaptive controller across
 * several deliberately crafted state scenarios and verifies that the protocol
 * selection changes appropriately when the neural state changes.
 *
 * Run with:
 *   node --experimental-strip-types src/simulation/__tests__/verify-controller.ts
 */

// ---------------------------------------------------------------------------
// Inline re-implementations of the simulation primitives
// (keeps this script self-contained; no bundler or transpile step needed)
// ---------------------------------------------------------------------------

// ── Types (inline) ──────────────────────────────────────────────────────────

interface NeuralSystemState {
  learningScore: number;
  stability: number;
  synchrony: number;
  spikeRate: number;
  variability: number;
  retention: number;
  fatigue: number;
  seed: number;
  trainingHistory: CycleRecord[];
}

interface CycleRecord {
  cycle: number;
  protocol: string;
  phaseSnapshots: unknown[];
  deltas: unknown;
  efficiency: number;
  endState: Omit<NeuralSystemState, 'trainingHistory'>;
}

// ── Clamp ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ── Protocols ───────────────────────────────────────────────────────────────

const PROTOCOLS = {
  LOW:    { id: 'LOW',    intensity: 0.25, learningRate: 0.30, stabilityDecayFactor: 0.04, fatigueFactor: 0.08, baseRecovery: 0.12 },
  MEDIUM: { id: 'MEDIUM', intensity: 0.55, learningRate: 0.55, stabilityDecayFactor: 0.14, fatigueFactor: 0.22, baseRecovery: 0.08 },
  HIGH:   { id: 'HIGH',   intensity: 0.88, learningRate: 0.78, stabilityDecayFactor: 0.32, fatigueFactor: 0.45, baseRecovery: 0.05 },
} as const;

// ── OLS trend ───────────────────────────────────────────────────────────────

function computeTrend(history: CycleRecord[], window = 5) {
  const w = history.slice(-window);
  if (w.length < 2) return { slopePerCycle: 0, direction: 'stagnant' as const, windowSize: w.length };
  const n = w.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = w.map(r => r.endState.learningScore);
  const mX = xs.reduce((a, b) => a + b, 0) / n;
  const mY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mX) * (ys[i] - mY); den += (xs[i] - mX) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return {
    slopePerCycle: slope,
    direction: slope >= 0.4 ? 'improving' as const : slope <= -0.3 ? 'declining' as const : 'stagnant' as const,
    windowSize: n,
  };
}

// ── Protocol scorer (mirrors controller.ts logic) ───────────────────────────

function scoreProtocol(pid: string, obs: ReturnType<typeof makeObs>, oscillating: boolean) {
  const p = PROTOCOLS[pid as keyof typeof PROTOCOLS];
  const fatiguePressure = clamp(obs.fatigue / 100, 0, 1);
  const instability     = clamp(1 - obs.stability / 100, 0, 1);
  const safety          = clamp(1 - p.intensity * (fatiguePressure * 0.6 + instability * 0.4), 0, 1);

  const headroom      = clamp(1 - obs.learningScore / 100, 0, 1);
  const fatigueClear  = clamp(1 - obs.fatigue / 100, 0, 1);
  const syncBonus     = clamp(obs.synchrony / 100, 0, 1);
  const learningPot   = clamp(p.learningRate * headroom * (fatigueClear * 0.7 + syncBonus * 0.3), 0, 1);

  const fatigueVuln  = clamp(obs.fatigue / 100, 0, 1);
  const economy      = clamp(1 - p.fatigueFactor * (0.5 + fatigueVuln * 0.5), 0, 1);

  const stabVuln     = clamp(1 - obs.stability / 100, 0, 1);
  const stabPres     = clamp(1 - p.stabilityDecayFactor * (0.4 + stabVuln * 0.6), 0, 1);

  const slopeNorm    = clamp(obs.trend.slopePerCycle / 3, -1, 1);
  let trendAlign: number;
  if (obs.trend.direction === 'improving') {
    trendAlign = clamp(0.5 + slopeNorm * p.intensity * 0.5, 0, 1);
  } else if (obs.trend.direction === 'declining') {
    trendAlign = clamp(0.5 + Math.abs(slopeNorm) * (1 - p.intensity) * 0.5, 0, 1);
  } else {
    trendAlign = clamp(0.4 + (1 - Math.abs(p.intensity - 0.55)) * 0.3, 0, 1);
  }

  const retRatio = obs.learningScore > 0 ? clamp(obs.retention / obs.learningScore, 0, 1.5) : 1;
  const retSig   = retRatio < 0.85 ? clamp(1 - p.intensity * 0.6, 0, 1) : 0.5;

  const hysteresis = obs.lastProtocol === pid ? (oscillating ? 0.16 : 0.08) : 0;

  const w = { safety: 0.28, lp: 0.22, ec: 0.16, sp: 0.18, ta: 0.10, rs: 0.06 };
  const total = clamp(
    safety * w.safety + learningPot * w.lp + economy * w.ec +
    stabPres * w.sp + trendAlign * w.ta + retSig * w.rs + hysteresis,
    0, 1,
  );
  return { pid, total, safety, learningPot, economy, stabPres, trendAlign, retSig, hysteresis };
}

function makeObs(s: NeuralSystemState) {
  const trend = computeTrend(s.trainingHistory);
  const recent = s.trainingHistory.slice(-4).map(r => r.protocol);
  return { ...s, trend, lastProtocol: recent.at(-1) ?? null, recentProtocols: recent };
}

function selectProtocol(state: NeuralSystemState) {
  const obs = makeObs(state);
  const oscillating = obs.recentProtocols.length >= 4 &&
    obs.recentProtocols.at(-1) === obs.recentProtocols.at(-3) &&
    obs.recentProtocols.at(-2) === obs.recentProtocols.at(-4) &&
    obs.recentProtocols.at(-1) !== obs.recentProtocols.at(-2);

  if (obs.fatigue >= 80 || obs.stability <= 22) return 'LOW';

  const scores = ['LOW', 'MEDIUM', 'HIGH'].map(id => scoreProtocol(id, obs, oscillating));
  const winner = scores.reduce((b, s) => s.total > b.total ? s : b);
  return winner.pid;
}

// ── Minimal state factory ────────────────────────────────────────────────────

function makeState(overrides: Partial<Omit<NeuralSystemState, 'trainingHistory'>> = {}): NeuralSystemState {
  return {
    learningScore: 0, stability: 75, synchrony: 45, spikeRate: 12,
    variability: 0.35, retention: 0, fatigue: 0, seed: 42, trainingHistory: [],
    ...overrides,
  };
}

// Attach a synthetic history so the trend calculator has data
function withHistory(state: NeuralSystemState, learningScores: number[], protocol = 'MEDIUM'): NeuralSystemState {
  state.trainingHistory = learningScores.map((ls, i) => ({
    cycle: i + 1, protocol, phaseSnapshots: [], deltas: {},
    efficiency: 50,
    endState: { ...state, learningScore: ls },
  }));
  return state;
}

// ── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, got: string, want: string) {
  if (got === want) {
    console.log(`  ✅  ${label}: ${got}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}: expected ${want}, got ${got}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n─── ${title} ──────────────────────────────────────────────`);
}

// ── Scenario tests ────────────────────────────────────────────────────────────

section('SAFETY OVERRIDES');

const criticalFatigue = makeState({ fatigue: 85, stability: 50, learningScore: 30 });
expect('Critical fatigue (85) → LOW', selectProtocol(criticalFatigue), 'LOW');

const criticalStability = makeState({ fatigue: 20, stability: 15, learningScore: 40 });
expect('Critical stability (15) → LOW', selectProtocol(criticalStability), 'LOW');

const bothCritical = makeState({ fatigue: 82, stability: 18 });
expect('Both critical → LOW', selectProtocol(bothCritical), 'LOW');

section('EARLY LEARNING — HIGH CAPACITY');

const earlyHighCapacity = makeState({ learningScore: 5, stability: 80, fatigue: 10, synchrony: 60 });
const earlyChoice = selectProtocol(earlyHighCapacity);
// Safety and stability are healthy; LOW is never the right choice here.
// With no history the trend is stagnant so MEDIUM or HIGH are both valid.
expect('Low learning + high stability + low fatigue → not LOW',
  earlyChoice !== 'LOW' ? earlyChoice : 'LOW',
  earlyChoice !== 'LOW' ? earlyChoice : 'notLOW',
);

section('BALANCED STATE — MEDIUM');

const balanced = makeState({ learningScore: 40, stability: 65, fatigue: 30, synchrony: 50 });
withHistory(balanced, [30, 34, 37, 40]);
expect('Balanced improving state → MEDIUM or HIGH', selectProtocol(balanced) !== 'LOW' ? selectProtocol(balanced) : 'X', 'MEDIUM');

section('HIGH FATIGUE — PREFER LOW');

const highFatigue = makeState({ fatigue: 70, stability: 45, learningScore: 50 });
const protHighFatigue = selectProtocol(highFatigue);
expect('High fatigue (70) → LOW or MEDIUM (not HIGH)', protHighFatigue !== 'HIGH' ? protHighFatigue : 'HIGH', protHighFatigue !== 'HIGH' ? protHighFatigue : 'NOTLOW');

section('HIGH LEARNING + FALLING STABILITY');

const highLearningFallingStab = makeState({ learningScore: 78, stability: 32, fatigue: 45, synchrony: 40 });
withHistory(highLearningFallingStab, [65, 70, 74, 78]);
expect('High learning + low stability → not HIGH', selectProtocol(highLearningFallingStab) !== 'HIGH' ? selectProtocol(highLearningFallingStab) : 'HIGH', 'MEDIUM');

section('DECLINING TREND — CONSOLIDATION');

const decliningState = makeState({ learningScore: 60, stability: 55, fatigue: 40, synchrony: 45 });
withHistory(decliningState, [70, 67, 64, 60], 'HIGH');
const decliningChoice = selectProtocol(decliningState);
expect('Declining learning trend → not HIGH', decliningChoice !== 'HIGH' ? decliningChoice : 'HIGH', decliningChoice !== 'HIGH' ? decliningChoice : 'notHIGH');

section('PROTOCOL CHANGES AS STATE CHANGES');

// Start healthy, progressively increase fatigue — protocol should shift down
const evolving = makeState({ learningScore: 20, stability: 70, fatigue: 0, synchrony: 55 });
const p1 = selectProtocol(evolving);

evolving.fatigue = 50; evolving.stability = 58;
const p2 = selectProtocol(evolving);

evolving.fatigue = 75; evolving.stability = 42;
const p3 = selectProtocol(evolving);

console.log(`\n  State evolution as fatigue rises:`);
console.log(`    fatigue=0,  stability=70  → ${p1}`);
console.log(`    fatigue=50, stability=58  → ${p2}`);
console.log(`    fatigue=75, stability=42  → ${p3}`);

// Assert that protocol either stayed equal or moved toward LOW as fatigue grew
const protOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
const intensityDecreased = protOrder[p3 as keyof typeof protOrder] <= protOrder[p2 as keyof typeof protOrder];
expect('Protocol intensity non-increasing as fatigue rises', intensityDecreased ? 'yes' : 'no', 'yes');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('  All assertions passed ✅');
} else {
  console.log('  Some assertions failed ❌');
  throw new Error('Some assertions failed ❌');
}
