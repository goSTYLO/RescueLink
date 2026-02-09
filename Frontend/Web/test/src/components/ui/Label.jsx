export function Label({ children, htmlFor, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={`block text-sm font-medium text-foreground ${className}`}>
      {children}
    </label>
  );
}
