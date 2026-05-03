import { useEffect, useRef } from 'react';

interface Props {
  activeAgents: number;
  height?: number;
}

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  r: number;
  g: number;
  b: number;
  baseAlpha: number;
  phase: number;
}

const BLOB_DEFS: Array<{ r: number; g: number; b: number; alpha: number }> = [
  { r: 134, g: 59,  b: 255, alpha: 0.35 },  // purple (Claude brand)
  { r: 167, g: 139, b: 250, alpha: 0.28 },  // light purple
  { r: 34,  g: 211, b: 238, alpha: 0.22 },  // teal
  { r: 52,  g: 211, b: 153, alpha: 0.20 },  // green
  { r: 96,  g: 165, b: 250, alpha: 0.20 },  // blue
];

export function AuroraGradient({ activeAgents, height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobsRef = useRef<Blob[]>([]);
  const animRef = useRef(0);
  const frameRef = useRef(0);
  const activeRef = useRef(activeAgents);
  activeRef.current = activeAgents;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let w = canvas.parentElement?.clientWidth || 800;

    const resize = () => {
      w = canvas.parentElement?.clientWidth || 800;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
    };
    resize();

    const ro = new ResizeObserver(() => resize());
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Init blobs once
    if (blobsRef.current.length === 0) {
      blobsRef.current = BLOB_DEFS.map((def, i) => ({
        x: (w / (BLOB_DEFS.length + 1)) * (i + 1),
        y: height * 0.3 + Math.random() * height * 0.4,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.2,
        radius: 100 + Math.random() * 80,
        r: def.r,
        g: def.g,
        b: def.b,
        baseAlpha: def.alpha,
        phase: i * 1.3,
      }));
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      frameRef.current++;
      const t = frameRef.current;
      const agents = activeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);

      // Speed + brightness respond to activity
      const speed = 0.6 + Math.min(agents, 8) * 0.15;
      const brightness = agents > 0 ? 1.2 + Math.min(agents, 6) * 0.15 : 0.6;

      blobsRef.current.forEach(blob => {
        blob.x += blob.vx * speed;
        blob.y += blob.vy * speed;
        blob.x += Math.sin(t * 0.007 + blob.phase) * 0.5;
        blob.y += Math.cos(t * 0.005 + blob.phase * 1.5) * 0.3;

        if (blob.x < -blob.radius * 0.3) blob.vx = Math.abs(blob.vx);
        if (blob.x > w + blob.radius * 0.3) blob.vx = -Math.abs(blob.vx);
        if (blob.y < -blob.radius * 0.2) blob.vy = Math.abs(blob.vy);
        if (blob.y > height + blob.radius * 0.2) blob.vy = -Math.abs(blob.vy);

        const pulse = 1 + Math.sin(t * 0.01 + blob.phase) * 0.2;
        const r = blob.radius * pulse;
        const a = blob.baseAlpha * brightness;

        const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, r);
        grad.addColorStop(0, `rgba(${blob.r},${blob.g},${blob.b},${a})`);
        grad.addColorStop(0.5, `rgba(${blob.r},${blob.g},${blob.b},${a * 0.4})`);
        grad.addColorStop(1, `rgba(${blob.r},${blob.g},${blob.b},0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Fade bottom edge to page background
      const fadeGrad = ctx.createLinearGradient(0, height * 0.55, 0, height);
      fadeGrad.addColorStop(0, 'rgba(17,19,24,0)');
      fadeGrad.addColorStop(1, 'rgba(17,19,24,1)');
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(0, height * 0.55, w, height * 0.45);

      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
