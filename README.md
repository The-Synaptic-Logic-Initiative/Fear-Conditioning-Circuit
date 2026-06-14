```markdown
# Project 8: Fear Conditioning Circuit

A computational simulation of Joseph LeDoux's amygdala fear circuit — one of the most influential models in affective neuroscience.

---

## What Is This?

I built this project to simulate how the brain learns fear associations. It's based on real neuroscience: when a neutral sound (tone) gets paired with something unpleasant (shock), the brain learns to fear the tone alone. This is exactly how phobias form.

The simulation runs in your browser. You can run trials, watch synaptic weights change in real time, and see fear responses rise and fall.

---

## The Neuroscience Behind It

Fear conditioning is a form of associative learning. A neutral **Conditioned Stimulus (CS)** — a tone — gets repeatedly paired with an aversive **Unconditioned Stimulus (US)** — a shock. After enough pairings, the CS alone triggers a fear response.

### LeDoux's Two Pathways

| Pathway | Route | Speed | Quality |
|---------|-------|-------|---------|
| 🔴 Low Road | Thalamus → Lateral Amygdala | Fast (~12-15ms) | Crude, automatic, "shoot first" |
| 🔵 High Road | Thalamus → Sensory Cortex → Lateral Amygdala | Slow (~30-40ms) | Detailed, contextual, "ask questions later" |

### The Circuit Nodes

| Node | What It Does |
|------|---------------|
| **Lateral Amygdala (LA)** | CS and US converge here. Hebbian plasticity happens here — this is where learning lives. |
| **Basal Amygdala (BA)** | Integration hub. Gets contextual input from hippocampus. |
| **Central Amygdala (CeA)** | Output gate. Drives freezing behavior and autonomic arousal. |
| **Intercalated Cells (ITC)** | GABAergic inhibitors. Suppress CeA during extinction. |
| **Prefrontal Cortex (PFC)** | Top-down extinction controller. Activates ITC when safety is detected. |

### The Learning Rule (Pure Hebbian)

```
ΔW_CS = η · A_CS · A_US
```

When CS and US fire together in the Lateral Amygdala, the connection between them strengthens. That's fear acquisition.

Extinction doesn't erase the memory — the PFC activates ITC cells, which clamp down on CeA output. The original memory stays intact, which is why fear can come back (renewal) if the context changes.

---

## Three Behavioral Phases

| Phase | What Happens | Neural Events |
|-------|--------------|----------------|
| **Habituation** | CS alone, no response | Baseline. No learning. |
| **Acquisition** | CS+US pairings | Hebbian plasticity. W_cs increases. Fear rises. |
| **Extinction** | CS alone again | PFC activates ITC. ITC suppresses CeA. Fear drops — but W_cs is still there. |

---

## How I Built It

**Stack:** React 19, Vite, Recharts, Lucide-React

**Architecture:** Single-page application with real-time state management. Every trial triggers a cascade of activation calculations across all nodes, updates synaptic weights, and re-renders the SVG diagram with animated signal pulses.

### Key State Variables

```javascript
W_cs              // CS→LA synaptic weight (the learning variable)
W_ctx             // context weight (for renewal experiments)
nodeActivations   // firing rates for all 7 nodes
trialHistory      // array tracking W_cs and fear over time
phase             // 'habituation' | 'acquisition' | 'extinction'
```

### The Math I Implemented

**Sigmoid activation function** (realistic neural firing):

```
σ(x) = 1 / (1 + e^(-k(input - θ)))
```

**LA activation** (convergence zone):

```
input_LA = (W_cs · A_cs) + (W_us · A_us) + (W_ctx · A_ctx)
```

**CeA output** (excitation vs. inhibition battle):

```
input_CeA = (W_ba · A_BA) - (W_itc · A_ITC)
```

**Learning during acquisition:**

```
ΔW_cs = η · A_cs · A_us
```

**Learning during extinction:**

```
ΔW_cs = -η_ext · A_cs · A_ITC
```

---

## How to Use the Simulator

### Layout

- **Left panel:** Animated circuit diagram with glowing nodes and edge weights visualized by thickness
- **Center panel:** Trial controls and phase selector
- **Right panel:** Live Recharts plots — synaptic weight over trials, fear output over trials
- **Bottom:** Fear meter gauge + context renewal toggle

### Running Your First Experiment

**Step 1 — Habituation:**
Click `Run 1 Trial` or `Run 10 Trials` while in Habituation phase. The tone plays alone. No fear response. Baseline established.

**Step 2 — Acquisition:**
Switch to Acquisition phase. Run CS+US pairings. Watch the yellow CS→LA connection grow thicker on the diagram. Watch the synaptic weight line climb on the right panel. Watch the fear gauge rise to maximum.

**Step 3 — Extinction:**
Switch to Extinction phase. Run CS alone trials. Watch the PFC node light up. Watch the purple ITC node activate. Watch the fear gauge drop — but the weight line on the chart barely moves. That's the neuroscience: inhibition, not erasure.

**Step 4 — Context Renewal (The Magic Trick):**
Run extinction until the fear gauge reads 0%. Then toggle the **Context Renewal Switch** (simulates moving the subject to a novel chamber). Fear instantly spikes back up. This proves the original memory was never deleted — just gated by PFC/ITC.

### Advanced Controls

Open the Advanced Panel to tweak:
- **η (learning rate):** How fast synapses strengthen
- **W_ctx:** How much context modulates the circuit
- **W_itc:** GABAergic inhibitory strength

Watch for non-linear breakpoints where the circuit becomes unstable.

---

## Project Structure

```
├── src/
│   ├── App.jsx        # Main simulation engine and UI
│   ├── index.css      # All styling, animations, glassmorphism
│   └── main.jsx       # Entry point
├── public/            # Static assets
├── index.html         # HTML template
└── package.json       # Dependencies
```

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YourUsername/fear-conditioning-circuit.git

# Enter directory
cd fear-conditioning-circuit

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open `http://localhost:5173` and start running experiments.

---

## What I Learned Building This

1. **Hebbian plasticity is beautiful in code.** The simplicity of `ΔW = η · pre · post` produces rich emergent behavior.
2. **Extinction is not unlearning.** Implementing it as active PFC→ITC inhibition rather than weight decay made the renewal effect possible. The context toggle snapping fear back up was incredibly satisfying to watch work.
3. **Real-time SVG visualization forces performance thinking.** Updating edge thickness and node glows on every trial without lag required careful state batching.
4. **Neuroscience makes for great interactive demos.** Seeing a purple node (ITC) clamp down on a red node (CeA) teaches the material better than any textbook diagram.

---

## References

- LeDoux, J.E. (1996). *The Emotional Brain.* Simon & Schuster.
- Phelps, E.A., Delgado, M.R., Nearing, K.I., & LeDoux, J.E. (2004). Extinction learning in humans: role of the amygdala and vmPFC. *Neuron*, 43(6), 897-905.
- Pape, H.C. & Pare, D. (2010). Plastic synaptic networks of the amygdala. *Physiological Reviews*, 90(2), 419-463.

---
