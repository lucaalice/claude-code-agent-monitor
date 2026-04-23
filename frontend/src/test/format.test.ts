import { describe, it, expect } from 'vitest';
import { formatCost, formatTokens, formatTime, formatTimestamp, formatDate } from '../utils/format';

describe('formatCost', () => {
  it('returns $0.0000 for null', () => expect(formatCost(null)).toBe('$0.0000'));
  it('returns $0.0000 for undefined', () => expect(formatCost(undefined)).toBe('$0.0000'));
  it('formats small cost', () => expect(formatCost(0.0123)).toBe('$0.0123'));
  it('formats larger cost', () => expect(formatCost(5.6789)).toBe('$5.6789'));
});

describe('formatTokens', () => {
  it('returns 0 for null', () => expect(formatTokens(null)).toBe('0'));
  it('returns 0 for NaN', () => expect(formatTokens(NaN)).toBe('0'));
  it('formats small numbers', () => expect(formatTokens(500)).toBe('500'));
  it('formats thousands', () => expect(formatTokens(5000)).toBe('5.0K'));
  it('formats millions', () => expect(formatTokens(2500000)).toBe('2.50M'));
});

describe('formatTime', () => {
  it('returns 0s for null', () => expect(formatTime(null)).toBe('0s'));
  it('returns 0s for 0', () => expect(formatTime(0)).toBe('0s'));
  it('formats seconds', () => expect(formatTime(45000)).toBe('45s'));
  it('formats minutes', () => expect(formatTime(125000)).toBe('2m 5s'));
  it('formats hours', () => expect(formatTime(3725000)).toBe('1h 2m'));
});

describe('formatTimestamp', () => {
  it('formats a date to HH:MM:SS', () => {
    const d = new Date(2026, 0, 1, 14, 5, 9).getTime();
    expect(formatTimestamp(d)).toBe('14:05:09');
  });
});

describe('formatDate', () => {
  it('formats a date to M/D HH:MM', () => {
    const d = new Date(2026, 3, 23, 9, 30).getTime();
    expect(formatDate(d)).toBe('4/23 09:30');
  });
});
