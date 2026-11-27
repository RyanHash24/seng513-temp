import type { ReactNode } from 'react';
import './WorkspaceEmptyState.css';

export function EmptyStateCard({ title, children, action, onAction }: {
  title: string; children: ReactNode; action?: string; onAction?: () => void;
}) {
  return <section className="fc-state-card">
    <h2>{title}</h2>
    <div className="fc-state-description">{children}</div>
    {action && onAction && <button type="button" className="fc-state-action" onClick={onAction}>{action}</button>}
  </section>;
}

export default function WorkspaceEmptyState({ children, label }: { children: ReactNode; label: string }) {
  return <div className="fc-workspace-state" aria-label={label}>{children}</div>;
}
