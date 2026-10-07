/** Shared login/landing backdrop: orbs, dot grid, optional Dagupan line map. */
export function AuthPageBackground({ showMap = true }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-primary/25 blur-3xl dark:bg-primary/10" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-secondary/30 blur-3xl dark:bg-secondary/15" />
      <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/8" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-secondary/25 blur-3xl dark:bg-secondary/10" />
      <div
        className="absolute inset-0 opacity-[0.12] dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      {showMap ? (
        <div className="absolute inset-0 animate-auth-map-fade text-secondary dark:text-foreground">
          <svg
            className="h-full w-full object-cover object-center"
            viewBox="0 0 400 320"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M80 40 L120 30 L180 45 L240 35 L300 50 L340 70 L360 120 L350 180 L320 240 L280 270 L220 290 L160 280 L100 260 L50 220 L30 160 L40 100 Z" opacity="0.9" />
            <path d="M100 80 L160 70 L220 85 L260 95 L280 130 L270 170 L240 200 L200 210 L150 200 L110 170 L95 130 Z" opacity="0.6" />
            <path d="M180 100 Q200 140 190 180 Q180 220 200 250" opacity="0.5" />
            <path d="M140 120 L200 115 L240 135" opacity="0.4" />
            <path d="M220 160 L280 155 L310 175" opacity="0.4" />
            <path d="M120 150 L260 145" opacity="0.35" />
            <path d="M130 190 L270 185" opacity="0.35" />
            <path d="M160 120 L165 240" opacity="0.3" />
            <path d="M230 90 L235 260" opacity="0.3" />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
