/**
 * NeuroForge BANN Engine — Bio-Inspired Adaptive Neural Network
 *
 * Implements a lightweight, bio-inspired neural plasticity model.
 * Inspired by Hebbian learning, STDP timing, homeostatic synaptic scaling,
 * and adaptive learning rates.
 *
 * THIS IS A COMPUTATIONAL MODEL — NOT BIOLOGICAL BRAIN TISSUES OR HUMAN COGNITION.
 */

import { createRng, nextNormal, clamp } from './seededRandom.ts';

// ---------------------------------------------------------------------------
// Model Interfaces
// ---------------------------------------------------------------------------

export type TaskType =
  | 'PATTERN_RECOGNITION'
  | 'COGNITIVE_FLEXIBILITY'
  | 'TACHISTOSCOPIC_RECALL'
  | 'MANUAL_STIMULUS';

export interface BannHyperparameters {
  learningRate: number;     // \eta_0 (default 0.05)
  difficulty: number;       // 0.1 to 1.0 (default 0.5)
  noiseLevel: number;       // \sigma (default 0.02)
  memoryDecay: number;      // \delta (default 0.005)
  rewardFactor: number;     // R (default 1.0)
  adaptationSpeed: number;  // Homeostasis speed (default 0.01)
  cycleCount: number;       // Cycles per batch (default 1)
}

export interface BannNeuron {
  id: string;
  label: string;
  layer: 'INPUT' | 'HIDDEN' | 'OUTPUT';
  position: [number, number, number]; // 3D coordinates [x, y, z]
  activation: number;      // a_i \in [0, 1]
  membranePotential: number; // v_i
  threshold: number;       // \theta_i
  refractory: number;      // steps remaining in refractory state
}

export interface BannSynapse {
  id: string;
  fromId: string;
  toId: string;
  weight: number;          // w_{ij} \in [-1, 2]
  lastDelta: number;       // \Delta w_{ij} from previous update
  eligibilityTrace: number;// e_{ij}
}

export interface BannState {
  neurons: BannNeuron[];
  synapses: BannSynapse[];
  hyperparams: BannHyperparameters;
  currentLearningRate: number; // \eta(t)
  adaptationState: number;    // Fatigue / metabolic load 0-100
  totalWeightChange: number;  // \sum |\Delta w| in last update
  meanActivation: number;     // Average activation across network
  cycle: number;
}

export interface BehavioralInputs {
  accuracy: number;        // 0 to 100 (%)
  errorRate: number;       // 0.0 to 1.0
  reactionTimeMs: number;  // Response latency (ms)
  confidence: number;      // 0.0 to 1.0
  difficulty: number;      // 0.1 to 1.0
  taskType: TaskType;
}

export interface BannTelemetry {
  cycle: number;
  accuracy: number;
  errorRate: number;
  reactionTimeMs: number;
  meanActivation: number;
  totalWeightChange: number;
  learningRate: number;
  memoryRetention: number;
  adaptationState: number;
  difficulty: number;
}

// ---------------------------------------------------------------------------
// Default Hyperparameters
// ---------------------------------------------------------------------------

export const DEFAULT_HYPERPARAMS: BannHyperparameters = {
  learningRate: 0.05,
  difficulty: 0.5,
  noiseLevel: 0.02,
  memoryDecay: 0.005,
  rewardFactor: 1.0,
  adaptationSpeed: 0.01,
  cycleCount: 1,
};

// ---------------------------------------------------------------------------
// Network Topology Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize a 14-neuron bio-inspired network topology in 3D space:
 * - 4 Input Neurons (Sensorimotor / Task encoding)
 * - 6 Hidden/Plastic Neurons (Interneuron processing array)
 * - 4 Output Neurons (Decision / Execution nodes)
 */
