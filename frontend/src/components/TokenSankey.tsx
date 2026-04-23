import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from 'd3-sankey';
import { T } from '../theme';
import { formatTokens } from '../utils/format';

interface AgentData {
  name: string;
  model: string;
  allTimeTokens: number;
}

interface Props {
  agents: AgentData[];
  embedded?: boolean;
}

interface SNode {
  name: string;
  id: number;
}
interface SLink {
  source: number;
  target: number;
  value: number;
}

const modelColor = (name: string) => {
  if (name === 'opus') return T.purple;
  if (name === 'haiku') return T.amber;
  return T.blue;
};

export function TokenSankey({ agents, embedded }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const active = agents.filter(a => a.allTimeTokens > 0).sort((a, b) => b.allTimeTokens - a.allTimeTokens);
    if (active.length === 0) return;

    const models = [...new Set(active.map(a => a.model))];
    const nodes: SNode[] = [
      ...models.map((m, i) => ({ name: m, id: i })),
      ...active.map((a, i) => ({ name: a.name, id: models.length + i })),
    ];

    const links: SLink[] = active.map(a => ({
      source: models.indexOf(a.model),
      target: models.length + active.indexOf(a),
      value: a.allTimeTokens,
    }));

    const margin = { top: 16, right: 140, bottom: 16, left: 80 };
    const width = 900 - margin.left - margin.right;
    const height = Math.max(320, active.length * 32) - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const sankeyGen = sankey<SNode, SLink>()
      .nodeId((d: SankeyNode<SNode, SLink>) => d.id!)
      .nodeWidth(18)
      .nodePadding(14)
      .extent([[0, 0], [width, height]]);

    const { nodes: sNodes, links: sLinks } = sankeyGen({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    // Links — much brighter
    g.append('g')
      .selectAll('path')
      .data(sLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => {
        const source = d.source as SankeyNode<SNode, SLink>;
        return modelColor(source.name);
      })
      .attr('stroke-width', d => Math.max(2, (d as SankeyLink<SNode, SLink>).width || 1))
      .attr('fill', 'none')
      .attr('opacity', 0.55)
      .style('cursor', 'pointer')
      .on('mouseover', function() { d3.select(this).attr('opacity', 0.85); })
      .on('mouseout', function() { d3.select(this).attr('opacity', 0.55); });

    // Nodes — taller, rounded
    g.append('g')
      .selectAll('rect')
      .data(sNodes)
      .join('rect')
      .attr('x', d => (d as SankeyNode<SNode, SLink>).x0 || 0)
      .attr('y', d => (d as SankeyNode<SNode, SLink>).y0 || 0)
      .attr('height', d => ((d as SankeyNode<SNode, SLink>).y1 || 0) - ((d as SankeyNode<SNode, SLink>).y0 || 0))
      .attr('width', d => ((d as SankeyNode<SNode, SLink>).x1 || 0) - ((d as SankeyNode<SNode, SLink>).x0 || 0))
      .attr('fill', d => {
        const idx = sNodes.indexOf(d);
        return idx < models.length ? modelColor(d.name) : T.green;
      })
      .attr('rx', 3)
      .attr('opacity', 0.9);

    // Labels — bigger, brighter, with token counts on agent side
    g.append('g')
      .selectAll('text')
      .data(sNodes)
      .join('text')
      .attr('x', d => {
        const node = d as SankeyNode<SNode, SLink>;
        const idx = sNodes.indexOf(d);
        return idx < models.length ? (node.x1 || 0) + 10 : (node.x0 || 0) - 10;
      })
      .attr('y', d => {
        const node = d as SankeyNode<SNode, SLink>;
        return ((node.y0 || 0) + (node.y1 || 0)) / 2;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', d => sNodes.indexOf(d) < models.length ? 'start' : 'end')
      .attr('fill', T.textPrimary)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('font-family', T.mono)
      .text(d => {
        const idx = sNodes.indexOf(d);
        if (idx < models.length) {
          // Model node — show total tokens flowing through
          const total = sLinks.filter(l => (l.source as SankeyNode<SNode, SLink>).id === d.id).reduce((s, l) => s + (l.value || 0), 0);
          return `${d.name} (${formatTokens(total)})`;
        }
        return d.name;
      });

    // Token count labels on the right side of agent nodes
    g.append('g')
      .selectAll('text.tokens')
      .data(sNodes.filter((_, i) => i >= models.length))
      .join('text')
      .attr('x', d => ((d as SankeyNode<SNode, SLink>).x1 || 0) + 10)
      .attr('y', d => {
        const node = d as SankeyNode<SNode, SLink>;
        return ((node.y0 || 0) + (node.y1 || 0)) / 2;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', T.textSecond)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('font-family', T.mono)
      .text(d => {
        const agent = active.find(a => a.name === d.name);
        return agent ? formatTokens(agent.allTimeTokens) : '';
      });

  }, [agents]);

  const active = agents.filter(a => a.allTimeTokens > 0);
  const svgHeight = Math.max(320, active.length * 32);

  if (embedded) {
    return <svg ref={svgRef} style={{ width: '100%', height: svgHeight }} />;
  }

  return (
    <div style={{ backgroundColor: T.bgSurface, borderRadius: 10, border: `1px solid ${T.borderMed}`, padding: '20px 20px 12px' }}>
      <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
        Token Flow: Models &rarr; Agents
      </div>
      <svg ref={svgRef} style={{ width: '100%', height: svgHeight }} />
    </div>
  );
}
