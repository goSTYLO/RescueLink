export function Button({ 
  children, 
  className = '', 
  variant = 'default',
  size = 'default',
  ...props 
}) {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none transform hover:scale-[1.02] active:scale-[0.98]';
  
  const variantClasses = {
    default: 'bg-primary text-white hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25 focus:ring-primary active:bg-primary-dark',
    outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white hover:border-primary focus:ring-primary active:bg-primary-hover',
    ghost: 'bg-transparent text-primary hover:bg-primary/15 focus:ring-primary active:bg-primary/25',
    link: 'bg-transparent text-primary hover:text-primary-light underline-offset-4 hover:underline p-0 focus:ring-primary',
    secondary: 'bg-secondary text-foreground hover:bg-secondary-hover focus:ring-secondary active:bg-secondary-light',
  };
  
  const sizeClasses = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base',
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${sizeClasses[size] || sizeClasses.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
