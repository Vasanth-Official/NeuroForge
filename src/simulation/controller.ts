/**
 * NeuroForge — Adaptive Training Controller
 *
 * Observes NeuralSystemState and selects the next training protocol using
 * a transparent, weighted scoring policy.  No random selection, no hardcoded
 * string templates — every decision is derived from live state values.
 *
 * Public API:
 *   selectAdaptiveProtocol()
 *   generateDecisionReason()
 *   calculateControllerConfidence()
 */

import type { CycleRecord, NeuralSystemState, TrainingProtocolId } from './types.ts';
import { clamp } from './seededRandom.ts';
import { PROTOCOLS } from './protocols.ts';
import { calculateLearningGain, calculateStability, calculateFatigueChange } from './calculations.ts';

// ---------------------------------------------------------------------------
// Controller-specific types
// ---------------------------------------------------------------------------

/** Direction and magnitude of learning over recent cycles. */
export interface LearningTrend {
  /** Positive = improving, negative = declining, near-zero = stagnant. */
  slopePerCycle: number;
  /** 'improving' | 'stagnant' | 'declining' */
  direction: 'improving' | 'stagnant' | 'declining';
  /** Number of cycles used to compute the trend. */
  windowSize: number;
}

/** What the controller observed before making its decision. */
export interface ControllerObservation {
  learningScore: number;
  stability: number;
  synchrony: number;
  retention: number;
  fatigue: number;
  trend: LearningTrend;
  lastProtocol: TrainingProtocolId | null;
  recentProtocols: TrainingProtocolId[];
  cycleCount: number;
}

/** Predicted qualitative outcome of applying the chosen protocol. */
export interface PredictedEffect {
  learningGainLabel: 'low' | 'moderate' | 'high';
  stabilityImpactLabel: 'minimal' | 'moderate' | 'significant';
  fatigueChangeLabel: 'recovery' | 'neutral' | 'accumulation';
  riskLevel: 'low' | 'moderate' | 'high';
  /** Quantitative best-guess gains, computed via the engine's own formulas. */
  estimatedLearningGain: number;
  estimatedStabilityChange: number;
  estimatedFatigueChange: number;
}

/** A single condition that fired during scoring and contributed to the decision. */
export interface FiredCondition {
  /** Short machine-readable tag (used by generateDecisionReason). */
  tag: string;
  /** Human-readable fragment built from real variable values. */
  fragment: string;
  /** How strongly this condition influenced the final choice (0–1). */
  weight: number;
}

/** Per-protocol score breakdown. */
export interface ProtocolScore {
  protocolId: TrainingProtocolId;
  total: number;
  components: {
    safety: number;
    learningPotential: number;
    economy: number;
    stabilityPreservation: number;
    trendAlignment: number;
    retentionSignal: number;
    hysteresis: number;
  };
}

/** The full output of the adaptive controller. */
export interface ControllerDecision {
  protocol: TrainingProtocolId;
  reason: string;
  confidence: number;          // 0–1
  observedState: ControllerObservation;
  predictedEffect: PredictedEffect;
  /** Internal: all protocol scores for UI transparency panels. */
  protocolScores: ProtocolScore[];
  /** Internal: conditions that materially drove the decision. */
  firedConditions: FiredCondition[];
}

// ---------------------------------------------------------------------------
// Thresholds (all in the same units as NeuralSystemState fields)
// ---------------------------------------------------------------------------

const T = {
  FATIGUE_CRITICAL:    80,   // fatigue at which safety override triggers LOW
  FATIGUE_HIGH:        65,   // elevated fatigue — prefer lighter protocol
  FATIGUE_CLEAR:       35,   // low enough to consider HIGH
  STABILITY_CRITICAL:  22,   // stability at which safety override triggers LOW
  STABILITY_LOW:       38,   // stability is under stress
  STABILITY_HEALTHY:   60,   // stability is comfortable
  LEARNING_EARLY:      25,   // system is still in early learning phase
  LEARNING_HIGH:       70,   // significant learning already accumulated
  RETENTION_CONCERN:   0.85, // retention/learningScore ratio — below = retention lagging
  TREND_IMPROVING:     0.4,  // slope threshold to call trend 'improving'
  TREND_DECLINING:    -0.3,  // slope threshold to call trend 'declining'
  HYSTERESIS_BONUS:    0.08, // score bonus for staying on same protocol
  OSCILLATION_WINDOW:  4,    // cycles to look back for oscillation detection
  TREND_WINDOW:        5,    // cycles for trend calculation
} as const;

