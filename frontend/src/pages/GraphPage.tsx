import { useEffect, useRef, useState, useCallback } from 'react';
import { T } from '../theme';
import { getStatus } from '../theme';
import { PageNav } from '../components/PageNav';
import { formatTokens } from '../utils/format';
import type { DashboardState, Agent } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeRole = 'orchestrator' | 'sub-orchestrator' | 'specialist';

interface GraphNode {
  id: string;
  label: string;
  initials: string;
  role: NodeRole;
  agent: Agent | null;
  x: number;
  y: number;
  radius: number;
  tokenRatio: number; // 0-1, relative to max
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

function getInitials(name: string): string {
  if (name === 'team-lead') return 'TL';
  if (name === 'seo-manager') return 'SM';
  if (name.startsWith('seo-')) return name.replace('seo-', '').slice(0, 3).toUpperCase();
  const parts = name.split('-');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Layout ──────────────────────────────────────────────────────────────────

function buildGraph(state: DashboardState, width: number, height: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const allAgents = [state.teamLead, ...Object.values(state.specialists)];
  const maxTokens = Math.max(1, ...allAgents.map(a => a.allTimeTokens || a.tokensUsed || 0));

  const cx = width / 2;
  const tierGap = Math.min(180, height * 0.28);
  const topY = Math.max(70, height * 0.12);

  const tokenRatio = (a: Agent) => (a.allTimeTokens || a.tokensUsed || 0) / maxTokens;

  // Team lead
  nodes.push({
    id: 'team-lead', label: 'team-lead', initials: 'TL',
    role: 'orchestrator', agent: state.teamLead,
    x: cx, y: topY, radius: 34, tokenRatio: tokenRatio(state.teamLead),
  });

  const allSpecs = Object.values(state.specialists);
  const seoManager = allSpecs.find(a => a.name === 'seo-manager') || null;
  const seoAgents = allSpecs.filter(a => SEO_SPECIALISTS.includes(a.name));
  const directReports = allSpecs.filter(a => a.name !== 'seo-manager' && !SEO_SPECIALISTS.includes(a.name));

  // Direct reports + seo-manager in tier 2
  const directY = topY + tierGap;
  const tier2 = [...directReports];
  if (seoManager) tier2.push(seoManager);
  const padding = 60;
  const availableWidth = width - padding * 2;
  const tier2Spread = Math.min(availableWidth, tier2.length * 120);
  const tier2StartX = cx - tier2Spread / 2;

  tier2.forEach((agent, i) => {
    const x = tier2.length === 1 ? cx : tier2StartX + (i / (tier2.length - 1)) * tier2Spread;
    const isSeoMgr = agent.name === 'seo-manager';
    nodes.push({
      id: agent.name, label: agent.name, initials: getInitials(agent.name),
      role: isSeoMgr ? 'sub-orchestrator' : 'specialist', agent,
      x, y: directY, radius: isSeoMgr ? 28 : 22, tokenRatio: tokenRatio(agent),
    });
    edges.push({ from: 'team-lead', to: agent.name, active: agent.status === 'running' });
  });

  // SEO specialists in tier 3
  if (seoManager && seoAgents.length > 0) {
    const seoMgrNode = nodes.find(n => n.id === 'seo-manager')!;
    const seoY = directY + tierGap * 0.85;
    const seoSpread = Math.min(availableWidth, seoAgents.length * 105);
    const seoCenterX = Math.max(padding + seoSpread / 2, Math.min(width - padding - seoSpread / 2, seoMgrNode.x));
    const seoStartX = seoCenterX - seoSpread / 2;

    seoAgents.forEach((agent, i) => {
      const x = seoAgents.length === 1 ? seoCenterX : seoStartX + (i / (seoAgents.length - 1)) * seoSpread;
      nodes.push({
        id: agent.name, label: agent.name.replace('seo-', ''), initials: getInitials(agent.name),
        role: 'specialist', agent, x, y: seoY, radius: 18, tokenRatio: tokenRatio(agent),
      });
      edges.push({ from: 'seo-manager', to: agent.name, active: agent.status === 'running' });
    });
  }

  return { nodes, edges };
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = r * 1.8;
  const h = r * 1.4;
  const cr = 8;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x - w / 2, y - h / 2, w, h, cr);
  } else {
    const left = x - w / 2, top = y - h / 2;
    ctx.moveTo(left + cr, top);
    ctx.lineTo(left + w - cr, top);
    ctx.quadraticCurveTo(left + w, top, left + w, top + cr);
    ctx.lineTo(left + w, top + h - cr);
    ctx.quadraticCurveTo(left + w, top + h, left + w - cr, top + h);
    ctx.lineTo(left + cr, top + h);
    ctx.quadraticCurveTo(left, top + h, left, top + h - cr);
    ctx.lineTo(left, top + cr);
    ctx.quadraticCurveTo(left, top, left + cr, top);
    ctx.closePath();
  }
}

