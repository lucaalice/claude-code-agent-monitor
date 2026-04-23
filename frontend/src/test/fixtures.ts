import type { Agent, DashboardState, GlobalMetrics, TaskQueueEntry } from '../types/api';

export const mockAgent = (overrides: Partial<Agent> = {}): Agent => ({
  name: 'test-agent',
  status: 'idle',
  currentTask: null,
  model: 'sonnet',
  tokensUsed: 0,
  startTime: null,
  taskCount: 0,
  allTimeTokens: 0,
  allTimeTasks: 0,
  lastOutput: null,
  ...overrides,
});

export const mockMetrics = (overrides: Partial<GlobalMetrics> = {}): GlobalMetrics => ({
  totalTokens: 50000,
  totalCost: 1.5,
  completedTasks: 10,
  sessionTokens: 5000,
  sessionCost: 0.3,
  sessionCompleted: 2,
  sessionStartTime: Date.now() - 3600000,
  activeAgents: 0,
  ...overrides,
});

export const mockTask = (overrides: Partial<TaskQueueEntry> = {}): TaskQueueEntry => ({
  id: 1,
  task: 'Test task',
  agent: 'test-agent',
  timestamp: Date.now(),
  status: 'completed',
  tokens: 1000,
  ...overrides,
});

export const mockDashboardState = (overrides: Partial<DashboardState> = {}): DashboardState => ({
  teamLead: mockAgent({ name: 'team-lead', model: 'opus' }),
  specialists: {
    'scraper-debugger': mockAgent({ name: 'scraper-debugger' }),
    'code-reviewer': mockAgent({ name: 'code-reviewer', status: 'running', currentTask: 'Reviewing PR', startTime: Date.now() - 30000 }),
    'seo-technical': mockAgent({ name: 'seo-technical' }),
  },
  globalMetrics: mockMetrics(),
  taskQueue: [mockTask()],
  ...overrides,
});