// ---------------------------------------------------------------------------
// computeLearningTrend
// ---------------------------------------------------------------------------

/**
 * Fit a simple linear slope to the last N cycles' learningScore values.
 * Uses ordinary least-squares with evenly spaced x-indices.
 */
export function computeLearningTrend(
  history: readonly CycleRecord[],
  windowSize: number = T.TREND_WINDOW,
): LearningTrend {
  const window = history.slice(-windowSize);

  if (window.length < 2) {
    return { slopePerCycle: 0, direction: 'stagnant', windowSize: window.length };
  }

  const n = window.length;
  // x = [0, 1, 2, …, n-1], y = learningScore at end of each cycle
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = window.map(r => r.endState.learningScore);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;

  const direction: LearningTrend['direction'] =
    slope >= T.TREND_IMPROVING  ? 'improving' :
    slope <= T.TREND_DECLINING   ? 'declining'  :
                                   'stagnant';

  return { slopePerCycle: slope, direction, windowSize: n };
}

// ---------------------------------------------------------------------------
// extractObservation
// ---------------------------------------------------------------------------

/** Build a ControllerObservation snapshot from live state (read-only). */
function extractObservation(state: Readonly<NeuralSystemState>): ControllerObservation {
  const trend = computeLearningTrend(state.trainingHistory);
  const recent = state.trainingHistory.slice(-T.OSCILLATION_WINDOW).map(r => r.protocol);
  const lastProtocol = recent.length > 0 ? recent[recent.length - 1] : null;

  return {
    learningScore: state.learningScore,
    stability:     state.stability,
    synchrony:     state.synchrony,
    retention:     state.retention,
    fatigue:       state.fatigue,
    trend,
    lastProtocol,
    recentProtocols: recent,
    cycleCount: state.trainingHistory.length,
  };
}

// ---------------------------------------------------------------------------
// detectOscillation
// ---------------------------------------------------------------------------

/**
 * Returns true when the recent protocol history is alternating between exactly
 * two protocols (e.g. LOW→HIGH→LOW→HIGH).  Used to apply dampening.
 */
function detectOscillation(recentProtocols: TrainingProtocolId[]): boolean {
  if (recentProtocols.length < 4) return false;
  const tail = recentProtocols.slice(-4);
  // oscillation = [A, B, A, B] pattern
  return tail[0] === tail[2] && tail[1] === tail[3] && tail[0] !== tail[1];
}

// ---------------------------------------------------------------------------
// scoreProtocol
// ---------------------------------------------------------------------------

/**
 * Score a single protocol against the current observation.
 * Every component is a normalised value in [0, 1].
 * Higher total = more appropriate for current state.
 */
