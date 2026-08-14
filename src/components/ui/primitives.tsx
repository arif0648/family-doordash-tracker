import React from 'react';

export function PageShell({ children, className = '', style }: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) {
  return <main className={`ui-page ${className}`.trim()} style={style}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="ui-page-header">
    <div className="ui-page-heading">
      {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {action ? <div className="ui-page-action">{action}</div> : null}
  </header>;
}

export function Surface({ children, className = '', style }: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) {
  return <section className={`ui-surface ${className}`.trim()} style={style}>{children}</section>;
}

export function SectionHeader({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return <div className="ui-section-header"><h2>{title}</h2>{meta ? <div>{meta}</div> : null}</div>;
}

type ButtonTone = 'primary' | 'secondary' | 'positive' | 'negative' | 'danger';
export function Button({ tone = 'secondary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return <button {...props} className={`ui-button ui-button-${tone} ${className}`.trim()} />;
}

export function Modal({ open, title, onClose, children }: React.PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null;
  return <div className="ui-modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ui-modal">
      <header className="ui-modal-header"><h2>{title}</h2><button type="button" className="ui-icon-button" onClick={onClose} aria-label="Kapat">×</button></header>
      {children}
    </section>
  </div>;
}
