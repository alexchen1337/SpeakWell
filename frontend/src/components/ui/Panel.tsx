import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export default function Panel({ children, className = '' }: PanelProps) {
  return <section className={`ui-panel ${className}`.trim()}>{children}</section>;
}
