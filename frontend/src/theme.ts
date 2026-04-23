import type { DesignTokens, AgentStatus, StatusMeta } from './types/api';

export const T: DesignTokens = {
  bg:          '#111318',
  bgSurface:   '#181b22',
  bgSurfaceHi: '#1e2230',
  bgOverlay:   '#242838',
  border:      'rgba(255,255,255,0.06)',
  borderMed:   'rgba(255,255,255,0.10)',
  borderBright:'rgba(255,255,255,0.16)',
  green:       '#34d399',
  greenDim:    'rgba(52,211,153,0.15)',
  greenGlow:   'rgba(52,211,153,0.25)',
  teal:        '#22d3ee',
  blue:        '#60a5fa',
  blueDim:     'rgba(96,165,250,0.15)',
  amber:       '#fbbf24',
  amberDim:    'rgba(251,191,36,0.12)',
  slate:       '#64748b',
  slateDim:    'rgba(100,116,139,0.12)',
  purple:      '#a78bfa',
  red:         '#f87171',
  redDim:      'rgba(248,113,113,0.12)',
  textPrimary: '#f1f5f9',
  textSecond:  '#94a3b8',
  textMuted:   '#475569',
  textDim:     '#334155',
  sans: '"Inter", "system-ui", "-apple-system", "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", "Consolas", monospace',
};

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  running:   { color: T.green,  dim: T.greenDim,  label: 'Running',   dot: T.green  },
  completed: { color: T.blue,   dim: T.blueDim,   label: 'Done',      dot: T.blue   },
  waiting:   { color: T.amber,  dim: T.amberDim,  label: 'Waiting',   dot: T.amber  },
  error:     { color: T.red,    dim: T.redDim,     label: 'Error',     dot: T.red    },
  idle:      { color: T.slate,  dim: T.slateDim,   label: 'Idle',      dot: T.slate  },
};

export const getStatus = (s: AgentStatus | string): StatusMeta =>
  STATUS_META[s as AgentStatus] || STATUS_META.idle;
