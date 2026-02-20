export function Badge({ children, className = '', variant = 'default' }) {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors duration-200';
  
  const variantClasses = {
    default: 'bg-card text-foreground border-[rgba(19,65,120,0.35)]',
    outline: 'bg-transparent text-muted border-[rgba(19,65,120,0.5)]',
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}>
      {children}
    </span>
  );
}
