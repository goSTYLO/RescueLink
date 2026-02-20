import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export function Select({ value, onValueChange, children, className = '', open: controlledOpen, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledOpen !== null;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const [dropdownRect, setDropdownRect] = useState(null);
  const selectRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen || !selectRef.current) {
      setDropdownRect(null);
      return;
    }
    const el = selectRef.current;
    const rect = el.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        const content = document.querySelector('[data-select-content]');
        if (content && content.contains(event.target)) return;
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      {children({ isOpen, setIsOpen, value, onValueChange, dropdownRect })}
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

export function SelectContent({ children, isOpen, className = '', dropdownRect, portal = true }) {
  if (!isOpen) return null;

  const usePortal = portal && dropdownRect && typeof document !== 'undefined';
  const content = (
    <div
      data-select-content
      role="listbox"
      className={`bg-card border border-[rgba(19,65,120,0.35)] rounded-xl max-h-60 overflow-auto shadow-xl ${usePortal ? 'ring-1 ring-black/5' : ''} ${className}`}
      style={
        usePortal
          ? {
              position: 'fixed',
              zIndex: 9999,
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              minWidth: '8rem',
            }
          : undefined
      }
    >
      {children}
    </div>
  );

  if (usePortal) {
    return createPortal(content, document.body);
  }

  return (
    <div className="absolute z-[100] w-full mt-1">
      {content}
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
