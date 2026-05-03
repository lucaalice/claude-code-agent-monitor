import { useEffect, useRef, useState, useCallback } from 'react';
import { T } from '../theme';
import { getStatus } from '../theme';
import { PageNav } from '../components/PageNav';
import type { DashboardState, Agent } from '../types/api';

// ─── Node layout ─────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  role: 'orchestrator' | 'sub-orchestrator' | 'specialist';
  agent: Agent | null;
  x: number;
  y: number;
  radius: number;
}

interface GraphEdge {
  from: string;
  to: string;
  active: boolean;
}

const SEO_SPECIALISTS = [
  'seo-technical', 'seo-content', 'seo-schema',
  'seo-sitemap', 'seo-geo', 'seo-performance', 'seo-visual',
];

function buildGraph(state: DashboardState, width: number, _height: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const cx = width / 2;
  const topY = 80;

  // Team lead — top center
  nodes.push({
    id: 'team-lead',
    label: 'team-lead',
    role: 'orchestrator',
    agent: state.teamLead,
    x: cx,
    y: topY,
    radius: 28,
  });

  // Separate specialists from seo-manager and seo team
  const allSpecs = Object.values(state.specialists);
  const seoManager = allSpecs.find(a => a.name === 'seo-manager') || null;
  const seoAgents = allSpecs.filter(a => SEO_SPECIALISTS.includes(a.name));
  const directReports = allSpecs.filter(a => a.name !== 'seo-manager' && !SEO_SPECIALISTS.includes(a.name));

  // Direct reports — arc below team-lead
  const directY = topY + 160;
  const seoManagerSlot = seoManager ? 1 : 0;
  const totalDirect = directReports.length + seoManagerSlot;
  const directSpread = Math.min(width - 120, totalDirect * 110);
  const directStartX = cx - directSpread / 2;

  directReports.forEach((agent, i) => {
    const x = totalDirect === 1 ? cx : directStartX + (i / (totalDirect - 1)) * directSpread;
    nodes.push({
      id: agent.name,
      label: agent.name,
      role: 'specialist',
      agent,
      x,
      y: directY,
      radius: 18,
    });
    edges.push({
      from: 'team-lead',
      to: agent.name,
      active: agent.status === 'running',
    });
  });

  // SEO manager — rightmost slot in the direct row
  if (seoManager) {
    const seoMgrX = totalDirect === 1 ? cx : directStartX + ((totalDirect - 1) / (totalDirect - 1)) * directSpread;
    nodes.push({
      id: 'seo-manager',
      label: 'seo-manager',
      role: 'sub-orchestrator',
      agent: seoManager,
      x: seoMgrX,
      y: directY,
      radius: 22,
    });
    edges.push({
      from: 'team-lead',
      to: 'seo-manager',
      active: seoManager.status === 'running',
    });

    // SEO specialists — arc below seo-manager
    const seoY = directY + 140;
    const seoSpread = Math.min(width - 80, seoAgents.length * 100);
    const seoStartX = seoMgrX - seoSpread / 2;

    seoAgents.forEach((agent, i) => {
      const x = seoAgents.length === 1 ? seoMgrX : seoStartX + (i / (seoAgents.length - 1)) * seoSpread;
      nodes.push({
        id: agent.name,
        label: agent.name.replace('seo-', ''),
        role: 'specialist',
        agent,
        x,
        y: seoY,
        radius: 16,
      });
      edges.push({
        from: 'seo-manager',
        to: agent.name,
        active: agent.status === 'running',
      });
    });
  }

  return { nodes, edges };
}

// ─── Canvas renderer ─────────────────────────────────────────────────────────

