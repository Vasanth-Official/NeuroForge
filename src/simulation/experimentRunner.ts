/**
 * NeuroForge — Experiment Runner
 *
 * Orchestrates multi-protocol parallel experiments, REST/RETEST retention
 * analysis, and multi-trial benchmarks with seeded randomization.
 *
 * All output values are derived from the simulation — never hardcoded.
 *
 * SIMULATION PROXY — These results represent computational model behavior,
 * not measured biological data.
 */

import type { NeuralSystemState, TrainingProtocolId } from './types.ts';
import { initializeNeuralSystem, runTrainingCycle } from './engine.ts';
import { selectAdaptiveProtocol } from './controller.ts';
import { clamp } from './seededRandom.ts';

// ── New experiment types ─────────────────────────────────────────────────────

export type BiologicalState =
  | 'IDLE'
  | 'LEARNING'
  | 'HIGH_PLASTICITY'
  | 'FATIGUED'
  | 'UNSTABLE'
  | 'RECOVERING'
  | 'PLATEAU';

export type ComparisonProtocol = 'RANDOM' | 'FIXED' | 'NEUROFORGE_ADAPTIVE';

export interface ExperimentConfig {
  episodes: number;           // training cycles per protocol
  restCycles: number;         // rest cycles after training (for retention test)
  seed: number;
  noiseLevel: number;         // 0–1, added as perturbation to state
  plasticityFactor: number;   // 0–1, multiplier on learning gains
  taskDifficulty: number;     // 0–1
  trainingIntensity: number;  // 0–1, scales protocol intensity
}

export interface PerEpisodePoint {
  episode: number;
  learning: number;
  stability: number;
  fatigue: number;
  retention: number;
  synchrony: number;
  stimCost: number;
  efficiency: number;
}

export interface RestPhaseResult {
  preRestLearning: number;
  preRestRetention: number;
  postRestLearning: number;
  postRestRetention: number;
  retentionPct: number;        // postRest / preRest × 100
  fatigueDrop: number;
}

export interface ProtocolExperimentResult {
  protocol: ComparisonProtocol;
  finalLearning: number;
  finalRetention: number;
  finalStability: number;
  finalFatigue: number;
  finalSynchrony: number;
  totalStimCost: number;
  avgEfficiency: number;
  rest: RestPhaseResult;
  history: PerEpisodePoint[];
  peakLearning: number;
  cyclesAbove80pct: number;
}

export interface ExperimentResult {
  id: string;
  timestamp: number;
  config: ExperimentConfig;
  random: ProtocolExperimentResult;
  fixed: ProtocolExperimentResult;
  adaptive: ProtocolExperimentResult;
  bestProtocol: ComparisonProtocol;
  objectiveScores: Record<ComparisonProtocol, number>;
}

export interface BenchmarkStats {
  mean: number;
  sd: number;
  min: number;
  max: number;
  median: number;
}

export interface BenchmarkResult {
  trials: number;
  config: ExperimentConfig;
  learning: Record<ComparisonProtocol, BenchmarkStats>;
  retention: Record<ComparisonProtocol, BenchmarkStats>;
  stability: Record<ComparisonProtocol, BenchmarkStats>;
  fatigue: Record<ComparisonProtocol, BenchmarkStats>;
  stimCost: Record<ComparisonProtocol, BenchmarkStats>;
  bestProtocolFrequency: Record<ComparisonProtocol, number>;
}

// ── Biological state classifier ──────────────────────────────────────────────

export function classifyBiologicalState(state: NeuralSystemState): BiologicalState {
  if (state.fatigue > 70) return 'FATIGUED';
  if (state.stability < 35) return 'UNSTABLE';
  if (state.fatigue > 40 && state.learningScore > 50) return 'RECOVERING';
  if (state.learningScore > 80 && state.stability > 70) return 'PLATEAU';
  if (state.synchrony > 75 && state.learningScore > 30) return 'HIGH_PLASTICITY';
  if (state.learningScore > 10 || state.trainingHistory.length > 0) return 'LEARNING';
  return 'IDLE';
}

export function biologicalStateColor(bs: BiologicalState): string {
  const map: Record<BiologicalState, string> = {
    IDLE: '#64748b',
    LEARNING: '#22d3ee',
    HIGH_PLASTICITY: '#a855f7',
    FATIGUED: '#f97316',
    UNSTABLE: '#f43f5e',
    RECOVERING: '#10b981',
    PLATEAU: '#eab308',
  };
  return map[bs];
}

