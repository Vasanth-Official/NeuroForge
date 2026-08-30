/**
 * NeuroForge Simulation Engine — Core Engine
 *
 * This module owns the only mutable state in the simulation layer:
 * the `NeuralSystemState` object.  All other modules are pure.
 *
 * Exported public API:
 *   initializeNeuralSystem()
 *   simulateNeuralActivity()   (re-exported wrapper)
 *   applyTrainingProtocol()
 *   calculateLearningGain()    (re-exported from calculations)
 *   calculateStability()       (re-exported from calculations)
 *   calculateRetention()       (re-exported from calculations)
 *   calculateTrainingEfficiency()  (re-exported from calculations)
 *   runTrainingCycle()
 */

import type {
  CycleDeltas,
  CycleRecord,
  NeuralSystemState,
  PhaseSnapshot,
  TrainingProtocolId,
} from './types.ts';
import { createRng, nextNormal, clamp } from './seededRandom.ts';
import { getProtocol } from './protocols.ts';
import {
  assessReadiness,
  calculateFatigueChange,
  calculateLearningGain,
  calculateRetention,
  calculateStability,
  calculateSynchronyChange,
  calculateTrainingEfficiency,
  simulateNeuralActivity,
} from './calculations.ts';

// ---------------------------------------------------------------------------
// Re-exports (public API surface lives in index.ts but these are the impls)
// ---------------------------------------------------------------------------
export {
  calculateLearningGain,
  calculateRetention,
  calculateStability,
  calculateTrainingEfficiency,
  simulateNeuralActivity,
};

// ---------------------------------------------------------------------------
// initializeNeuralSystem
// ---------------------------------------------------------------------------

/**
 * Create a fresh, zeroed neural system state.
 *
 * The `seed` parameter ensures that all subsequent simulations driven by
 * this state are fully reproducible.
 *
 * @param seed - integer seed for the PRNG (default: 42)
 */
export function initializeNeuralSystem(seed: number = 42): NeuralSystemState {
  return {
    learningScore: 0,
    stability: 75,       // systems start at healthy but not perfect stability
    synchrony: 45,       // moderate baseline synchrony
    spikeRate: 12,       // idling baseline (≈ BASE_SPIKE_RATE)
    variability: 0.35,   // moderate variability at rest
    retention: 0,
    fatigue: 0,
    seed,
    trainingHistory: [],
  };
}

// ---------------------------------------------------------------------------
// applyTrainingProtocol
// ---------------------------------------------------------------------------

/**
 * Run a single complete training cycle against `state` using the specified
 * protocol, following the five mandatory phases:
 *
 *   OBSERVE → ASSESS → TRAIN → UPDATE → MEASURE
 *
 * The function mutates `state` in-place and appends a `CycleRecord` to
 * `state.trainingHistory`.
 *
 * @param state      - current neural system state (mutated)
 * @param protocolId - which training protocol to apply
 * @returns the `CycleRecord` produced by this cycle
 */
export function applyTrainingProtocol(
  state: NeuralSystemState,
  protocolId: TrainingProtocolId,
): CycleRecord {
  return runTrainingCycle(state, protocolId);
}

// ---------------------------------------------------------------------------
// runTrainingCycle  (the five-phase pipeline)
// ---------------------------------------------------------------------------

/**
 * Execute the full OBSERVE → ASSESS → TRAIN → UPDATE → MEASURE pipeline.
 *
 * Phase descriptions
 * ──────────────────
 * OBSERVE  Capture baseline activity metrics for this cycle.
 * ASSESS   Evaluate system readiness; compute effective learning multipliers.
 * TRAIN    Calculate all gains and losses driven by the active protocol.
 * UPDATE   Apply computed deltas to the live state.
 * MEASURE  Record efficiency and snapshot the post-update state.
 *
 * @param state      - current neural system state (mutated)
 * @param protocolId - which training protocol to apply
 * @returns the completed `CycleRecord`
 */
