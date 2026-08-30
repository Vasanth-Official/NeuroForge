/**
 * NeuroForge Simulation Engine — Type Definitions
 *
 * All types are pure data; no React or DOM imports here.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type TrainingProtocolId = 'LOW' | 'MEDIUM' | 'HIGH';

export type CyclePhase =
  | 'OBSERVE'
  | 'ASSESS'
  | 'TRAIN'
  | 'UPDATE'
  | 'MEASURE';

// ---------------------------------------------------------------------------
// Protocol definition
// ---------------------------------------------------------------------------

/**
 * Immutable parameter set that governs how a training protocol behaves.
 * All factors are normalised to [0, 1] unless noted.
 */
export interface TrainingProtocol {
  readonly id: TrainingProtocolId;
  readonly label: string;
  /** Overall stimulus intensity driving learning and stress. */
  readonly intensity: number;
  /** Base learning rate multiplier (0–1). */
  readonly learningRate: number;
  /** How fast stability erodes per cycle (0–1). */
  readonly stabilityDecayFactor: number;
  /** How quickly fatigue accumulates per cycle (0–1). */
  readonly fatigueFactor: number;
  /** Minimum fatigue recovery applied at the end of each cycle (0–1). */
  readonly baseRecovery: number;
  /** Short description shown in UI. */
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Neural-system state
// ---------------------------------------------------------------------------

/**
 * The mutable runtime state of the simulated neural system.
 * Every field is a plain number so it serialises trivially (JSON, storage, etc.).
 */
export interface NeuralSystemState {
  /** Accumulated learning 0–100. */
  learningScore: number;
  /** Structural/functional stability 0–100; high = more resilient. */
  stability: number;
  /** Degree of coordinated firing across the population 0–100. */
  synchrony: number;
  /** Effective firing rate in arbitrary simulation units (≥ 0). */
  spikeRate: number;
  /** Coefficient of variation of inter-spike intervals (0–1 range). */
  variability: number;
  /** Long-term retention of acquired learning 0–100. */
  retention: number;
  /** Cumulative fatigue 0–100; high fatigue degrades performance. */
  fatigue: number;
  /** Seed used for the PRNG so results are reproducible. */
  seed: number;
  /** Ordered log of completed training cycles. */
  trainingHistory: CycleRecord[];
}

// ---------------------------------------------------------------------------
// Per-cycle records
// ---------------------------------------------------------------------------

/**
 * Snapshot produced at the end of every completed training cycle.
 */
export interface CycleRecord {
  /** Sequential cycle index, starting at 1. */
  cycle: number;
  protocol: TrainingProtocolId;
  /** Phase-by-phase diagnostic values produced during this cycle. */
  phaseSnapshots: PhaseSnapshot[];
  /** Delta scores applied during the UPDATE phase. */
  deltas: CycleDeltas;
  /** Aggregate efficiency score for this cycle 0–100. */
  efficiency: number;
  /** Copy of the system state at the end of the cycle (post-UPDATE). */
  endState: Readonly<Omit<NeuralSystemState, 'trainingHistory'>>;
}

export interface PhaseSnapshot {
  phase: CyclePhase;
  /** Arbitrary key → value diagnostics captured during the phase. */
  metrics: Record<string, number>;
}

export interface CycleDeltas {
  learningGain: number;
  stabilityChange: number;
  retentionChange: number;
  fatigueChange: number;
  synchronyChange: number;
  spikeRateDelta: number;
  variabilityDelta: number;
}

// ---------------------------------------------------------------------------
// Assess-phase readiness report
// ---------------------------------------------------------------------------

export interface ReadinessAssessment {
  /** 0–1 composite readiness score. */
  readinessScore: number;
  /** Whether fatigue is high enough to meaningfully impair learning. */
  fatigueImpaired: boolean;
  /** Whether stability is dangerously low. */
  stabilityWarning: boolean;
  /** Effective learning-rate multiplier adjusted for current state. */
  effectiveLearningMultiplier: number;
}
