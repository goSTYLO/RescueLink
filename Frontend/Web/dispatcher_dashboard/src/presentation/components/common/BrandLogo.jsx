import logoIcon from '@/presentation/assets/logo_icon.png';
import { useTheme } from '@/presentation/context/ThemeContext';

export function BrandLogo({ iconOnly = false, size = 'md', className = '' }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Standard sleek logo size configurations with balanced shield icon proportions
  const sizes = {
    sm: { icon: 'h-7 w-7', title: 'text-base', sub: 'text-[10px]' },
    md: { icon: 'h-9 w-9', title: 'text-xl', sub: 'text-[11px]' },
    lg: { icon: 'h-11 w-11', title: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 'h-13 w-13', title: 'text-3xl', sub: 'text-xs' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src={logoIcon}
        alt="RescueLink Icon"
        className={`${s.icon} object-contain flex-shrink-0`}
      />
      {!iconOnly && (
        <div className="flex flex-col justify-center leading-none">
          <div className={`font-bold tracking-tight ${s.title} ${isLight ? 'text-gray-900' : 'text-white'}`}>
            Rescue<span className="text-primary">Link</span>
          </div>
          <span className={`font-medium tracking-wide mt-1 ${s.sub} ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            Your Safety Companion
          </span>
        </div>
      )}
    </div>
  );
}
