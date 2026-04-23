import { T, getStatus } from '../theme';
import { StatusDot } from './StatusDot';

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const m = getStatus(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 99,
      backgroundColor: m.dim, border: `1px solid ${m.color}33`,
      fontFamily: T.sans, fontSize: 11, fontWeight: 500,
      color: m.color, letterSpacing: 0.2, whiteSpace: 'nowrap',
    }}>
      <StatusDot status={status} size={6} />
      {m.label}
    </span>
  );
}
