import { useState } from 'react';
import { T } from '../theme';
import { formatTime } from '../utils/format';
import { useDashboard } from '../hooks/useDashboard';
import { BootScreen } from '../components/BootScreen';
import { MetricStrip } from '../components/MetricStrip';
import { FilterBar } from '../components/FilterBar';
import { AgentTimeline } from '../components/AgentTimeline';
import { SessionHistory } from '../components/SessionHistory';
import { SectionHeader } from '../components/Primitives';
import { TeamLeadCard, SubOrchestratorCard, SpecialistCard } from '../components/AgentCards';
import { TaskQueue } from '../components/TaskQueue';
import { AppHeader } from '../components/AppHeader';
import type { Agent } from '../types/api';

export function DashboardPage() {
  const {
    agentState, connected, now, sessions, notifMuted,
    toggleMute, fetchSessions, archiveSession,
  } = useDashboard();

  const [statusFilter, setStatusFilter] = useState('all');
  const [showSessions, setShowSessions] = useState(false);

  if (!agentState) return <BootScreen connected={connected} />;

  const specialists = Object.values(agentState.specialists);

  const elapsedTime =
    agentState.teamLead.startTime && agentState.teamLead.status === 'running'
      ? formatTime(now - agentState.teamLead.startTime) : null;

  const statusCounts: Record<string, number> = { all: specialists.length, running: 0, error: 0, completed: 0, idle: 0 };
  specialists.forEach((a) => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  const statusSort = (a: Agent, b: Agent) => {
    const order: Record<string, number> = { running: 0, error: 1, waiting: 2, completed: 3, idle: 4 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  };

  const applyFilter = (agents: Agent[]) =>
    statusFilter === 'all' ? agents : agents.filter((a) => a.status === statusFilter);

  const seoSpecialistNames = ['seo-technical', 'seo-content', 'seo-schema', 'seo-sitemap', 'seo-geo', 'seo-performance', 'seo-visual'];
  const seoManager    = specialists.find((a) => a.name === 'seo-manager') || null;
  const seoAgents     = specialists.filter((a) => seoSpecialistNames.includes(a.name));
  const directReports = specialists.filter((a) => a.name !== 'seo-manager' && !seoSpecialistNames.includes(a.name));

  const filteredDirect = applyFilter([...directReports]).sort(statusSort);
  const filteredSeo    = applyFilter([...seoAgents]).sort(statusSort);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: T.bg, fontFamily: T.sans,
      color: T.textPrimary, display: 'flex', flexDirection: 'column',
    }}>
      <AppHeader
        connected={connected}
        now={now}
        sessionStartTime={agentState.globalMetrics.sessionStartTime}
        notifMuted={notifMuted}
        toggleMute={toggleMute}
        showSessions={showSessions}
        setShowSessions={setShowSessions}
        fetchSessions={fetchSessions}
      />

      <MetricStrip
        metrics={agentState.globalMetrics}
        activeAgentCount={agentState.globalMetrics.activeAgents}
        now={now}
        onArchive={archiveSession}
      />

      <FilterBar filter={statusFilter} setFilter={setStatusFilter} counts={statusCounts} />
      <AgentTimeline now={now} />

      {showSessions && (
        <div style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgSurface }}>
          <SectionHeader label="Session History" right={`${sessions.length} sessions`} />
          <SessionHistory sessions={sessions} />
        </div>
      )}

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.border}`, overflowY: 'auto' }}>
          <div style={{ borderBottom: `1px solid ${T.border}` }}>
            <SectionHeader label="Orchestrator" right="team-lead" accent />
            <TeamLeadCard agent={agentState.teamLead} elapsedTime={elapsedTime} />
          </div>

          <div style={{ borderBottom: `1px solid ${T.border}` }}>
            <SectionHeader
              label="Direct Reports"
              right={`${directReports.filter(a => a.status === 'running').length} running \u00b7 ${directReports.length} agents`}
            />
            {filteredDirect.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, padding: '12px 14px' }}>
                {filteredDirect.map((agent, i) => (
                  <SpecialistCard key={agent.name} agent={agent} index={i} now={now} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', fontFamily: T.sans, fontSize: 12, color: T.textDim }}>
                No {statusFilter} agents
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <SectionHeader
              label="SEO Team"
              right={`${seoAgents.filter(a => a.status === 'running').length} running \u00b7 ${seoAgents.length + 1} agents`}
            />
            {seoManager && <SubOrchestratorCard agent={seoManager} childCount={seoAgents.length} />}
            {filteredSeo.length > 0 ? (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 10, padding: '8px 14px 12px 28px', marginLeft: 14,
                borderLeft: `2px solid ${seoManager && seoManager.status === 'running' ? T.green + '40' : T.border}`,
                transition: 'border-color 0.3s ease',
              }}>
                {filteredSeo.map((agent, i) => (
                  <SpecialistCard key={agent.name} agent={agent} index={i} compact now={now} />
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px 28px', marginLeft: 14, borderLeft: `2px solid ${T.border}`, fontFamily: T.sans, fontSize: 12, color: T.textDim }}>
                No {statusFilter} agents
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <SectionHeader label="Task Queue" right={`${agentState.taskQueue.length} events`} />
          {agentState.taskQueue.length > 0 ? (
            <TaskQueue tasks={agentState.taskQueue} />
          ) : (
            <div style={{ padding: '24px 16px', fontFamily: T.sans, fontSize: 12, color: T.textDim, textAlign: 'center' }}>
              No events yet
            </div>
          )}
        </div>
      </div>

      <footer style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px', height: 32, backgroundColor: T.bgSurface,
        borderTop: `1px solid ${T.border}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>ws://localhost:3001/ws</span>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{new Date(now).toLocaleTimeString('en-GB')}</span>
        <span style={{ fontFamily: T.sans, fontSize: 10, color: T.textDim }}>Claude Code Agent Dashboard</span>
      </footer>
    </div>
  );
}
