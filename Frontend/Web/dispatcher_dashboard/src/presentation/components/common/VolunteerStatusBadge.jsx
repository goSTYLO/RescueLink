import { Badge } from '@/presentation/components/ui/Badge';
import {
  getVolunteerStatusBadgeClass,
  volunteerResponderStatusLabel,
} from '@/core/utils/incidentDisplay';

export function VolunteerStatusBadge({ responderStatus, className = '' }) {
  const label = volunteerResponderStatusLabel(responderStatus);
  if (!label) return null;

  return (
    <Badge
      className={`${getVolunteerStatusBadgeClass(label)} rounded-lg px-2 py-0.5 text-[11px] font-semibold w-fit ${className}`}
      title="Volunteer responder status"
    >
      VOLUNTEER: {label.toUpperCase()}
    </Badge>
  );
}
