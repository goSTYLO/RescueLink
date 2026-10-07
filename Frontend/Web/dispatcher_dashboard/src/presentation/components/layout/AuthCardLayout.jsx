import { BrandLogo } from '@/presentation/components/common/BrandLogo';
import { ThemeToggle } from '@/presentation/components/common/ThemeToggle.jsx';
import { AuthPageBackground } from '@/presentation/components/layout/AuthPageBackground.jsx';

/**
 * Auth card layout: centered card with form (left) and branding panel (right).
 * Glassmorphism + neumorphism, theme-aware. Theme toggle in top-right of form panel.
 */
export function AuthCardLayout({ children, illustration, tagline = 'One Tap. One Report. Faster Response.' }) {
  const cardClass = [
    'w-full max-w-5xl rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[520px] max-h-[90vh]',
    'transition-all duration-300',
    'glass border',
    'bg-card/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] border-gray-200/80',
    'dark:bg-card/90 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] dark:border-white/10',
    'neumorphic-light dark:neumorphic-dark',
  ].join(' ');

  const formPanelClass = 'auth-form-panel bg-card dark:bg-card';
  const brandPanelClass = [
    'border-l',
    'bg-gradient-to-br from-primary/25 via-primary/15 to-secondary/30 border-gray-200/80',
    'dark:from-primary/25 dark:via-primary/15 dark:to-secondary/30 dark:border-white/10',
  ].join(' ');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <AuthPageBackground />
      <div
        className="absolute inset-0 bg-background/25 pointer-events-none dark:bg-background/70"
        aria-hidden
      />
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
          <div className="relative z-10 mt-6 flex items-center justify-center">
            <BrandLogo size="lg" />
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
