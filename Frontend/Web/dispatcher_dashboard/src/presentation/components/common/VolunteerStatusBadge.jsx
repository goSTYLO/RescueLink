import { Tag } from 'antd';
import { responderStatusTagColor } from '@/core/utils/responderStatus';
import { volunteerResponderStatusLabel } from '@/core/utils/incidentDisplay';

export function VolunteerStatusBadge({ responderStatus }) {
  const label = volunteerResponderStatusLabel(responderStatus);
  if (!label) return null;

  return (
    <Tag color={responderStatusTagColor(label)} title="Volunteer responder status">
      VOLUNTEER: {label.toUpperCase()}
    </Tag>
  );
}
