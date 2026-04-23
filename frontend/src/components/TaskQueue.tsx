import { T } from '../theme';
import { formatTimestamp } from '../utils/format';
import type { TaskQueueEntry } from '../types/api';

interface Props {
  tasks: TaskQueueEntry[];
}

export function TaskQueue({ tasks }: Props) {
  const slice = tasks.slice(-100).reverse();
  const statusColor = (s: string) => s === 'completed' ? T.blue : s === 'error' ? T.red : T.green;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {slice.map((task, i) => (
        <div key={task.id || i} style={{
          display: 'grid', gridTemplateColumns: '48px 1fr', gap: 0,
          padding: '7px 14px',
          borderBottom: i < slice.length - 1 ? `1px solid ${T.border}` : 'none',
          animation: `fadeSlideIn ${0.05 + i * 0.03}s ease-out`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textMuted, letterSpacing: 0.3, lineHeight: 1.3 }}>
              {formatTimestamp(task.timestamp)}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.agent || 'sys'}
            </span>
          </div>
          <span style={{
            fontFamily: T.sans, fontSize: 11,
            color: task.status === 'completed' ? T.blue : task.status === 'error' ? T.red : T.textSecond,
            lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            paddingLeft: 8, borderLeft: `2px solid ${statusColor(task.status)}`,
          }}>
            {task.task}
          </span>
        </div>
      ))}
    </div>
  );
}
