import { User } from 'lucide-react';

export function profileInitials(firstName, lastName) {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();
  if (!first && !last) return '';
  const a = first ? first[0].toUpperCase() : '';
  const b = last ? last[0].toUpperCase() : '';
  return `${a}${b}`;
}

const SIZE = {
  sm: { box: 'w-9 h-9', text: 'text-sm', icon: 'w-5 h-5' },
  md: { box: 'w-16 h-16', text: 'text-xl', icon: 'w-8 h-8' },
  lg: { box: 'w-20 h-20', text: 'text-2xl', icon: 'w-10 h-10' },
};

export function ProfileAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 'md',
  onClick,
  className = '',
  rounded = 'rounded-full',
}) {
  const initials = profileInitials(firstName, lastName);
  const dim = SIZE[size] || SIZE.md;
  const interactive = typeof onClick === 'function';

  const inner = photoUrl ? (
    <img
      src={photoUrl}
      alt=""
      className={`${dim.box} ${rounded} object-cover`}
    />
  ) : initials ? (
    <span
      className={`${dim.box} ${rounded} flex items-center justify-center font-semibold bg-primary/15 text-primary ${dim.text}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  ) : (
    <span
      className={`${dim.box} ${rounded} flex items-center justify-center bg-primary text-white`}
      aria-hidden="true"
    >
      <User className={dim.icon} strokeWidth={2} />
    </span>
  );

  if (!interactive) {
    return <span className={`inline-flex flex-shrink-0 ${className}`}>{inner}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${rounded} ${className}`}
      aria-label="Change profile photo"
    >
      {inner}
    </button>
  );
}