export function createInitialBannState(seed: number = 42, customHyperparams?: Partial<BannHyperparameters>): BannState {
  const hyperparams: BannHyperparameters = { ...DEFAULT_HYPERPARAMS, ...customHyperparams };
  const rng = createRng(seed);

  const neurons: BannNeuron[] = [
    // INPUT LAYER (Layer 0, X = -4.0)
    { id: 'n_in_0', label: 'IN-α1 (Visual)',     layer: 'INPUT',  position: [-4.0,  2.2, -1.2], activation: 0.2, membranePotential: 0.1, threshold: 0.4, refractory: 0 },
    { id: 'n_in_1', label: 'IN-α2 (Pattern)',    layer: 'INPUT',  position: [-4.0,  0.7,  1.5], activation: 0.15, membranePotential: 0.1, threshold: 0.4, refractory: 0 },
    { id: 'n_in_2', label: 'IN-β1 (Temporal)',   layer: 'INPUT',  position: [-4.0, -0.8, -1.5], activation: 0.25, membranePotential: 0.1, threshold: 0.4, refractory: 0 },
    { id: 'n_in_3', label: 'IN-β2 (Rule)',       layer: 'INPUT',  position: [-4.0, -2.2,  1.0], activation: 0.1, membranePotential: 0.1, threshold: 0.4, refractory: 0 },

    // HIDDEN / PLASTIC LAYER (Layer 1, X = 0.0)
    { id: 'n_hid_0', label: 'HID-γ1 (Interneuron)', layer: 'HIDDEN', position: [ 0.0,  3.0,  0.0], activation: 0.3, membranePotential: 0.2, threshold: 0.5, refractory: 0 },
    { id: 'n_hid_1', label: 'HID-γ2 (Plasticity)', layer: 'HIDDEN', position: [ 0.0,  1.5, -2.0], activation: 0.35, membranePotential: 0.2, threshold: 0.5, refractory: 0 },
    { id: 'n_hid_2', label: 'HID-γ3 (Associative)', layer: 'HIDDEN', position: [ 0.0,  0.0,  2.2], activation: 0.25, membranePotential: 0.2, threshold: 0.5, refractory: 0 },
    { id: 'n_hid_3', label: 'HID-γ4 (Gating)',      layer: 'HIDDEN', position: [ 0.0, -1.5, -1.8], activation: 0.4, membranePotential: 0.2, threshold: 0.5, refractory: 0 },
    { id: 'n_hid_4', label: 'HID-γ5 (Consolidator)',layer: 'HIDDEN', position: [ 0.0, -2.8,  0.5], activation: 0.2, membranePotential: 0.2, threshold: 0.5, refractory: 0 },
    { id: 'n_hid_5', label: 'HID-γ6 (Modulator)',   layer: 'HIDDEN', position: [ 0.0,  1.8,  1.8], activation: 0.45, membranePotential: 0.2, threshold: 0.5, refractory: 0 },

    // OUTPUT LAYER (Layer 2, X = 4.0)
    { id: 'n_out_0', label: 'OUT-ω1 (Recall)',   layer: 'OUTPUT', position: [ 4.0,  2.0, -1.0], activation: 0.1, membranePotential: 0.05, threshold: 0.6, refractory: 0 },
    { id: 'n_out_1', label: 'OUT-ω2 (Discrim)',  layer: 'OUTPUT', position: [ 4.0,  0.7,  1.2], activation: 0.1, membranePotential: 0.05, threshold: 0.6, refractory: 0 },
    { id: 'n_out_2', label: 'OUT-ω3 (Adapt)',    layer: 'OUTPUT', position: [ 4.0, -0.7, -1.2], activation: 0.1, membranePotential: 0.05, threshold: 0.6, refractory: 0 },
    { id: 'n_out_3', label: 'OUT-ω4 (Execution)',layer: 'OUTPUT', position: [ 4.0, -2.0,  0.8], activation: 0.1, membranePotential: 0.05, threshold: 0.6, refractory: 0 },
  ];

  const synapses: BannSynapse[] = [];
  let synCount = 0;

  // Connect Input -> Hidden
  neurons.filter(n => n.layer === 'INPUT').forEach(inNode => {
    neurons.filter(n => n.layer === 'HIDDEN').forEach(hidNode => {
      // Connect with ~70% density
      if (nextNormal(rng, 0.5, 0.3) > 0.2) {
        const initWeight = parseFloat(clamp(nextNormal(rng, 0.45, 0.15), 0.1, 0.9).toFixed(3));
        synapses.push({
          id: `syn_${synCount++}`,
          fromId: inNode.id,
          toId: hidNode.id,
          weight: initWeight,
          lastDelta: 0,
          eligibilityTrace: 0,
        });
      }
    });
  });

  // Connect Lateral Hidden -> Hidden
  const hiddenNodes = neurons.filter(n => n.layer === 'HIDDEN');
  for (let i = 0; i < hiddenNodes.length; i++) {
    for (let j = 0; j < hiddenNodes.length; j++) {
      if (i !== j && nextNormal(rng, 0.5, 0.3) > 0.5) {
        const initWeight = parseFloat(clamp(nextNormal(rng, 0.25, 0.1), 0.05, 0.6).toFixed(3));
        synapses.push({
          id: `syn_${synCount++}`,
          fromId: hiddenNodes[i].id,
          toId: hiddenNodes[j].id,
          weight: initWeight,
          lastDelta: 0,
          eligibilityTrace: 0,
        });
      }
    }
  }

  // Connect Hidden -> Output
  hiddenNodes.forEach(hidNode => {
    neurons.filter(n => n.layer === 'OUTPUT').forEach(outNode => {
      if (nextNormal(rng, 0.5, 0.3) > 0.25) {
        const initWeight = parseFloat(clamp(nextNormal(rng, 0.5, 0.15), 0.1, 0.95).toFixed(3));
        synapses.push({
          id: `syn_${synCount++}`,
          fromId: hidNode.id,
          toId: outNode.id,
          weight: initWeight,
          lastDelta: 0,
          eligibilityTrace: 0,
        });
      }
    });
  });

  return {
    neurons,
    synapses,
    hyperparams,
    currentLearningRate: hyperparams.learningRate,
    adaptationState: 10, // low initial fatigue
    totalWeightChange: 0,
    meanActivation: 0.25,
    cycle: 0,
  };
}

