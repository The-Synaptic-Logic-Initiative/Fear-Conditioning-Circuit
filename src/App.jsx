import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceArea 
} from 'recharts';
import { 
  Play, 
  RotateCcw, 
  Info, 
  Settings2, 
  Eye, 
  Flame, 
  Brain, 
  Volume2, 
  Activity, 
  Zap, 
  Compass, 
  BookOpen
} from 'lucide-react';

// Detailed descriptions of the circuit nodes for the interactive inspector
const nodeDescriptions = {
  CS: {
    name: "Conditioned Stimulus (CS)",
    role: "Sensory Input (Tone)",
    desc: "A neutral stimulus (like a tone). Before conditioning, it does not evoke fear. After conditioning, the CS alone is enough to travel down the pathways and trigger a full fear response in the Central Amygdala."
  },
  US: {
    name: "Unconditioned Stimulus (US)",
    role: "Aversive Input (Shock)",
    desc: "An innately noxious stimulus (like a mild foot shock). It strongly and directly activates the Lateral Amygdala (LA), driving the unconditioned fear response. Its co-activation with the CS drives synaptic plasticity."
  },
  Thal: {
    name: "Sensory Thalamus",
    role: "Relay Station",
    desc: "Relays raw sensory information from the environment. It projects to both the Sensory Cortex (High Road) and directly to the Lateral Amygdala (Low Road), acting as the initial fork in LeDoux's model."
  },
  Ctx: {
    name: "Sensory Cortex",
    role: "High Road Processor",
    desc: "Performs detailed, higher-level cognitive analysis of the CS. This pathway is slower (~30ms in rats) but provides precise, context-rich information to the Lateral Amygdala to confirm if a threat is actually present."
  },
  LA: {
    name: "Lateral Amygdala (LA)",
    role: "Synaptic Convergence Zone",
    desc: "The convergence zone where CS and US signals meet. When they co-fire, Hebbian plasticity (Long-Term Potentiation) strengthens the CS→LA synapse (W_cs), forming the associative fear memory trace."
  },
  BA: {
    name: "Basal Amygdala (BA)",
    role: "Integration Hub",
    desc: "Receives projections from the LA and also projects to the Central Amygdala (CeA). It serves as an integrator and is highly modulated by contextual signals from the hippocampus."
  },
  CeA: {
    name: "Central Amygdala (CeA)",
    role: "Output Engine",
    desc: "The primary output node of the fear circuit. When activated, it projects to the brainstem and hypothalamus to drive freezing behavior, autonomic arousal (elevated heart rate), and startle responses."
  },
  ITC: {
    name: "Intercalated Cells (ITC)",
    role: "GABAergic Inhibitory Gate",
    desc: "Inhibitory GABAergic neurons positioned between the PFC/LA and the CeA. Activated by the PFC during extinction, they suppress CeA output, acting as a brake that active safety learning puts on the fear output."
  },
  PFC: {
    name: "Prefrontal Cortex (PFC)",
    role: "Top-Down Extinction Controller",
    desc: "Responsible for cognitive control and safety evaluation. During extinction (CS without US), the PFC activates the ITC to actively suppress fear expression, encoding a safety memory context."
  },
  CtxNode: {
    name: "Hippocampus / Context",
    role: "Contextual Modulator",
    desc: "Encodes spatial and environmental context. Toggling Context Renewal represents shifting context: it disables the PFC-ITC safety signal and adds context-specific excitation to the LA, restoring the fear response."
  },
  Response: {
    name: "Behavioral Responses",
    role: "Fear Expression Output",
    desc: "Downstream physiological readouts triggered by Central Amygdala (CeA) activity: freezing (immobility), pupillary dilation, startle response, and sympathetic nervous system surge."
  }
};

const initialActivations = {
  Thal: 0,
  Ctx: 0,
  LA: 0.05,
  BA: 0.05,
  CeA: 0.05,
  ITC: 0.05,
  PFC: 0,
  CtxNode: 0
};

