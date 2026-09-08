/**
 * NeuroForge Simulation Engine — Public API
 *
 * Import everything you need from this single barrel file.
 *
 * Example:
 *   import {
 *     initializeNeuralSystem,
 *     runTrainingCycle,
 *     PROTOCOLS,
 *   } from '../simulation';
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  CycleDeltas,
  CyclePhase,
  CycleRecord,
  NeuralSystemState,
  PhaseSnapshot,
  ReadinessAssessment,
  TrainingProtocol,
  TrainingProtocolId,
  TaskType,
  BannHyperparameters,
  BannNeuron,
  BannSynapse,
  BannState,
  BehavioralInputs,
  BannTelemetry,
} from './types.ts';

export {
  createInitialBannState,
  updateBannState,
  runBannBatch,
  DEFAULT_HYPERPARAMS,
} from './bann.ts';


// ── PRNG utilities (exposed for advanced / testing use) ───────────────────
export {
  clamp,
  createRng,
  nextFloat,
  nextNormal,
  nextRange,
} from './seededRandom.ts';

// ── Protocol registry ──────────────────────────────────────────────────────
export { getProtocol, PROTOCOL_IDS, PROTOCOLS } from './protocols.ts';

// ── Pure calculation functions (unit-testable) ────────────────────────────
export {
  assessReadiness,
  calculateFatigueChange,
  calculateLearningGain,
  calculateRetention,
  calculateStability,
  calculateSynchronyChange,
  calculateTrainingEfficiency,
  sigmoid,
  simulateNeuralActivity,
} from './calculations.ts';

// ── Engine (stateful) ─────────────────────────────────────────────────────
export {
  applyTrainingProtocol,
  initializeNeuralSystem,
  runTrainingCycle,
} from './engine.ts';

// ── Adaptive controller ───────────────────────────────────────────────────
export type {
  ControllerDecision,
  ControllerObservation,
  FiredCondition,
  LearningTrend,
  PredictedEffect,
  ProtocolScore,
} from './controller.ts';

export {
  calculateControllerConfidence,
  computeLearningTrend,
  generateDecisionReason,
  selectAdaptiveProtocol,
} from './controller.ts';

// ── Experiment Runner ──────────────────────────────────────────────────────
export type {
  BiologicalState,
  ComparisonProtocol,
  ExperimentConfig,
  ExperimentLogEntry,
  ExperimentResult,
  BenchmarkResult,
  BenchmarkStats,
  PerEpisodePoint,
  ProtocolExperimentResult,
  RestPhaseResult,
} from './experimentRunner.ts';

export {
  classifyBiologicalState,
  biologicalStateColor,
  biologicalStateDescription,
  runExperiment,
  runBenchmark,
  DEFAULT_EXPERIMENT_CONFIG,
} from './experimentRunner.ts';