function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  time: number,
  hoveredNode: string | null,
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // Background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Draw edges
  edges.forEach(edge => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    // Start/end at node borders
    const x1 = from.x + nx * from.radius;
    const y1 = from.y + ny * from.radius;
    const x2 = to.x - nx * to.radius;
    const y2 = to.y - ny * to.radius;

    // Curved path via control point
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const perpX = -(y2 - y1) * 0.08;
    const perpY = (x2 - x1) * 0.08;
    const cpX = midX + perpX;
    const cpY = midY + perpY;

    if (edge.active) {
      // Glow layer
      ctx.strokeStyle = T.green + '30';
      ctx.lineWidth = 6;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.stroke();

      // Active line with flowing dashes
      ctx.strokeStyle = T.green;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 0.06;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.stroke();

      // Travelling dot
      const t = ((time * 0.015) % 1);
      const dotX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
      const dotY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;
      ctx.setLineDash([]);
      ctx.fillStyle = T.green;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Dot glow
      ctx.fillStyle = T.green + '40';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Inactive line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpX, cpY, x2, y2);
      ctx.stroke();
    }
  });

  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Draw nodes
  nodes.forEach(node => {
    const status = node.agent?.status || 'idle';
    const meta = getStatus(status);
    const isHovered = hoveredNode === node.id;
    const isRunning = status === 'running';
    const r = node.radius + (isHovered ? 3 : 0);

    // Outer glow for running
    if (isRunning) {
      const pulse = Math.sin(time * 0.04) * 0.3 + 0.7;
      const grad = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 18);
      grad.addColorStop(0, meta.color + Math.round(pulse * 40).toString(16).padStart(2, '0'));
      grad.addColorStop(1, meta.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node fill
    const fillGrad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r);
    if (node.role === 'orchestrator') {
      fillGrad.addColorStop(0, '#2a2040');
      fillGrad.addColorStop(1, '#181020');
    } else if (node.role === 'sub-orchestrator') {
      fillGrad.addColorStop(0, '#1e2838');
      fillGrad.addColorStop(1, '#141c28');
    } else {
      fillGrad.addColorStop(0, T.bgSurfaceHi);
      fillGrad.addColorStop(1, T.bgSurface);
    }
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Node border
    ctx.strokeStyle = isRunning ? meta.color : isHovered ? T.textMuted : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = isRunning ? 2 : 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Status pip
    const pipR = node.role === 'orchestrator' ? 5 : 4;
    const pipAngle = -Math.PI * 0.25;
    const pipX = node.x + Math.cos(pipAngle) * (r - 2);
    const pipY = node.y + Math.sin(pipAngle) * (r - 2);
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(pipX, pipY, pipR, 0, Math.PI * 2);
    ctx.fill();
    if (isRunning) {
      ctx.fillStyle = meta.color + '50';
      ctx.beginPath();
      ctx.arc(pipX, pipY, pipR + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = isRunning ? meta.color : isHovered ? T.textPrimary : T.textSecond;
    ctx.font = `${node.role === 'orchestrator' ? 600 : 500} ${node.role === 'orchestrator' ? 11 : node.role === 'sub-orchestrator' ? 10 : 9}px ${T.sans}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, node.x, node.y + r + 8);

    // Task label for running agents
    if (isRunning && node.agent?.currentTask) {
      const task = node.agent.currentTask.length > 40
        ? node.agent.currentTask.slice(0, 37) + '...'
        : node.agent.currentTask;
      ctx.fillStyle = T.textMuted;
      ctx.font = `400 8px ${T.sans}`;
      ctx.fillText(task, node.x, node.y + r + 22);
    }
  });
}

// ─── Graph page component ────────────────────────────────────────────────────

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DashboardState | null>(null);
  const [connected, setConnected] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state_update') setState(msg.payload);
      } catch {}
    };
    return () => ws.close();
  }, []);

  // Resize observer
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build graph when state or size changes
  useEffect(() => {
    if (!state || !size.w) return;
    const { nodes } = buildGraph(state, size.w, size.h);
    nodesRef.current = nodes;
  }, [state, size]);

  // Animation loop
  useEffect(() => {
    if (!state || !size.w) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    let running = true;
    const loop = () => {
      if (!running) return;
      frameRef.current++;
      const { nodes, edges } = buildGraph(state, size.w, size.h);
      nodesRef.current = nodes;
      drawGraph(ctx, nodes, edges, size.w, size.h, frameRef.current, hoveredNode);
      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [state, size, hoveredNode]);

  // Hit testing for hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hit: string | null = null;
    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < (node.radius + 8) ** 2) {
        hit = node.id;
        break;
      }
    }
    setHoveredNode(hit);
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredNode(null), []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.bg, fontFamily: T.sans, color: T.textPrimary, display: 'flex', flexDirection: 'column' }}>
      <PageNav />

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 36, backgroundColor: T.bgSurface,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Connection Graph</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>live topology</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: connected ? T.green : T.red,
            boxShadow: connected ? `0 0 6px ${T.green}` : `0 0 6px ${T.red}`,
          }} />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: connected ? T.green : T.red }}>
            {connected ? 'ws://localhost:3001' : 'disconnected'}
          </span>
          {state && (
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, marginLeft: 8 }}>
              {Object.keys(state.specialists).length + 1} nodes
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 18px', height: 30, backgroundColor: T.bgSurface,
        borderBottom: `1px solid ${T.border}`,
      }}>
        {[
          { color: T.green, label: 'Running' },
          { color: T.blue, label: 'Completed' },
          { color: T.amber, label: 'Waiting' },
          { color: T.red, label: 'Error' },
          { color: T.slate, label: 'Idle' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.color }} />
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>{item.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8 }}>
          <span style={{ width: 20, height: 2, background: `repeating-linear-gradient(90deg, ${T.green} 0, ${T.green} 8px, transparent 8px, transparent 14px)` }} />
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>Active delegation</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 1, background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 4px, transparent 4px, transparent 12px)` }} />
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>Inactive</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!state ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              width: 24, height: 24, border: `2px solid ${T.textMuted}`, borderTopColor: T.green,
              borderRadius: '50%', animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted }}>
              {connected ? 'Waiting for state...' : 'Connecting to ws://localhost:3001...'}
            </span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ display: 'block', cursor: hoveredNode ? 'pointer' : 'default' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      {/* Footer */}
      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 28, backgroundColor: T.bgSurface,
        borderTop: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>canvas @ 60fps</span>
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim }}>
          {state ? `${state.globalMetrics.activeAgents} active` : '---'}
        </span>
      </footer>
    </div>
  );
}
