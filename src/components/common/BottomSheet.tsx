import React, { useEffect, useRef } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target === overlayRef.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    overlayRef.current?.addEventListener('touchstart', onTouch);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      overlayRef.current?.removeEventListener('touchstart', onTouch);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      style={S.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.handle} />
        {title ? <h3 style={S.title}>{title}</h3> : null}
        <div style={S.body}>{children}</div>
        <div style={S.safe} />
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(2px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    animation: 'overlayEnter 200ms ease forwards',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    background: 'var(--surface)',
    borderRadius: '24px 24px 0 0',
    border: '1px solid var(--border)',
    borderBottom: 0,
    boxShadow: '0 -24px 60px rgba(0,0,0,0.45)',
    animation: 'sheetEnter 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
    willChange: 'transform',
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.18)',
    margin: '12px auto',
  },
  title: {
    margin: '8px 0 4px',
    padding: '0 20px',
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--text)',
  },
  body: {
    padding: '8px 16px 16px',
  },
  safe: {
    height: 'var(--safe-bottom)',
    minHeight: 12,
  },
};
