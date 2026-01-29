export function Badge({ children, className = '', variant = 'default' }) {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border';
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 border-gray-200',
    outline: 'bg-transparent text-gray-700 border-gray-300',
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}>
      {children}
    </span>
  );
}
