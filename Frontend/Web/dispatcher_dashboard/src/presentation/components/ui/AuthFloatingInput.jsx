import { useState, useId } from 'react';

/**
 * Auth input with floating label: label sits inside the field, then animates up to the top border when focused or filled.
 * Icons on the right. Focus uses secondary (blue), not primary (red).
 */
export function AuthFloatingInput({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  type = 'text',
  placeholder,
  leftIcon,
  rightIcon,
  rightAction,
  error,
  disabled,
  className = '',
  inputClassName = '',
  id: idProp,
  ...rest
}) {
  const id = idProp || useId();
  const [focused, setFocused] = useState(false);
  const hasValue = value != null && String(value).length > 0;
  const floating = focused || hasValue;

  const wrapperClass =
    'relative flex items-center rounded-[10px] border border-border bg-card text-foreground transition-all duration-200 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 focus-within:ring-offset-2 focus-within:ring-offset-background outline-none';

  const inputPaddingLeft = leftIcon ? 'pl-10' : 'pl-4';
  const inputPaddingRight = rightIcon && rightAction ? 'pr-20' : rightIcon || rightAction ? 'pr-12' : 'pr-4';

  return (
    <div className={className}>
      <div className={wrapperClass}>
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex-shrink-0 text-muted pointer-events-none z-10">
            {leftIcon}
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          disabled={disabled}
          placeholder={floating ? placeholder : undefined}
          className={[
            'w-full bg-transparent text-foreground placeholder-muted outline-none transition-colors duration-200 rounded-[10px]',
            inputPaddingLeft,
            inputPaddingRight,
            'pt-5 pb-3',
            'text-base',
            inputClassName,
          ].join(' ')}
          {...rest}
        />
        <label
          htmlFor={id}
          className={[
            'absolute left-4 -translate-y-1/2 pointer-events-none origin-left text-muted',
            'transition-all duration-300 ease-out',
            floating
              ? 'top-0 text-xs font-medium py-0 px-1'
              : 'top-1/2 text-base',
            leftIcon && 'left-10',
          ].join(' ')}
          style={
            floating
              ? { background: 'var(--color-card)' }
              : {}
          }
        >
          {label}
        </label>
        {rightIcon && (
          <div
            className={[
              'absolute top-1/2 -translate-y-1/2 flex-shrink-0 text-muted pointer-events-none z-10',
              rightAction ? 'right-11' : 'right-3',
            ].join(' ')}
          >
            {rightIcon}
          </div>
        )}
        {rightAction && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0 z-10">
            {rightAction}
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 dark:border-red-500/50 dark:bg-red-950/50 dark:text-red-300">
          <svg className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