function scoreProtocol(
  protocolId: TrainingProtocolId,
  obs: ControllerObservation,
  oscillating: boolean,
): ProtocolScore {
  const p = PROTOCOLS[protocolId];

  // ── 1. Safety score ───────────────────────────────────────────────────────
  // Penalises high-intensity protocols when the system is stressed.
  const fatiguePressure  = clamp(obs.fatigue  / 100, 0, 1);
  const instability      = clamp(1 - obs.stability / 100, 0, 1);
  // Safety degrades non-linearly with intensity when state is stressed
  const safety = clamp(
    1 - p.intensity * (fatiguePressure * 0.6 + instability * 0.4),
    0, 1,
  );

  // ── 2. Learning potential ─────────────────────────────────────────────────
  // HIGH protocols have more potential when headroom exists and fatigue is low.
  const headroom        = clamp(1 - obs.learningScore / 100, 0, 1);
  const fatigueClear    = clamp(1 - obs.fatigue / 100, 0, 1);
  const synchronyBonus  = clamp(obs.synchrony / 100, 0, 1);
  const learningPotential = clamp(
    p.learningRate * headroom * (fatigueClear * 0.7 + synchronyBonus * 0.3),
    0, 1,
  );

  // ── 3. Economy score ──────────────────────────────────────────────────────
  // Rewards protocols that are unlikely to push fatigue further.
  // At high current fatigue, lower-fatigueFactor protocols score better.
  const fatigueVulnerability = clamp(obs.fatigue / 100, 0, 1);
  const economy = clamp(
    1 - p.fatigueFactor * (0.5 + fatigueVulnerability * 0.5),
    0, 1,
  );

  // ── 4. Stability preservation ─────────────────────────────────────────────
  // Protocols with low stabilityDecayFactor are preferred when stability is low.
  const stabilityVulnerability = clamp(1 - obs.stability / 100, 0, 1);
  const stabilityPreservation = clamp(
    1 - p.stabilityDecayFactor * (0.4 + stabilityVulnerability * 0.6),
    0, 1,
  );

  // ── 5. Trend alignment ────────────────────────────────────────────────────
  // When learning is improving, maintain or increase intensity.
  // When declining, reduce intensity to consolidate.
  const slopeNorm = clamp(obs.trend.slopePerCycle / 3, -1, 1); // normalise slope
  let trendAlignment: number;
  if (obs.trend.direction === 'improving') {
    // Improving trend → reward higher intensity protocols
    trendAlignment = clamp(0.5 + slopeNorm * p.intensity * 0.5, 0, 1);
  } else if (obs.trend.direction === 'declining') {
    // Declining → reward lower intensity (inverse of intensity)
    trendAlignment = clamp(0.5 + Math.abs(slopeNorm) * (1 - p.intensity) * 0.5, 0, 1);
  } else {
    // Stagnant → mild preference for MEDIUM
    const mediumness = 1 - Math.abs(p.intensity - 0.55);
    trendAlignment = clamp(0.4 + mediumness * 0.3, 0, 1);
  }

  // ── 6. Retention signal ───────────────────────────────────────────────────
  // When retention is lagging behind learningScore, prefer moderate protocols
  // that consolidate without excessive variability.
  const retentionRatio = obs.learningScore > 0
    ? clamp(obs.retention / obs.learningScore, 0, 1.5)
    : 1;
  const retentionConcern = retentionRatio < T.RETENTION_CONCERN;
  let retentionSignal: number;
  if (retentionConcern) {
    // Prefer LOW or MEDIUM — avoid HIGH (high variability hurts retention)
    retentionSignal = clamp(1 - p.intensity * 0.6, 0, 1);
  } else {
    retentionSignal = 0.5; // neutral when retention is healthy
  }

  // ── 7. Hysteresis bonus ───────────────────────────────────────────────────
  // Small bonus for staying on current protocol to prevent oscillation.
  // Doubled when oscillation is detected (stronger dampening).
  const isCurrentProtocol = obs.lastProtocol === protocolId;
  const hysteresisMagnitude = oscillating ? T.HYSTERESIS_BONUS * 2 : T.HYSTERESIS_BONUS;
  const hysteresis = isCurrentProtocol ? hysteresisMagnitude : 0;

  // ── Weighted composite ────────────────────────────────────────────────────
  const w = { safety: 0.28, learningPotential: 0.22, economy: 0.16,
              stabilityPreservation: 0.18, trendAlignment: 0.10,
              retentionSignal: 0.06 };

  const total = clamp(
    safety              * w.safety +
    learningPotential   * w.learningPotential +
    economy             * w.economy +
    stabilityPreservation * w.stabilityPreservation +
    trendAlignment      * w.trendAlignment +
    retentionSignal     * w.retentionSignal +
    hysteresis,
    0, 1,
  );

  return {
    protocolId,
    total,
    components: {
      safety,
      learningPotential,
      economy,
      stabilityPreservation,
      trendAlignment,
      retentionSignal,
      hysteresis,
    },
  };
}

