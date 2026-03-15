import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Breadcrumb navigation component.
 * @param {Object} props
 * @param {Array<{ label: string, path?: string }>} props.items - Breadcrumb items. Last item typically has no path (current page).
 */
export function Breadcrumb({ items = [] }) {
  const navigate = useNavigate();

  if (!items.length) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted mb-3" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = !isLast && item.path;

        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted/60" aria-hidden />
            )}
            {isClickable ? (
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded px-1 -mx-1"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
