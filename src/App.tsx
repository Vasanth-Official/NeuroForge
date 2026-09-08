import { useState, useCallback, useRef, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  RotateCcw, BookOpen, Layers, Play, BrainCircuit, Printer,
  Activity, Target, Sliders, BarChart3, FileText,
  ChevronRight, Zap, Cpu, TrendingUp, Shield, Clock, Database,
  FlaskConical, Network, Pause, SkipForward, Save, RefreshCw, Brain,
} from 'lucide-react';

import {
  initializeNeuralSystem, runTrainingCycle, selectAdaptiveProtocol,
  type NeuralSystemState, type ControllerDecision, type BehavioralInputs, type TaskType,
  type ExperimentLogEntry,
} from './simulation';

import { NeuralVisualization } from './components/NeuralVisualization';
import { NeuralVisualization3D } from './components/NeuralVisualization3D';
import { NeuroTask } from './components/NeuroTask';
import { PatternRecognitionTask } from './components/PatternRecognitionTask';
import { CognitiveFlexibilityTask } from './components/CognitiveFlexibilityTask';
import { TrainingLab } from './components/TrainingLab';
import { GraphLab } from './components/GraphLab';
import { ExperimentComparison } from './components/ExperimentComparison';
import { ScientificReport } from './components/ScientificReport';
import { HumanInTheLoopLab } from './components/HumanInTheLoopLab';
import { ResearchDashboard } from './components/ResearchDashboard';
import { ExperimentLab } from './components/ExperimentLab';
import { WhatIfLab } from './components/WhatIfLab';
import { SystemBlueprint } from './components/SystemBlueprint';
import { KnowledgeBase } from './components/KnowledgeBase';
import { ExperimentLog } from './components/ExperimentLog';
import './App.css';

type NavTab =
  | 'RESEARCH'
  | 'EXPERIMENT_LAB'
  | 'WHAT_IF'
  | 'BLUEPRINT'
  | 'DASHBOARD'
  | 'MODULES'
  | '3D_NETWORK'
  | 'TRAINING_LAB'
  | 'GRAPH_LAB'
  | 'COMPARISON'
  | 'KNOWLEDGE'
  | 'EXPERIMENT_LOG'
  | 'REPORT'
  | 'HUMAN_LOOP';

type BlueprintPhase = 'OBSERVE' | 'ASSESS' | 'ENGINE' | 'TRAIN' | 'MEASURE' | null;

interface SavedSessionSnapshot {
  id: string;
  label: string;
  timestamp: string;
  state: NeuralSystemState;
}

function getSimpleExplanation(d: ControllerDecision): string {
  if (!d.firedConditions.length) {
    return `System nominal. NeuroForge selected ${d.protocol} intensity as optimal.`;
  }
  const top = d.firedConditions[0];
  const map: Record<string, string> = {
    fatigue_critical: 'Fatigue reached critical threshold. Downshifting to LOW intensity.',
    fatigue_high: 'Elevated fatigue detected. Reduced training load to prevent overtraining.',
    stability_critical: 'Stability dropped critically. Training halted to protect system.',
    stability_low: 'Stability under stress. Gentler protocol applied to restabilise.',
    high_capacity: 'Optimal conditions — low fatigue, high stability. Capitalising with HIGH intensity.',
    learning_high_stability_falling: 'Strong gains but stability declining. Moderating intensity.',
    trend_improving: 'Learning trend consistently improving. Maintaining momentum.',
    trend_declining: 'Performance declining. Reducing intensity to consolidate gains.',
    trend_stagnant: 'Learning plateaued. Adjusting stimulus to break stagnation.',
    retention_lagging: 'Acquiring patterns faster than consolidating. Moderate intensity applied.',
    oscillation_dampened: 'Protocol oscillation detected. Hysteresis applied for stability.',
  };
  const base = map[top.tag] ?? `NeuroForge selected ${d.protocol} protocol based on live state.`;
  return d.firedConditions.length > 1
    ? `${base} Additional: ${d.firedConditions[1].fragment}.`
    : base;
}

function ProtocolBadge({ protocol }: { protocol: string | null | undefined }) {
  if (!protocol) return <span className="protocol-badge protocol-badge-none">—</span>;
  const cls = protocol === 'LOW' ? 'protocol-badge-low' : protocol === 'HIGH' ? 'protocol-badge-high' : 'protocol-badge-medium';
  return <span className={`protocol-badge ${cls}`}>{protocol}</span>;
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(6, 12, 28, 0.95)',
  border: '1px solid rgba(0, 240, 255, 0.5)',
  borderRadius: '8px',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  color: '#ffffff',
  boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)',
};

