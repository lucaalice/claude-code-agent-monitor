import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { T } from '../theme';

interface AgentData {
  name: string;
  model: string;
  allTimeTokens: number;
  allTimeTasks: number;
}

interface Props {
  agents: AgentData[];
  embedded?: boolean;
}

export function AgentTokenChart({ agents, embedded }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || agents.length === 0) return;

    const sorted = [...agents].filter(a => a.allTimeTokens > 0).sort((a, b) => b.allTimeTokens - a.allTimeTokens);
    if (sorted.length === 0) return;

    const margin = { top: 24, right: 20, bottom: 120, left: 70 };
    const width = 700 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(sorted.map(d => d.name)).range([0, width]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(sorted, d => d.allTimeTokens) || 1]).nice().range([height, 0]);

    const modelColor = (model: string) => model === 'opus' ? T.purple : model === 'haiku' ? T.amber : T.blue;

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.08)').attr('stroke-dasharray', '3,3');
    g.selectAll('.grid .domain').remove();

    // Bars with glow
    g.selectAll('.bar')
      .data(sorted)
      .join('rect')
      .attr('x', d => x(d.name)!)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', d => modelColor(d.model))
      .attr('opacity', 0.9)
      .transition()
      .duration(600)
      .delay((_, i) => i * 50)
      .attr('y', d => y(d.allTimeTokens))
      .attr('height', d => height - y(d.allTimeTokens));

    // Value labels above bars — bright white
    g.selectAll('.label')
      .data(sorted)
      .join('text')
      .attr('x', d => x(d.name)! + x.bandwidth() / 2)
      .attr('y', d => y(d.allTimeTokens) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', T.textPrimary)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('font-family', T.mono)
      .text(d => {
        if (d.allTimeTokens > 1_000_000) return `${(d.allTimeTokens / 1_000_000).toFixed(1)}M`;
        if (d.allTimeTokens > 1_000) return `${(d.allTimeTokens / 1_000).toFixed(0)}K`;
        return String(d.allTimeTokens);
      });

    // X axis — brighter labels, larger font
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${height})`);
    xAxis.call(d3.axisBottom(x).tickSize(0));
    xAxis.select('.domain').attr('stroke', 'rgba(255,255,255,0.12)');
    xAxis.selectAll('text')
      .attr('transform', 'rotate(-40)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.25em')
      .attr('fill', T.textPrimary)
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .attr('font-family', T.mono);

    // Y axis — brighter labels
    const yAxis = g.append('g');
    yAxis.call(d3.axisLeft(y).ticks(5).tickFormat(d => {
      const v = d as number;
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
      return String(v);
    }));
    yAxis.select('.domain').attr('stroke', 'rgba(255,255,255,0.12)');
    yAxis.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.08)');
    yAxis.selectAll('text')
      .attr('fill', T.textSecond)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('font-family', T.mono);

    // Model legend
    const models = [...new Set(sorted.map(d => d.model))];
    const legend = g.append('g').attr('transform', `translate(${width - models.length * 80}, -12)`);
    models.forEach((model, i) => {
      const lg = legend.append('g').attr('transform', `translate(${i * 80}, 0)`);
      lg.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', modelColor(model)).attr('opacity', 0.9);
      lg.append('text').attr('x', 14).attr('y', 9).attr('fill', T.textSecond).attr('font-size', 11).attr('font-family', T.sans).attr('font-weight', 500).text(model);
    });

  }, [agents]);

  if (embedded) {
    return <svg ref={svgRef} style={{ width: '100%', height: 420 }} />;
  }

  return (
    <div style={{ backgroundColor: T.bgSurface, borderRadius: 10, border: `1px solid ${T.borderMed}`, padding: '20px 20px 12px' }}>
      <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
        Token Usage by Agent
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: 420 }} />
    </div>
  );
}
