/**
 * NeuroForge — Knowledge Base
 *
 * 10 scientific concept cards with clear "What it means / Why NeuroForge uses it /
 * What is simulated / What is NOT claimed" structure.
 *
 * IMPORTANT: All cards explicitly separate simulated behavior from biological claims.
 */
import { useState } from 'react';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface KBCard {
  id: string;
  title: string;
  emoji: string;
  color: string;
  what: string;
  why: string;
  simulated: string;
  notClaimed: string;
  source?: { label: string; url: string };
}

const CARDS: KBCard[] = [
  {
    id: 'OI',
    title: 'Organoid Intelligence (OI)',
    emoji: '🧫',
    color: '#22d3ee',
    what: 'Organoid Intelligence is an emerging field that studies brain organoids — 3D clusters of human-derived neurons — as potential substrates for biological computing. The foundational 2023 OI paper (Smirnova et al., Frontiers in Science) explicitly proposes architecture involving organoids, electrophysiological recording, AI/ML, biofeedback, and connected input/output systems.',
    why: 'NeuroForge is directly inspired by the OI framework. The closed-loop training architecture mirrors the proposed electrophysiology → AI controller → stimulation → feedback pipeline.',
    simulated: 'NeuroForge simulates the AI controller and closed-loop feedback logic. The "neural system" is a computational model proxy for a biological organoid.',
    notClaimed: 'NeuroForge does NOT contain living biological tissue. It is not a real organoid experiment.',
    source: { label: 'Smirnova et al. 2023 — Organoid Intelligence', url: 'https://www.frontiersin.org/articles/10.3389/fscir.2023.1017235/full' },
  },
  {
    id: 'BCI',
    title: 'Brain-Computer Interfaces (BCI)',
    emoji: '🔌',
    color: '#a855f7',
    what: 'BCIs are systems that create a direct communication pathway between the brain and external devices. They typically involve recording neural activity (EEG, MEA, Utah array), decoding intent, and providing feedback stimulation.',
    why: 'The NeuroForge signal-processing and state-estimation pipeline is architecturally analogous to a closed-loop BCI system — it observes, decodes, and acts on neural state.',
    simulated: 'Signal processing, state estimation, and adaptive control are all simulated using mathematical proxies. No real neural recording hardware is used.',
    notClaimed: 'NeuroForge is not an implantable BCI device. It is a software simulation.',
  },
  {
    id: 'SNN',
    title: 'Spiking Neural Networks (SNN)',
    emoji: '⚡',
    color: '#f59e0b',
    what: 'SNNs are neural network models that more closely approximate biological neuron behavior by communicating through discrete spikes (action potentials) rather than continuous activations. They exhibit properties like temporal coding, refractory periods, and spike-timing dependent plasticity.',
    why: 'NeuroForge models spike rate, variability, and synchrony as simulation proxies inspired by SNN population dynamics. The raster plot visualizes simulated population firing.',
    simulated: 'Population firing rate, inter-spike interval variability, and synchrony are computed as mathematical abstractions. They are NOT an actual SNN implementation.',
    notClaimed: 'NeuroForge does not implement spiking neurons in the computational sense. The "spike rate" is a simulation parameter, not a real action potential measurement.',
  },
  {
    id: 'PLAST',
    title: 'Neuroplasticity',
    emoji: '🧬',
    color: '#10b981',
    what: 'Neuroplasticity is the brain\'s ability to reorganize itself by forming new neural connections. Hebbian plasticity ("neurons that fire together wire together"), long-term potentiation (LTP), and synaptic pruning are key mechanisms.',
    why: 'The learning gain and plasticity factor in NeuroForge are model proxies for synaptic plasticity. The adaptive controller attempts to exploit high-plasticity windows (analogous to LTP windows).',
    simulated: 'Plasticity is represented as a scalar multiplier on learning gains. It responds to simulated training conditions including fatigue and stability.',
    notClaimed: 'NeuroForge does not simulate individual synaptic connections or molecular plasticity mechanisms.',
  },
  {
    id: 'CLL',
    title: 'Closed-Loop Learning',
    emoji: '🔁',
    color: '#00f0ff',
    what: 'Closed-loop learning systems continuously observe the response to their interventions and use this feedback to adapt their strategy. They are more efficient than open-loop (fixed) systems because they can detect and respond to changes in the system state.',
    why: 'This is the core architectural principle of NeuroForge. The OBSERVE → ASSESS → TRAIN → MEASURE → ADAPT loop is a direct implementation of closed-loop learning.',
    simulated: 'The entire closed-loop pipeline is simulated. The neural system state, controller decisions, and feedback are all computational.',
    notClaimed: 'NeuroForge does not demonstrate a live closed-loop connection to biological tissue.',
  },
  {
    id: 'RC',
    title: 'Reservoir Computing',
    emoji: '🌊',
    color: '#7c3aed',
    what: 'Reservoir computing uses a fixed, high-dimensional dynamical system (the "reservoir") as a computational substrate. Only the output layer is trained. Brain organoids have been proposed as biological reservoirs due to their complex spontaneous dynamics.',
    why: 'The NeuroForge digital twin is conceptually inspired by reservoir computing — the neural system has intrinsic dynamics (synchrony, variability) that interact with training inputs.',
    simulated: 'Reservoir-like dynamics are approximated through the stability, synchrony, and variability state variables.',
    notClaimed: 'NeuroForge does not implement a formal reservoir computing architecture with readout layers.',
  },
  {
    id: 'AC',
    title: 'Adaptive Control Systems',
    emoji: '🎛',
    color: '#f43f5e',
    what: 'Adaptive control is a branch of control theory where the controller adapts its parameters in response to changes in the system it is controlling. Reinforcement learning-inspired approaches are common in neurostimulation research.',
    why: 'The AdaptiveTrainingController in NeuroForge is an adaptive controller. It adjusts protocol selection based on a real-time weighted scoring policy derived from live state values.',
    simulated: 'The controller uses a transparent, rule-based weighted scoring function — not a black-box ML model. All decisions are traceable.',
    notClaimed: 'The controller does not use deep reinforcement learning or claim to be an optimally trained AI.',
  },
  {
    id: 'LR',
    title: 'Learning vs. Retention',
    emoji: '📊',
    color: '#eab308',
    what: 'Learning (acquisition) and retention (consolidation) are distinct phases of memory formation. High performance during training does not guarantee retention after rest. Sleep and offline consolidation are critical for long-term memory.',
    why: 'NeuroForge explicitly separates the TRAIN phase (learning) from the REST → RETEST phase (retention). This is a core research axis: adaptive training should optimize both.',
    simulated: 'Retention is computed as post-rest performance / pre-rest performance × 100. The rest phase simulates forgetting curves and consolidation as model proxies.',
    notClaimed: 'NeuroForge does not model actual memory consolidation mechanisms such as hippocampal replay or sleep-dependent consolidation.',
  },
  {
    id: 'BC',
    title: 'Biological Computing',
    emoji: '🖥',
    color: '#64748b',
    what: 'Biological computing explores the use of living cells and biological systems as computational substrates. Brain organoids, DNA computing, and cellular automata are active research areas. The 2023 OI paper frames organoids as a promising substrate for future biological computers.',
    why: 'NeuroForge is a prototype of the software infrastructure that would be needed to interface with, train, and evaluate a biological computing system.',
    simulated: 'The computational behavior modeled in NeuroForge represents the AI/software side of such a system, not the biological substrate itself.',
    notClaimed: 'NeuroForge is not a biological computer. No biological computation is performed.',
  },
  {
    id: 'ETHICS',
    title: 'Ethics of Organoid Research',
    emoji: '⚖',
    color: '#94a3b8',
    what: 'The use of brain organoids in research raises important ethical questions about moral status, pain experience, and the implications of developing increasingly sophisticated biological neural systems. The OI field has an active ethics track led by researchers including Elan Ohayon.',
    why: 'NeuroForge acknowledges these ethical dimensions. The system is a computational simulation specifically to enable research without requiring biological tissue at this stage.',
    simulated: 'Nothing in NeuroForge involves living biological material. All experimentation is purely computational.',
    notClaimed: 'NeuroForge does not have moral status implications. It is a software prototype.',
    source: { label: 'OI Ethics — Frontiers in Science 2023', url: 'https://www.frontiersin.org/articles/10.3389/fscir.2023.1017235/full' },
  },
];

