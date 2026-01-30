export function Card({ children, className = '', hover = true }) {
  const hoverClasses = hover ? 'hover-lift cursor-pointer' : '';
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-300 ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`p-6 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 transition-colors duration-200 ${className}`}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-6 transition-all duration-200 ${className}`}>
      {children}
    </div>
  );
}
