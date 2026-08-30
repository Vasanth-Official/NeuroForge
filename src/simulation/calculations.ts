/**
 * NeuroForge Simulation Engine — Pure Calculation Functions
 *
 * Every function in this module is a pure function (no side-effects, no
 * mutation of external state).  That makes them straightforward to
 * unit-test: call with known inputs, assert on the output.
 *
 * Biological plausibility is intentionally NOT claimed.  The math is
 * designed to produce interesting, non-linear state transitions that
 * "feel" like a learning system.
 */

import type {
  NeuralSystemState,
  ReadinessAssessment,
  TrainingProtocol,
} from './types.ts';
import { clamp } from './seededRandom.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Spike-rate baseline in simulation units. */
const BASE_SPIKE_RATE = 12;

/** Maximum spike rate achievable at full intensity with no fatigue. */
const MAX_SPIKE_RATE = 80;

/** Minimum spike rate (idling system). */
const MIN_SPIKE_RATE = 2;

/**
 * Sigmoid (logistic) function mapped to [0, 1].
 * Adds a natural diminishing-returns curve to several calculations.
 *
 * @param x - raw input (can be any real number)
 * @param k - steepness (default 1)
 * @param x0 - midpoint (default 0)
 */
export function sigmoid(x: number, k = 1, x0 = 0): number {
  return 1 / (1 + Math.exp(-k * (x - x0)));
}

// ---------------------------------------------------------------------------
// simulateNeuralActivity
// ---------------------------------------------------------------------------

/**
 * Simulate instantaneous neural activity metrics given the current state
 * and the protocol being applied.
 *
 * Returns the derived spikeRate and variability (coefficient of variation).
 * Both values are deterministic given the inputs — the small noise term
 * is drawn from the provided `jitter` parameter that the caller generates
 * with the seeded RNG, keeping this function pure.
 *
 * @param state       - current neural system state
 * @param protocol    - active training protocol
 * @param jitter      - small noise term in [-0.5, 0.5] from the seeded RNG
 */
export function simulateNeuralActivity(
  state: Readonly<NeuralSystemState>,
  protocol: Readonly<TrainingProtocol>,
  jitter: number,
): { spikeRate: number; variability: number } {
  // Fatigue suppresses firing; fatigue on [0,100] → suppression on [0, 0.6]
  const fatigueSuppression = (state.fatigue / 100) * 0.6;

  // Synchrony boosts effective spiking; higher synchrony = more coherent drive
  const synchronyBoost = (state.synchrony / 100) * 0.25;

  // Raw spike rate driven by protocol intensity
  const rawRate =
    BASE_SPIKE_RATE +
    (MAX_SPIKE_RATE - BASE_SPIKE_RATE) * protocol.intensity;

  const spikeRate = clamp(
    rawRate * (1 - fatigueSuppression) * (1 + synchronyBoost) +
      jitter * 3.0,
    MIN_SPIKE_RATE,
    MAX_SPIKE_RATE,
  );

  // Variability (CV of ISIs):
  //   High stability → low variability (regular firing)
  //   High fatigue → higher variability (irregular firing)
  //   High intensity → slightly more variability
  const stabilityEffect = 1 - state.stability / 100;   // 0 (stable) → 1 (unstable)
  const fatigueEffect = state.fatigue / 100;
  const intensityEffect = protocol.intensity * 0.15;

  const variability = clamp(
    0.05 +
      stabilityEffect * 0.45 +
      fatigueEffect * 0.25 +
      intensityEffect +
      Math.abs(jitter) * 0.05,
    0.05,
    1.0,
  );

  return { spikeRate, variability };
}

// ---------------------------------------------------------------------------
// calculateLearningGain
// ---------------------------------------------------------------------------

/**
 * Calculate the raw learning gain for one training cycle.
 *
 * Key non-linearities:
 *  • Diminishing returns — learning slows as `learningScore` approaches 100.
 *  • Fatigue impairment — high fatigue significantly dampens gain.
 *  • Stability gate — very low stability prevents consolidation.
 *  • Synchrony amplifier — coordinated activity boosts encoding efficiency.
 *
 * @returns gain in the same units as `learningScore` (0–100 scale).
 */