export function KnowledgeBase() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const filtered = CARDS.filter(c =>
    filter === '' ||
    c.title.toLowerCase().includes(filter.toLowerCase()) ||
    c.what.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--cyan-bright)', letterSpacing: '0.15em', marginBottom: '2px' }}>📚 KNOWLEDGE BASE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0' }}>SCIENTIFIC CONCEPTS BEHIND NEUROFORGE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '2px' }}>
              Each card separates what is simulated from what is not claimed
            </div>
          </div>
          <input
            type="text"
            placeholder="Search concepts…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '8px 14px', background: 'rgba(6,14,32,0.8)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: '#e2e8f0', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', outline: 'none', minWidth: '200px' }}
          />
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '12px' }}>
        {filtered.map(card => {
          const isOpen = expanded === card.id;
          return (
            <div key={card.id}
              className="glass-panel"
              style={{ padding: '0', overflow: 'hidden', border: `1px solid ${isOpen ? card.color + '60' : 'var(--border-subtle)'}`, transition: 'border-color 0.3s', boxShadow: isOpen ? `0 0 18px ${card.color}20` : 'none' }}>
              {/* Card header */}
              <div onClick={() => setExpanded(isOpen ? null : card.id)}
                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '1.4rem' }}>{card.emoji}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', fontWeight: 700, color: card.color }}>{card.title}</div>
                    {!isOpen && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--text-faint)', marginTop: '2px' }}>Click to expand</div>}
                  </div>
                </div>
                <div style={{ color: isOpen ? card.color : 'var(--text-faint)' }}>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${card.color}30` }}>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: card.color, letterSpacing: '0.1em', marginBottom: '4px' }}>WHAT IT MEANS</div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.7, margin: 0 }}>{card.what}</p>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#10b981', letterSpacing: '0.1em', marginBottom: '4px' }}>WHY NEUROFORGE USES IT</div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.7, margin: 0 }}>{card.why}</p>
                  </div>
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#10b981', letterSpacing: '0.1em', marginBottom: '4px' }}>✓ WHAT IS SIMULATED</div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#a7f3d0', lineHeight: 1.5, margin: 0 }}>{card.simulated}</p>
                  </div>
                  <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '6px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#eab308', letterSpacing: '0.1em', marginBottom: '4px' }}>✗ WHAT IS NOT CLAIMED</div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#fef3c7', lineHeight: 1.5, margin: 0 }}>{card.notClaimed}</p>
                  </div>
                  {card.source && (
                    <a href={card.source.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: card.color, textDecoration: 'none', opacity: 0.85 }}>
                      <ExternalLink size={12} /> {card.source.label}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <BookOpen size={30} color="var(--text-faint)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-faint)' }}>No matching concepts found</div>
        </div>
      )}
    </div>
  );
}