// ---------------------------------------------------------------------------
// gatherFiredConditions
// ---------------------------------------------------------------------------

/**
 * Inspect the observation and winning protocol score to collect the
 * conditions that most significantly drove the decision.
 * Each condition carries the actual numeric values that triggered it.
 */
function gatherFiredConditions(
  obs: ControllerObservation,
  winner: ProtocolScore,
  oscillating: boolean,
): FiredCondition[] {
  const conditions: FiredCondition[] = [];

  // Safety overrides
  if (obs.fatigue >= T.FATIGUE_CRITICAL) {
    conditions.push({
      tag: 'fatigue_critical',
      fragment: `fatigue (${obs.fatigue.toFixed(1)}) reached critical level (≥${T.FATIGUE_CRITICAL}), forcing recovery`,
      weight: 0.9,
    });
  } else if (obs.fatigue >= T.FATIGUE_HIGH) {
    conditions.push({
      tag: 'fatigue_high',
      fragment: `fatigue (${obs.fatigue.toFixed(1)}) is elevated (≥${T.FATIGUE_HIGH}), reducing stimulus load`,
      weight: 0.6,
    });
  }

  if (obs.stability <= T.STABILITY_CRITICAL) {
    conditions.push({
      tag: 'stability_critical',
      fragment: `stability (${obs.stability.toFixed(1)}) is critically low (≤${T.STABILITY_CRITICAL}), preventing further decay`,
      weight: 0.85,
    });
  } else if (obs.stability <= T.STABILITY_LOW) {
    conditions.push({
      tag: 'stability_low',
      fragment: `stability (${obs.stability.toFixed(1)}) is under stress (≤${T.STABILITY_LOW})`,
      weight: 0.5,
    });
  }

  // Learning phase signals
  if (obs.learningScore <= T.LEARNING_EARLY && obs.stability >= T.STABILITY_HEALTHY && obs.fatigue <= T.FATIGUE_CLEAR) {
    conditions.push({
      tag: 'high_capacity',
      fragment: `learning (${obs.learningScore.toFixed(1)}) is low with stability (${obs.stability.toFixed(1)}) and fatigue (${obs.fatigue.toFixed(1)}) both healthy — high-capacity window`,
      weight: 0.7,
    });
  }

  if (obs.learningScore >= T.LEARNING_HIGH && winner.components.stabilityPreservation < 0.5) {
    conditions.push({
      tag: 'learning_high_stability_falling',
      fragment: `learning score (${obs.learningScore.toFixed(1)}) is high but stability pressure is elevated (preservation score ${(winner.components.stabilityPreservation * 100).toFixed(0)}%)`,
      weight: 0.55,
    });
  }

  // Trend signals
  if (obs.trend.direction === 'improving' && obs.trend.slopePerCycle > T.TREND_IMPROVING) {
    conditions.push({
      tag: 'trend_improving',
      fragment: `learning trend is improving at +${obs.trend.slopePerCycle.toFixed(2)} pts/cycle over ${obs.trend.windowSize} cycles`,
      weight: 0.4,
    });
  } else if (obs.trend.direction === 'declining') {
    conditions.push({
      tag: 'trend_declining',
      fragment: `learning trend is declining at ${obs.trend.slopePerCycle.toFixed(2)} pts/cycle — consolidation preferred`,
      weight: 0.5,
    });
  } else if (obs.trend.direction === 'stagnant' && obs.cycleCount >= 3) {
    conditions.push({
      tag: 'trend_stagnant',
      fragment: `learning has been stagnant (slope ${obs.trend.slopePerCycle.toFixed(2)} pts/cycle) — adjusting stimulus`,
      weight: 0.35,
    });
  }

  // Retention signal
  const retentionRatio = obs.learningScore > 0 ? obs.retention / obs.learningScore : 1;
  if (retentionRatio < T.RETENTION_CONCERN && obs.cycleCount >= 2) {
    conditions.push({
      tag: 'retention_lagging',
      fragment: `retention (${obs.retention.toFixed(1)}) is lagging learning score (${obs.learningScore.toFixed(1)}) — ratio ${(retentionRatio * 100).toFixed(0)}% below threshold`,
      weight: 0.45,
    });
  }

  // Oscillation dampening
  if (oscillating) {
    conditions.push({
      tag: 'oscillation_dampened',
      fragment: `recent protocol sequence [${obs.recentProtocols.join('→')}] shows oscillation — applying hysteresis`,
      weight: 0.3,
    });
  }

  // Sort by weight descending so the most influential condition leads the reason
  return conditions.sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// generateDecisionReason
// ---------------------------------------------------------------------------

/**
 * Assemble a human-readable reason string from the top fired conditions.
 * Every value in the string originates from actual state variables.
 * The observation data is already embedded inside each condition's `fragment`
 * field, so only the winner score and conditions list are needed here.
 *
 * @param winner        - the winning protocol score
 * @param conditions    - fired conditions sorted by weight
 */
export function generateDecisionReason(
  winner: ProtocolScore,
  conditions: FiredCondition[],
): string {
  const protocolLabel = PROTOCOLS[winner.protocolId].label;
  const scorePercent  = (winner.total * 100).toFixed(1);

  if (conditions.length === 0) {
    return `${protocolLabel} selected (score ${scorePercent}%) — system in nominal state with no dominant signals.`;
  }

  // Use top 2 conditions for the main reason
  const primary   = conditions[0];
  const secondary = conditions.length > 1 ? conditions[1] : null;

  const base = `${protocolLabel} selected (score ${scorePercent}%): ${primary.fragment}`;
  return secondary
    ? `${base}; additionally, ${secondary.fragment}.`
    : `${base}.`;
}

// ---------------------------------------------------------------------------
// calculateControllerConfidence
// ---------------------------------------------------------------------------

/**
 * Compute confidence (0–1) in the decision.
 *
 * Confidence is high when:
 *  - The winning protocol's score clearly separates from the runner-up.
 *  - Multiple conditions unanimously point to the same protocol.
 *  - The system is not in a borderline / oscillating state.
 *
 * @param scores     - all three protocol scores
 * @param conditions - fired conditions for the winning decision
 * @param oscillating - whether oscillation was detected
 */
export function calculateControllerConfidence(
  scores: ProtocolScore[],
  conditions: FiredCondition[],
  oscillating: boolean,
): number {
  const sorted = [...scores].sort((a, b) => b.total - a.total);
  const best   = sorted[0].total;
  const second = sorted[1].total;

  // Score separation: larger gap → higher confidence
  const separation = clamp((best - second) / 0.3, 0, 1);

  // Condition agreement: high-weight conditions boost confidence
  const conditionStrength =
    conditions.length === 0 ? 0.5
    : clamp(conditions.reduce((s, c) => s + c.weight, 0) / conditions.length, 0, 1);

  // Oscillation penalty
  const oscillationPenalty = oscillating ? 0.15 : 0;

  const raw = separation * 0.55 + conditionStrength * 0.45 - oscillationPenalty;
  return clamp(raw, 0.05, 0.98);
}

// ---------------------------------------------------------------------------
// buildPredictedEffect
// ---------------------------------------------------------------------------

/**
 * Predict qualitative and quantitative effects of applying the chosen protocol
 * to the current state.  Uses the engine's own pure calculation functions so
 * predictions are grounded in the same math as actual updates.
 */
function buildPredictedEffect(
  obs: ControllerObservation,
  protocolId: TrainingProtocolId,
  state: Readonly<NeuralSystemState>,
): PredictedEffect {
  const p = PROTOCOLS[protocolId];

  // Re-use engine calculations on a read-only state snapshot
  const estLearningGain    = calculateLearningGain(state, p);
  const estStabilityChange = calculateStability(state, p);
  const estFatigueChange   = calculateFatigueChange(state, p);

  // Qualitative labels
  const learningGainLabel: PredictedEffect['learningGainLabel'] =
    estLearningGain >= 3.5 ? 'high' :
    estLearningGain >= 1.5 ? 'moderate' : 'low';

  const stabilityImpactLabel: PredictedEffect['stabilityImpactLabel'] =
    estStabilityChange <= -6 ? 'significant' :
    estStabilityChange <= -2 ? 'moderate' : 'minimal';

  const fatigueChangeLabel: PredictedEffect['fatigueChangeLabel'] =
    estFatigueChange < -1  ? 'recovery' :
    estFatigueChange < 4   ? 'neutral'  : 'accumulation';

  // Risk: combination of instability and fatigue accumulation
  const riskScore =
    (obs.fatigue / 100) * 0.4 +
    (1 - obs.stability / 100) * 0.4 +
    p.intensity * 0.2;

  const riskLevel: PredictedEffect['riskLevel'] =
    riskScore >= 0.6 ? 'high' :
    riskScore >= 0.35 ? 'moderate' : 'low';

  return {
    learningGainLabel,
    stabilityImpactLabel,
    fatigueChangeLabel,
    riskLevel,
    estimatedLearningGain:    parseFloat(estLearningGain.toFixed(3)),
    estimatedStabilityChange: parseFloat(estStabilityChange.toFixed(3)),
    estimatedFatigueChange:   parseFloat(estFatigueChange.toFixed(3)),
  };
}

// ---------------------------------------------------------------------------
// selectAdaptiveProtocol  (main entry point)
// ---------------------------------------------------------------------------

/**
 * Observe the current neural system state and select the most appropriate
 * training protocol for the next cycle.
 *
 * Decision policy (in priority order):
 *  1. Safety override — critical fatigue OR critical stability → LOW
 *  2. Protocol scoring — weighted multi-objective score across all three options
 *  3. Hysteresis dampening — small bonus for continuity; doubled if oscillating
 *
 * @param state - live NeuralSystemState (read-only; never mutated here)
 * @returns ControllerDecision with protocol, reason, confidence, and diagnostics
 */
export function selectAdaptiveProtocol(
  state: Readonly<NeuralSystemState>,
): ControllerDecision {
  const obs = extractObservation(state);
  const oscillating = detectOscillation(obs.recentProtocols);

  // ── Hard safety override (highest priority) ───────────────────────────────
  const safetyCritical =
    obs.fatigue >= T.FATIGUE_CRITICAL || obs.stability <= T.STABILITY_CRITICAL;

  let scores: ProtocolScore[];
  let winner: ProtocolScore;

  if (safetyCritical) {
    // Force LOW — score all but set LOW's score to 1.0 for transparency
    scores = (['LOW', 'MEDIUM', 'HIGH'] as TrainingProtocolId[]).map(id =>
      id === 'LOW'
        ? { protocolId: 'LOW', total: 1.0,
            components: { safety: 1, learningPotential: 0, economy: 1,
                          stabilityPreservation: 1, trendAlignment: 0,
                          retentionSignal: 0.5, hysteresis: 0 } }
        : { ...scoreProtocol(id, obs, oscillating), total: 0 },
    );
    winner = scores[0];
  } else {
    // Normal scoring path
    scores = (['LOW', 'MEDIUM', 'HIGH'] as TrainingProtocolId[]).map(id =>
      scoreProtocol(id, obs, oscillating),
    );
    winner = scores.reduce((best, s) => (s.total > best.total ? s : best));
  }

  const conditions   = gatherFiredConditions(obs, winner, oscillating);
  const reason       = generateDecisionReason(winner, conditions);
  const confidence   = calculateControllerConfidence(scores, conditions, oscillating);
  const predictedEffect = buildPredictedEffect(obs, winner.protocolId, state);

  return {
    protocol:       winner.protocolId,
    reason,
    confidence,
    observedState:  obs,
    predictedEffect,
    protocolScores: scores,
    firedConditions: conditions,
  };
}
