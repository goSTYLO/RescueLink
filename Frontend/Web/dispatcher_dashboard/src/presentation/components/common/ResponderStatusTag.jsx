import { Tag } from 'antd';
import { responderStatusTagColor } from '@/core/utils/responderStatus';

export function ResponderStatusTag({ status, children }) {
  const label = children ?? String(status || '').trim();
  if (!label) return null;
  return (
    <Tag color={responderStatusTagColor(status)} style={{ marginInlineEnd: 0 }}>
      {label}
    </Tag>
  );
}

const PLAIN = new Set(['all', '']);

function statusPaint(option) {
  const value = option?.value;
  if (PLAIN.has(value)) return option.label;
  return <ResponderStatusTag status={value}>{option.label}</ResponderStatusTag>;
}

export const statusSelectProps = {
  optionRender: statusPaint,
  labelRender: statusPaint,
};

function paintEmbeddedStatus(option) {
  const raw = String(option?.label ?? '');
  const paren = raw.match(/^(.*?)\(([^)]+)\)(.*)$/);
  if (paren) {
    const status = paren[2].trim();
    return <span>{paren[1]}<ResponderStatusTag status={status}>{status}</ResponderStatusTag>{paren[3]}</span>;
  }
  const bullet = raw.lastIndexOf(' • ');
  if (bullet >= 0) {
    const status = raw.slice(bullet + 3);
    return <span>{raw.slice(0, bullet)} <ResponderStatusTag status={status}>{status}</ResponderStatusTag></span>;
  }
  return raw;
}

export const embeddedStatusSelectProps = {
  optionRender: paintEmbeddedStatus,
  labelRender: paintEmbeddedStatus,
};
