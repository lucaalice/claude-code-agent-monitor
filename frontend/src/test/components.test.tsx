import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';
import { SectionHeader, ActivityBar, Divider } from '../components/Primitives';
import { BootScreen } from '../components/BootScreen';
import { SessionHistory } from '../components/SessionHistory';
import { TaskQueue } from '../components/TaskQueue';
import { TeamLeadCard, SpecialistCard } from '../components/AgentCards';
import { mockAgent, mockTask } from './fixtures';

describe('StatusBadge', () => {
  it('renders running label', () => {
    render(<StatusBadge status="running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders error label', () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});

describe('SectionHeader', () => {
  it('renders label', () => {
    render(<SectionHeader label="Test Section" />);
    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('renders right content', () => {
    render(<SectionHeader label="X" right="3 items" />);
    expect(screen.getByText('3 items')).toBeInTheDocument();
  });
});

describe('ActivityBar', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<ActivityBar active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders shimmer bar when active', () => {
    const { container } = render(<ActivityBar active={true} />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe('Divider', () => {
  it('renders horizontal by default', () => {
    const { container } = render(<Divider />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.height).toBe('1px');
  });

  it('renders vertical when specified', () => {
    const { container } = render(<Divider vertical />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('1px');
  });
});

describe('BootScreen', () => {
  it('shows connection message when disconnected', () => {
    render(<BootScreen connected={false} />);
    expect(screen.getByText(/auto-reconnect enabled/)).toBeInTheDocument();
  });

  it('shows waiting message when connected', () => {
    render(<BootScreen connected={true} />);
    expect(screen.getByText(/Waiting for data/)).toBeInTheDocument();
  });
});

describe('SessionHistory', () => {
  it('shows empty state', () => {
    render(<SessionHistory sessions={[]} />);
    expect(screen.getByText('No archived sessions')).toBeInTheDocument();
  });

  it('renders sessions', () => {
    const sessions = [{ id: 1, startTime: Date.now() - 60000, endTime: Date.now(), totalTokens: 5000, totalCost: 0.5, completedTasks: 3 }];
    render(<SessionHistory sessions={sessions} />);
    expect(screen.getByText('5.0K')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('TaskQueue', () => {
  it('renders task entries', () => {
    render(<TaskQueue tasks={[mockTask({ task: 'Audit homepage' })]} />);
    expect(screen.getByText('Audit homepage')).toBeInTheDocument();
  });
});

describe('TeamLeadCard', () => {
  it('shows idle state', () => {
    render(<TeamLeadCard agent={mockAgent({ name: 'team-lead', model: 'opus' })} elapsedTime={null} />);
    expect(screen.getByText('team-lead')).toBeInTheDocument();
    expect(screen.getByText('No active task')).toBeInTheDocument();
  });

  it('shows running state with task', () => {
    render(<TeamLeadCard agent={mockAgent({ name: 'team-lead', model: 'opus', status: 'running', currentTask: 'Orchestrating audit' })} elapsedTime="2m 30s" />);
    expect(screen.getByText('Orchestrating audit')).toBeInTheDocument();
    expect(screen.getByText('2m 30s')).toBeInTheDocument();
  });
});

describe('SpecialistCard', () => {
  it('renders agent name and status', () => {
    render(<SpecialistCard agent={mockAgent({ name: 'seo-technical', status: 'completed', taskCount: 5, allTimeTasks: 12 })} index={0} now={Date.now()} />);
    expect(screen.getByText('seo-technical')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
