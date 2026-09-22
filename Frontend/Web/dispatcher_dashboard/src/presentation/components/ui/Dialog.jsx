import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Dialog({ open, onOpenChange, children, className = '', zIndex = 50 }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const wrapperClass = className
    ? `relative w-full max-h-[min(90vh,40rem)] overflow-y-auto bg-card border border-[rgba(19,65,120,0.35)] rounded-lg shadow-card-hover ${className}`
    : 'relative w-full max-w-lg max-h-[min(90vh,40rem)] overflow-y-auto bg-card border border-[rgba(19,65,120,0.35)] rounded-lg shadow-card-hover';

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }} role="presentation">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div className={wrapperClass} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogTrigger({ asChild, children, onClick }) {
  if (asChild) {
    return children;
  }
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}

export function DialogContent({ children, className = '' }) {
  return (
    <div className={`p-6 bg-card ${className}`}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, className = '' }) {
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = '' }) {
  return (
    <h2 className={`text-lg font-semibold text-foreground ${className}`}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className = '' }) {
  return (
    <p className={`text-sm text-muted mt-1 ${className}`}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className = '' }) {
  return (
    <div className={`flex justify-between gap-2 mt-6 ${className}`}>
      {children}
    </div>
  );
}