function drawNodeShape(ctx: CanvasRenderingContext2D, node: GraphNode) {
  if (node.role === 'orchestrator') drawHexagon(ctx, node.x, node.y, node.radius);
  else if (node.role === 'sub-orchestrator') drawRoundedRect(ctx, node.x, node.y, node.radius);
  else { ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); }
}

// ─── Main renderer ───────────────────────────────────────────────────────────

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

  // Subtle radial background glow
  const bgGrad = ctx.createRadialGradient(width / 2, height * 0.3, 0, width / 2, height * 0.3, width * 0.6);
  bgGrad.addColorStop(0, 'rgba(134,59,255,0.03)');
  bgGrad.addColorStop(0.5, 'rgba(34,211,238,0.015)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Dot grid (not lines — softer)
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  const gridSize = 32;
  for (let x = gridSize; x < width; x += gridSize) {
    for (let y = gridSize; y < height; y += gridSize) {
      ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Tier labels
  const tiers = new Map<number, string>();
  nodes.forEach(n => {
    if (n.role === 'orchestrator') tiers.set(n.y, 'ORCHESTRATOR');
    else if (n.role === 'sub-orchestrator') {
      if (!tiers.has(n.y)) tiers.set(n.y, 'SPECIALISTS');
    }
    else if (n.id.startsWith('seo-') && n.role === 'specialist') {
      tiers.set(n.y, 'SEO TEAM');
    }
  });
  // Add specialist tier
  const specNodes = nodes.filter(n => n.role === 'specialist' && !n.id.startsWith('seo-'));
  if (specNodes.length > 0) tiers.set(specNodes[0].y, 'SPECIALISTS');

  tiers.forEach((label, y) => {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = `700 9px ${T.sans}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px';
    ctx.fillText(label, 16, y);
    ctx.restore();
  });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // ─── Edges ─────────────────────────────────────────────────────────────────
  edges.forEach(edge => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;

    const fromR = from.role === 'sub-orchestrator' ? from.radius * 0.9 : from.radius;
    const toR = to.role === 'sub-orchestrator' ? to.radius * 0.9 : to.radius;
    const x1 = from.x + nx * fromR;
    const y1 = from.y + ny * fromR;
    const x2 = to.x - nx * toR;
    const y2 = to.y - ny * toR;

    // Gentle curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const perpX = -(y2 - y1) * 0.06;
    const perpY = (x2 - x1) * 0.06;
    const cpX = midX + perpX;
    const cpY = midY + perpY;

    if (edge.active) {
      // Wide glow
      ctx.strokeStyle = T.green + '18';
      ctx.lineWidth = 10;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpX, cpY, x2, y2); ctx.stroke();

      // Core glow
      ctx.strokeStyle = T.green + '40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpX, cpY, x2, y2); ctx.stroke();

      // Dashed line
      ctx.strokeStyle = T.green;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -time * 0.05;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpX, cpY, x2, y2); ctx.stroke();

      // Travelling dot (2 dots for longer edges)
      ctx.setLineDash([]);
      const dotCount = dist > 200 ? 2 : 1;
      for (let d = 0; d < dotCount; d++) {
        const t = ((time * 0.012 + d * 0.5) % 1);
        const dotX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
        const dotY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;
        ctx.fillStyle = T.green;
        ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = T.green + '30';
        ctx.beginPath(); ctx.arc(dotX, dotY, 8, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 8]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpX, cpY, x2, y2); ctx.stroke();
    }
  });

  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // ─── Nodes ─────────────────────────────────────────────────────────────────
  nodes.forEach(node => {
    const status = node.agent?.status || 'idle';
    const meta = getStatus(status);
    const isHovered = hoveredNode === node.id;
    const isRunning = status === 'running';
    const isError = status === 'error';
    const r = node.radius + (isHovered ? 2 : 0);

    // Outer glow for running/error
    if (isRunning || isError) {
      const pulse = Math.sin(time * 0.04) * 0.3 + 0.7;
      const glowColor = isError ? T.red : T.green;
      const grad = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 24);
      grad.addColorStop(0, glowColor + Math.round(pulse * 30).toString(16).padStart(2, '0'));
      grad.addColorStop(1, glowColor + '00');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(node.x, node.y, r + 24, 0, Math.PI * 2); ctx.fill();
    }

    // Token usage arc (behind node)
    if (node.tokenRatio > 0) {
      const arcR = r + 5;
      const arcAngle = Math.PI * 2 * node.tokenRatio;
      ctx.strokeStyle = T.blue + '50';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(node.x, node.y, arcR, -Math.PI / 2, -Math.PI / 2 + arcAngle);
      ctx.stroke();
      // Arc track
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, arcR, -Math.PI / 2 + arcAngle, -Math.PI / 2 + Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Node fill
    const fillGrad = ctx.createRadialGradient(node.x - r * 0.2, node.y - r * 0.2, 0, node.x, node.y, r);
    if (node.role === 'orchestrator') {
      fillGrad.addColorStop(0, isRunning ? '#2a1850' : '#221838');
      fillGrad.addColorStop(1, '#140e22');
    } else if (node.role === 'sub-orchestrator') {
      fillGrad.addColorStop(0, isRunning ? '#1a2840' : '#1a2232');
      fillGrad.addColorStop(1, '#101820');
    } else {
      fillGrad.addColorStop(0, isHovered ? T.bgOverlay : T.bgSurfaceHi);
      fillGrad.addColorStop(1, T.bgSurface);
    }
    ctx.fillStyle = fillGrad;
    drawNodeShape(ctx, { ...node, radius: r });
    ctx.fill();

    // Node border
    ctx.strokeStyle = isError ? T.red + 'a0' : isRunning ? meta.color + '80' : isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = isRunning || isError ? 2 : 1;
    drawNodeShape(ctx, { ...node, radius: r });
    ctx.stroke();

    // Initials inside node
    ctx.fillStyle = isError ? T.red : isRunning ? meta.color : isHovered ? T.textPrimary : T.textSecond;
    const fontSize = node.role === 'orchestrator' ? 14 : node.role === 'sub-orchestrator' ? 12 : 10;
    ctx.font = `700 ${fontSize}px ${T.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.initials, node.x, node.y);

    // Status pip
    const pipR = node.role === 'orchestrator' ? 5 : 4;
    const pipAngle = node.role === 'orchestrator' ? -Math.PI * 0.08 : -Math.PI * 0.25;
    const pipDist = node.role === 'sub-orchestrator' ? r * 0.85 : r - 1;
    const pipX = node.x + Math.cos(pipAngle) * pipDist;
    const pipY = node.y + Math.sin(pipAngle) * pipDist;
    // Pip background
    ctx.fillStyle = T.bg;
    ctx.beginPath(); ctx.arc(pipX, pipY, pipR + 2, 0, Math.PI * 2); ctx.fill();
    // Pip color
    ctx.fillStyle = meta.color;
    ctx.beginPath(); ctx.arc(pipX, pipY, pipR, 0, Math.PI * 2); ctx.fill();
    if (isRunning) {
      const pipPulse = Math.sin(time * 0.06) * 0.4 + 0.6;
      ctx.fillStyle = meta.color + Math.round(pipPulse * 60).toString(16).padStart(2, '0');
      ctx.beginPath(); ctx.arc(pipX, pipY, pipR + 4, 0, Math.PI * 2); ctx.fill();
    }

    // Label below node
    ctx.fillStyle = isRunning ? meta.color : isHovered ? T.textPrimary : T.textMuted;
    ctx.font = `${node.role === 'orchestrator' ? 600 : 500} ${node.role === 'orchestrator' ? 11 : 10}px ${T.sans}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(node.label, node.x, node.y + r + 10);

    // Token count below label
    const tokens = node.agent?.allTimeTokens || node.agent?.tokensUsed || 0;
    if (tokens > 0) {
      ctx.fillStyle = T.blue + '80';
      ctx.font = `500 8px ${T.mono}`;
      ctx.fillText(formatTokens(tokens), node.x, node.y + r + 24);
    }
  });
}

// ─── Tooltip component ───────────────────────────────────────────────────────

function Tooltip({ node, x, y }: { node: GraphNode; x: number; y: number }) {
  const agent = node.agent;
  if (!agent) return null;
  const meta = getStatus(agent.status);
  const tokens = agent.allTimeTokens || agent.tokensUsed || 0;

  return (
    <div style={{
      position: 'absolute', left: x + 16, top: y - 10,
      backgroundColor: 'rgba(20,22,30,0.95)', border: `1px solid rgba(255,255,255,0.12)`,
      borderRadius: 8, padding: '10px 14px', minWidth: 180, maxWidth: 280,
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', pointerEvents: 'none', zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: meta.color }}>{agent.name}</span>
        <span style={{
          fontFamily: T.mono, fontSize: 9, color: T.textMuted,
          backgroundColor: T.bgOverlay, border: `1px solid ${T.border}`,
          padding: '1px 6px', borderRadius: 3,
        }}>{agent.model}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: meta.color }} />
        <span style={{ fontFamily: T.sans, fontSize: 10, color: meta.color }}>{meta.label}</span>
      </div>
      {agent.currentTask && (
        <p style={{
          margin: '0 0 6px', fontFamily: T.mono, fontSize: 10, color: T.textSecond,
          lineHeight: 1.5, wordBreak: 'break-word',
        }}>
          {agent.currentTask}
        </p>
      )}
      <div style={{ display: 'flex', gap: 16, borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
        <div>
          <span style={{ fontFamily: T.sans, fontSize: 8, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</span>
          <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.textSecond }}>{agent.allTimeTasks || agent.taskCount}</div>
        </div>
        <div>
          <span style={{ fontFamily: T.sans, fontSize: 8, color: T.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tokens</span>
          <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: tokens > 0 ? T.blue : T.textDim }}>
            {tokens > 0 ? formatTokens(tokens) : '\u2014'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DashboardState | null>(null);
  const [connected, setConnected] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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

  // Resize
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
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state, size, hoveredNode]);

  // Hit testing
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    let hit: string | null = null;
    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < (node.radius + 10) ** 2) { hit = node.id; break; }
    }
    setHoveredNode(hit);
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredNode(null), []);

  const hoveredGraphNode = hoveredNode ? nodesRef.current.find(n => n.id === hoveredNode) : null;

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
          <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.textPrimary }}>Workflow</span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>agent topology</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {state && (
            <>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>
                {Object.keys(state.specialists).length + 1} nodes
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: state.globalMetrics.activeAgents > 0 ? T.green : T.textMuted }}>
                {state.globalMetrics.activeAgents} active
              </span>
            </>
          )}
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: connected ? T.green : T.red,
            boxShadow: connected ? `0 0 6px ${T.green}` : `0 0 6px ${T.red}`,
          }} />
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '0 18px', height: 32, backgroundColor: T.bgSurface,
        borderBottom: `1px solid ${T.border}`,
      }}>
        {/* Shape legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 11,3.5 11,8.5 6,11 1,8.5 1,3.5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" /></svg>
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>Orchestrator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0.5" y="0.5" width="13" height="9" rx="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" /></svg>
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>Sub-orchestrator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" /></svg>
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>Specialist</span>
        </div>

        <span style={{ width: 1, height: 14, backgroundColor: T.border }} />

        {/* Status legend */}
        {[
          { color: T.green, label: 'Running' },
          { color: T.blue, label: 'Done' },
          { color: T.amber, label: 'Waiting' },
          { color: T.red, label: 'Error' },
          { color: T.slate, label: 'Idle' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: item.color }} />
            <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>{item.label}</span>
          </div>
        ))}

        <span style={{ width: 1, height: 14, backgroundColor: T.border }} />

        {/* Arc legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
            <path d="M 6 1 A 5 5 0 0 1 11 6" fill="none" stroke={T.blue + '60'} strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: T.sans, fontSize: 9, color: T.textMuted }}>Token usage</span>
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
          <>
            <canvas
              ref={canvasRef}
              style={{ display: 'block', cursor: hoveredNode ? 'pointer' : 'default' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
            {hoveredGraphNode && (
              <Tooltip node={hoveredGraphNode} x={mousePos.x} y={mousePos.y} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
