export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-[rgba(19,65,120,0.35)] rounded-lg bg-card text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background focus:border-secondary resize-none transition-all duration-200 ${className}`}
      {...props}
    />
  );
}
