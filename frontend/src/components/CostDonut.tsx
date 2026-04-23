import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { T } from '../theme';
import { formatTokens } from '../utils/format';

interface AgentData {
  name: string;
  model: string;
  allTimeTokens: number;
}

interface Props {
  agents: AgentData[];
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  opus:      { input: 15, output: 75 },
  sonnet:    { input: 3, output: 15 },
  haiku:     { input: 0.8, output: 4 },
  inherited: { input: 3, output: 15 },
};

const COLORS = [T.blue, T.green, T.purple, T.amber, T.teal, T.red, '#818cf8', '#fb923c', '#a3e635', '#f472b6', '#38bdf8', T.slate];

function estimateCost(agent: AgentData) {
  const rates = MODEL_PRICING[agent.model] || MODEL_PRICING.sonnet;
  const inputTokens = agent.allTimeTokens * 0.6;
  const outputTokens = agent.allTimeTokens * 0.4;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

export function CostDonut({ agents }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const active = agents.filter(a => a.allTimeTokens > 0).sort((a, b) => b.allTimeTokens - a.allTimeTokens);
  const colorMap: Record<string, string> = {};
  active.forEach((a, i) => { colorMap[a.name] = COLORS[i % COLORS.length]; });

  useEffect(() => {
    if (!svgRef.current) return;

    const data = active.map(a => ({ name: a.name, cost: estimateCost(a), model: a.model })).filter(d => d.cost > 0);
    if (data.length === 0) return;

    const size = 280;
    const radius = size / 2 - 16;
    const innerRadius = radius * 0.52;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${size} ${size}`);

    const g = svg.append('g').attr('transform', `translate(${size / 2}, ${size / 2})`);

    const colors = d3.scaleOrdinal<string>().domain(data.map(d => d.name)).range(data.map(d => colorMap[d.name]));

    const pie = d3.pie<typeof data[0]>().value(d => d.cost).sort(null).padAngle(0.02);
    const arc = d3.arc<d3.PieArcDatum<typeof data[0]>>().innerRadius(innerRadius).outerRadius(radius).cornerRadius(3);

    // Arcs
    g.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('d', arc)
      .attr('fill', d => colors(d.data.name))
      .attr('stroke', T.bgSurface)
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mouseover', (_event: MouseEvent, d: d3.PieArcDatum<typeof data[0]>) => {
        const [cx, cy] = arc.centroid(d);
        const angle = Math.atan2(cy, cx);
        d3.select(_event.currentTarget as SVGPathElement).attr('opacity', 1).attr('transform', `translate(${Math.cos(angle) * 4},${Math.sin(angle) * 4})`);
      })
      .on('mouseout', (_event: MouseEvent) => {
        d3.select(_event.currentTarget as SVGPathElement).attr('opacity', 0.9).attr('transform', '');
      });

    // Center total
    const totalCost = data.reduce((s, d) => s + d.cost, 0);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', T.textPrimary)
      .attr('font-size', 22)
      .attr('font-weight', 700)
      .attr('font-family', T.mono)
      .text(`$${totalCost.toFixed(2)}`);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.4em')
      .attr('fill', T.textSecond)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('font-family', T.sans)
      .text('est. total');

  }, [agents, active, colorMap]);

  return (
    <div style={{ backgroundColor: T.bgSurface, borderRadius: 10, border: `1px solid ${T.borderMed}`, padding: '20px 20px 12px' }}>
      <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
        Cost Distribution
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <svg ref={svgRef} style={{ width: 280, height: 280, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {active.map(a => {
            const cost = estimateCost(a);
            return (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colorMap[a.name], flexShrink: 0 }} />
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textSecond, marginLeft: 'auto', flexShrink: 0 }}>
                  ${cost.toFixed(3)}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted, flexShrink: 0 }}>
                  {formatTokens(a.allTimeTokens)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
