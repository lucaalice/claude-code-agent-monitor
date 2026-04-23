import { describe, it, expect } from 'vitest';
import { T, getStatus, STATUS_META } from '../theme';

describe('theme', () => {
  it('exports design tokens', () => {
    expect(T.bg).toBe('#111318');
    expect(T.green).toBe('#34d399');
    expect(T.sans).toContain('Inter');
    expect(T.mono).toContain('JetBrains');
  });

  it('has status metadata for all statuses', () => {
    expect(STATUS_META).toHaveProperty('running');
    expect(STATUS_META).toHaveProperty('completed');
    expect(STATUS_META).toHaveProperty('waiting');
    expect(STATUS_META).toHaveProperty('error');
    expect(STATUS_META).toHaveProperty('idle');
  });
});

describe('getStatus', () => {
  it('returns correct meta for running', () => {
    const m = getStatus('running');
    expect(m.color).toBe(T.green);
    expect(m.label).toBe('Running');
  });

  it('falls back to idle for unknown status', () => {
    const m = getStatus('unknown');
    expect(m.label).toBe('Idle');
    expect(m.color).toBe(T.slate);
  });
});
