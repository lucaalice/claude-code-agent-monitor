export const formatCost = (c: number | null | undefined): string =>
  c == null ? '$0.0000' : `$${Number(c).toFixed(4)}`;

export const formatTokens = (t: number | null | undefined): string => {
  if (t == null || isNaN(t)) return '0';
  if (t > 1_000_000) return (t / 1_000_000).toFixed(2) + 'M';
  if (t > 1_000)     return (t / 1_000).toFixed(1) + 'K';
  return t.toString();
};

export const formatTime = (ms: number | null | undefined): string => {
  if (!ms) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const formatTimestamp = (t: number): string => {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

export const formatDate = (t: number): string => {
  const d = new Date(t);
  return `${d.getMonth()+1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