export function biologicalStateDescription(bs: BiologicalState): string {
  const map: Record<BiologicalState, string> = {
    IDLE: 'System at baseline. No active training stimulation detected.',
    LEARNING: 'Active learning in progress. Synaptic weights are being modified.',
    HIGH_PLASTICITY: 'High plasticity window. Optimal conditions for learning consolidation.',
    FATIGUED: 'Fatigue threshold exceeded. Training efficiency is compromised. Rest recommended.',
    UNSTABLE: 'Network stability critically low. Risk of pathological activity patterns.',
    RECOVERING: 'Active recovery phase. Fatigue clearing, retention being consolidated.',
    PLATEAU: 'Learning plateau detected. Diminishing returns on current protocol.',
  };
  return map[bs];
}

// ── Protocol mapping ─────────────────────────────────────────────────────────
// RANDOM   → always picks a random protocol each cycle (control condition)
// FIXED    → alternates LOW→MEDIUM→HIGH on a fixed schedule (non-adaptive)
// ADAPTIVE → uses existing selectAdaptiveProtocol() (NeuroForge controller)

function selectRandomProtocol(seed: number, cycle: number): TrainingProtocolId {
  const ids: TrainingProtocolId[] = ['LOW', 'MEDIUM', 'HIGH'];
  const idx = Math.abs(Math.sin(seed * 9973 + cycle * 1337) * 1000) % 3 | 0;
  return ids[idx];
}

function selectFixedProtocol(cycle: number): TrainingProtocolId {
  const schedule: TrainingProtocolId[] = ['LOW', 'MEDIUM', 'HIGH'];
  return schedule[cycle % 3];
}

// ── Apply noise perturbation to state (simulates biological variability) ─────
function applyNoise(state: NeuralSystemState, noise: number, seed: number, cycle: number): void {
  if (noise <= 0) return;
  const jitter = Math.sin(seed * 7919 + cycle * 2053) * noise * 8;
  state.learningScore = clamp(state.learningScore + jitter * 0.3, 0, 100);
  state.stability = clamp(state.stability + jitter * 0.5, 0, 100);
  state.synchrony = clamp(state.synchrony + jitter * 0.2, 0, 100);
}

// ── Compute stimulation cost for a cycle ─────────────────────────────────────
function cycleCost(protocolId: TrainingProtocolId): number {
  const costs: Record<TrainingProtocolId, number> = { LOW: 3, MEDIUM: 7, HIGH: 14 };
  return costs[protocolId];
}

