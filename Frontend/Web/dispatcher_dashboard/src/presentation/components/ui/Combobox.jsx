import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

export function Combobox({
  options = [],
  value = '',
  onValueChange,
  placeholder = 'Select option',
  searchPlaceholder = 'Search...',
  className = '',
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        value: String(option?.value ?? ''),
        label: String(option?.label ?? option?.value ?? ''),
      })),
    [options]
  );

  const selectedOption = normalizedOptions.find((option) => option.value === String(value)) || null;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return normalizedOptions;
    return normalizedOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [normalizedOptions, query]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setHighlightedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const pick = (nextValue) => {
    onValueChange?.(String(nextValue));
    setIsOpen(false);
    setQuery('');
  };

  const onKeyDown = (event) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) pick(option.value);
    }
  };

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background ${
          isLight ? 'border-[rgba(19,65,120,0.35)] bg-card' : 'border-white/20 bg-card/90'
        }`}
      >
        <span className={selectedOption ? 'text-foreground truncate' : 'text-muted truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute z-[120] mt-1 w-full rounded-xl border shadow-xl overflow-hidden ${
          isLight ? 'border-[rgba(19,65,120,0.35)] bg-card' : 'border-white/20 bg-card'
        }`}>
          <div className="p-2 border-b border-border/50">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              className={`w-full px-2 py-1.5 rounded-md border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary ${
                isLight ? 'bg-background/70 border-border' : 'bg-card/80 border-white/20'
              }`}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="max-h-56 overflow-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted">No matching options</div>
            ) : (
              filteredOptions.map((option, index) => {
                const active = index === highlightedIndex;
                const selected = option.value === String(value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-secondary/25 text-foreground' : 'text-foreground hover:bg-secondary/15'
                    } ${selected ? 'font-medium' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => pick(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
