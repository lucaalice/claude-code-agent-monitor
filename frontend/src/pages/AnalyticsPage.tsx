import { useState, useEffect, useCallback, useMemo } from 'react';
import { T } from '../theme';
import { PageNav } from '../components/PageNav';
import { AgentTokenChart } from '../components/AgentTokenChart';
import { CostDonut } from '../components/CostDonut';
import { TokenSankey } from '../components/TokenSankey';
import { formatTokens, formatCost } from '../utils/format';

interface AgentData {
  name: string;
  model: string;
  allTimeTokens: number;
  allTimeTasks: number;
  tokensUsed: number;
  taskCount: number;
}

interface AnalyticsData {
  agents: AgentData[];
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  opus:      { input: 15, output: 75 },
  sonnet:    { input: 3, output: 15 },
  haiku:     { input: 0.8, output: 4 },
  inherited: { input: 3, output: 15 },
};

function estimateCost(agent: AgentData) {
  const rates = MODEL_PRICING[agent.model] || MODEL_PRICING.sonnet;
  const inputTokens = agent.allTimeTokens * 0.6;
  const outputTokens = agent.allTimeTokens * 0.4;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, color, dimColor, icon }: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  dimColor: string;
  icon: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 180, padding: '20px 22px',
      backgroundColor: T.bgSurface, borderRadius: 12,
      border: `1px solid ${T.borderMed}`,
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: dimColor, filter: 'blur(30px)',
        opacity: 0.5, pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
        <span style={{
          fontFamily: T.sans, fontSize: 10, fontWeight: 600,
          color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          {label}
        </span>
      </div>
      <span style={{
        fontFamily: T.mono, fontSize: 28, fontWeight: 700,
        color, lineHeight: 1, letterSpacing: -0.5,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: T.sans, fontSize: 11, color: T.textSecond, marginTop: 2 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

/* ─── Chart Container ────────────────────────────────────────────────────── */

function ChartCard({ title, description, children, fullWidth }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: T.bgSurface, borderRadius: 12,
      border: `1px solid ${T.borderMed}`,
      padding: '24px 24px 16px',
      gridColumn: fullWidth ? '1 / -1' : undefined,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: T.sans, fontSize: 14, fontWeight: 600,
          color: T.textPrimary, marginBottom: 4,
        }}>
          {title}
        </div>
        {description && (
          <div style={{
            fontFamily: T.sans, fontSize: 12, color: T.textMuted,
          }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

/* ─── Agent Leaderboard ──────────────────────────────────────────────────── */

function AgentLeaderboard({ agents }: { agents: AgentData[] }) {
  const sorted = useMemo(() =>
    [...agents].filter(a => a.allTimeTokens > 0).sort((a, b) => b.allTimeTokens - a.allTimeTokens),
    [agents]
  );

  if (sorted.length === 0) return null;

  const maxTokens = sorted[0].allTimeTokens;

  const modelBadgeColor = (model: string) => {
    if (model === 'opus') return { bg: 'rgba(167,139,250,0.15)', text: T.purple };
    if (model === 'haiku') return { bg: T.amberDim, text: T.amber };
    return { bg: T.blueDim, text: T.blue };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 80px 90px 80px',
        gap: 12, padding: '0 16px 10px',
        borderBottom: `1px solid ${T.border}`,
      }}>
        {['#', 'Agent', 'Model', 'Tokens', 'Cost'].map(h => (
          <span key={h} style={{
            fontFamily: T.sans, fontSize: 10, fontWeight: 600,
            color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.6,
            textAlign: h === 'Tokens' || h === 'Cost' ? 'right' : 'left',
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((agent, i) => {
        const cost = estimateCost(agent);
        const badge = modelBadgeColor(agent.model);
        const barWidth = (agent.allTimeTokens / maxTokens) * 100;

        return (
          <div key={agent.name} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 80px 90px 80px',
            gap: 12, padding: '10px 16px', alignItems: 'center',
            borderBottom: `1px solid ${T.border}`,
            backgroundColor: i === 0 ? 'rgba(52,211,153,0.03)' : 'transparent',
            transition: 'background-color 0.15s ease',
          }}>
            {/* Rank */}
            <span style={{
              fontFamily: T.mono, fontSize: 13, fontWeight: 700,
              color: i < 3 ? T.green : T.textMuted,
            }}>
              {i + 1}
            </span>

            {/* Name + bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{
                fontFamily: T.mono, fontSize: 13, fontWeight: 600,
                color: T.textPrimary, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {agent.name}
              </span>
              <div style={{
                height: 3, borderRadius: 2, backgroundColor: T.bgOverlay,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${barWidth}%`,
                  background: `linear-gradient(90deg, ${T.green}, ${T.teal})`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>

            {/* Model badge */}
            <span style={{
              fontFamily: T.mono, fontSize: 10, fontWeight: 600,
              color: badge.text, backgroundColor: badge.bg,
              padding: '3px 8px', borderRadius: 4,
              textAlign: 'center', textTransform: 'uppercase',
            }}>
              {agent.model}
            </span>

            {/* Tokens */}
            <span style={{
              fontFamily: T.mono, fontSize: 13, fontWeight: 600,
              color: T.textPrimary, textAlign: 'right',
            }}>
              {formatTokens(agent.allTimeTokens)}
            </span>

            {/* Cost */}
            <span style={{
              fontFamily: T.mono, fontSize: 13, fontWeight: 500,
              color: T.textSecond, textAlign: 'right',
            }}>
              ${cost.toFixed(3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Model Breakdown Mini Cards ─────────────────────────────────────────── */

function ModelBreakdown({ agents }: { agents: AgentData[] }) {
  const active = agents.filter(a => a.allTimeTokens > 0);
  const models = [...new Set(active.map(a => a.model))];

  const modelData = models.map(model => {
    const modelAgents = active.filter(a => a.model === model);
    const tokens = modelAgents.reduce((s, a) => s + a.allTimeTokens, 0);
    const tasks = modelAgents.reduce((s, a) => s + a.allTimeTasks, 0);
    const cost = modelAgents.reduce((s, a) => s + estimateCost(a), 0);
    return { model, agentCount: modelAgents.length, tokens, tasks, cost };
  }).sort((a, b) => b.tokens - a.tokens);

  const totalTokens = modelData.reduce((s, m) => s + m.tokens, 0);

  const modelColor = (m: string) => {
    if (m === 'opus') return T.purple;
    if (m === 'haiku') return T.amber;
    return T.blue;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {modelData.map(m => {
        const pct = totalTokens > 0 ? (m.tokens / totalTokens * 100) : 0;
        const color = modelColor(m.model);
        return (
          <div key={m.model} style={{
            padding: '14px 16px', borderRadius: 8,
            backgroundColor: T.bgOverlay, border: `1px solid ${T.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: color,
                }} />
                <span style={{
                  fontFamily: T.mono, fontSize: 13, fontWeight: 700,
                  color: T.textPrimary, textTransform: 'uppercase',
                }}>
                  {m.model}
                </span>
              </div>
              <span style={{
                fontFamily: T.mono, fontSize: 12, fontWeight: 600, color,
              }}>
                {pct.toFixed(1)}%
              </span>
            </div>
            {/* Progress bar */}
            <div style={{
              height: 4, borderRadius: 2, backgroundColor: T.bg,
              marginBottom: 10, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2, backgroundColor: color,
                width: `${pct}%`, opacity: 0.8,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
            }}>
              {[
                { label: 'Tokens', value: formatTokens(m.tokens) },
                { label: 'Tasks', value: String(m.tasks) },
                { label: 'Agents', value: String(m.agentCount) },
                { label: 'Cost', value: `$${m.cost.toFixed(3)}` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontFamily: T.sans, fontSize: 9, fontWeight: 500,
                    color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.textSecond,
                  }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(() => {
    fetch('http://localhost:3001/api/analytics')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const iv = setInterval(fetchAnalytics, 10_000);
    return () => clearInterval(iv);
  }, [fetchAnalytics]);

  const stats = useMemo(() => {
    if (!data) return null;
    const active = data.agents.filter(a => a.allTimeTokens > 0);
    const totalTokens = data.agents.reduce((s, a) => s + a.allTimeTokens, 0);
    const totalTasks = data.agents.reduce((s, a) => s + a.allTimeTasks, 0);
    const totalCost = data.agents.reduce((s, a) => s + estimateCost(a), 0);
    const avgTokensPerTask = totalTasks > 0 ? Math.round(totalTokens / totalTasks) : 0;
    return { totalTokens, totalTasks, totalCost, activeAgents: active.length, totalAgents: data.agents.length, avgTokensPerTask };
  }, [data]);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: T.bg,
      color: T.textPrimary, fontFamily: T.sans,
    }}>
      <PageNav />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 48px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: T.sans, fontSize: 22, fontWeight: 700,
            color: T.textPrimary, margin: 0, letterSpacing: -0.3,
          }}>
            Analytics
          </h1>
          <p style={{
            fontFamily: T.sans, fontSize: 13, color: T.textMuted,
            margin: '6px 0 0',
          }}>
            All-time agent performance metrics and cost analysis.
          </p>
        </div>

        {!data || !stats ? (
          <div style={{
            padding: '64px 24px', borderRadius: 12,
            border: `1px dashed ${T.border}`,
            backgroundColor: T.bgSurface, textAlign: 'center',
          }}>
            <div style={{
              width: 32, height: 32, margin: '0 auto 12px',
              border: `2px solid ${T.textDim}`, borderTopColor: T.green,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontFamily: T.mono, fontSize: 13, color: T.textMuted }}>
              Loading analytics...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Stat Cards ── */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <StatCard
                icon="T"
                label="Total Tokens"
                value={formatTokens(stats.totalTokens)}
                sub={`${stats.avgTokensPerTask > 0 ? formatTokens(stats.avgTokensPerTask) + ' avg/task' : 'No tasks yet'}`}
                color={T.blue}
                dimColor={T.blueDim}
              />
              <StatCard
                icon="$"
                label="Est. Cost"
                value={formatCost(stats.totalCost)}
                sub={`Across ${stats.activeAgents} active agents`}
                color={T.amber}
                dimColor={T.amberDim}
              />
              <StatCard
                icon="#"
                label="Tasks Completed"
                value={stats.totalTasks}
                sub={`${stats.totalAgents} agents registered`}
                color={T.purple}
                dimColor="rgba(167,139,250,0.15)"
              />
              <StatCard
                icon="A"
                label="Active Agents"
                value={stats.activeAgents}
                sub={`${stats.totalAgents - stats.activeAgents} idle`}
                color={T.green}
                dimColor={T.greenDim}
              />
            </div>

            {/* ── Charts Row 1: Bar + Donut ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
              <ChartCard
                title="Token Usage by Agent"
                description="All-time token consumption per agent, colored by model tier"
              >
                <AgentTokenChart agents={data.agents} embedded />
              </ChartCard>
              <ChartCard
                title="Cost Distribution"
                description="Estimated cost breakdown across agents"
              >
                <CostDonut agents={data.agents} embedded />
              </ChartCard>
            </div>

            {/* ── Charts Row 2: Sankey full-width ── */}
            <ChartCard
              title="Token Flow: Models to Agents"
              description="How tokens flow from model tiers to individual agents"
              fullWidth
            >
              <TokenSankey agents={data.agents} embedded />
            </ChartCard>

            {/* ── Bottom Row: Leaderboard + Model Breakdown ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
              <ChartCard
                title="Agent Leaderboard"
                description="Ranked by all-time token usage"
              >
                <AgentLeaderboard agents={data.agents} />
              </ChartCard>
              <ChartCard
                title="Model Breakdown"
                description="Performance metrics by model tier"
              >
                <ModelBreakdown agents={data.agents} />
              </ChartCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