// ── Run a single protocol simulation ─────────────────────────────────────────
function runProtocolSimulation(
  protocol: ComparisonProtocol,
  config: ExperimentConfig,
): ProtocolExperimentResult {
  const state = initializeNeuralSystem(config.seed);
  const history: PerEpisodePoint[] = [];
  let totalStimCost = 0;
  let totalEfficiency = 0;
  let peakLearning = 0;
  let cyclesAbove80 = 0;

  for (let ep = 0; ep < config.episodes; ep++) {
    // Select protocol based on type
    let pid: TrainingProtocolId;
    if (protocol === 'RANDOM') {
      pid = selectRandomProtocol(config.seed, ep);
    } else if (protocol === 'FIXED') {
      pid = selectFixedProtocol(ep);
    } else {
      // Adaptive — use existing NeuroForge controller
      const decision = selectAdaptiveProtocol(state);
      pid = decision.protocol;
    }

    const record = runTrainingCycle(state, pid);

    // Apply noise after training
    applyNoise(state, config.noiseLevel, config.seed, ep);

    // Apply plasticity scaling (higher plasticity = amplified learning)
    const plasticityBoost = (config.plasticityFactor - 0.5) * 5;
    state.learningScore = clamp(state.learningScore + plasticityBoost, 0, 100);

    const cost = cycleCost(pid);
    totalStimCost += cost;
    totalEfficiency += record.efficiency;

    if (state.learningScore > peakLearning) peakLearning = state.learningScore;
    if (state.learningScore >= 80) cyclesAbove80++;

    history.push({
      episode: ep + 1,
      learning: +state.learningScore.toFixed(2),
      stability: +state.stability.toFixed(2),
      fatigue: +state.fatigue.toFixed(2),
      retention: +state.retention.toFixed(2),
      synchrony: +state.synchrony.toFixed(2),
      stimCost: totalStimCost,
      efficiency: +record.efficiency.toFixed(2),
    });
  }

  // ── REST PHASE ─────────────────────────────────────────────────────────────
  const preRestLearning = state.learningScore;
  const preRestRetention = state.retention;
  const preFatigue = state.fatigue;

  // During rest: fatigue recovers, retention consolidates, learning slightly decays
  for (let r = 0; r < config.restCycles; r++) {
    state.fatigue = clamp(state.fatigue - 6, 0, 100);
    state.retention = clamp(state.retention + 1.5, 0, 100);
    // Slight forgetting
    state.learningScore = clamp(state.learningScore - 0.8 - config.noiseLevel * 2, 0, 100);
    state.stability = clamp(state.stability + 1, 0, 100);
  }

  // ── RETEST PHASE ────────────────────────────────────────────────────────────
  // Run a few training cycles post-rest to assess retained performance
  for (let r = 0; r < Math.min(5, config.episodes * 0.2 | 0 + 2); r++) {
    const pid = protocol === 'RANDOM'
      ? selectRandomProtocol(config.seed, config.episodes + r)
      : protocol === 'FIXED'
        ? selectFixedProtocol(r)
        : selectAdaptiveProtocol(state).protocol;
    runTrainingCycle(state, pid);
  }

  const postRestLearning = state.learningScore;
  const postRestRetention = state.retention;
  const retentionPct = preRestLearning > 0
    ? clamp((postRestLearning / preRestLearning) * 100, 0, 100)
    : 0;

  const rest: RestPhaseResult = {
    preRestLearning: +preRestLearning.toFixed(2),
    preRestRetention: +preRestRetention.toFixed(2),
    postRestLearning: +postRestLearning.toFixed(2),
    postRestRetention: +postRestRetention.toFixed(2),
    retentionPct: +retentionPct.toFixed(2),
    fatigueDrop: +(preFatigue - state.fatigue).toFixed(2),
  };

  return {
    protocol,
    finalLearning: +state.learningScore.toFixed(2),
    finalRetention: +state.retention.toFixed(2),
    finalStability: +state.stability.toFixed(2),
    finalFatigue: +state.fatigue.toFixed(2),
    finalSynchrony: +state.synchrony.toFixed(2),
    totalStimCost: +totalStimCost.toFixed(1),
    avgEfficiency: config.episodes > 0 ? +(totalEfficiency / config.episodes).toFixed(2) : 0,
    rest,
    history,
    peakLearning: +peakLearning.toFixed(2),
    cyclesAbove80pct: cyclesAbove80,
  };
}

// ── Objective function (higher = better) ─────────────────────────────────────
// Weights: learning 40%, retention 30%, stability 20%, low fatigue 10%
// Stimulation cost applied as a mild penalty
function computeObjectiveScore(r: ProtocolExperimentResult): number {
  const costPenalty = Math.min(30, r.totalStimCost / 20);
  return (
    r.finalLearning * 0.4 +
    r.rest.retentionPct * 0.3 +
    r.finalStability * 0.2 +
    (100 - r.finalFatigue) * 0.1 -
    costPenalty
  );
}

// ── Main experiment runner ────────────────────────────────────────────────────

export function runExperiment(config: ExperimentConfig): ExperimentResult {
  const random = runProtocolSimulation('RANDOM', config);
  const fixed = runProtocolSimulation('FIXED', config);
  const adaptive = runProtocolSimulation('NEUROFORGE_ADAPTIVE', config);

  const scores: Record<ComparisonProtocol, number> = {
    RANDOM: computeObjectiveScore(random),
    FIXED: computeObjectiveScore(fixed),
    NEUROFORGE_ADAPTIVE: computeObjectiveScore(adaptive),
  };

  const bestProtocol = Object.entries(scores).reduce(
    (best, [k, v]) => v > scores[best] ? (k as ComparisonProtocol) : best,
    'RANDOM' as ComparisonProtocol,
  );

  return {
    id: `EXP-${Date.now().toString(36).toUpperCase()}`,
    timestamp: Date.now(),
    config,
    random,
    fixed,
    adaptive,
    bestProtocol,
    objectiveScores: scores,
  };
}

