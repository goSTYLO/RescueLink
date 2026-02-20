export function Input({ className = '', error = false, ...props }) {
  return (
    <input
      className={`w-full px-4 py-3 border-2 rounded-xl bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background focus:border-secondary transition-all duration-300 ${
        error 
          ? 'border-primary focus:border-primary focus:ring-primary/30' 
          : 'border-[rgba(19,65,120,0.35)] hover:border-secondary/50 hover:bg-card'
      } ${className}`}
      {...props}
    />
  );
}
