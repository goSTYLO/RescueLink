/** Compact action buttons + row click-to-view for dashboard incident tables. */

export const INCIDENT_ACTION_BTN_PROPS = {
  size: 'small',
  style: { paddingInline: 6, height: 26, fontSize: 12 },
};

const ROW_CLICK_IGNORE =
  'button, a, input, textarea, select, .ant-select, .ant-switch, label.ant-switch';

export function incidentTableRowClickProps(record, navigate, idField = 'id') {
  const id = record?.[idField];
  if (id == null || id === '') return {};
  return {
    onClick: (e) => {
      if (e.target.closest(ROW_CLICK_IGNORE)) return;
      navigate(`/incidents/${id}`);
    },
    style: { cursor: 'pointer' },
  };
}
