export function Alert({ children, className = '' }) {
  return (
    <div className={`rounded-lg border border-[rgba(19,65,120,0.35)] bg-card p-4 ${className}`}>
      {children}
    </div>
  );
}

export function AlertTitle({ children, className = '' }) {
  return (
    <h5 className={`mb-1 font-semibold leading-none tracking-tight text-foreground ${className}`}>
      {children}
    </h5>
  );
}

export function AlertDescription({ children, className = '' }) {
  return (
    <div className={`text-sm mt-1 text-muted ${className}`}>
      {children}
    </div>
  );
}