// ── Multi-trial benchmark ─────────────────────────────────────────────────────

function computeStats(values: number[]): BenchmarkStats {
  if (values.length === 0) return { mean: 0, sd: 0, min: 0, max: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    mean: +mean.toFixed(2),
    sd: +Math.sqrt(variance).toFixed(2),
    min: +sorted[0].toFixed(2),
    max: +sorted[sorted.length - 1].toFixed(2),
    median: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
  };
}

export function runBenchmark(
  baseConfig: ExperimentConfig,
  trials: number,
  onProgress?: (done: number, total: number) => void,
): BenchmarkResult {
  const protocols: ComparisonProtocol[] = ['RANDOM', 'FIXED', 'NEUROFORGE_ADAPTIVE'];
  const collected: Record<ComparisonProtocol, {
    learning: number[]; retention: number[]; stability: number[];
    fatigue: number[]; stimCost: number[];
  }> = {
    RANDOM: { learning: [], retention: [], stability: [], fatigue: [], stimCost: [] },
    FIXED: { learning: [], retention: [], stability: [], fatigue: [], stimCost: [] },
    NEUROFORGE_ADAPTIVE: { learning: [], retention: [], stability: [], fatigue: [], stimCost: [] },
  };
  const bestCounts: Record<ComparisonProtocol, number> = {
    RANDOM: 0, FIXED: 0, NEUROFORGE_ADAPTIVE: 0,
  };

  for (let t = 0; t < trials; t++) {
    const config = { ...baseConfig, seed: baseConfig.seed + t * 997 };
    const result = runExperiment(config);

    for (const p of protocols) {
      const r = p === 'RANDOM' ? result.random : p === 'FIXED' ? result.fixed : result.adaptive;
      collected[p].learning.push(r.finalLearning);
      collected[p].retention.push(r.rest.retentionPct);
      collected[p].stability.push(r.finalStability);
      collected[p].fatigue.push(r.finalFatigue);
      collected[p].stimCost.push(r.totalStimCost);
    }
    bestCounts[result.bestProtocol]++;
    onProgress?.(t + 1, trials);
  }

  const makeStats = (proto: ComparisonProtocol, key: keyof typeof collected.RANDOM) =>
    computeStats(collected[proto][key]);

  return {
    trials,
    config: baseConfig,
    learning: {
      RANDOM: makeStats('RANDOM', 'learning'),
      FIXED: makeStats('FIXED', 'learning'),
      NEUROFORGE_ADAPTIVE: makeStats('NEUROFORGE_ADAPTIVE', 'learning'),
    },
    retention: {
      RANDOM: makeStats('RANDOM', 'retention'),
      FIXED: makeStats('FIXED', 'retention'),
      NEUROFORGE_ADAPTIVE: makeStats('NEUROFORGE_ADAPTIVE', 'retention'),
    },
    stability: {
      RANDOM: makeStats('RANDOM', 'stability'),
      FIXED: makeStats('FIXED', 'stability'),
      NEUROFORGE_ADAPTIVE: makeStats('NEUROFORGE_ADAPTIVE', 'stability'),
    },
    fatigue: {
      RANDOM: makeStats('RANDOM', 'fatigue'),
      FIXED: makeStats('FIXED', 'fatigue'),
      NEUROFORGE_ADAPTIVE: makeStats('NEUROFORGE_ADAPTIVE', 'fatigue'),
    },
    stimCost: {
      RANDOM: makeStats('RANDOM', 'stimCost'),
      FIXED: makeStats('FIXED', 'stimCost'),
      NEUROFORGE_ADAPTIVE: makeStats('NEUROFORGE_ADAPTIVE', 'stimCost'),
    },
    bestProtocolFrequency: bestCounts,
  };
}

// ── Default experiment config ─────────────────────────────────────────────────
export const DEFAULT_EXPERIMENT_CONFIG: ExperimentConfig = {
  episodes: 30,
  restCycles: 5,
  seed: 42,
  noiseLevel: 0.15,
  plasticityFactor: 0.5,
  taskDifficulty: 0.5,
  trainingIntensity: 0.5,
};

// ── Experiment log entry ──────────────────────────────────────────────────────
export interface ExperimentLogEntry {
  id: string;
  label: string;
  timestamp: number;
  config: ExperimentConfig;
  result: ExperimentResult;
}
