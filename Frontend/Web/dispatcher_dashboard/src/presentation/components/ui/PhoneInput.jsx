import { Input } from '@/presentation/components/ui/Input';
import { sanitizePhoneInput } from '@/core/utils/inputUtils';

export function PhoneInput({ value, onChange, className = '', error = false, ...props }) {
  return (
    <Input
      inputMode="numeric"
      maxLength={11}
      placeholder="09171234567"
      value={value ?? ''}
      onChange={(e) => onChange?.({ ...e, target: { ...e.target, value: sanitizePhoneInput(e.target.value) } })}
      className={className}
      error={error}
      {...props}
    />
  );
}
