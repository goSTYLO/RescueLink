import { useState, useRef, useEffect } from 'react';

export function Select({ value, onValueChange, children, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      {children({ isOpen, setIsOpen, value, onValueChange })}
    </div>
  );
}

export function SelectTrigger({ children, onClick, className = '', isOpen = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 border border-[rgba(19,65,120,0.35)] rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background hover:border-secondary/50 transition-all duration-200 ${className}`}
    >
      {children}
      <svg 
        className={`w-4 h-4 text-muted flex-shrink-0 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder, value, options }) {
  if (value && options) {
    const selectedOption = options.find(opt => opt.value === value);
    return <span className="text-foreground">{selectedOption ? selectedOption.label : value}</span>;
  }
  return <span className="text-muted">{placeholder || 'Select...'}</span>;
}

export function SelectContent({ children, isOpen, className = '' }) {
  if (!isOpen) return null;
  
  return (
    <div className={`absolute z-50 w-full mt-1 bg-card border border-[rgba(19,65,120,0.35)] rounded-lg shadow-card-hover max-h-60 overflow-auto ${className}`}>
      {children}
    </div>
  );
}

export function SelectItem({ children, value, onSelect, className = '' }) {
  return (
    <div
      className={`px-3 py-2 text-sm text-foreground hover:bg-secondary/30 cursor-pointer transition-colors duration-200 ${className}`}
      onClick={() => onSelect && onSelect(value)}
    >
      {children}
    </div>
  );
}
