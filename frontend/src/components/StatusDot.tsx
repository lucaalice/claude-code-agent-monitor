import { T, getStatus } from '../theme';

interface Props {
  status: string;
  size?: number;
}

export function StatusDot({ status, size = 8 }: Props) {
  const m = getStatus(status);
  const isRunning = status === 'running';
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      backgroundColor: m.color,
      boxShadow: isRunning ? `0 0 0 2px ${T.greenGlow}` : 'none',
      animation: isRunning ? 'pipPulse 2s ease-in-out infinite' : 'none',
      flexShrink: 0, transition: 'background-color 0.3s ease',
    }} aria-label={m.label} />
  );
}
