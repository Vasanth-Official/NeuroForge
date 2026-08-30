import { useEffect, useRef } from 'react';
import type { NeuralSystemState } from '../simulation';

interface NeuralVisualizationProps {
  systemState: NeuralSystemState;
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

export function NeuralVisualization({ systemState }: NeuralVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    // Fixed anatomical nodes layout on canvas space (800x320 grid)
    const nodes: NeuronNode[] = [
      {
        x: 120, y: 160, radius: 18, label: 'SOMA α1',
        dendrites: [
          { angle: -Math.PI / 4, length: 45, branches: [{ angle: -0.3, length: 20 }, { angle: 0.3, length: 22 }] },
          { angle: -3 * Math.PI / 4, length: 50, branches: [{ angle: -0.4, length: 25 }] },
          { angle: Math.PI * 0.8, length: 40, branches: [{ angle: 0.2, length: 18 }] },
        ],
      },
      {
        x: 320, y: 90, radius: 15, label: 'SOMA β1',
        dendrites: [
          { angle: -Math.PI / 2, length: 40, branches: [{ angle: -0.3, length: 18 }] },
          { angle: Math.PI / 6, length: 35, branches: [{ angle: 0.4, length: 20 }] },
        ],
      },
      {
        x: 340, y: 230, radius: 16, label: 'SOMA β2',
        dendrites: [
          { angle: Math.PI / 3, length: 42, branches: [{ angle: -0.2, length: 22 }] },
          { angle: Math.PI * 0.9, length: 38, branches: [{ angle: 0.3, length: 15 }] },
        ],
      },
      {
        x: 540, y: 140, radius: 17, label: 'INTERNEURON γ',
        dendrites: [
          { angle: -Math.PI / 3, length: 45, branches: [{ angle: 0.3, length: 25 }] },
          { angle: Math.PI / 4, length: 40, branches: [{ angle: -0.2, length: 18 }] },
        ],
      },
      {
        x: 700, y: 170, radius: 19, label: 'TARGET SOMA',
        dendrites: [
          { angle: -Math.PI / 6, length: 50, branches: [{ angle: 0.2, length: 22 }] },
          { angle: Math.PI / 2, length: 45, branches: [{ angle: -0.3, length: 20 }] },
          { angle: Math.PI, length: 38, branches: [{ angle: 0.4, length: 18 }] },
        ],
      },
    ];

    // Synaptic axon pathways connecting somas
    const axons: AxonPathway[] = [
      { from: 0, to: 1, cp1x: 180, cp1y: 80, cp2x: 260, cp2y: 70, pulses: [{ progress: 0.1, speed: 0.008, intensity: 1 }] },
      { from: 0, to: 2, cp1x: 190, cp1y: 240, cp2x: 270, cp2y: 250, pulses: [{ progress: 0.5, speed: 0.009, intensity: 0.8 }] },
      { from: 1, to: 3, cp1x: 410, cp1y: 80, cp2x: 470, cp2y: 110, pulses: [{ progress: 0.3, speed: 0.01, intensity: 1 }] },
      { from: 2, to: 3, cp1x: 420, cp1y: 220, cp2x: 480, cp2y: 180, pulses: [{ progress: 0.7, speed: 0.007, intensity: 0.9 }] },
      { from: 3, to: 4, cp1x: 600, cp1y: 130, cp2x: 640, cp2y: 150, pulses: [{ progress: 0.4, speed: 0.012, intensity: 1 }] },
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
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 40; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const spikeRateFactor = Math.max(0.3, systemState.spikeRate / 50);
      const synchronyFactor = Math.max(0.2, systemState.synchrony / 100);
      const fatigueFactor = systemState.fatigue / 100;
      const isUnstable = systemState.stability < 35;

      // 1. Draw Axon Pathways & Synaptic Boutons
      axons.forEach((axon) => {
        const n1 = nodes[axon.from];
        const n2 = nodes[axon.to];

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.bezierCurveTo(axon.cp1x, axon.cp1y, axon.cp2x, axon.cp2y, n2.x, n2.y);
        
        // Axon line style (Ink-drawn look with stability jitter)
        ctx.strokeStyle = isUnstable ? '#b91c1c' : '#44403c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Myelin sheath nodes along axon
        [0.25, 0.5, 0.75].forEach((t) => {
          const mx = getBezierPoint(n1.x, axon.cp1x, axon.cp2x, n2.x, t);
          const my = getBezierPoint(n1.y, axon.cp1y, axon.cp2y, n2.y, t);

          ctx.fillStyle = '#f5f2eb';
          ctx.strokeStyle = '#292524';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Synaptic Bouton at connection terminal
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(n2.x - 8, n2.y - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // 2. Animate Travelling Action Potential Pulses along Axons (Blue = Neural Activity)
        axon.pulses.forEach((pulse) => {
          pulse.progress += pulse.speed * spikeRateFactor;
          if (pulse.progress > 1) pulse.progress = 0;

          const px = getBezierPoint(n1.x, axon.cp1x, axon.cp2x, n2.x, pulse.progress);
          const py = getBezierPoint(n1.y, axon.cp1y, axon.cp2y, n2.y, pulse.progress);

          // Pulse halo
          const glowRadius = 8 + synchronyFactor * 6;
          const grad = ctx.createRadialGradient(px, py, 1, px, py, glowRadius);
          grad.addColorStop(0, fatigueFactor > 0.6 ? 'rgba(194, 65, 12, 0.8)' : 'rgba(29, 78, 216, 0.9)');
          grad.addColorStop(1, 'rgba(29, 78, 216, 0)');
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // Core pulse dot
          ctx.fillStyle = fatigueFactor > 0.6 ? '#c2410c' : '#1d4ed8';
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // 3. Draw Neurons (Soma & Dendrites)
      nodes.forEach((node) => {
        // Dendritic arborizations
        node.dendrites.forEach((d) => {
          const dx = node.x + Math.cos(d.angle) * d.length;
          const dy = node.y + Math.sin(d.angle) * d.length;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(dx, dy);
          ctx.strokeStyle = '#57534e';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Dendritic sub-branches
          d.branches.forEach((b) => {
            const bx = dx + Math.cos(d.angle + b.angle) * b.length;
            const by = dy + Math.sin(d.angle + b.angle) * b.length;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = '#8a8378';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Spine knobs
            ctx.fillStyle = '#15803d'; // Green = stable synaptic spine
            ctx.beginPath();
            ctx.arc(bx, by, 2, 0, Math.PI * 2);
            ctx.fill();
          });
        });

        // Soma (Cell body)
        ctx.fillStyle = '#fcfaf4';
        ctx.strokeStyle = isUnstable ? '#b91c1c' : '#1c1917';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nucleus
        ctx.fillStyle = isUnstable ? 'rgba(185, 28, 28, 0.4)' : 'rgba(29, 78, 216, 0.3)';
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Node Label Annotation
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#57534e';
        ctx.fillText(node.label, node.x - 24, node.y + node.radius + 14);
      });

      // 4. Scientific Diagram Annotations & Leader Lines
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#8a8378';

      // Leader line for Soma
      ctx.beginPath();
      ctx.moveTo(120, 140);
      ctx.lineTo(90, 80);
      ctx.lineTo(30, 80);
      ctx.strokeStyle = '#8a8378';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillText('[A] SOMA (PYRAMIDAL CELL)', 30, 74);

      // Leader line for Axon Hillock
      ctx.beginPath();
      ctx.moveTo(470, 110);
      ctx.lineTo(490, 50);
      ctx.lineTo(540, 50);
      ctx.stroke();
      ctx.fillText('[B] ACTION POTENTIAL WAVE', 544, 53);

      // Leader line for Synapse
      ctx.beginPath();
      ctx.moveTo(692, 166);
      ctx.lineTo(720, 100);
      ctx.lineTo(760, 100);
      ctx.stroke();
      ctx.fillText('[C] SYNAPTIC TERMINAL', 680, 94);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [systemState]);

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={820}
        height={300}
        style={{
          width: '100%',
          height: '300px',
          display: 'block',
          backgroundColor: '#fcfaf4',
        }}
      />
      {/* Visual Legend Bar */}
      <div style={{
        display: 'flex',
        gap: '16px',
        padding: '8px 12px',
        borderTop: '1px solid #292524',
        backgroundColor: '#f7f4ed',
        fontSize: '0.7rem',
        fontFamily: 'var(--font-mono)',
        color: '#57534e',
        flexWrap: 'wrap'
      }}>
        <div><span style={{ color: '#1d4ed8', fontWeight: 'bold' }}>●</span> BLUE = Neural Activity / Pulses</div>
        <div><span style={{ color: '#15803d', fontWeight: 'bold' }}>●</span> GREEN = Synaptic Spines (Learning)</div>
        <div><span style={{ color: '#c2410c', fontWeight: 'bold' }}>●</span> ORANGE = Metabolic Fatigue</div>
        <div><span style={{ color: '#b91c1c', fontWeight: 'bold' }}>●</span> RED = Instability Warning</div>
      </div>
    </div>
  );
}