export default function App() {
  // --- Simulation State ---
  const [phase, setPhase] = useState('habituation'); // habituation | acquisition | extinction
  const [W_cs, setW_cs] = useState(0.1); // CS-LA weight
  const [renewal, setRenewal] = useState(false); // context renewal toggle
  const [selectedNode, setSelectedNode] = useState('LA');
  
  // Input activation values for the *current* interactive visualization
  const [csActive, setCsActive] = useState(false);
  const [usActive, setUsActive] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Activations displaying on the circuit nodes
  const [nodeActivations, setNodeActivations] = useState(initialActivations);

  // Trial history for plotting
  const [history, setHistory] = useState([
    {
      trial: 0,
      phase: 'habituation',
      cs: 0,
      us: 0,
      renewal: false,
      W_cs: 0.1,
      fear: 0.05,
      ...initialActivations
    }
  ]);

  // --- Neural Parameters State (Tunable) ---
  const [eta, setEta] = useState(0.10);      // acquisition learning rate
  const [etaExt, setEtaExt] = useState(0.03); // extinction learning rate
  const [wCtx, setWCtx] = useState(0.50);    // context weight
  const [wUs, setWUs] = useState(1.00);      // US-LA weight
  const [wBa, setWBa] = useState(1.00);      // LA-BA weight
  const [wItc, setWItc] = useState(1.50);    // ITC-CeA inhibition
  const [wPfc, setWPfc] = useState(1.00);    // PFC-ITC weight

  // --- UI Layout State ---
  const [showParams, setShowParams] = useState(false);
  const [eduTab, setEduTab] = useState('anatomy');

  // --- Simulation Mathematics ---
  // Sigmoid activation function
  const sig = (x, k = 5, th = 0.5) => 1 / (1 + Math.exp(-k * (x - th)));

  // Calculate trial values given inputs and current weight
  const computeTrial = (csVal, usVal, phaseVal, renewalVal, currentW_cs) => {
    const A_cs = csVal ? 1.0 : 0.0;
    const A_us = usVal ? 1.0 : 0.0;

    // 1. Thalamus relays CS/US
    const A_Thal = Math.max(A_cs, A_us);

    // 2. Sensory Cortex processes CS (High Road)
    const A_Ctx = A_cs;

    // 3. PFC activates during Extinction, but is suppressed when renewal context is swapped
    const A_PFC = (phaseVal === 'extinction' && !renewalVal) ? 1.0 : 0.0;

    // 4. ITC is driven by PFC (safety memory recall)
    const A_ITC = sig(wPfc * A_PFC, 5, 0.5);

    // 5. Context node is active during context renewal
    const A_ctxNode = renewalVal ? 1.0 : 0.0;

    // 6. Lateral Amygdala integrates CS (W_cs), US (wUs), and Context (wCtx)
    const input_LA = (currentW_cs * A_cs) + (wUs * A_us) + (wCtx * A_ctxNode);
    const A_LA = sig(input_LA, 5, 0.5);

    // 7. Basal Amygdala integrates LA output
    const A_BA = sig(wBa * A_LA, 5, 0.5);

    // 8. Central Amygdala integrates BA excitation and ITC GABAergic inhibition
    const input_CeA = (wBa * A_BA) - (wItc * A_ITC);
    const A_CeA = sig(input_CeA, 5, 0.2); // threshold = 0.2 for low baseline

    // Weight update rule
    let deltaW = 0;
    if (phaseVal === 'acquisition') {
      // Hebbian co-activation in LA
      deltaW = eta * A_cs * A_us;
    } else if (phaseVal === 'extinction') {
      // PFC-driven ITC inhibits CeA, and CS weight decays slowly
      deltaW = -etaExt * A_cs * A_ITC;
    }

    const newW_cs = Math.max(0.05, Math.min(1.2, currentW_cs + deltaW));

    return {
      A_Thal: A_Thal * (A_cs || A_us ? 1.0 : 0.0),
      A_Ctx: A_Ctx * (A_cs ? 1.0 : 0.0),
      A_PFC,
      A_ITC,
      A_ctx: A_ctxNode,
      A_LA: A_cs || A_us || renewalVal ? A_LA : 0.05,
      A_BA: A_cs || A_us || renewalVal ? A_BA : 0.05,
      A_CeA: A_cs || A_us || renewalVal ? A_CeA : 0.05,
      newW_cs
    };
  };

  // --- Run Controls ---
  const handleSingleTrial = (customCs = null, customUs = null) => {
    // Determine inputs based on phase or custom override
    const cs = customCs !== null ? customCs : true; // default tone is present
    let us = false;
    
    if (customUs !== null) {
      us = customUs;
    } else {
      if (phase === 'acquisition') us = true;
      if (phase === 'habituation') us = false;
      if (phase === 'extinction') us = false;
    }

    setCsActive(cs);
    setUsActive(us);

    // Run math
    const result = computeTrial(cs, us, phase, renewal, W_cs);

    // Update state
    setW_cs(result.newW_cs);
    setNodeActivations({
      Thal: result.A_Thal,
      Ctx: result.A_Ctx,
      LA: result.A_LA,
      BA: result.A_BA,
      CeA: result.A_CeA,
      ITC: result.A_ITC,
      PFC: result.A_PFC,
      CtxNode: result.A_ctx
    });

    // Animate signal flow
    setAnimating(true);
    const animTimeout = setTimeout(() => setAnimating(false), 800);

    // Add to history
    setHistory(prev => [
      ...prev,
      {
        trial: prev.length,
        phase,
        cs: cs ? 1 : 0,
        us: us ? 1 : 0,
        renewal,
        W_cs: result.newW_cs,
        fear: result.A_CeA,
        Thal: result.A_Thal,
        Ctx: result.A_Ctx,
        LA: result.A_LA,
        BA: result.A_BA,
        CeA: result.A_CeA,
        ITC: result.A_ITC,
        PFC: result.A_PFC,
        CtxNode: result.A_ctx
      }
    ]);

    return () => clearTimeout(animTimeout);
  };

  const handleTenTrials = () => {
    let currentW = W_cs;
    const newItems = [];
    let lastResult = null;

    const cs = true;
    const us = phase === 'acquisition';

    for (let i = 0; i < 10; i++) {
      const result = computeTrial(cs, us, phase, renewal, currentW);
      currentW = result.newW_cs;
      lastResult = result;

      newItems.push({
        trial: history.length + i,
        phase,
        cs: cs ? 1 : 0,
        us: us ? 1 : 0,
        renewal,
        W_cs: result.newW_cs,
        fear: result.A_CeA,
        Thal: result.A_Thal,
        Ctx: result.A_Ctx,
        LA: result.A_LA,
        BA: result.A_BA,
        CeA: result.A_CeA,
        ITC: result.A_ITC,
        PFC: result.A_PFC,
        CtxNode: result.A_ctx
      });
    }

    setW_cs(currentW);
    setCsActive(cs);
    setUsActive(us);

    if (lastResult) {
      setNodeActivations({
        Thal: lastResult.A_Thal,
        Ctx: lastResult.A_Ctx,
        LA: lastResult.A_LA,
        BA: lastResult.A_BA,
        CeA: lastResult.A_CeA,
        ITC: lastResult.A_ITC,
        PFC: lastResult.A_PFC,
        CtxNode: lastResult.A_ctx
      });
    }

    setHistory(prev => [...prev, ...newItems]);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 800);
  };

  const handleReset = () => {
    setW_cs(0.1);
    setRenewal(false);
    setCsActive(false);
    setUsActive(false);
    setNodeActivations(initialActivations);
    setHistory([
      {
        trial: 0,
        phase: 'habituation',
        cs: 0,
        us: 0,
        renewal: false,
        W_cs: 0.1,
        fear: 0.05,
        ...initialActivations
      }
    ]);
  };

  const restoreDefaultParams = () => {
    setEta(0.10);
    setEtaExt(0.03);
    setWCtx(0.50);
    setWUs(1.00);
    setWBa(1.00);
    setWItc(1.50);
    setWPfc(1.00);
  };

  // Synchronize context node activation with renewal state when inputs occur
  useEffect(() => {
    if (csActive || usActive) {
      // Re-evaluate activations based on new renewal state
      const result = computeTrial(csActive, usActive, phase, renewal, W_cs);
      setNodeActivations(prev => ({
        ...prev,
        LA: result.A_LA,
        BA: result.A_BA,
        CeA: result.A_CeA,
        ITC: result.A_ITC,
        PFC: result.A_PFC,
        CtxNode: result.A_ctx
      }));
    } else {
      setNodeActivations(prev => ({
        ...prev,
        CtxNode: renewal ? 1.0 : 0.0
      }));
    }
  }, [renewal]);

  // Extract reference shading zones for Recharts
  const getPhaseRegions = () => {
    if (history.length <= 1) return [];
    const regions = [];
    let currentPhase = history[1].phase;
    let start = history[1].trial;

    for (let i = 2; i < history.length; i++) {
      if (history[i].phase !== currentPhase) {
        regions.push({
          phase: currentPhase,
          start,
          end: history[i - 1].trial,
          color: getPhaseColor(currentPhase)
        });
        start = history[i].trial;
        currentPhase = history[i].phase;
      }
    }

    regions.push({
      phase: currentPhase,
      start,
      end: history[history.length - 1].trial,
      color: getPhaseColor(currentPhase)
    });

    return regions;
  };

  const getPhaseColor = (p) => {
    switch (p) {
      case 'habituation': return 'rgba(148, 163, 184, 0.08)'; // gray
      case 'acquisition': return 'rgba(239, 68, 68, 0.08)';   // red
      case 'extinction': return 'rgba(16, 185, 129, 0.08)';   // green
      default: return 'rgba(255, 255, 255, 0.02)';
    }
  };

  // Fear thermometer visual descriptors
  const getFearState = (f) => {
    if (f < 0.15) return { text: "Baseline Safe (Calm / Exploring)", color: "text-slate-400", bg: "bg-slate-500/20" };
    if (f < 0.50) return { text: "Mild Alertness (Startle Sensitive)", color: "text-amber-400", bg: "bg-amber-500/20" };
    if (f < 0.80) return { text: "Autonomic Fear (Elevated Heart Rate)", color: "text-orange-500", bg: "bg-orange-500/20" };
    return { text: "Tonic Freezing (Immobile Defensive State)", color: "text-rose-500", bg: "bg-rose-500/20", glow: "0 0 10px rgba(244, 63, 94, 0.5)" };
  };

  const currentFearState = getFearState(nodeActivations.CeA);

  // Custom tooltips for graphs
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-xl text-xs space-y-1.5 font-mono">
          <p className="font-bold text-white text-sm font-sans mb-1">Trial #{data.trial}</p>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-slate-400">Phase:</span>
            <span className={`badge badge-${data.phase}`}>{data.phase.toUpperCase()}</span>
          </div>
          <p className="text-amber-400">
            Synaptic Weight (W_cs): <span className="font-bold">{data.W_cs.toFixed(3)}</span>
          </p>
          <p className="text-rose-400">
            Fear Output (CeA): <span className="font-bold">{data.fear.toFixed(3)}</span>
          </p>
          <div className="h-[1px] bg-white/5 my-1" />
          <p className="text-slate-400">
            Stimuli: <span className="text-white">
              {data.cs ? 'Tone (CS)' : ''}
              {data.cs && data.us ? ' + ' : ''}
              {data.us ? 'Shock (US)' : ''}
              {!data.cs && !data.us ? 'None' : ''}
            </span>
          </p>
          <p className="text-slate-400">
            Renewal Context: <span className={data.renewal ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {data.renewal ? 'Context B (Novel)' : 'Context A (Conditioning)'}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      {/* Header bar */}
      <header className="p-4 border-b border-white/5 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-rose-500 to-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Joseph LeDoux Amygdala Fear Circuit
            </h1>
            <p className="text-xs text-slate-400">Interactive Simulation of Affective Associative Learning</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowParams(!showParams)}
            className={`btn btn-secondary py-1.5 px-3 flex items-center gap-1.5 ${showParams ? 'bg-white/10 border-white/20' : ''}`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Parameters</span>
          </button>
          <button onClick={handleReset} className="btn btn-danger py-1.5 px-3 flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* Main layout */}
      <main className="main-content">
        {/* LEFT COLUMN: SVG Circuit Diagram */}
        <section className="flex flex-col gap-4">
          <div className="glass-panel p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 text-[10px] font-mono tracking-wider font-bold text-white/20 bg-white/5 rounded-bl-lg">
              SVG CIRCUIT ANATOMY
            </div>
            <div>
              <h2 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                Neural Connectivity Diagram
              </h2>
              <p className="text-xs text-slate-400">
                Click any node to inspect its role. Glow intensity shows active firing. CS line thickness reflects synaptic weight (W_cs).
              </p>
            </div>

            {/* Visual representation of current context */}
            <div className={`p-2 rounded-lg border text-center transition-all ${
              renewal 
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' 
                : 'bg-slate-950/40 border-slate-800 text-slate-400'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold block mb-0.5">Current Environment</span>
              <span className="text-xs font-semibold">
                {renewal ? 'Context B (Novel Testing Chamber)' : 'Context A (Original Training Chamber)'}
              </span>
            </div>

            {/* SVG Circuit Diagram */}
            <div className="flex justify-center select-none">
              <svg viewBox="0 0 740 400" className="w-full h-auto bg-slate-950/30 rounded-xl border border-white/5 overflow-visible">
                <defs>
                  <filter id="glow-heavy" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur1" />
                    <feGaussianBlur stdDeviation="3" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur1" />
                      <feMergeNode in="blur2" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  
                  {/* Arrowhead Markers */}
                  <marker id="arrow-excitatory" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#cbd5e1" />
                  </marker>
                  <marker id="arrow-cs" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-cs)" />
                  </marker>
                  <marker id="arrow-us" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-us)" />
                  </marker>
                  <marker id="arrow-high-road" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-high-road)" />
                  </marker>
                  <marker id="arrow-low-road" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-low-road)" />
                  </marker>
                  <marker id="arrow-pfc" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--color-pfc)" />
                  </marker>
                  
                  {/* Inhibitory T-bar Marker */}
                  <marker id="bar-inhibitory" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 5 0 L 5 10 M 0 5 L 9 5" stroke="var(--color-itc)" strokeWidth="2.5" />
                  </marker>
                </defs>

                {/* Legend Guidelines */}
                <path d="M 10 10 L 60 10" stroke="var(--color-low-road)" strokeWidth="2" strokeDasharray="3,3" />
                <text x="68" y="14" fill="var(--text-muted)" fontSize="9" fontWeight="bold">LOW ROAD (FAST)</text>

                <path d="M 10 25 L 60 25" stroke="var(--color-high-road)" strokeWidth="2" />
                <text x="68" y="29" fill="var(--text-muted)" fontSize="9" fontWeight="bold">HIGH ROAD (SLOW)</text>

                {/* Synaptic Connections (Base Lines) */}
                {/* CS -> Thal */}
                <path 
                  d="M 60 140 L 180 200" 
                  stroke="var(--color-cs)" 
                  strokeWidth={csActive ? 3.5 : 1.2} 
                  opacity={csActive ? 0.9 : 0.2} 
                  markerEnd="url(#arrow-cs)" 
                />

                {/* US -> Thal */}
                <path 
                  d="M 60 260 L 180 200" 
                  stroke="var(--color-us)" 
                  strokeWidth={usActive ? 3.5 : 1.2} 
                  opacity={usActive ? 0.9 : 0.2} 
                  markerEnd="url(#arrow-us)" 
                />

                {/* Thal -> Ctx */}
                <path 
                  d="M 180 200 L 180 90" 
                  stroke="var(--color-high-road)" 
                  strokeWidth={nodeActivations.Ctx > 0.1 ? 3 : 1.2} 
                  opacity={nodeActivations.Ctx > 0.1 ? 0.8 : 0.2} 
                  markerEnd="url(#arrow-high-road)" 
                />

                {/* Ctx -> LA (High Road CS Plastic Synapse) */}
                <path 
                  d="M 180 90 L 340 200" 
                  stroke="var(--color-high-road)" 
                  strokeWidth={1.5 + (W_cs * 4.5)} 
                  opacity={0.25 + (W_cs * 0.6)} 
                  markerEnd="url(#arrow-high-road)" 
                />

                {/* Thal -> LA (Low Road CS Plastic Synapse) */}
                <path 
                  d="M 180 200 L 340 200" 
                  stroke="var(--color-low-road)" 
                  strokeWidth={1.5 + (W_cs * 4.5)} 
                  opacity={0.25 + (W_cs * 0.6)} 
                  strokeDasharray="4,3"
                  markerEnd="url(#arrow-low-road)" 
                />

                {/* US -> LA */}
                <path 
                  d="M 60 260 L 340 200" 
                  stroke="var(--color-us)" 
                  strokeWidth={usActive ? 4 : 1.2} 
                  opacity={usActive ? 0.95 : 0.2} 
                  markerEnd="url(#arrow-us)" 
                />

                {/* Context -> LA */}
                <path 
                  d="M 200 320 L 340 200" 
                  stroke="var(--color-success)" 
                  strokeWidth={renewal ? 3 : 1.2} 
                  strokeDasharray={renewal ? "" : "3,3"} 
                  opacity={renewal ? 0.9 : 0.15} 
                  markerEnd="url(#arrow-excitatory)" 
                />

                {/* LA -> BA */}
                <path 
                  d="M 340 200 L 340 300" 
                  stroke="var(--color-la)" 
                  strokeWidth={nodeActivations.LA > 0.1 ? 3 : 1.2} 
                  opacity={nodeActivations.LA > 0.1 ? 0.85 : 0.2} 
                  markerEnd="url(#arrow-excitatory)" 
                />

                {/* BA -> CeA */}
                <path 
                  d="M 340 300 L 480 250" 
                  stroke="var(--color-ba)" 
                  strokeWidth={nodeActivations.BA > 0.1 ? 3 : 1.2} 
                  opacity={nodeActivations.BA > 0.1 ? 0.85 : 0.2} 
                  markerEnd="url(#arrow-excitatory)" 
                />

                {/* PFC -> ITC */}
                <path 
                  d="M 340 70 L 480 130" 
                  stroke="var(--color-pfc)" 
                  strokeWidth={nodeActivations.PFC > 0.1 ? 3 : 1.2} 
                  opacity={nodeActivations.PFC > 0.1 ? 0.95 : 0.2} 
                  markerEnd="url(#arrow-pfc)" 
                />

                {/* ITC -> CeA (GABAergic Inhibition) */}
                <path 
                  d="M 480 130 L 480 250" 
                  stroke="var(--color-itc)" 
                  strokeWidth={nodeActivations.ITC > 0.1 ? 3.5 : 1.2} 
                  opacity={nodeActivations.ITC > 0.1 ? 0.95 : 0.2} 
                  markerEnd="url(#bar-inhibitory)" 
                />

                {/* CeA -> Response */}
                <path 
                  d="M 480 250 L 620 250" 
                  stroke="var(--color-cea)" 
                  strokeWidth={nodeActivations.CeA > 0.1 ? 4 : 1.2} 
                  opacity={nodeActivations.CeA > 0.1 ? 0.95 : 0.2} 
                  markerEnd="url(#arrow-excitatory)" 
                />

                {/* Signal Propagation Pulses */}
                {animating && (
                  <>
                    {csActive && (
                      <>
                        <circle r="3.5" fill="var(--color-cs)" className="edge-pulse">
                          <animateMotion dur="0.7s" repeatCount="1" path="M 60 140 L 180 200" />
                        </circle>
                        <circle r="3.5" fill="var(--color-high-road)" className="edge-pulse">
                          <animateMotion dur="0.7s" repeatCount="1" path="M 180 200 L 180 90" />
                        </circle>
                        <circle r="3.5" fill="var(--color-high-road)" className="edge-pulse">
                          <animateMotion dur="0.7s" repeatCount="1" path="M 180 90 L 340 200" />
                        </circle>
                        <circle r="3.5" fill="var(--color-low-road)" className="edge-pulse">
                          <animateMotion dur="0.7s" repeatCount="1" path="M 180 200 L 340 200" />
                        </circle>
                      </>
                    )}
                    {usActive && (
                      <>
                        <circle r="3.5" fill="var(--color-us)" className="edge-pulse">
                          <animateMotion dur="0.7s" repeatCount="1" path="M 60 260 L 180 200" />
                        </circle>
                        <circle r="3.5" fill="var(--color-us)" className="edge-pulse">
                          <animateMotion dur="0.7s" repeatCount="1" path="M 60 260 L 340 200" />
                        </circle>
                      </>
                    )}
                    {renewal && (
                      <circle r="3.5" fill="var(--color-success)" className="edge-pulse">
                        <animateMotion dur="0.7s" repeatCount="1" path="M 200 320 L 340 200" />
                      </circle>
                    )}
                    {nodeActivations.LA > 0.1 && (
                      <circle r="3.5" fill="var(--color-la)" className="edge-pulse">
                        <animateMotion dur="0.7s" repeatCount="1" path="M 340 200 L 340 300" />
                      </circle>
                    )}
                    {nodeActivations.BA > 0.1 && (
                      <circle r="3.5" fill="var(--color-ba)" className="edge-pulse">
                        <animateMotion dur="0.7s" repeatCount="1" path="M 340 300 L 480 250" />
                      </circle>
                    )}
                    {nodeActivations.PFC > 0.1 && (
                      <circle r="3.5" fill="var(--color-pfc)" className="edge-pulse">
                        <animateMotion dur="0.7s" repeatCount="1" path="M 340 70 L 480 130" />
                      </circle>
                    )}
                    {nodeActivations.ITC > 0.1 && (
                      <circle r="3.5" fill="var(--color-itc)" className="edge-pulse">
                        <animateMotion dur="0.7s" repeatCount="1" path="M 480 130 L 480 250" />
                      </circle>
                    )}
                    {nodeActivations.CeA > 0.1 && (
                      <circle r="3.5" fill="var(--color-cea)" className="edge-pulse">
                        <animateMotion dur="0.7s" repeatCount="1" path="M 480 250 L 620 250" />
                      </circle>
                    )}
                  </>
                )}

                {/* Node Labels inside SVG */}
                <text x="60" y="105" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">CS (Tone)</text>
                <text x="60" y="302" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">US (Shock)</text>
                <text x="180" y="238" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">Thalamus</text>
                <text x="180" y="55" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">Sensory Cortex</text>
                <text x="340" y="35" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">PFC</text>
                <text x="480" y="95" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">ITC (Inhibitory)</text>
                <text x="340" y="240" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">LA (Plastic)</text>
                <text x="340" y="338" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">BA</text>
                <text x="480" y="290" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">CeA (Output)</text>
                <text x="200" y="358" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">Context (Hipp.)</text>
                <text x="620" y="290" textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">Fear Response</text>

                {/* Nodes - Interactive Circle Groups */}
                {/* CS Node */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("CS")}>
                  <circle cx="60" cy="140" r="22" fill={selectedNode === "CS" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={csActive ? "var(--color-cs)" : "var(--border-color)"} strokeWidth={selectedNode === "CS" ? 3 : 1.5} filter={csActive ? "url(#glow-heavy)" : ""} />
                  <text x="60" y="144" textAnchor="middle" fill={csActive ? "var(--color-cs)" : "#fff"} fontSize="11" fontWeight="700" fontFamily="var(--font-display)">CS</text>
                </g>

                {/* US Node */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("US")}>
                  <circle cx="60" cy="260" r="22" fill={selectedNode === "US" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={usActive ? "var(--color-us)" : "var(--border-color)"} strokeWidth={selectedNode === "US" ? 3 : 1.5} filter={usActive ? "url(#glow-heavy)" : ""} />
                  <text x="60" y="264" textAnchor="middle" fill={usActive ? "var(--color-us)" : "#fff"} fontSize="11" fontWeight="700" fontFamily="var(--font-display)">US</text>
                </g>

                {/* Thalamus */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("Thal")}>
                  <circle cx="180" cy="200" r="22" fill={selectedNode === "Thal" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.Thal > 0.1 ? "var(--color-low-road)" : "var(--border-color)"} strokeWidth={selectedNode === "Thal" ? 3 : 1.5} filter={nodeActivations.Thal > 0.1 ? "url(#glow-light)" : ""} />
                  <text x="180" y="204" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">THAL</text>
                </g>

                {/* Sensory Cortex */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("Ctx")}>
                  <circle cx="180" cy="90" r="22" fill={selectedNode === "Ctx" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.Ctx > 0.1 ? "var(--color-high-road)" : "var(--border-color)"} strokeWidth={selectedNode === "Ctx" ? 3 : 1.5} filter={nodeActivations.Ctx > 0.1 ? "url(#glow-light)" : ""} />
                  <text x="180" y="94" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">CTX</text>
                </g>

                {/* PFC */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("PFC")}>
                  <circle cx="340" cy="70" r="22" fill={selectedNode === "PFC" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.PFC > 0.1 ? "var(--color-pfc)" : "var(--border-color)"} strokeWidth={selectedNode === "PFC" ? 3 : 1.5} filter={nodeActivations.PFC > 0.1 ? "url(#glow-heavy)" : ""} />
                  <text x="340" y="74" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">PFC</text>
                </g>

                {/* ITC */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("ITC")}>
                  <circle cx="480" cy="130" r="22" fill={selectedNode === "ITC" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.ITC > 0.1 ? "var(--color-itc)" : "var(--border-color)"} strokeWidth={selectedNode === "ITC" ? 3 : 1.5} filter={nodeActivations.ITC > 0.1 ? "url(#glow-heavy)" : ""} />
                  <text x="480" y="134" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">ITC</text>
                </g>

                {/* LA (Lateral Amygdala) - Highlight Plastic Synapses */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("LA")}>
                  <circle cx="340" cy="200" r="24" fill={selectedNode === "LA" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.LA > 0.1 ? "var(--color-la)" : "var(--border-color)"} strokeWidth={selectedNode === "LA" ? 3.5 : 1.5} filter={nodeActivations.LA > 0.1 ? "url(#glow-heavy)" : ""} />
                  <text x="340" y="204" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="var(--font-display)">LA</text>
                  
                  {/* Synapse representation on Left edge of LA (Auditory/Sensory convergence) */}
                  <circle 
                    cx="317" 
                    cy="200" 
                    r={3.5 + (W_cs * 2.5)} 
                    fill="var(--color-cs)" 
                    opacity={0.3 + (W_cs * 0.7)} 
                    filter={W_cs > 0.5 ? "url(#glow-light)" : ""} 
                  />
                  <text x="312" y="193" fill="var(--color-cs)" fontSize="7" fontWeight="bold" opacity={0.6 + W_cs * 0.4}>W</text>
                </g>

                {/* BA */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("BA")}>
                  <circle cx="340" cy="300" r="22" fill={selectedNode === "BA" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.BA > 0.1 ? "var(--color-ba)" : "var(--border-color)"} strokeWidth={selectedNode === "BA" ? 3 : 1.5} filter={nodeActivations.BA > 0.1 ? "url(#glow-light)" : ""} />
                  <text x="340" y="304" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">BA</text>
                </g>

                {/* CeA */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("CeA")}>
                  <circle cx="480" cy="250" r="23" fill={selectedNode === "CeA" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.CeA > 0.1 ? "var(--color-cea)" : "var(--border-color)"} strokeWidth={selectedNode === "CeA" ? 3.5 : 1.5} filter={nodeActivations.CeA > 0.1 ? "url(#glow-heavy)" : ""} />
                  <text x="480" y="254" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">CeA</text>
                </g>

                {/* Context / Hippocampus */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("CtxNode")}>
                  <circle cx="200" cy="320" r="22" fill={selectedNode === "CtxNode" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={renewal ? "var(--color-success)" : "var(--border-color)"} strokeWidth={selectedNode === "CtxNode" ? 3 : 1.5} filter={renewal ? "url(#glow-heavy)" : ""} />
                  <text x="200" y="324" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="var(--font-display)">CTX</text>
                </g>

                {/* Behavioral Response Node */}
                <g className="cursor-pointer" onClick={() => setSelectedNode("Response")}>
                  <circle cx="620" cy="250" r="22" fill={selectedNode === "Response" ? "var(--bg-tertiary)" : "rgba(10, 14, 26, 0.9)"} stroke={nodeActivations.CeA > 0.15 ? "var(--color-cea)" : "var(--border-color)"} strokeWidth={selectedNode === "Response" ? 3 : 1.5} filter={nodeActivations.CeA > 0.15 ? "url(#glow-heavy)" : ""} />
                  <text x="620" y="254" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="var(--font-display)">FEAR</text>
                </g>
              </svg>
            </div>
          </div>

          {/* Node Inspector details */}
          <div className="glass-panel p-4 flex flex-col gap-2 min-h-[140px] bg-slate-900/60 border border-white/5 relative">
            <div className="absolute top-3 right-4 flex items-center gap-1 text-[10px] font-mono text-slate-500">
              <Eye className="w-3.5 h-3.5" />
              NODE INSPECTOR
            </div>
            {selectedNode ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                  <h3 className="text-sm font-bold text-white font-display">
                    {nodeDescriptions[selectedNode].name}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {nodeDescriptions[selectedNode].role}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  {nodeDescriptions[selectedNode].desc}
                </p>
                <div className="pt-2 flex items-center gap-4 text-xs font-mono text-slate-400 border-t border-white/5 mt-2">
                  <div>
                    Current Activation: <span className="text-white font-bold">
                      {(selectedNode === 'CtxNode' ? (renewal ? 1.0 : 0.0) : nodeActivations[selectedNode] || 0.0).toFixed(3)}
                    </span>
                  </div>
                  {selectedNode === 'LA' && (
                    <div className="text-amber-400">
                      Synaptic Weight (W_cs): <span className="font-bold">{W_cs.toFixed(3)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">
                Click a node on the diagram to inspect its parameters.
              </div>
            )}
          </div>
        </section>

        {/* CENTER COLUMN: Controls & Numerical Status */}
        <section className="flex flex-col gap-4">
          {/* Phase Control Card */}
          <div className="glass-panel p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-rose-400" />
                Behavioral Phase Controller
              </h2>
              <p className="text-xs text-slate-400">Select a phase to simulate different stages of fear conditioning.</p>
            </div>

            {/* Toggle Buttons */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/50 p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => setPhase('habituation')} 
                className={`btn py-1.5 text-xs rounded transition-all ${
                  phase === 'habituation' 
                    ? 'bg-slate-800 border-slate-700 text-white shadow' 
                    : 'text-slate-400 bg-transparent hover:text-slate-200'
                }`}
              >
                1. Habituation
              </button>
              <button 
                onClick={() => setPhase('acquisition')} 
                className={`btn py-1.5 text-xs rounded transition-all ${
                  phase === 'acquisition' 
                    ? 'bg-rose-950/60 border-rose-800 text-rose-200 shadow' 
                    : 'text-slate-400 bg-transparent hover:text-slate-200'
                }`}
              >
                2. Acquisition
              </button>
              <button 
                onClick={() => setPhase('extinction')} 
                className={`btn py-1.5 text-xs rounded transition-all ${
                  phase === 'extinction' 
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200 shadow' 
                    : 'text-slate-400 bg-transparent hover:text-slate-200'
                }`}
              >
                3. Extinction
              </button>
            </div>

            {/* Phase info box */}
            <div className="p-3 rounded-lg bg-slate-950/40 border border-white/5 text-xs space-y-1.5 leading-relaxed">
              {phase === 'habituation' && (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Habituation Baseline
                  </div>
                  <p className="text-slate-400">
                    The Conditioned Stimulus (Tone) is presented repeatedly without shock. The animal learns that the Tone is safe. The CS-LA weight remains at its low baseline.
                  </p>
                  <p className="text-slate-500 italic mt-1 font-mono">Learning dynamic: ΔW_cs = 0</p>
                </>
              )}
              {phase === 'acquisition' && (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Acquisition Pairing
                  </div>
                  <p className="text-slate-400">
                    Tone (CS) and Shock (US) are presented together. High calcium influx through co-activation triggers synaptic changes (LTP). Synaptic weight <span className="text-amber-400 font-bold">W_cs</span> strengthens rapidly.
                  </p>
                  <p className="text-slate-500 italic mt-1 font-mono">Learning dynamic: ΔW_cs = η * A_cs * A_us (Hebbian)</p>
                </>
              )}
              {phase === 'extinction' && (
                <>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Extinction Recall
                  </div>
                  <p className="text-slate-400">
                    The Tone is presented without shock. The Prefrontal Cortex (PFC) detects the safety context and activates the inhibitory Intercalated Cells (ITC) to clamp the Central Amygdala (CeA). The CS-LA weight decays slowly.
                  </p>
                  <p className="text-slate-500 italic mt-1 font-mono">Learning dynamic: ΔW_cs = -η_ext * A_cs * A_ITC (Active suppression)</p>
                </>
              )}
            </div>
          </div>

          {/* Trial Runner Controls */}
          <div className="glass-panel p-4 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-200">Simulation Controls</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleSingleTrial(true, null)} 
                className="btn btn-primary flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                Run 1 Trial
              </button>
              <button 
                onClick={handleTenTrials} 
                className="btn btn-secondary flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4" />
                Run 10 Trials
              </button>
            </div>

            {/* Quick manual stimulus */}
            <div className="border-t border-white/5 pt-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-2">Manual Micro-Stimulation</span>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => handleSingleTrial(true, false)} 
                  className="btn btn-secondary py-1.5 px-1 text-xs hover:border-amber-500/50"
                  title="Deliver tone only"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 inline mr-1" />
                  CS Only
                </button>
                <button 
                  onClick={() => handleSingleTrial(false, true)} 
                  className="btn btn-secondary py-1.5 px-1 text-xs hover:border-red-500/50"
                  title="Deliver shock only"
                >
                  <Zap className="w-3.5 h-3.5 text-rose-500 inline mr-1" />
                  US Only
                </button>
                <button 
                  onClick={() => handleSingleTrial(true, true)} 
                  className="btn btn-secondary py-1.5 px-1 text-xs hover:border-violet-500/50"
                  title="Deliver tone & shock"
                >
                  <Flame className="w-3.5 h-3.5 text-violet-400 inline mr-1" />
                  CS + US
                </button>
              </div>
            </div>
          </div>

          {/* Current Activation status cards */}
          <div className="glass-panel p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-200">Current Node Activations</h3>
            
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">CS input:</span>
                <span className={`font-bold ${csActive ? 'text-amber-400' : 'text-slate-600'}`}>{csActive ? '1.000' : '0.000'}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">US input:</span>
                <span className={`font-bold ${usActive ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`}>{usActive ? '1.000' : '0.000'}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Thalamus:</span>
                <span className="font-bold text-slate-200">{nodeActivations.Thal.toFixed(3)}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Cortex:</span>
                <span className="font-bold text-blue-400">{nodeActivations.Ctx.toFixed(3)}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">PFC:</span>
                <span className="font-bold text-cyan-400">{nodeActivations.PFC.toFixed(3)}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">ITC (GABA):</span>
                <span className="font-bold text-violet-400">{nodeActivations.ITC.toFixed(3)}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Lat. Amygdala:</span>
                <span className="font-bold text-fuchsia-400">{nodeActivations.LA.toFixed(3)}</span>
              </div>
              <div className="bg-slate-950/30 p-2 rounded border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Central Amyg.:</span>
                <span className="font-bold text-rose-400">{nodeActivations.CeA.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Real-Time Recharts Plots */}
        <section className="flex flex-col gap-4">
          <div className="glass-panel p-4 flex flex-col gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Live Circuit Dynamics
              </h2>
              <p className="text-xs text-slate-400">Real-time plots tracking trials. Background represents training phase.</p>
            </div>

            {/* Plot 1: W_cs Synaptic Weight */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-slate-300">CS→LA Synaptic Weight (W_cs)</span>
                <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                  Current: {W_cs.toFixed(3)}
                </span>
              </div>
              <div className="h-[180px] bg-slate-950/40 rounded-xl p-2 border border-white/5 relative">
                {history.length <= 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600 font-mono">
                    Awaiting trials...
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="trial" tick={{ fontSize: 9, fill: '#64748b' }} stroke="rgba(255,255,255,0.1)" />
                    <YAxis domain={[0, 1.25]} tick={{ fontSize: 9, fill: '#64748b' }} stroke="rgba(255,255,255,0.1)" />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Visual phase dividers */}
                    {getPhaseRegions().map((region, index) => (
                      <ReferenceArea 
                        key={index}
                        x1={region.start}
                        x2={region.end}
                        fill={region.color}
                        fillOpacity={1}
                      />
                    ))}

                    <Line 
                      type="monotone" 
                      dataKey="W_cs" 
                      stroke="var(--color-cs)" 
                      strokeWidth={2.5} 
                      dot={{ r: 2, stroke: 'var(--color-cs)', strokeWidth: 1 }}
                      activeDot={{ r: 5 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plot 2: Fear Output (CeA) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-slate-300">Fear Response Output (CeA Activation)</span>
                <span className="font-mono text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded">
                  Current: {nodeActivations.CeA.toFixed(3)}
                </span>
              </div>
              <div className="h-[180px] bg-slate-950/40 rounded-xl p-2 border border-white/5 relative">
                {history.length <= 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600 font-mono">
                    Awaiting trials...
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="trial" tick={{ fontSize: 9, fill: '#64748b' }} stroke="rgba(255,255,255,0.1)" />
                    <YAxis domain={[0, 1.05]} tick={{ fontSize: 9, fill: '#64748b' }} stroke="rgba(255,255,255,0.1)" />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Visual phase dividers */}
                    {getPhaseRegions().map((region, index) => (
                      <ReferenceArea 
                        key={index}
                        x1={region.start}
                        x2={region.end}
                        fill={region.color}
                        fillOpacity={1}
                      />
                    ))}

                    <Line 
                      type="monotone" 
                      dataKey="fear" 
                      stroke="var(--color-cea)" 
                      strokeWidth={2.5} 
                      dot={{ r: 2, stroke: 'var(--color-cea)', strokeWidth: 1 }}
                      activeDot={{ r: 5 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graphs Legend info */}
            <div className="flex justify-center gap-4 text-[10px] font-mono text-slate-500">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-slate-400/20" /> Habituation
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-rose-500/20" /> Acquisition
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-500/20" /> Extinction
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* PARAMETERS ADJUST PANEL (Collapsible) */}
      {showParams && (
        <section className="max-w-[1600px] mx-auto w-full px-6 mb-4 animate-fadeIn">
          <div className="glass-panel p-4 bg-slate-900/80 border-violet-500/20 shadow-xl shadow-violet-900/5">
            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-violet-400" />
                Advanced Neural Parameters Adjustment
              </h3>
              <button onClick={restoreDefaultParams} className="btn btn-secondary py-1 px-3 text-xs">
                Reset Defaults
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>Acq. Learning Rate (η)</span>
                  <span className="text-amber-400">{eta.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.01" max="0.30" step="0.01" value={eta} 
                  onChange={(e) => setEta(parseFloat(e.target.value))} 
                  className="w-full accent-amber-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>Ext. Decay Rate (η_ext)</span>
                  <span className="text-emerald-400">{etaExt.toFixed(3)}</span>
                </div>
                <input 
                  type="range" min="0.005" max="0.10" step="0.005" value={etaExt} 
                  onChange={(e) => setEtaExt(parseFloat(e.target.value))} 
                  className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>Context Weight (W_ctx)</span>
                  <span className="text-blue-400">{wCtx.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.1" max="1.0" step="0.05" value={wCtx} 
                  onChange={(e) => setWCtx(parseFloat(e.target.value))} 
                  className="w-full accent-blue-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>ITC Inhibition (W_ITC)</span>
                  <span className="text-violet-400">{wItc.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.5" max="2.5" step="0.1" value={wItc} 
                  onChange={(e) => setWItc(parseFloat(e.target.value))} 
                  className="w-full accent-violet-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>US Input Weight (wUs)</span>
                  <span className="text-rose-400">{wUs.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.5" max="1.5" step="0.1" value={wUs} 
                  onChange={(e) => setWUs(parseFloat(e.target.value))} 
                  className="w-full accent-rose-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>LA-BA Weight (wBa)</span>
                  <span className="text-fuchsia-400">{wBa.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.5" max="1.5" step="0.1" value={wBa} 
                  onChange={(e) => setWBa(parseFloat(e.target.value))} 
                  className="w-full accent-fuchsia-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1 bg-slate-950/30 p-2.5 rounded border border-white/5">
                <div className="flex justify-between text-slate-300">
                  <span>PFC-ITC Weight (wPfc)</span>
                  <span className="text-cyan-400">{wPfc.toFixed(2)}</span>
                </div>
                <input 
                  type="range" min="0.5" max="1.5" step="0.1" value={wPfc} 
                  onChange={(e) => setWPfc(parseFloat(e.target.value))} 
                  className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-violet-950/10 border border-violet-900/20 rounded flex items-center gap-2 text-[10px] text-slate-400 leading-normal">
                <Info className="w-4 h-4 text-violet-400 shrink-0" />
                These variables dynamically scale the sigmoidal activations and synaptic weight updates.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BOTTOM PANEL: Fear Meter & Context Renewal & Educational Guide */}
      <section className="max-w-[1600px] mx-auto w-full px-6 flex flex-col gap-4 pb-6">
        
        {/* Fear Thermometer & Context Renewal Toggle */}
        <div className="glass-panel p-5 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          
          {/* Fear thermometer output */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300 font-display flex items-center gap-1">
                <Flame className="w-4 h-4 text-rose-500" />
                CENTRAL AMYGDALA (CeA) BEHAVIORAL OUTPUT
              </span>
              <span className="text-xs font-bold font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                Freezing: {(nodeActivations.CeA * 100).toFixed(1)}%
              </span>
            </div>
            
            {/* The liquid indicator bar */}
            <div className="h-6 w-full bg-slate-950 rounded-full border border-white/5 overflow-hidden p-[2px] flex relative shadow-inner">
              <div 
                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 shadow-lg"
                style={{ 
                  width: `${nodeActivations.CeA * 100}%`,
                  boxShadow: currentFearState.glow || "none"
                }} 
              />
            </div>

            {/* Labeled indicator text */}
            <div className="flex justify-between items-center text-xs">
              <span className={`font-semibold ${currentFearState.color}`}>
                Status: {currentFearState.text}
              </span>
              <span className="text-slate-500 text-[10px] font-mono">
                Threshold: A_CeA &gt; 0.15
              </span>
            </div>
          </div>

          {/* Context renewal toggle & explanation */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1 max-w-[70%]">
              <h4 className="text-xs font-bold text-slate-300 font-display uppercase tracking-wider">
                Context Renewal Switch (Hippocampus)
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal">
                Toggling this switch simulates moving the subject out of the Extinction context. It will disable the PFC active safety brake and recruit contextual inputs.
              </p>
            </div>

            {/* Interactive Toggle Switch */}
            <button 
              onClick={() => setRenewal(!renewal)}
              className={`w-14 h-7 rounded-full p-1 transition-colors relative flex items-center shrink-0 ${
                renewal ? 'bg-emerald-500' : 'bg-slate-800 border border-white/10'
              }`}
            >
              <span 
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  renewal ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Educational Guide Card */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <BookOpen className="w-5 h-5 text-violet-400" />
            <h3 className="text-md font-bold text-white font-display">Neuroscience Study Guide</h3>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-slate-950/30 p-1 rounded border border-white/5 max-w-sm">
            <button 
              onClick={() => setEduTab('anatomy')}
              className={`py-1 px-3 text-xs rounded transition-all flex-1 ${
                eduTab === 'anatomy' ? 'bg-slate-800 text-white font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Circuit Paths
            </button>
            <button 
              onClick={() => setEduTab('plasticity')}
              className={`py-1 px-3 text-xs rounded transition-all flex-1 ${
                eduTab === 'plasticity' ? 'bg-slate-800 text-white font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Hebbian Rule
            </button>
            <button 
              onClick={() => setEduTab('renewal')}
              className={`py-1 px-3 text-xs rounded transition-all flex-1 ${
                eduTab === 'renewal' ? 'bg-slate-800 text-white font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Extinction Theory
            </button>
          </div>

          {/* Tab content */}
          <div className="text-xs text-slate-300 leading-relaxed min-h-[140px] pt-1">
            {eduTab === 'anatomy' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-400">🔴 The Low Road (Thalamus → LA)</h4>
                  <p className="text-slate-400">
                    A subcortical pathway bypassing the sensory cortex. It is fast (~12-15 ms) but transmits crude auditory/visual information. Evolutionary benefit: enables immediate life-saving reflexes ("shoot first, ask questions later" — e.g. jumping away from a branch that looks like a snake).
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-400">🔵 The High Road (Thalamus → Cortex → LA)</h4>
                  <p className="text-slate-400">
                    A cortical pathway that relays detailed, contextual representation. It is slower (~30-40 ms) but performs advanced processing. Cognitive integration allows it to verify threat signals and modulate the fear response top-down.
                  </p>
                </div>
              </div>
            )}

            {eduTab === 'plasticity' && (
              <div className="space-y-2">
                <p>
                  Joseph LeDoux's model demonstrates that <strong>Fear Conditioning</strong> is driven by Hebbian LTP (Long-Term Potentiation) within the <strong>Lateral Amygdala (LA)</strong>.
                </p>
                <div className="p-3 bg-slate-950/40 rounded border border-white/5 font-mono text-center text-amber-400 text-xs">
                  ΔW_cs = η × A_cs × A_us
                </div>
                <p className="text-slate-400 pt-1">
                  The CS input (tone) represents weak synapse activity. The US input (shock) represents strong somatic depolarization. When they arrive concurrently in the LA, NMDA receptors open, triggering an intracellular cascade that inserts AMPA receptors. This strengthens the CS synapse so that later, the CS alone is strong enough to drive the BA and CeA, generating autonomic responses.
                </p>
              </div>
            )}

            {eduTab === 'renewal' && (
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-400">Extinction is Inhibition, Not Erasure</h4>
                <p>
                  When the Tone is repeatedly presented without the Shock, fear behavior declines. However, this is not because the original CS→LA memory is erased. Instead, the subject learns a <em>new safety association</em>.
                </p>
                <p className="text-slate-400">
                  During extinction, the <strong>Prefrontal Cortex (PFC)</strong> fires, activating the <strong>Intercalated Cells (ITC)</strong>. These GABAergic cells actively suppress the <strong>Central Amygdala (CeA)</strong> output, gating the fear expression.
                </p>
                <p className="text-slate-400">
                  If the context is switched (Renewal ON), hippocampal inputs notify the circuit that the current chamber is not the safe safety-chamber. The PFC safety-gating fails (PFC activation drops), lifting the ITC GABAergic brake and restoring fear expression.
                </p>
              </div>
            )}
          </div>
        </div>

      </section>

      {/* Footer copyright */}
      <footer className="footer bg-slate-950/20">
        <p className="flex items-center justify-center gap-1.5">
          <span>Simulation calibrated to research data from LeDoux (1996) and Phelps et al. (2004). Built for educational neuroscience laboratories.</span>
        </p>
      </footer>
    </div>
  );
}