export function calculateLearningGain(
  state: Readonly<NeuralSystemState>,
  protocol: Readonly<TrainingProtocol>,
): number {
  // Available "headroom" before the ceiling — diminishing returns
  const headroom = 1 - state.learningScore / 100;

  // Fatigue multiplier: exponential decay above a threshold (> 60 fatigue)
  const fatiguePenalty = state.fatigue > 60
    ? Math.exp(-((state.fatigue - 60) / 25))
    : 1 - (state.fatigue / 100) * 0.3;

  // Stability gate: below 20 stability, learning is severely impaired
  const stabilityGate = state.stability < 20
    ? state.stability / 20        // linear ramp 0 → 1 in [0, 20]
    : 0.8 + (state.stability / 100) * 0.2;  // gentle boost above 20

  // Synchrony amplifier: sigmoid centred at 50
  const synchronyAmp = 0.7 + sigmoid(state.synchrony, 0.06, 50) * 0.6;

  const rawGain =
    protocol.learningRate *
    protocol.intensity *
    headroom *
    fatiguePenalty *
    stabilityGate *
    synchronyAmp;

  // Scale to percentage points (max ≈ 8 pp per cycle at full params)
  return clamp(rawGain * 12, 0, 12);
}

// ---------------------------------------------------------------------------
// calculateStability
// ---------------------------------------------------------------------------

/**
 * Calculate the stability change (can be negative) for one training cycle.
 *
 * Stability:
 *  • Decays proportionally to protocol intensity and current fatigue.
 *  • Partially recovers when fatigue is low and current stability is high
 *    (resilient systems are self-correcting).
 *
 * @returns signed delta to apply to `state.stability`.
 */
export function calculateStability(
  state: Readonly<NeuralSystemState>,
  protocol: Readonly<TrainingProtocol>,
): number {
  // Decay driven by intensity and amplified when system is already fatigued
  const fatigueDriven = 1 + (state.fatigue / 100) * 0.8;
  const decay =
    protocol.stabilityDecayFactor *
    protocol.intensity *
    fatigueDriven *
    (state.stability / 100) * // proportional — decay slows at low stability
    14; // scale to percentage points

  // Recovery: only meaningful when fatigue < 40 and stability > 30
  const recoveryCondition =
    state.fatigue < 40 && state.stability > 30
      ? ((40 - state.fatigue) / 40) * (state.stability / 100) * 2.5
      : 0;

  return clamp(recoveryCondition - decay, -20, 4);
}

// ---------------------------------------------------------------------------
// calculateRetention
// ---------------------------------------------------------------------------

/**
 * Calculate the retention change for one training cycle.
 *
 * Retention:
 *  • Increases with each training cycle (consolidation), but only when
 *    learning is actually happening (gain > 0).
 *  • High variability causes mild forgetting (noisy encoding).
 *  • Decays slowly toward a floor proportional to current learningScore.
 *
 * @param learningGain  - gain computed by `calculateLearningGain` this cycle
 * @returns signed delta to apply to `state.retention`.
 */
export function calculateRetention(
  state: Readonly<NeuralSystemState>,
  learningGain: number,
): number {
  // Consolidation: gain positively reinforces retention
  const consolidation = learningGain * 0.65;

  // Noise-driven forgetting: high variability → less precise memory trace
  const forgetting = state.variability * 2.5;

  // Natural decay toward a floor anchored to learningScore
  const floor = state.learningScore * 0.6;
  const naturalDecay =
    state.retention > floor
      ? (state.retention - floor) * 0.04
      : 0;

  return clamp(consolidation - forgetting - naturalDecay, -8, 6);
}

// ---------------------------------------------------------------------------
// calculateTrainingEfficiency
// ---------------------------------------------------------------------------

/**
 * Compute a single efficiency score (0–100) for the completed cycle.
 *
 * Efficiency rewards:
 *  • High learning gain relative to protocol's theoretical max
 *  • High stability preservation
 *  • Low fatigue cost
 *
 * @param learningGain     - actual gain this cycle
 * @param stabilityChange  - stability delta this cycle
 * @param fatigueChange    - fatigue delta this cycle
 * @param protocol         - the active protocol
 */
