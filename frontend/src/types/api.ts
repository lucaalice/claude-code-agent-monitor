// ─── Agent & state types ─────────────────────────────────────────────────────

export type AgentStatus = 'running' | 'completed' | 'waiting' | 'error' | 'idle';

export interface Agent {
  name: string;
  status: AgentStatus;
  currentTask: string | null;
  model: string;
  tokensUsed: number;
  startTime: number | null;
  taskCount: number;
  allTimeTokens: number;
  allTimeTasks: number;
  lastOutput: string | null;
}

export interface GlobalMetrics {
  totalTokens: number;
  totalCost: number;
  completedTasks: number;
  sessionTokens: number;
  sessionCost: number;
  sessionCompleted: number;
  sessionStartTime: number;
  activeAgents: number;
}

export interface TaskQueueEntry {
  id: number;
  task: string;
  agent: string | null;
  timestamp: number;
  status: string;
  tokens: number;
}

export interface TimelineEntry {
  id: number;
  agent: string;
  task: string | null;
  startTime: number;
  endTime: number | null;
  status: string;
}

export interface Session {
  id: number;
  startTime: number;
  endTime: number;
  totalTokens: number;
  totalCost: number;
  completedTasks: number;
}

export interface DashboardState {
  teamLead: Agent;
  specialists: Record<string, Agent>;
  globalMetrics: GlobalMetrics;
  taskQueue: TaskQueueEntry[];
}

// ─── WebSocket message types ────────────────────────────────────────────────

export interface WsStateUpdate {
  type: 'state_update';
  payload: DashboardState;
}

// ─── Design tokens ──────────────────────────────────────────────────────────

export interface DesignTokens {
  bg: string;
  bgSurface: string;
  bgSurfaceHi: string;
  bgOverlay: string;
  border: string;
  borderMed: string;
  borderBright: string;
  green: string;
  greenDim: string;
  greenGlow: string;
  teal: string;
  blue: string;
  blueDim: string;
  amber: string;
  amberDim: string;
  slate: string;
  slateDim: string;
  purple: string;
  red: string;
  redDim: string;
  textPrimary: string;
  textSecond: string;
  textMuted: string;
  textDim: string;
  sans: string;
  mono: string;
}

// ─── Status metadata ────────────────────────────────────────────────────────

export interface StatusMeta {
  color: string;
  dim: string;
  label: string;
  dot: string;
}
