/**
 * NeuroForge Simulation Engine — Training Protocol Definitions
 *
 * Each protocol is a frozen constant object.  Adding a new protocol
 * requires only a new entry here — the engine and calculations modules
 * consume them through the shared interface, not switch statements.
 */

import type { TrainingProtocol, TrainingProtocolId } from './types.ts';

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

const LOW_PROTOCOL: TrainingProtocol = Object.freeze({
  id: 'LOW' as const,
  label: 'Low Intensity',
  description:
    'Slow but steady learning with high stability and minimal fatigue.',
  // Core parameters
  intensity: 0.25,
  learningRate: 0.30,
  stabilityDecayFactor: 0.04,
  fatigueFactor: 0.08,
  baseRecovery: 0.12,
});

const MEDIUM_PROTOCOL: TrainingProtocol = Object.freeze({
  id: 'MEDIUM' as const,
  label: 'Medium Intensity',
  description:
    'Balanced trade-off between learning speed, stability and fatigue.',
  intensity: 0.55,
  learningRate: 0.55,
  stabilityDecayFactor: 0.14,
  fatigueFactor: 0.22,
  baseRecovery: 0.08,
});

const HIGH_PROTOCOL: TrainingProtocol = Object.freeze({
  id: 'HIGH' as const,
  label: 'High Intensity',
  description:
    'Accelerated learning with significant instability and fatigue risk.',
  intensity: 0.88,
  learningRate: 0.78,
  stabilityDecayFactor: 0.32,
  fatigueFactor: 0.45,
  baseRecovery: 0.05,
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROTOCOLS: Readonly<Record<TrainingProtocolId, TrainingProtocol>> =
  Object.freeze({
    LOW: LOW_PROTOCOL,
    MEDIUM: MEDIUM_PROTOCOL,
    HIGH: HIGH_PROTOCOL,
  });

/**
 * Retrieve a protocol by its ID.
 * Throws a descriptive error rather than returning `undefined` so callers
 * do not have to guard against missing protocols.
 */
export function getProtocol(id: TrainingProtocolId): TrainingProtocol {
  const protocol = PROTOCOLS[id];
  if (!protocol) {
    throw new Error(`Unknown training protocol: "${id as string}"`);
  }
  return protocol;
}

/** Ordered list of all available protocol IDs (LOW → MEDIUM → HIGH). */
export const PROTOCOL_IDS: readonly TrainingProtocolId[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
] as const;