export function calculateTrainingEfficiency(
  learningGain: number,
  stabilityChange: number,
  fatigueChange: number,
  protocol: Readonly<TrainingProtocol>,
): number {
  // Theoretical max gain at full params (see calculateLearningGain scale ≈ 12)
  const maxPossibleGain = protocol.learningRate * 12;
  const gainScore = maxPossibleGain > 0
    ? clamp(learningGain / maxPossibleGain, 0, 1)
    : 0;

  // Stability preservation: 1 if stability stayed flat, 0 if it fell by 20
  const stabilityScore = clamp((stabilityChange + 20) / 20, 0, 1);

  // Fatigue economy: 1 if no fatigue accumulated, 0 if 30+ points added
  const maxFatigueChange = protocol.fatigueFactor * 30;
  const fatigueScore =
    maxFatigueChange > 0
      ? clamp(1 - fatigueChange / maxFatigueChange, 0, 1)
      : 1;

  // Weighted composite
  const composite = gainScore * 0.55 + stabilityScore * 0.25 + fatigueScore * 0.20;

  return clamp(composite * 100, 0, 100);
}

// ---------------------------------------------------------------------------
// Assess-phase helper
// ---------------------------------------------------------------------------

/**
 * Evaluate system readiness before a training cycle begins.
 *
 * Returns a structured report rather than a simple boolean so the UI layer
 * can surface detailed diagnostics without re-running the logic.
 */
export function assessReadiness(
  state: Readonly<NeuralSystemState>,
  protocol: Readonly<TrainingProtocol>,
): ReadinessAssessment {
  const fatigueImpaired = state.fatigue > 65;
  const stabilityWarning = state.stability < 25;

  // Composite readiness: penalise fatigue and low stability
  const fatiguePenalty = clamp(state.fatigue / 100, 0, 1);
  const stabilityBonus = clamp(state.stability / 100, 0, 1);

  const readinessScore = clamp(
    (1 - fatiguePenalty * 0.6) * (0.4 + stabilityBonus * 0.6),
    0,
    1,
  );

  // Effective learning multiplier: reduced by both fatigue and instability
  const effectiveLearningMultiplier = clamp(
    readinessScore * protocol.learningRate,
    0.05,
    1,
  );

  return {
    readinessScore,
    fatigueImpaired,
    stabilityWarning,
    effectiveLearningMultiplier,
  };
}

// ---------------------------------------------------------------------------
// Synchrony update helper
// ---------------------------------------------------------------------------

/**
 * Calculate synchrony change for one cycle.
 *
 * Synchrony:
 *  • Builds up with repeated moderate training (resonance effect).
 *  • Disrupted by very high intensity or very low stability.
 *  • Decays slowly without training.
 */
export function calculateSynchronyChange(
  state: Readonly<NeuralSystemState>,
  protocol: Readonly<TrainingProtocol>,
): number {
  // High intensity disrupts synchrony unless stability is also high
  const disruptionRisk =
    protocol.intensity > 0.7 && state.stability < 50
      ? -(protocol.intensity - 0.7) * 15
      : 0;

  // Resonance: moderate protocols at good stability build synchrony
  const resonance =
    protocol.intensity < 0.8
      ? protocol.intensity * (state.stability / 100) * 4
      : protocol.intensity * (state.stability / 100) * 1.5;

  // Natural drift toward 50 (homeostasis)
  const homeostasis = (50 - state.synchrony) * 0.03;

  return clamp(resonance + disruptionRisk + homeostasis, -10, 8);
}

// ---------------------------------------------------------------------------
// Fatigue update helper
// ---------------------------------------------------------------------------

/**
 * Calculate net fatigue change for one cycle.
 *
 * Fatigue accumulates with training intensity and decays via recovery.
 * Recovery is boosted when fatigue is already high (autoregulation).
 */
export function calculateFatigueChange(
  state: Readonly<NeuralSystemState>,
  protocol: Readonly<TrainingProtocol>,
): number {
  // Accumulation: intensity × fatigueFactor, amplified by current fatigue
  // (tired systems tire faster)
  const accumulation =
    protocol.fatigueFactor *
    protocol.intensity *
    (1 + (state.fatigue / 100) * 0.3) *
    22;

  // Recovery: baseline + extra when already heavily fatigued (homeostatic)
  const autoRecovery =
    state.fatigue > 70
      ? protocol.baseRecovery * 2.2
      : protocol.baseRecovery;
  const recovery = autoRecovery * 15;

  return clamp(accumulation - recovery, -12, 18);
}
