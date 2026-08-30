import { useState, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { RotateCcw, Activity, BookOpen, Layers } from 'lucide-react';

import {
  initializeNeuralSystem,
  runTrainingCycle,
  selectAdaptiveProtocol,
  type NeuralSystemState,
  type ControllerDecision,
} from './simulation';
import { NeuroTask } from './components/NeuroTask';
import { NeuralVisualization } from './components/NeuralVisualization';
import { ExperimentComparison } from './components/ExperimentComparison';
import './App.css';

export default function App() {
  const [systemState, setSystemState] = useState<NeuralSystemState>(() => initializeNeuralSystem());
  const stateRef = useRef<NeuralSystemState>(systemState);
  const [decision, setDecision] = useState<ControllerDecision | null>(null);

  const handleManualCycle = useCallback(() => {
    const currentState = { ...stateRef.current };
    
    // OBSERVE -> ASSESS -> ADAPTIVE DECISION
    const newDecision = selectAdaptiveProtocol(currentState);
    
    // TRAIN -> UPDATE -> REASSESS
    runTrainingCycle(currentState, newDecision.protocol);
    
    stateRef.current = currentState;
    setSystemState(currentState);
    setDecision(newDecision);
  }, []);

  const handleTrialComplete = useCallback((accuracy: number, responseTimeMs: number) => {
    const currentState = { ...stateRef.current };
    
    // Map Human Performance to State Adjustments
    const accuracyFactor = accuracy / 100;
    
    // Stability: reward high accuracy, heavily penalize low accuracy
    const stabilityDelta = accuracyFactor >= 0.75 ? 3 : -12 * (1 - accuracyFactor);
    currentState.stability = Math.max(0, Math.min(100, currentState.stability + stabilityDelta));
    
    // Fatigue: accumulates based on response time and cognitive load
    const timePenalty = (responseTimeMs / 1000) * 1.5;
    currentState.fatigue = Math.max(0, Math.min(100, currentState.fatigue + timePenalty));

    // Controller Observes Updated State -> ADAPTIVE DECISION
    const newDecision = selectAdaptiveProtocol(currentState);
    
    // Engine Runs Training Cycle (TRAIN -> UPDATE -> REASSESS)
    runTrainingCycle(currentState, newDecision.protocol);

    // Commit state updates to React
    stateRef.current = currentState;
    setSystemState(currentState);
    setDecision(newDecision);
  }, []);

  const handleReset = useCallback(() => {
    const initialState = initializeNeuralSystem();
    stateRef.current = initialState;
    setSystemState(initialState);
    setDecision(null);
  }, []);

  const history = systemState.trainingHistory;

  // Prepare data for charts
  const chartData = history.map((record) => ({
    cycle: record.cycle,
    protocol: record.protocol,
    learningScore: record.endState.learningScore,
    stability: record.endState.stability,
    retention: record.endState.retention,
    spikeRate: record.endState.spikeRate,
    fatigue: record.endState.fatigue,
    synchrony: record.endState.synchrony,
  }));

  // Protocol history mapping for numeric bar chart
  const protocolData = history.map((record) => {
    let protocolValue = 0;
    if (record.protocol === 'LOW') protocolValue = 1;
    if (record.protocol === 'MEDIUM') protocolValue = 2;
    if (record.protocol === 'HIGH') protocolValue = 3;
    return {
      cycle: record.cycle,
      protocol: protocolValue,
      label: record.protocol,
    };
  });

  // Delta calculations for scientific metric presentation
  const prevRecord = history.length > 1 ? history[history.length - 2] : null;
  const currRecord = history.length > 0 ? history[history.length - 1] : null;
  const learningDelta = currRecord && prevRecord 
    ? currRecord.endState.learningScore - prevRecord.endState.learningScore 
    : (currRecord ? currRecord.endState.learningScore : 0);

  return (
    <div className="notebook-page">
      
      {/* Official Simulation Classification Stamp */}
      <div style={{ 
        backgroundColor: '#fffbeb', 
        color: '#b45309', 
        padding: '8px 16px', 
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        fontWeight: 700,
        marginBottom: '24px',
        border: '1px solid #fde68a',
        letterSpacing: '0.12em'
      }}>
        CLASSIFICATION NOTICE: INTERACTIVE COMPUTATIONAL SIMULATION — NOT BIOLOGICAL EXPERIMENTAL DATA
      </div>

      {/* Laboratory Journal Header */}
      <header style={{ 
        borderBottom: '2px solid var(--border-ink)', 
        paddingBottom: '16px', 
        marginBottom: '28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.72rem', 
            fontWeight: 700, 
            letterSpacing: '0.15em', 
            color: 'var(--ink-muted)',
            textTransform: 'uppercase'
          }}>
            JOURNAL OF COMPUTATIONAL NEUROSCIENCE | LAB PROTOCOL NF-2026-01
          </div>
          <h1 style={{ 
            margin: '4px 0 0 0', 
            fontFamily: 'var(--font-serif)', 
            fontSize: '2.2rem', 
            fontWeight: 700,
            lineHeight: 1.15
          }}>
            NEUROFORGE: ADAPTIVE NEURAL TRAINING LABORATORY
          </h1>
        </div>

        <button 
          onClick={handleReset}
          style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
            backgroundColor: 'var(--paper-sheet)',
            color: 'var(--ink-dark)',
            border: '1px solid var(--border-ink)',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RotateCcw size={14}/> RESET EXPERIMENTAL STATE
        </button>
      </header>

      {/* Scientific Research Notebook Overview Card */}
      <section className="lab-panel">
        <div className="lab-panel-header">
          <h2 className="lab-title">
            <BookOpen size={18} color="var(--ink-dark)"/> EXPERIMENT 001: CLOSED-LOOP ADAPTIVE POTENTIATION
          </h2>
          <span className="fig-caption">SUBJECT POPULATION: VIRTUAL SYNAPTIC ARRAY α-07</span>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '20px',
          fontFamily: 'var(--font-serif)',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <div>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
              [I] RESEARCH QUESTION
            </strong>
            <p style={{ marginTop: '4px', color: 'var(--ink-dark)' }}>
              Can an adaptive closed-loop controller maintain population stability while maximizing long-term potentiation during variable-intensity stimulus protocols?
            </p>
          </div>
          <div>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
              [II] HYPOTHESIS
            </strong>
            <p style={{ marginTop: '4px', color: 'var(--ink-dark)' }}>
              Dynamic feedback adjustment of stimulus intensity based on real-time neural fatigue and synchrony indicators will prevent catastrophic decay and accelerate learning retention.
            </p>
          </div>
          <div>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
              [III] METHODOLOGY
            </strong>
            <p style={{ marginTop: '4px', color: 'var(--ink-dark)' }}>
              Trial-by-trial visual sequence reconstruction (NeuroTask) feeds accuracy & latency metrics directly into state update equations, triggering dynamic controller protocol selection.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive NeuroTask Experimental Apparatus */}
      <NeuroTask 
        systemState={systemState}
        decision={decision}
        lastRecord={history.length > 0 ? history[history.length - 1] : null}
        onTrialComplete={handleTrialComplete}
        onManualCycle={handleManualCycle}
      />

      {/* Automated Control vs Adaptive Experiment Comparison */}
      <ExperimentComparison />

      {/* Biological Neural Network Visualization (FIG. 01) */}
      <section className="lab-panel">
        <div className="lab-panel-header">
          <h2 className="lab-title">
            <Layers size={18} color="var(--color-blue)"/> FIG. 01 — BIOLOGICAL NEURAL POPULATION & SYNAPTIC ACTIVITY
          </h2>
          <span className="fig-caption">REAL-TIME ACTION POTENTIAL PROPAGATION</span>
        </div>
        <NeuralVisualization systemState={systemState} />
      </section>

      {/* Laboratory Measurements & Scientific Metrics */}
      <section className="lab-panel">
        <div className="lab-panel-header">
          <h2 className="lab-title">
            <Activity size={18} color="var(--color-green)"/> POPULATION STATE OBSERVATIONS
          </h2>
          <span className="fig-caption">COMPLETED CYCLES: #{String(history.length).padStart(3, '0')}</span>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          {/* Learning Index */}
          <div className="metric-box" style={{ borderLeft: '4px solid var(--color-green)' }}>
            <div className="metric-label">LEARNING INDEX</div>
            <div className="metric-value" style={{ color: 'var(--color-green)' }}>
              {systemState.learningScore.toFixed(2)}
            </div>
            <div className="metric-sub">
              {learningDelta >= 0 ? `+${learningDelta.toFixed(2)}` : learningDelta.toFixed(2)} from previous cycle
            </div>
          </div>

          {/* Stability Index */}
          <div className="metric-box" style={{ borderLeft: `4px solid ${systemState.stability < 35 ? 'var(--color-red)' : 'var(--color-green)'}` }}>
            <div className="metric-label">STABILITY INDEX</div>
            <div className="metric-value" style={{ color: systemState.stability < 35 ? 'var(--color-red)' : 'var(--ink-dark)' }}>
              {systemState.stability.toFixed(2)}
            </div>
            <div className="metric-sub">
              {systemState.stability < 35 ? 'CRITICAL INSTABILITY' : 'WITHIN OPERATING RANGE'}
            </div>
          </div>

          {/* Neural Synchrony */}
          <div className="metric-box" style={{ borderLeft: '4px solid var(--color-blue)' }}>
            <div className="metric-label">NEURAL SYNCHRONY</div>
            <div className="metric-value" style={{ color: 'var(--color-blue)' }}>
              {systemState.synchrony.toFixed(2)}
            </div>
            <div className="metric-sub">γ-BAND PHASE COHERENCE</div>
          </div>

          {/* Retention */}
          <div className="metric-box" style={{ borderLeft: '4px solid var(--color-green)' }}>
            <div className="metric-label">MEMORIES RETENTION</div>
            <div className="metric-value" style={{ color: 'var(--color-green)' }}>
              {systemState.retention.toFixed(2)}
            </div>
            <div className="metric-sub">CONSOLIDATED MEMORY</div>
          </div>

          {/* Spike Rate */}
          <div className="metric-box" style={{ borderLeft: '4px solid var(--color-blue)' }}>
            <div className="metric-label">SPIKE RATE</div>
            <div className="metric-value" style={{ color: 'var(--color-blue)' }}>
              {systemState.spikeRate.toFixed(1)} <span style={{ fontSize: '1rem' }}>Hz</span>
            </div>
            <div className="metric-sub">MEAN DISCHARGE FREQUENCY</div>
          </div>

          {/* Fatigue */}
          <div className="metric-box" style={{ borderLeft: '4px solid var(--color-orange)' }}>
            <div className="metric-label">METABOLIC FATIGUE</div>
            <div className="metric-value" style={{ color: 'var(--color-orange)' }}>
              {systemState.fatigue.toFixed(1)}%
            </div>
            <div className="metric-sub">ATP DEPLETION LOAD</div>
          </div>

          {/* Population Variability */}
          <div className="metric-box">
            <div className="metric-label">VARIABILITY</div>
            <div className="metric-value" style={{ fontSize: '1.4rem' }}>
              {systemState.variability.toFixed(4)}
            </div>
            <div className="metric-sub">STD DEV SPIKE INTERVALS</div>
          </div>
        </div>
      </section>

      {/* Adaptive Decision Observations notebook section */}
      <section className="lab-panel" style={{ backgroundColor: 'var(--color-purple-bg)', borderColor: 'var(--color-purple)' }}>
        <div className="lab-panel-header" style={{ borderColor: 'rgba(107, 33, 168, 0.3)' }}>
          <h2 className="lab-title" style={{ color: 'var(--color-purple)' }}>
            ADAPTIVE CONTROLLER EXPERIMENTAL OBSERVATION
          </h2>
          <span className="fig-caption" style={{ color: 'var(--color-purple)' }}>
            CLOSED-LOOP POLICY EVALUATION
          </span>
        </div>

        {decision ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            <div>
              <strong style={{ color: 'var(--ink-muted)', textTransform: 'uppercase' }}>[A] OBSERVATION</strong>
              <p style={{ marginTop: '6px', fontSize: '0.9rem', color: 'var(--ink-dark)' }}>
                {decision.reason}
              </p>
            </div>

            <div>
              <strong style={{ color: 'var(--ink-muted)', textTransform: 'uppercase' }}>[B] ADAPTIVE RESPONSE</strong>
              <div style={{ marginTop: '6px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-purple)' }}>
                PROTOCOL ADJUSTED → {decision.protocol}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', marginTop: '2px' }}>
                SELECTION CONFIDENCE: {(decision.confidence * 100).toFixed(1)}%
              </div>
            </div>

            <div>
              <strong style={{ color: 'var(--ink-muted)', textTransform: 'uppercase' }}>[C] RATIONALE & PREDICTED IMPACT</strong>
              <p style={{ marginTop: '6px', fontStyle: 'italic', color: 'var(--ink-dark)' }}>
                Learning Gain: {decision.predictedEffect.learningGainLabel} | Stability Impact: {decision.predictedEffect.stabilityImpactLabel} | Fatigue Accumulation: {decision.predictedEffect.fatigueChangeLabel}
              </p>
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-faint)' }}>
            Initial condition established. Execute an experimental trial to record adaptive decisions.
          </p>
        )}
      </section>

      {/* Experimental Figures & Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* FIG. 02: Learning & Retention */}
        <div className="lab-panel">
          <div className="lab-panel-header">
            <h3 className="lab-title" style={{ fontSize: '1.05rem' }}>
              FIG. 02 — LEARNING INDEX & RETENTION TRAJECTORY
            </h3>
          </div>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eae4d5" />
                <XAxis dataKey="cycle" stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                <YAxis domain={[0, 100]} stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fcfaf4', border: '1px solid #292524', fontFamily: 'var(--font-mono)', fontSize: '12px' }} 
                />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                <Line type="monotone" dataKey="learningScore" stroke="#15803d" name="Learning Index" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="retention" stroke="#16a34a" name="Retention" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FIG. 03: Stability & Fatigue */}
        <div className="lab-panel">
          <div className="lab-panel-header">
            <h3 className="lab-title" style={{ fontSize: '1.05rem' }}>
              FIG. 03 — SYSTEM STABILITY VS METABOLIC FATIGUE
            </h3>
          </div>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eae4d5" />
                <XAxis dataKey="cycle" stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                <YAxis domain={[0, 100]} stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fcfaf4', border: '1px solid #292524', fontFamily: 'var(--font-mono)', fontSize: '12px' }} 
                />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                <Line type="monotone" dataKey="stability" stroke="#b91c1c" name="Stability" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="fatigue" stroke="#c2410c" name="Fatigue Load" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FIG. 04: Spike Rate & Synchrony */}
        <div className="lab-panel">
          <div className="lab-panel-header">
            <h3 className="lab-title" style={{ fontSize: '1.05rem' }}>
              FIG. 04 — SPIKE RATE & γ-BAND PHASE SYNCHRONY
            </h3>
          </div>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eae4d5" />
                <XAxis dataKey="cycle" stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                <YAxis yAxisId="left" domain={[0, 100]} stroke="#1d4ed8" fontSize={11} fontFamily="var(--font-mono)" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#0284c7" fontSize={11} fontFamily="var(--font-mono)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fcfaf4', border: '1px solid #292524', fontFamily: 'var(--font-mono)', fontSize: '12px' }} 
                />
                <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                <Line yAxisId="left" type="monotone" dataKey="spikeRate" stroke="#1d4ed8" name="Spike Rate (Hz)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="synchrony" stroke="#0284c7" name="Synchrony (%)" strokeWidth={2} strokeDasharray="2 2" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FIG. 05: Protocol Distribution */}
        <div className="lab-panel">
          <div className="lab-panel-header">
            <h3 className="lab-title" style={{ fontSize: '1.05rem' }}>
              FIG. 05 — CONTROLLER PROTOCOL TRANSITIONS
            </h3>
          </div>
          <div style={{ height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={protocolData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eae4d5" />
                <XAxis dataKey="cycle" stroke="#57534e" fontSize={11} fontFamily="var(--font-mono)" />
                <YAxis 
                  domain={[0, 4]} 
                  ticks={[1, 2, 3]} 
                  stroke="#57534e"
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                  tickFormatter={(val) => {
                    if (val === 1) return 'LOW';
                    if (val === 2) return 'MED';
                    if (val === 3) return 'HIGH';
                    return '';
                  }} 
                />
                <Tooltip 
                  formatter={(_value, _name, props) => [props.payload.label, 'Protocol Level']} 
                  contentStyle={{ backgroundColor: '#fcfaf4', border: '1px solid #292524', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
                <Bar dataKey="protocol" fill="#6b21a8" name="Protocol Level" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
