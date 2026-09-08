import { useEffect, useRef } from 'react';
import type { NeuralSystemState } from '../simulation';

interface NeuralVisualizationProps {
  systemState: NeuralSystemState;
  isRunning?: boolean;
}

interface NeuronNode {
  x: number;
  y: number;
  radius: number;
  label: string;
  dendrites: Array<{ angle: number; length: number; branches: Array<{ angle: number; length: number }> }>;
}

interface AxonPathway {
  from: number;
  to: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  pulses: Array<{ progress: number; speed: number; intensity: number }>;
}

export function NeuralVisualization({ systemState, isRunning = false }: NeuralVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    // Fixed anatomical nodes layout on canvas space (900x360 grid)
    const nodes: NeuronNode[] = [
      {
        x: 120, y: 180, radius: 22, label: 'SOMA α1',
        dendrites: [
          { angle: -Math.PI / 4, length: 52, branches: [{ angle: -0.3, length: 24 }, { angle: 0.3, length: 26 }] },
          { angle: -3 * Math.PI / 4, length: 58, branches: [{ angle: -0.4, length: 28 }] },
          { angle: Math.PI * 0.8, length: 46, branches: [{ angle: 0.2, length: 20 }] },
        ],
      },
      {
        x: 340, y: 100, radius: 18, label: 'SOMA β1',
        dendrites: [
          { angle: -Math.PI / 2, length: 46, branches: [{ angle: -0.3, length: 20 }] },
          { angle: Math.PI / 6, length: 40, branches: [{ angle: 0.4, length: 22 }] },
        ],
      },
      {
        x: 360, y: 260, radius: 19, label: 'SOMA β2',
        dendrites: [
          { angle: Math.PI / 3, length: 48, branches: [{ angle: -0.2, length: 24 }] },
          { angle: Math.PI * 0.9, length: 44, branches: [{ angle: 0.3, length: 18 }] },
        ],
      },
      {
        x: 580, y: 160, radius: 20, label: 'INTERNEURON γ',
        dendrites: [
          { angle: -Math.PI / 3, length: 50, branches: [{ angle: 0.3, length: 28 }] },
          { angle: Math.PI / 4, length: 44, branches: [{ angle: -0.2, length: 20 }] },
        ],
      },
      {
        x: 780, y: 190, radius: 23, label: 'TARGET SOMA',
        dendrites: [
          { angle: -Math.PI / 6, length: 56, branches: [{ angle: 0.2, length: 25 }] },
          { angle: Math.PI / 2, length: 50, branches: [{ angle: -0.3, length: 22 }] },
          { angle: Math.PI, length: 44, branches: [{ angle: 0.4, length: 20 }] },
        ],
      },
    ];

    // Synaptic axon pathways connecting somas
    const axons: AxonPathway[] = [
      { from: 0, to: 1, cp1x: 200, cp1y: 90, cp2x: 280, cp2y: 80, pulses: [{ progress: 0.1, speed: 0.008, intensity: 1 }] },
      { from: 0, to: 2, cp1x: 210, cp1y: 270, cp2x: 290, cp2y: 280, pulses: [{ progress: 0.5, speed: 0.009, intensity: 0.8 }] },
      { from: 1, to: 3, cp1x: 440, cp1y: 90, cp2x: 510, cp2y: 120, pulses: [{ progress: 0.3, speed: 0.01, intensity: 1 }] },
      { from: 2, to: 3, cp1x: 460, cp1y: 250, cp2x: 520, cp2y: 210, pulses: [{ progress: 0.7, speed: 0.007, intensity: 0.9 }] },
      { from: 3, to: 4, cp1x: 650, cp1y: 148, cp2x: 710, cp2y: 168, pulses: [{ progress: 0.4, speed: 0.012, intensity: 1 }] },
    ];

    // Helper bezier calculation
    const getBezierPoint = (p0: number, p1: number, p2: number, p3: number, t: number) => {
      const u = 1 - t;
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    };

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Paper grid lines inside canvas
      ctx.strokeStyle = '#eae4d5';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let x = 40; x < width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 40; y < height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      ctx.setLineDash([]);

      const spikeRateFactor = Math.max(0.3, systemState.spikeRate / 50) * (isRunning ? 1.35 : 1);
      const synchronyFactor = Math.max(0.2, systemState.synchrony / 100);
      const fatigueFactor   = systemState.fatigue / 100;
      const learningFactor  = systemState.learningScore / 100;
      const retentionFactor = systemState.retention / 100;
      const isUnstable      = systemState.stability < 35;

      // 1. Draw Axon Pathways & Synaptic Boutons
      axons.forEach((axon) => {
        const n1 = nodes[axon.from];
        const n2 = nodes[axon.to];

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.bezierCurveTo(axon.cp1x, axon.cp1y, axon.cp2x, axon.cp2y, n2.x, n2.y);
        ctx.strokeStyle = isUnstable ? '#b91c1c' : '#44403c';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Myelin sheath nodes along axon
        [0.25, 0.5, 0.75].forEach((t) => {
          const mx = getBezierPoint(n1.x, axon.cp1x, axon.cp2x, n2.x, t);
          const my = getBezierPoint(n1.y, axon.cp1y, axon.cp2y, n2.y, t);
          ctx.fillStyle = '#f5f2eb';
          ctx.strokeStyle = '#292524';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(mx, my, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        });

        // Synaptic Bouton at terminal
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath(); ctx.arc(n2.x - 9, n2.y - 5, 4, 0, Math.PI * 2); ctx.fill();

        // 2. Travelling Action Potential Pulses
        axon.pulses.forEach((pulse) => {
          pulse.progress += pulse.speed * spikeRateFactor;
          if (pulse.progress > 1) pulse.progress = 0;

          const px = getBezierPoint(n1.x, axon.cp1x, axon.cp2x, n2.x, pulse.progress);
          const py = getBezierPoint(n1.y, axon.cp1y, axon.cp2y, n2.y, pulse.progress);

          // Pulse halo — colour depends on fatigue
          const glowRadius = 9 + synchronyFactor * 7;
          const grad = ctx.createRadialGradient(px, py, 1, px, py, glowRadius);
          const pulseColor = fatigueFactor > 0.6 ? 'rgba(194,65,12,0.85)' : 'rgba(29,78,216,0.9)';
          grad.addColorStop(0, pulseColor);
          grad.addColorStop(1, 'rgba(29,78,216,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(px, py, glowRadius, 0, Math.PI * 2); ctx.fill();

          // Core dot
          ctx.fillStyle = fatigueFactor > 0.6 ? '#c2410c' : '#1d4ed8';
          ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        });
      });

      // 3. Draw Neurons (Soma & Dendrites)
      nodes.forEach((node, _nodeIdx) => {
        // ── Learning-score glow ring (green, scales with learningFactor)
        if (learningFactor > 0.05) {
          const glowR = node.radius + 8 + learningFactor * 12;
          const learningGlow = ctx.createRadialGradient(node.x, node.y, node.radius - 2, node.x, node.y, glowR);
          learningGlow.addColorStop(0, `rgba(21,128,61,${learningFactor * 0.28})`);
          learningGlow.addColorStop(1, 'rgba(21,128,61,0)');
          ctx.fillStyle = learningGlow;
          ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2); ctx.fill();
        }

        // Dendritic arborizations
        node.dendrites.forEach((d) => {
          const dx = node.x + Math.cos(d.angle) * d.length;
          const dy = node.y + Math.sin(d.angle) * d.length;
          ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(dx, dy);
          ctx.strokeStyle = '#57534e'; ctx.lineWidth = 1.5; ctx.stroke();

          // Sub-branches with spine knobs
          d.branches.forEach((b) => {
            const bx = dx + Math.cos(d.angle + b.angle) * b.length;
            const by = dy + Math.sin(d.angle + b.angle) * b.length;
            ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(bx, by);
            ctx.strokeStyle = '#8a8378'; ctx.lineWidth = 1; ctx.stroke();

            // Spine knob — size scales with retention (memory consolidation indicator)
            const spineSize = 1.8 + retentionFactor * 1.8;
            ctx.fillStyle = '#15803d'; // Green = synaptic spine (learning)
            ctx.beginPath(); ctx.arc(bx, by, spineSize, 0, Math.PI * 2); ctx.fill();
          });
        });

        // Soma (Cell body)
        ctx.fillStyle = '#fcfaf4';
        ctx.strokeStyle = isUnstable ? '#b91c1c' : '#1c1917';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Nucleus
        ctx.fillStyle = isUnstable ? 'rgba(185,28,28,0.4)' : 'rgba(29,78,216,0.3)';
        ctx.strokeStyle = '#1c1917'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(node.x, node.y, node.radius * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Node Label
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#57534e';
        ctx.fillText(node.label, node.x - 26, node.y + node.radius + 16);
      });

      // 4. Scientific Diagram Annotations & Leader Lines
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#8a8378';

      // Leader: Soma
      ctx.beginPath(); ctx.moveTo(120, 158); ctx.lineTo(88, 90); ctx.lineTo(20, 90);
      ctx.strokeStyle = '#8a8378'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillText('[A] SOMA (PYRAMIDAL CELL)', 20, 84);

      // Leader: Action potential
      ctx.beginPath(); ctx.moveTo(510, 128); ctx.lineTo(530, 58); ctx.lineTo(580, 58);
      ctx.stroke();
      ctx.fillText('[B] ACTION POTENTIAL WAVE', 584, 62);

      // Leader: Synapse
      ctx.beginPath(); ctx.moveTo(775, 172); ctx.lineTo(810, 108); ctx.lineTo(838, 108);
      ctx.stroke();
      ctx.fillText('[C] SYNAPTIC TERMINAL', 760, 102);

      // Live state annotation
      const annotY = height - 14;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#8a8378';
      ctx.fillText(
        `SPIKE: ${systemState.spikeRate.toFixed(1)} Hz  |  SYNC: ${systemState.synchrony.toFixed(1)}%  |  STAB: ${systemState.stability.toFixed(1)}`,
        16, annotY
      );

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [systemState, isRunning]);

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={900}
        height={360}
        style={{ width: '100%', height: '360px', display: 'block', backgroundColor: '#fcfaf4' }}
      />
      {/* Visual Legend Bar */}
      <div style={{
        display: 'flex', gap: '16px', padding: '7px 12px',
        borderTop: '1px solid #292524', backgroundColor: '#f7f4ed',
        fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#57534e',
        flexWrap: 'wrap',
      }}>
        <div><span style={{ color: '#1d4ed8', fontWeight: 'bold' }}>●</span> BLUE — Action Potential / Neural Activity</div>
        <div><span style={{ color: '#15803d', fontWeight: 'bold' }}>●</span> GREEN — Synaptic Spines (Learning / Retention)</div>
        <div><span style={{ color: '#c2410c', fontWeight: 'bold' }}>●</span> ORANGE — Metabolic Fatigue Signal</div>
        <div><span style={{ color: '#b91c1c', fontWeight: 'bold' }}>●</span> RED — Instability Warning</div>
      </div>
      <div className="whatami" style={{ padding: '4px 12px 0', display: 'block' }}>
        Watch the blue pulses travel between neurons — each pulse represents a simulated action potential.
      </div>
    </div>
  );
}