// ---------------------------------------------------------------------------
// Activation Function (Sigmoid with gain & threshold)
// ---------------------------------------------------------------------------
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-clamp(x, -10, 10)));
}

// ---------------------------------------------------------------------------
// Model State Update (Learning Loop Core)
// ---------------------------------------------------------------------------

/**
 * Execute a single BANN learning step:
 * 1. Convert behavioral input into input layer stimulus drive.
 * 2. Propagate forward activations through synapses with noise injection.
 * 3. Evaluate prediction vs actual demand (Error).
 * 4. Apply error-modulated Hebbian plasticity to synapses.
 * 5. Perform homeostatic synaptic scaling to preserve network stability.
 * 6. Adjust adaptive learning rate and adaptation/fatigue state.
 */
export function updateBannState(
  state: BannState,
  inputs: BehavioralInputs,
  seedModifier: number = 0
): BannTelemetry {
  const rng = createRng((state.cycle + 1) * 999331 + seedModifier);
  const hp = state.hyperparams;

  state.cycle += 1;

  // 1. Map Behavioral Inputs to Input Layer Stimulus
  const accNorm = inputs.accuracy / 100; // 0 to 1
  const errorNorm = clamp(inputs.errorRate, 0, 1);
  const rtNorm = clamp(inputs.reactionTimeMs / 3000, 0, 1); // normalized latency
  const diffNorm = clamp(inputs.difficulty, 0.1, 1.0);

  const inputDrives: Record<string, number> = {
    'n_in_0': accNorm * 0.8 + (1 - rtNorm) * 0.2,
    'n_in_1': (1 - errorNorm) * 0.9 + inputs.confidence * 0.1,
    'n_in_2': diffNorm * 0.7 + rtNorm * 0.3,
    'n_in_3': (inputs.taskType === 'COGNITIVE_FLEXIBILITY' ? 0.9 : inputs.taskType === 'PATTERN_RECOGNITION' ? 0.7 : 0.4) * diffNorm,
  };

  // Set Input Neuron Activations
  state.neurons.forEach(n => {
    if (n.layer === 'INPUT') {
      const drive = inputDrives[n.id] ?? 0.5;
      const noise = nextNormal(rng, 0, hp.noiseLevel);
      n.activation = clamp(drive + noise, 0, 1);
    }
  });

  // Map neuron lookup for fast access
  const neuronMap = new Map<string, BannNeuron>();
  state.neurons.forEach(n => neuronMap.set(n.id, n));

  // 2. Forward Propagation (Hidden and Output Layers)
  ['HIDDEN', 'OUTPUT'].forEach(layerType => {
    state.neurons.filter(n => n.layer === layerType).forEach(targetNode => {
      let incomingSum = 0;
      state.synapses.forEach(syn => {
        if (syn.toId === targetNode.id) {
          const sourceNode = neuronMap.get(syn.fromId);
          if (sourceNode) {
            incomingSum += sourceNode.activation * syn.weight;
          }
        }
      });

      // Inject synaptic noise & leak
      const noise = nextNormal(rng, 0, hp.noiseLevel);
      const netPotential = incomingSum - targetNode.threshold + noise;
      targetNode.membranePotential = netPotential;
      targetNode.activation = parseFloat(sigmoid(netPotential * 2.5).toFixed(4));
    });
  });

  // Calculate Mean Activation
  const totalAct = state.neurons.reduce((sum, n) => sum + n.activation, 0);
  state.meanActivation = parseFloat((totalAct / state.neurons.length).toFixed(4));

  // 3. Error & Plasticity Computation
  // Prediction accuracy: output activation vs actual task demand
  const outActivations = state.neurons.filter(n => n.layer === 'OUTPUT').map(n => n.activation);
  const meanOutputAct = outActivations.reduce((a, b) => a + b, 0) / (outActivations.length || 1);

  // Model prediction error: difference between neural output activity and human performance target
  const targetOutputDrive = accNorm * (1 - errorNorm);
  const predictionError = Math.abs(targetOutputDrive - meanOutputAct);

  // Dynamic Learning Rate Adaptation:
  // Increases when error is high (needs adjustment), cools when error is low (consolidation)
  const errFactor = predictionError * 0.15 - (1 - errorNorm) * 0.05;
  state.currentLearningRate = clamp(
    state.currentLearningRate * (1 + errFactor),
    0.005,
    0.35
  );

  const eta = state.currentLearningRate;
  const reward = hp.rewardFactor * (accNorm - errorNorm * 0.5);
  let totalWDelta = 0;

  // 4. Update Synaptic Weights via Hebbian Plasticity + Memory Decay + Reward Modulation
  state.synapses.forEach(syn => {
    const pre = neuronMap.get(syn.fromId);
    const post = neuronMap.get(syn.toId);
    if (!pre || !post) return;

    // Hebbian co-activation: pre * post
    const hebbianTerm = pre.activation * post.activation;

    // Synaptic eligibility trace update
    syn.eligibilityTrace = syn.eligibilityTrace * 0.8 + hebbianTerm * 0.2;

    // Weight delta: Hebbian gain + Reward-modulated eligibility trace - Memory decay
    const deltaW = eta * (hebbianTerm + reward * syn.eligibilityTrace - hp.memoryDecay * syn.weight);

    syn.lastDelta = parseFloat(deltaW.toFixed(5));
    syn.weight = clamp(syn.weight + deltaW, -0.5, 2.5);
    totalWDelta += Math.abs(deltaW);
  });

  state.totalWeightChange = parseFloat(totalWDelta.toFixed(4));

  // 5. Homeostatic Synaptic Scaling (prevents exploding / collapsing weights over 10k cycles)
  const targetMeanWeight = 0.55;
  const currentMeanWeight = state.synapses.reduce((sum, s) => sum + s.weight, 0) / (state.synapses.length || 1);
  const scalingFactor = 1 + hp.adaptationSpeed * (targetMeanWeight - currentMeanWeight);

  state.synapses.forEach(syn => {
    syn.weight = parseFloat(clamp(syn.weight * scalingFactor, 0.02, 2.2).toFixed(4));
  });

  // 6. Adaptation State & Fatigue Update
  // Fatigue accumulates with task difficulty and response latency; recovers slightly per cycle
  const fatigueGain = diffNorm * 1.8 + rtNorm * 1.2;
  const fatigueRecovery = 1.0;
  state.adaptationState = parseFloat(clamp(state.adaptationState + fatigueGain - fatigueRecovery, 0, 100).toFixed(2));

  // 7. Memory Retention Computation
  // Retention consolidates with synaptic stability and low decay
  const memoryRetention = parseFloat(
    clamp(accNorm * 100 * Math.exp(-hp.memoryDecay * 10) * (1 - state.adaptationState / 200), 0, 100).toFixed(2)
  );

  return {
    cycle: state.cycle,
    accuracy: parseFloat(inputs.accuracy.toFixed(1)),
    errorRate: parseFloat(inputs.errorRate.toFixed(3)),
    reactionTimeMs: parseFloat(inputs.reactionTimeMs.toFixed(0)),
    meanActivation: state.meanActivation,
    totalWeightChange: state.totalWeightChange,
    learningRate: parseFloat(state.currentLearningRate.toFixed(4)),
    memoryRetention,
    adaptationState: state.adaptationState,
    difficulty: parseFloat(inputs.difficulty.toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Batch Cycle Execution (Up to 10,000 Cycles)
// ---------------------------------------------------------------------------

/**
 * Execute a fast multi-cycle batch training run (e.g. 10, 100, 1,000, or 10,000 cycles).
 * Generates natural bio-inspired learning progression with plateaus, noise, and adaptation.
 */
export function runBannBatch(
  state: BannState,
  cycles: number,
  baseInputs: Partial<BehavioralInputs> = {}
): BannTelemetry[] {
  const telemetryHistory: BannTelemetry[] = [];
  const rng = createRng(state.cycle + 42);

  // Baseline behavioral state trajectory
  let currentAcc = baseInputs.accuracy ?? 50.0;
  let currentDiff = baseInputs.difficulty ?? state.hyperparams.difficulty;
  const taskType = baseInputs.taskType ?? 'PATTERN_RECOGNITION';

  for (let c = 0; c < cycles; c++) {
    // Natural non-linear performance progression with learning plateaus & noise
    const noise = nextNormal(rng, 0, 1.8);
    const plateauFactor = Math.sin(c / 80) * 2.5; // realistic cognitive fluctuations
    
    // Performance improves as weights adapt, but degrades under high fatigue/difficulty
    const learningPush = state.currentLearningRate * 12.0 * (1 - currentAcc / 110);
    const fatiguePenalty = (state.adaptationState / 100) * 1.5;

    currentAcc = clamp(currentAcc + learningPush - fatiguePenalty + noise + plateauFactor, 15, 99.5);
    const currentError = parseFloat(((100 - currentAcc) / 100).toFixed(3));
    const currentRt = parseFloat((800 + (1 - currentAcc / 100) * 1200 + currentDiff * 400 + nextNormal(rng, 0, 40)).toFixed(0));

    const inputs: BehavioralInputs = {
      accuracy: parseFloat(currentAcc.toFixed(1)),
      errorRate: currentError,
      reactionTimeMs: currentRt,
      confidence: parseFloat((currentAcc / 100 * 0.85 + 0.15).toFixed(2)),
      difficulty: currentDiff,
      taskType,
    };

    const telemetry = updateBannState(state, inputs, c);
    telemetryHistory.push(telemetry);

    // Adaptive difficulty adjustment every 50 cycles
    if (c > 0 && c % 50 === 0) {
      if (currentAcc > 82 && currentDiff < 0.95) currentDiff = parseFloat((currentDiff + 0.05).toFixed(2));
      else if (currentAcc < 45 && currentDiff > 0.15) currentDiff = parseFloat((currentDiff - 0.05).toFixed(2));
    }
  }

  return telemetryHistory;
}