export function runTrainingCycle(
  state: NeuralSystemState,
  protocolId: TrainingProtocolId,
): CycleRecord {
  const protocol = getProtocol(protocolId);
  const cycleIndex = state.trainingHistory.length + 1;
  const phaseSnapshots: PhaseSnapshot[] = [];

  // ── Advance the seeded PRNG ──────────────────────────────────────────────
  // Each cycle advances the seed deterministically so repeated calls on the
  // same state remain reproducible without ever using Math.random().
  const rng = createRng(state.seed + cycleIndex * 1_000_003);

  // Draw a small jitter sample for activity simulation.
  // nextNormal with mean=0, stddev=0.5 stays well within [-2, 2].
  const jitter = nextNormal(rng, 0, 0.5);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1: OBSERVE
  // Measure current activity metrics (read-only snapshot).
  // ══════════════════════════════════════════════════════════════════════════
  const observed = simulateNeuralActivity(state, protocol, jitter);

  phaseSnapshots.push({
    phase: 'OBSERVE',
    metrics: {
      spikeRate: parseFloat(observed.spikeRate.toFixed(3)),
      variability: parseFloat(observed.variability.toFixed(4)),
      currentFatigue: state.fatigue,
      currentStability: state.stability,
      currentSynchrony: state.synchrony,
      currentLearningScore: state.learningScore,
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2: ASSESS
  // Evaluate system readiness; determine effective training parameters.
  // ══════════════════════════════════════════════════════════════════════════
  const assessment = assessReadiness(state, protocol);

  phaseSnapshots.push({
    phase: 'ASSESS',
    metrics: {
      readinessScore: parseFloat(assessment.readinessScore.toFixed(4)),
      effectiveLearningMultiplier: parseFloat(
        assessment.effectiveLearningMultiplier.toFixed(4),
      ),
      fatigueImpaired: assessment.fatigueImpaired ? 1 : 0,
      stabilityWarning: assessment.stabilityWarning ? 1 : 0,
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3: TRAIN
  // Compute all deltas using pure calculation functions.
  // Nothing is applied to state yet.
  // ══════════════════════════════════════════════════════════════════════════
  const learningGain = calculateLearningGain(state, protocol);
  const stabilityChange = calculateStability(state, protocol);
  const retentionChange = calculateRetention(state, learningGain);
  const fatigueChange = calculateFatigueChange(state, protocol);
  const synchronyChange = calculateSynchronyChange(state, protocol);

  // Spike-rate and variability deltas (difference from current stored values)
  const spikeRateDelta = observed.spikeRate - state.spikeRate;
  const variabilityDelta = observed.variability - state.variability;

  phaseSnapshots.push({
    phase: 'TRAIN',
    metrics: {
      learningGain: parseFloat(learningGain.toFixed(4)),
      stabilityChange: parseFloat(stabilityChange.toFixed(4)),
      retentionChange: parseFloat(retentionChange.toFixed(4)),
      fatigueChange: parseFloat(fatigueChange.toFixed(4)),
      synchronyChange: parseFloat(synchronyChange.toFixed(4)),
      spikeRateDelta: parseFloat(spikeRateDelta.toFixed(3)),
      variabilityDelta: parseFloat(variabilityDelta.toFixed(4)),
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 4: UPDATE
  // Apply all computed deltas to the live state.
  // ══════════════════════════════════════════════════════════════════════════
  const prevLearningScore = state.learningScore;
  const prevStability = state.stability;
  const prevRetention = state.retention;
  const prevFatigue = state.fatigue;
  const prevSynchrony = state.synchrony;

  state.learningScore = clamp(state.learningScore + learningGain, 0, 100);
  state.stability = clamp(state.stability + stabilityChange, 0, 100);
  state.retention = clamp(state.retention + retentionChange, 0, 100);
  state.fatigue = clamp(state.fatigue + fatigueChange, 0, 100);
  state.synchrony = clamp(state.synchrony + synchronyChange, 0, 100);
  state.spikeRate = observed.spikeRate;
  state.variability = observed.variability;

  // Advance the stored seed for the next cycle
  state.seed = state.seed + cycleIndex * 1_000_003;

  phaseSnapshots.push({
    phase: 'UPDATE',
    metrics: {
      learningScoreDelta: parseFloat(
        (state.learningScore - prevLearningScore).toFixed(4),
      ),
      stabilityDelta: parseFloat((state.stability - prevStability).toFixed(4)),
      retentionDelta: parseFloat((state.retention - prevRetention).toFixed(4)),
      fatigueDelta: parseFloat((state.fatigue - prevFatigue).toFixed(4)),
      synchronyDelta: parseFloat(
        (state.synchrony - prevSynchrony).toFixed(4),
      ),
      newLearningScore: parseFloat(state.learningScore.toFixed(3)),
      newStability: parseFloat(state.stability.toFixed(3)),
      newRetention: parseFloat(state.retention.toFixed(3)),
      newFatigue: parseFloat(state.fatigue.toFixed(3)),
      newSynchrony: parseFloat(state.synchrony.toFixed(3)),
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5: MEASURE
  // Compute efficiency and assemble the CycleRecord.
  // ══════════════════════════════════════════════════════════════════════════
  const efficiency = calculateTrainingEfficiency(
    learningGain,
    stabilityChange,
    fatigueChange,
    protocol,
  );

  phaseSnapshots.push({
    phase: 'MEASURE',
    metrics: {
      efficiency: parseFloat(efficiency.toFixed(3)),
      cumulativeLearning: parseFloat(state.learningScore.toFixed(3)),
      cumulativeRetention: parseFloat(state.retention.toFixed(3)),
    },
  });

  // ── Assemble CycleDeltas record ──────────────────────────────────────────
  const deltas: CycleDeltas = {
    learningGain: parseFloat(learningGain.toFixed(4)),
    stabilityChange: parseFloat(stabilityChange.toFixed(4)),
    retentionChange: parseFloat(retentionChange.toFixed(4)),
    fatigueChange: parseFloat(fatigueChange.toFixed(4)),
    synchronyChange: parseFloat(synchronyChange.toFixed(4)),
    spikeRateDelta: parseFloat(spikeRateDelta.toFixed(3)),
    variabilityDelta: parseFloat(variabilityDelta.toFixed(4)),
  };

  // ── Snapshot post-update state (without history to avoid circular refs) ─
  const endState: CycleRecord['endState'] = {
    learningScore: parseFloat(state.learningScore.toFixed(3)),
    stability: parseFloat(state.stability.toFixed(3)),
    synchrony: parseFloat(state.synchrony.toFixed(3)),
    spikeRate: parseFloat(state.spikeRate.toFixed(3)),
    variability: parseFloat(state.variability.toFixed(4)),
    retention: parseFloat(state.retention.toFixed(3)),
    fatigue: parseFloat(state.fatigue.toFixed(3)),
    seed: state.seed,
  };

  const record: CycleRecord = {
    cycle: cycleIndex,
    protocol: protocolId,
    phaseSnapshots,
    deltas,
    efficiency,
    endState,
  };

  state.trainingHistory.push(record);
  return record;
}
