import { Space, Tag } from 'antd';
import { kpiTagColor } from '@/presentation/components/insights/insightsColors';

const KPI_ITEMS = [
  { id: 'total_assigned', label: 'Total Assigned', key: 'totalAssigned' },
  { id: 'awaiting_action', label: 'Awaiting Action', key: 'awaitingAction' },
  { id: 'in_progress', label: 'In Progress', key: 'inProgress' },
  { id: 'resolved', label: 'Resolved', key: 'resolved' },
];

export function IncidentOverviewKpiTags({ counts = {} }) {
  return (
    <Space wrap size={[4, 4]}>
      {KPI_ITEMS.map(({ id, label, key }) => (
        <Tag key={id} color={kpiTagColor(id)}>
          {label}: {counts[key] ?? 0}
        </Tag>
      ))}
    </Space>
  );
}
