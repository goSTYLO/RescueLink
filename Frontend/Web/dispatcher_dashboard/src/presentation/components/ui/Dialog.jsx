import { useEffect } from 'react';

export function Dialog({ open, onOpenChange, children, className = '' }) {
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
    ? `relative z-50 w-full bg-card border border-[rgba(19,65,120,0.35)] rounded-lg shadow-card-hover overflow-hidden ${className}`
    : 'relative z-50 w-full max-w-lg bg-card border border-[rgba(19,65,120,0.35)] rounded-lg shadow-card-hover overflow-hidden';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} aria-hidden="true" />
      <div className={wrapperClass}>
        {children}
      </div>
    </div>
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
