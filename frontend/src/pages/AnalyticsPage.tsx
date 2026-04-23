import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme';
import { PageNav } from '../components/PageNav';
import { AgentTokenChart } from '../components/AgentTokenChart';
import { CostDonut } from '../components/CostDonut';
import { TokenSankey } from '../components/TokenSankey';

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: T.bg, color: T.textPrimary, fontFamily: T.sans }}>
      <PageNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: T.textPrimary, marginBottom: 8 }}>
          Analytics
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: 13, color: T.textMuted, marginBottom: 24 }}>
          Agent performance visualizations powered by D3.
        </p>

        {!data ? (
          <div style={{
            padding: '48px 24px', borderRadius: 8, border: `1px dashed ${T.border}`,
            backgroundColor: T.bgSurface, textAlign: 'center',
          }}>
            <span style={{ fontFamily: T.mono, fontSize: 13, color: T.textDim }}>Loading analytics...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <AgentTokenChart agents={data.agents} />
              <CostDonut agents={data.agents} />
            </div>
            <TokenSankey agents={data.agents} />
          </div>
        )}
      </div>
    </div>
  );
}
