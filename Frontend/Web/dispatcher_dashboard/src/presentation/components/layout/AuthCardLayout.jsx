import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import logo from '@/presentation/assets/logo.svg';
import logoDark from '@/presentation/assets/logo-dark.svg';
import { ThemeToggle } from '@/presentation/components/common/ThemeToggle.jsx';

/**
 * Auth card layout: centered card with form (left) and branding panel (right).
 * Glassmorphism + neumorphism, theme-aware. Theme toggle in top-right of form panel.
 */
export function AuthCardLayout({ children, illustration, tagline = 'One Tap. One Report. Faster Response.' }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const cardClass = [
    'w-full max-w-5xl rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[520px] max-h-[90vh]',
    'transition-all duration-300',
    'glass border',
    'bg-white/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border-gray-200/80',
    'dark:bg-card/90 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] dark:border-white/10',
    'neumorphic-light dark:neumorphic-dark',
  ].join(' ');

  const formPanelClass = 'bg-white dark:bg-card';
  const brandPanelClass = [
    'border-l',
    'bg-gradient-to-br from-primary/15 via-primary/10 to-secondary/20 border-gray-200/80',
    'dark:from-primary/25 dark:via-primary/15 dark:to-secondary/30 dark:border-white/10',
  ].join(' ');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Full-page background: decorative objects */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Soft gradient orbs */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-secondary/10 blur-3xl" />
        {/* Subtle grid / dots */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        {/* Dagupan-inspired line map (lines only), fade in/out */}
        <div className="absolute inset-0 animate-auth-map-fade text-foreground">
          <svg
            className="w-full h-full object-cover object-center"
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
      </div>
      <div className="absolute inset-0 bg-background/70 pointer-events-none" aria-hidden />
      <div className={`relative z-10 flex items-center justify-center w-full p-4`}>
      <div className={cardClass}>
        {/* Left: Form */}
        <div className={`flex-1 flex flex-col justify-center p-8 md:p-10 lg:p-12 min-w-0 relative ${formPanelClass}`}>
          <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
            <ThemeToggle />
          </div>
          {children}
        </div>

        {/* Right: Branding */}
        <div className={`w-full md:w-[44%] lg:w-[42%] flex flex-col items-center justify-center p-8 md:p-10 relative overflow-hidden ${brandPanelClass}`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full opacity-60" aria-hidden />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/10 rounded-tl-full opacity-60" aria-hidden />
          <div className="relative z-10 w-full flex flex-col items-center justify-center flex-1">
            {illustration ? (
              <img
                src={illustration}
                alt=""
                className="w-full max-w-xs md:max-w-sm h-auto object-contain flex-shrink-0"
              />
            ) : (
              <div className="w-full max-w-[200px] h-[180px] rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
                <span className="text-4xl opacity-50">🚨</span>
              </div>
            )}
          </div>
          <div className="relative z-10 mt-6 flex items-center gap-2">
            <img
              src={isLight ? logo : logoDark}
              alt="RescueLink"
              className="h-8 w-auto opacity-90"
            />
          </div>
          <p className="relative z-10 mt-3 text-center text-sm font-medium text-foreground/90 max-w-[200px]">
            {tagline}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
