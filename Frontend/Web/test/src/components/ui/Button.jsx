export function Button({ 
  children, 
  className = '', 
  variant = 'default',
  size = 'default',
  ...props 
}) {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transform hover:scale-[1.02] active:scale-[0.98]';
  
  const variantClasses = {
    default: 'bg-[#FF4F52] text-white hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-500/30 focus:ring-[#FF4F52]',
    outline: 'bg-transparent border-2 border-[#FF4F52] text-[#FF4F52] hover:bg-gray-800 hover:text-white hover:border-gray-800 focus:ring-[#FF4F52]',
    ghost: 'bg-transparent text-[#FF4F52] hover:bg-gray-100 focus:ring-[#FF4F52]',
    link: 'bg-transparent text-[#FF4F52] hover:text-gray-800 underline-offset-4 hover:underline p-0',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500',
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
