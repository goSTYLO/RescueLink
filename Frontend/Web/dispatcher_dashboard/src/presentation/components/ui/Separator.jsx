export function Separator({ className = '', orientation = 'horizontal' }) {
  if (orientation === 'vertical') {
    return <div className={`w-px bg-[rgba(19,65,120,0.35)] ${className}`} />;
  }
  return <div className={`h-px bg-[rgba(19,65,120,0.35)] ${className}`} />;
}