export default function App() {
  const [systemState, setSystemState] = useState<NeuralSystemState>(() => initializeNeuralSystem());
  const stateRef = useRef<NeuralSystemState>(systemState);
  const [decision, setDecision] = useState<ControllerDecision | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('DASHBOARD');
  const [visMode, setVisMode] = useState<'2D' | '3D'>('3D');
  const [selectedTaskModule, setSelectedTaskModule] = useState<TaskType>('TACHISTOSCOPIC_RECALL');
  const [showReport, setShowReport] = useState<boolean>(false);

  // Continuous training
  const [isContinuous, setIsContinuous] = useState(false);
  const continuousRef = useRef(false);
  const continuousTimerRef = useRef<number | null>(null);

  // Post-completion action modal
  const [showSessionModal, setShowSessionModal] = useState(false);

  const [savedSessions, setSavedSessions] = useState<SavedSessionSnapshot[]>([]);
  const [experimentLogs, setExperimentLogs] = useState<ExperimentLogEntry[]>([]);
  const [experimentStatus, setExperimentStatus] = useState<'READY' | 'RUNNING'>('READY');
  const [blueprintPhase, setBlueprintPhase] = useState<BlueprintPhase>(null);
  const prevDecisionRef = useRef<ControllerDecision | null>(null);
  const phaseTimers = useRef<number[]>([]);

  const handleLogEntry = useCallback((entry: ExperimentLogEntry) => {
    setExperimentLogs(prev => [entry, ...prev]);
  }, []);

  const handleDeleteLog = useCallback((id: string) => {
    setExperimentLogs(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleDuplicateConfig = useCallback((_entry: ExperimentLogEntry) => {
    setActiveTab('EXPERIMENT_LAB');
  }, []);

  const animateBlueprintPhases = useCallback(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
    const phases: BlueprintPhase[] = ['OBSERVE', 'ASSESS', 'ENGINE', 'TRAIN', 'MEASURE'];
    phases.forEach((ph, i) => {
      const t = window.setTimeout(() => setBlueprintPhase(ph), i * 400);
      phaseTimers.current.push(t);
    });
    const t = window.setTimeout(() => setBlueprintPhase(null), phases.length * 400 + 200);
    phaseTimers.current.push(t);
  }, []);

  useEffect(() => {
    return () => { phaseTimers.current.forEach(clearTimeout); };
  }, []);

  const handleManualCycle = useCallback(() => {
    prevDecisionRef.current = decision;
    setExperimentStatus('RUNNING');
    animateBlueprintPhases();
    const currentState = { ...stateRef.current };
    const newDecision = selectAdaptiveProtocol(currentState);
    runTrainingCycle(currentState, newDecision.protocol);
    stateRef.current = currentState;
    setSystemState({ ...currentState });
    setDecision(newDecision);
  }, [decision, animateBlueprintPhases]);

  const handleTaskComplete = useCallback((inputs: BehavioralInputs) => {
    prevDecisionRef.current = decision;
    setExperimentStatus('RUNNING');
    animateBlueprintPhases();
    const currentState = { ...stateRef.current };
    const accuracyFactor = inputs.accuracy / 100;
    const stabilityDelta = accuracyFactor >= 0.75 ? 3 : -12 * (1 - accuracyFactor);
    currentState.stability = Math.max(0, Math.min(100, currentState.stability + stabilityDelta));
    const timePenalty = (inputs.reactionTimeMs / 1000) * 1.2;
    currentState.fatigue = Math.max(0, Math.min(100, currentState.fatigue + timePenalty));
    const newDecision = selectAdaptiveProtocol(currentState);
    runTrainingCycle(currentState, newDecision.protocol, inputs);
    stateRef.current = currentState;
    setSystemState({ ...currentState });
    setDecision(newDecision);
  }, [decision, animateBlueprintPhases]);

  const handleReset = useCallback(() => {
    phaseTimers.current.forEach(clearTimeout);
    setBlueprintPhase(null);
    setExperimentStatus('READY');
    prevDecisionRef.current = null;
    stopContinuous();
    const initialState = initializeNeuralSystem();
    stateRef.current = initialState;
    setSystemState(initialState);
    setDecision(null);
  }, []);

  const handleSaveSnapshot = useCallback((label: string, stateToSave: NeuralSystemState) => {
    const newSnapshot: SavedSessionSnapshot = {
      id: `snap_${Date.now()}`,
      label,
      timestamp: new Date().toLocaleTimeString(),
      state: JSON.parse(JSON.stringify(stateToSave)),
    };
    setSavedSessions(prev => [...prev, newSnapshot]);
  }, []);

  // Continuous training controls
  const stopContinuous = () => {
    continuousRef.current = false;
    setIsContinuous(false);
    if (continuousTimerRef.current) {
      clearTimeout(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
  };

  const runContinuousStep = useCallback(() => {
    if (!continuousRef.current) return;
    const currentState = { ...stateRef.current };
    const newDecision = selectAdaptiveProtocol(currentState);
    runTrainingCycle(currentState, newDecision.protocol);
    stateRef.current = currentState;
    setSystemState({ ...currentState });
    setDecision(newDecision);
    setExperimentStatus('RUNNING');
    continuousTimerRef.current = window.setTimeout(runContinuousStep, 200);
  }, []);

  const handleToggleContinuous = useCallback(() => {
    if (isContinuous) {
      stopContinuous();
    } else {
      continuousRef.current = true;
      setIsContinuous(true);
      runContinuousStep();
    }
  }, [isContinuous, runContinuousStep]);

  useEffect(() => {
    return () => stopContinuous();
  }, []);

  const history = systemState.trainingHistory;

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

  const protocolData = history.map((record) => {
    let protocolValue = 0;
    if (record.protocol === 'LOW') protocolValue = 1;
    if (record.protocol === 'MEDIUM') protocolValue = 2;
    if (record.protocol === 'HIGH') protocolValue = 3;
    return { cycle: record.cycle, protocol: protocolValue, label: record.protocol };
  });

  const prevRecord = history.length > 1 ? history[history.length - 2] : null;
  const currRecord = history.length > 0 ? history[history.length - 1] : null;
  const learningDelta = currRecord && prevRecord
    ? currRecord.endState.learningScore - prevRecord.endState.learningScore
    : (currRecord ? currRecord.endState.learningScore : 0);
  const currProtocol = currRecord?.protocol ?? null;
  const nextProtocol = decision?.protocol ?? null;

  const isRunning = experimentStatus === 'RUNNING';

  const bann = systemState.bannState;
  const accuracy = bann
    ? Math.min(99.9, Math.max(10, systemState.learningScore * 0.9 + 10))
    : systemState.learningScore;
  const reactionTimeMs = bann
    ? Math.max(400, 2200 - systemState.learningScore * 15)
    : 1800;
  const cognitiveScore = ((systemState.learningScore * 0.4 + systemState.stability * 0.3 + systemState.retention * 0.2 + systemState.synchrony * 0.1));
  const neuralActivity = bann?.meanActivation ? bann.meanActivation * 100 : systemState.synchrony;

  const NAV_ITEMS: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'RESEARCH', label: '🔬 RESEARCH', icon: <FlaskConical size={13} /> },
    { id: 'EXPERIMENT_LAB', label: '🧪 EXPERIMENT LAB', icon: <Activity size={13} /> },
    { id: 'WHAT_IF', label: '⚡ WHAT-IF LAB', icon: <Zap size={13} /> },
    { id: 'BLUEPRINT', label: '📐 BLUEPRINT', icon: <BrainCircuit size={13} /> },
    { id: 'DASHBOARD', label: 'DASHBOARD', icon: <Network size={13} /> },
    { id: 'MODULES', label: 'MODULES', icon: <Target size={13} /> },
    { id: '3D_NETWORK', label: '3D NEURAL VIZ', icon: <BrainCircuit size={13} /> },
    { id: 'TRAINING_LAB', label: 'TRAINING LAB', icon: <Sliders size={13} /> },
    { id: 'GRAPH_LAB', label: 'GRAPH LAB', icon: <BarChart3 size={13} /> },
    { id: 'COMPARISON', label: 'EXPERIMENT COMPARE', icon: <Activity size={13} /> },
    { id: 'KNOWLEDGE', label: '📚 KNOWLEDGE', icon: <BookOpen size={13} /> },
    { id: 'EXPERIMENT_LOG', label: '📋 LOGS', icon: <Database size={13} /> },
    { id: 'REPORT', label: 'REPORT', icon: <FileText size={13} /> },
    { id: 'HUMAN_LOOP', label: '🧠 HUMAN-IN-LOOP', icon: <Brain size={13} /> },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header className="dashboard-header">
        {/* Row 1: Brand + Status */}
        <div className="header-top-row">
          <div className="brand-container">
            <div className="brand-icon-wrapper">
              <BrainCircuit size={24} color="var(--cyan-bright)" />
            </div>
            <div>
              <h1 className="brand-title gradient-text-cyan">NEUROFORGE</h1>
              <div className="brand-subtitle">ADAPTIVE NEURAL TRAINING LABORATORY · BANN CORE ENGINE</div>
            </div>
          </div>

          {/* Status indicators pushed to right */}
          <div className="status-bar" style={{ marginLeft: 'auto' }}>
            <div className="status-pill">
              <span className={`status-dot${isContinuous ? ' running' : ''}`} />
              {isContinuous ? 'CONTINUOUS' : isRunning ? 'RUNNING' : 'READY'}
            </div>
            <div className="status-pill" style={{ color: 'var(--cyan-bright)' }}>
              <Cpu size={12} /> CYCLE {String(bann?.cycle ?? history.length).padStart(4, '0')}
            </div>
            <div className="status-pill">
              SEED {systemState.seed}
            </div>
            <div className="status-pill">
              PROTOCOL: <ProtocolBadge protocol={nextProtocol ?? currProtocol} />
            </div>
          </div>
        </div>

        {/* Row 2: Full-width Nav Tabs */}
        <nav className="header-nav-row">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-tab-btn${activeTab === item.id ? ' active' : ''}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          TRAINING CONTROL BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', padding: '12px 20px', background: 'rgba(6, 14, 32, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
        <button onClick={handleManualCycle} className="cyber-btn cyber-btn-primary">
          <Play size={14} /> RUN ONE CYCLE
        </button>
        <button onClick={handleToggleContinuous} className={`cyber-btn ${isContinuous ? 'cyber-btn-danger' : 'cyber-btn-secondary'}`}>
          {isContinuous ? <><Pause size={14} /> PAUSE CONTINUOUS</> : <><SkipForward size={14} /> CONTINUOUS TRAIN</>}
        </button>
        <button onClick={() => setShowSessionModal(true)} className="cyber-btn cyber-btn-secondary">
          <Save size={14} /> SESSION ACTIONS
        </button>
        <button onClick={() => setShowReport(!showReport)} className="cyber-btn cyber-btn-ghost">
          <Printer size={14} /> {showReport ? 'HIDE REPORT' : 'EXPORT REPORT'}
        </button>
        <button onClick={handleReset} className="cyber-btn cyber-btn-danger">
          <RotateCcw size={14} /> RESET STATE
        </button>
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--cyan-bright)' }}>BANN</span> Bio-Adaptive Neural Network | Plasticity-Inspired Simulation
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SESSION ACTIONS MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showSessionModal && (
        <div className="modal-overlay" onClick={() => setShowSessionModal(false)}>
          <div className="modal-content-futuristic" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title gradient-text-cyan">SESSION MANAGEMENT</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Current session: {bann?.cycle ?? history.length} cycles | Score: {systemState.learningScore.toFixed(1)}%
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => { setShowSessionModal(false); continuousRef.current = true; setIsContinuous(true); runContinuousStep(); }}
                className="cyber-btn cyber-btn-primary"
                style={{ justifyContent: 'center', padding: '14px' }}
              >
                <Play size={16} /> CONTINUE TRAINING
              </button>
              <button
                onClick={() => { handleSaveSnapshot(`Session_${Date.now()}`, systemState); setShowSessionModal(false); }}
                className="cyber-btn cyber-btn-secondary"
                style={{ justifyContent: 'center', padding: '14px' }}
              >
                <Save size={16} /> SAVE MODEL STATE
              </button>
              <button
                onClick={() => { setShowSessionModal(false); setActiveTab('TRAINING_LAB'); }}
                className="cyber-btn cyber-btn-secondary"
                style={{ justifyContent: 'center', padding: '14px' }}
              >
                <Sliders size={16} /> CHANGE PARAMETERS
              </button>
              <button
                onClick={() => { setShowSessionModal(false); setActiveTab('COMPARISON'); }}
                className="cyber-btn cyber-btn-ghost"
                style={{ justifyContent: 'center', padding: '14px' }}
              >
                <Activity size={16} /> COMPARE SESSIONS
              </button>
              <button
                onClick={() => { handleReset(); setShowSessionModal(false); }}
                className="cyber-btn cyber-btn-danger"
                style={{ justifyContent: 'center', padding: '14px', gridColumn: 'span 2' }}
              >
                <RefreshCw size={16} /> NEW EXPERIMENT (RESETS ALL STATE)
              </button>
            </div>
            <button onClick={() => setShowSessionModal(false)} style={{ marginTop: '16px', width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', cursor: 'pointer' }}>
              ✕ CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REPORT PANEL (Toggle)
      ══════════════════════════════════════════════════════════════════════ */}
      {(showReport || activeTab === 'REPORT') && (
        <div style={{ marginBottom: '24px' }}>
          <ScientificReport systemState={systemState} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RESEARCH DASHBOARD TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'RESEARCH' && (
        <ResearchDashboard
          systemState={systemState}
          decision={decision}
          isRunning={isRunning || isContinuous}
          currentPhase={blueprintPhase}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN DASHBOARD TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'DASHBOARD' && (
        <>
          {/* ── Top Grid: Large Chart + Right Panels ── */}
          <div className="dashboard-grid" style={{ marginBottom: '20px' }}>

            {/* Large Main Analytics Panel */}
            <div className="col-8 glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '2px' }}>
                    REAL-TIME COGNITIVE ANALYTICS
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    TRAINING SESSION TELEMETRY
                  </h2>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {history.length} CYCLES RECORDED
                </div>
              </div>
              {history.length === 0 ? (
                <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                  Run training cycles to populate the live analytics graph
                </div>
              ) : (
                <div style={{ height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.1)" />
                      <XAxis dataKey="cycle" stroke="#475569" fontSize={11} fontFamily="var(--font-mono)" />
                      <YAxis domain={[0, 100]} stroke="#475569" fontSize={11} fontFamily="var(--font-mono)" />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }} />
                      <Line type="monotone" dataKey="learningScore" stroke="#00f0ff" name="Learning Score" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="stability" stroke="#f43f5e" name="Stability" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="retention" stroke="#10b981" name="Retention" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="fatigue" stroke="#f59e0b" name="Fatigue" strokeWidth={1.5} strokeDasharray="2 2" dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Right Stacked Panels */}
            <div className="col-4 metrics-stack">
              {/* Key Metrics Cards */}
              <div className="metric-card-futuristic">
                <div>
                  <div className="metric-label-futuristic">ACCURACY</div>
                  <div className="metric-value-large" style={{ color: 'var(--cyan-bright)' }}>
                    {accuracy.toFixed(1)}%
                  </div>
                </div>
                <TrendingUp size={32} color="rgba(0, 240, 255, 0.3)" />
              </div>

              <div className="metric-card-futuristic">
                <div>
                  <div className="metric-label-futuristic">COGNITIVE SCORE</div>
                  <div className="metric-value-large" style={{ color: 'var(--purple-neon)' }}>
                    {cognitiveScore.toFixed(1)}
                  </div>
                </div>
                <Cpu size={32} color="rgba(168, 85, 247, 0.3)" />
              </div>

              <div className="metric-card-futuristic">
                <div>
                  <div className="metric-label-futuristic">TRAINING PROGRESS</div>
                  <div className="metric-value-large" style={{ color: 'var(--emerald-neon)' }}>
                    {systemState.learningScore.toFixed(1)}%
                  </div>
                  <div style={{ marginTop: '6px', height: '4px', background: 'rgba(16,185,129,0.2)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${systemState.learningScore}%`, background: 'var(--emerald-neon)', borderRadius: '2px', boxShadow: '0 0 8px var(--emerald-neon)', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
                <Shield size={32} color="rgba(16, 185, 129, 0.3)" />
              </div>

              <div className="metric-card-futuristic">
                <div>
                  <div className="metric-label-futuristic">REACTION TIME</div>
                  <div className="metric-value-large" style={{ color: 'var(--amber-neon)' }}>
                    {reactionTimeMs.toFixed(0)} ms
                  </div>
                </div>
                <Clock size={32} color="rgba(245, 158, 11, 0.3)" />
              </div>

              {/* Active Training Modules */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '10px' }}>
                  ACTIVE TRAINING MODULES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {([
                    { id: 'TACHISTOSCOPIC_RECALL', label: 'TACHISTOSCOPIC RECALL', icon: <Database size={12} /> },
                    { id: 'PATTERN_RECOGNITION', label: 'PATTERN RECOGNITION', icon: <Network size={12} /> },
                    { id: 'COGNITIVE_FLEXIBILITY', label: 'COGNITIVE FLEXIBILITY', icon: <Activity size={12} /> },
                  ] as { id: TaskType; label: string; icon: React.ReactNode }[]).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setActiveTab('MODULES'); setSelectedTaskModule(m.id); }}
                      className="task-option-card"
                      style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {m.icon} {m.label}
                      <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── 6-Card Middle Analytics Grid ── */}
          <div className="analytics-6-grid" style={{ marginBottom: '20px' }}>
            {[
              { label: 'NEURAL ACTIVITY', value: `${neuralActivity.toFixed(1)}%`, icon: <Zap size={16} color="var(--purple-neon)" />, color: 'var(--purple-neon)' },
              { label: 'LEARNING PROGRESS', value: `${systemState.learningScore.toFixed(1)}`, icon: <TrendingUp size={16} color="var(--cyan-bright)" />, color: 'var(--cyan-bright)', delta: `${learningDelta >= 0 ? '+' : ''}${learningDelta.toFixed(2)}` },
              { label: 'ADAPTATION', value: `${systemState.synchrony.toFixed(1)}%`, icon: <RefreshCw size={16} color="var(--emerald-neon)" />, color: 'var(--emerald-neon)' },
              { label: 'ERROR RATE', value: `${((100 - accuracy) / 100).toFixed(3)}`, icon: <Activity size={16} color="var(--rose-neon)" />, color: 'var(--rose-neon)' },
              { label: 'MEMORY', value: `${systemState.retention.toFixed(1)}`, icon: <Database size={16} color="var(--blue-accent)" />, color: 'var(--blue-accent)' },
              { label: 'DIFFICULTY', value: `${(bann?.hyperparams.difficulty ?? 0.5).toFixed(2)}`, icon: <Target size={16} color="var(--amber-neon)" />, color: 'var(--amber-neon)' },
            ].map((card) => (
              <div key={card.label} className="card-mini-futuristic">
                <div className="card-mini-header">
                  <span>{card.label}</span>
                  {card.icon}
                </div>
                <div className="card-mini-val" style={{ color: card.color }}>{card.value}</div>
                {card.delta && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: parseFloat(card.delta) >= 0 ? 'var(--emerald-neon)' : 'var(--rose-neon)' }}>{card.delta}</div>}
              </div>
            ))}
          </div>

          {/* ── Bottom Grid: Profile + History ── */}
          <div className="dashboard-grid">
            {/* Bottom Left: Session Profile + Controller Log */}
            <div className="col-6 glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                SESSION PROFILE &amp; SYSTEM STATE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginBottom: '16px' }}>
                {[
                  { label: 'SEED', value: systemState.seed },
                  { label: 'CYCLES', value: bann?.cycle ?? history.length },
                  { label: 'PROTOCOL', value: currProtocol ?? '—' },
                  { label: 'STABILITY', value: `${systemState.stability.toFixed(1)}%` },
                  { label: 'FATIGUE', value: `${systemState.fatigue.toFixed(1)}%`, warn: systemState.fatigue > 65 },
                  { label: 'SPIKE RATE', value: `${systemState.spikeRate.toFixed(1)} Hz` },
                  { label: 'SYNCHRONY', value: `${systemState.synchrony.toFixed(1)}%` },
                  { label: 'VARIABILITY', value: systemState.variability.toFixed(4) },
                  { label: 'SYNAPSES', value: bann?.synapses.length ?? '—' },
                  { label: 'LR (η)', value: bann?.currentLearningRate.toFixed(4) ?? '—' },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(6, 14, 32, 0.6)', borderRadius: '5px', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <strong style={{ color: (item as { warn?: boolean }).warn ? 'var(--rose-neon)' : 'var(--cyan-bright)' }}>{item.value}</strong>
                  </div>
                ))}
              </div>

              {/* Controller Decision */}
              <div className="controller-log-card">
                <div className="controller-log-header">
                  <BrainCircuit size={14} /> ADAPTIVE CONTROLLER DECISION
                </div>
                {decision ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selected:</span>
                      <ProtocolBadge protocol={decision.protocol} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-faint)', marginLeft: 'auto' }}>
                        Confidence: {(decision.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="controller-explanation">{getSimpleExplanation(decision)}</p>
                  </div>
                ) : (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No decision recorded. Run a training cycle to activate the adaptive controller.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Right: Training History + Snapshots */}
            <div className="col-6 glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--cyan-bright)', letterSpacing: '0.1em', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                TRAINING HISTORY &amp; SESSION SNAPSHOTS
              </div>

              {history.length > 0 ? (
                <div style={{ marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '5px', textAlign: 'left' }}>CYCLE</th>
                        <th style={{ padding: '5px', textAlign: 'right' }}>SCORE</th>
                        <th style={{ padding: '5px', textAlign: 'right' }}>STABILITY</th>
                        <th style={{ padding: '5px', textAlign: 'right' }}>PROTOCOL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(-12).reverse().map((rec) => (
                        <tr key={rec.cycle} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '5px', color: 'var(--text-muted)' }}>{rec.cycle}</td>
                          <td style={{ padding: '5px', textAlign: 'right', color: 'var(--cyan-bright)' }}>{rec.endState.learningScore.toFixed(1)}%</td>
                          <td style={{ padding: '5px', textAlign: 'right', color: rec.endState.stability < 35 ? 'var(--rose-neon)' : 'var(--emerald-neon)' }}>{rec.endState.stability.toFixed(1)}</td>
                          <td style={{ padding: '5px', textAlign: 'right' }}><ProtocolBadge protocol={rec.protocol} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-faint)', border: '1px dashed var(--border-subtle)', borderRadius: '8px', marginBottom: '16px' }}>
                  No history yet. Run training cycles to populate.
                </div>
              )}

              {/* Protocol Distribution Bar Chart */}
              {history.length > 0 && (
                <div style={{ height: '160px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    PROTOCOL DISTRIBUTION
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={protocolData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(56, 189, 248, 0.08)" />
                      <XAxis dataKey="cycle" stroke="#475569" fontSize={10} fontFamily="var(--font-mono)" />
                      <YAxis
                        domain={[0, 4]} ticks={[1, 2, 3]} stroke="#475569"
                        fontSize={10} fontFamily="var(--font-mono)"
                        tickFormatter={(val) => val === 1 ? 'L' : val === 2 ? 'M' : val === 3 ? 'H' : ''}
                      />
                      <Tooltip
                        formatter={(_v, _n, props) => [props.payload.label, 'Protocol']}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Bar dataKey="protocol" fill="rgba(168, 85, 247, 0.6)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Saved Snapshots */}
              {savedSessions.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    SAVED SNAPSHOTS ({savedSessions.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {savedSessions.map((snap) => (
                      <div key={snap.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(6,14,32,0.7)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                        <span style={{ color: '#ffffff' }}>{snap.label}</span>
                        <span style={{ color: 'var(--cyan-bright)' }}>{snap.state.learningScore.toFixed(1)}%</span>
                        <span style={{ color: 'var(--text-faint)' }}>{snap.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 3D Neural Visualizer Inline Panel ── */}
          <div className="glass-panel" style={{ padding: '20px', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '2px' }}>
                  LIVE NEURAL TOPOLOGY
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                  BANN NEURAL NETWORK VISUALIZER
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setVisMode('2D')} className={`cyber-btn ${visMode === '2D' ? 'cyber-btn-primary' : 'cyber-btn-ghost'}`} style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
                  2D SCHEMATIC
                </button>
                <button onClick={() => setVisMode('3D')} className={`cyber-btn ${visMode === '3D' ? 'cyber-btn-primary' : 'cyber-btn-ghost'}`} style={{ padding: '6px 12px', fontSize: '0.72rem' }}>
                  <BrainCircuit size={12} /> 3D WebGL
                </button>
              </div>
            </div>
            {visMode === '3D' ? (
              <NeuralVisualization3D systemState={systemState} isRunning={isRunning || isContinuous} />
            ) : (
              <NeuralVisualization systemState={systemState} isRunning={isRunning || isContinuous} />
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODULES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'MODULES' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {([
              { id: 'TACHISTOSCOPIC_RECALL', label: 'TACHISTOSCOPIC RECALL', icon: <BookOpen size={13} /> },
              { id: 'PATTERN_RECOGNITION', label: 'PATTERN RECOGNITION', icon: <Layers size={13} /> },
              { id: 'COGNITIVE_FLEXIBILITY', label: 'COGNITIVE FLEXIBILITY', icon: <Activity size={13} /> },
            ] as { id: TaskType; label: string; icon: React.ReactNode }[]).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedTaskModule(m.id)}
                className={`cyber-btn ${selectedTaskModule === m.id ? 'cyber-btn-primary' : 'cyber-btn-ghost'}`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {selectedTaskModule === 'TACHISTOSCOPIC_RECALL' && (
            <NeuroTask
              systemState={systemState}
              decision={decision}
              lastRecord={history.length > 0 ? history[history.length - 1] : null}
              onTrialComplete={(acc, rt) => handleTaskComplete({
                accuracy: acc,
                errorRate: (100 - acc) / 100,
                reactionTimeMs: rt,
                confidence: acc / 100,
                difficulty: systemState.bannState?.hyperparams.difficulty ?? 0.5,
                taskType: 'TACHISTOSCOPIC_RECALL',
              })}
              onManualCycle={handleManualCycle}
            />
          )}
          {selectedTaskModule === 'PATTERN_RECOGNITION' && (
            <PatternRecognitionTask
              difficulty={systemState.bannState?.hyperparams.difficulty ?? 0.5}
              onTaskComplete={handleTaskComplete}
            />
          )}
          {selectedTaskModule === 'COGNITIVE_FLEXIBILITY' && (
            <CognitiveFlexibilityTask
              difficulty={systemState.bannState?.hyperparams.difficulty ?? 0.5}
              onTaskComplete={handleTaskComplete}
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3D NETWORK TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === '3D_NETWORK' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--cyan-bright)', letterSpacing: '0.12em', marginBottom: '2px' }}>3D BANN TOPOLOGY</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>LIVE NEURAL NETWORK VISUALIZER</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setVisMode('2D')} className={`cyber-btn ${visMode === '2D' ? 'cyber-btn-primary' : 'cyber-btn-ghost'}`} style={{ fontSize: '0.72rem' }}>2D SCHEMATIC</button>
              <button onClick={() => setVisMode('3D')} className={`cyber-btn ${visMode === '3D' ? 'cyber-btn-primary' : 'cyber-btn-ghost'}`} style={{ fontSize: '0.72rem' }}><BrainCircuit size={12} /> 3D WebGL</button>
            </div>
          </div>
          {visMode === '3D' ? (
            <NeuralVisualization3D systemState={systemState} isRunning={isRunning || isContinuous} />
          ) : (
            <NeuralVisualization systemState={systemState} isRunning={isRunning || isContinuous} />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TRAINING LAB TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'TRAINING_LAB' && (
        <TrainingLab
          systemState={systemState}
          onUpdateSystemState={(newState) => { stateRef.current = newState; setSystemState(newState); }}
          onSaveSessionSnapshot={handleSaveSnapshot}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GRAPH LAB TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'GRAPH_LAB' && <GraphLab systemState={systemState} />}

      {/* ══════════════════════════════════════════════════════════════════════
          EXPERIMENT COMPARISON TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'COMPARISON' && <ExperimentComparison savedSessions={savedSessions} />}

      {/* ══════════════════════════════════════════════════════════════════════
          EXPERIMENT LAB TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'EXPERIMENT_LAB' && (
        <ExperimentLab
          systemState={systemState}
          onLogEntry={handleLogEntry}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          WHAT-IF LAB TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'WHAT_IF' && (
        <WhatIfLab />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SYSTEM BLUEPRINT TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'BLUEPRINT' && (
        <SystemBlueprint />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          KNOWLEDGE BASE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'KNOWLEDGE' && (
        <KnowledgeBase />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EXPERIMENT LOG TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'EXPERIMENT_LOG' && (
        <ExperimentLog
          entries={experimentLogs}
          onDelete={handleDeleteLog}
          onDuplicate={handleDuplicateConfig}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HUMAN-IN-THE-LOOP LAB TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'HUMAN_LOOP' && (
        <HumanInTheLoopLab systemState={systemState} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)', marginTop: '32px', paddingTop: '16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)',
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <div style={{ fontWeight: 700, letterSpacing: '0.1em', marginBottom: '2px', color: 'var(--cyan-bright)' }}>
            NEUROFORGE — ADAPTIVE NEURAL TRAINING LABORATORY
          </div>
          <div>LAB PROTOCOL NF-2026-01 &nbsp;|&nbsp; BANN ENGINE v2.0 &nbsp;|&nbsp; SYNAPTIC ARRAY α-07</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, color: 'var(--amber-neon)', letterSpacing: '0.1em', marginBottom: '2px' }}>
            ⚠ COMPUTATIONAL SIMULATION
          </div>
          <div>NOT BIOLOGICAL DATA &nbsp;|&nbsp; Plasticity-Inspired Model Only</div>
        </div>
      </footer>
    </div>
  );
}
