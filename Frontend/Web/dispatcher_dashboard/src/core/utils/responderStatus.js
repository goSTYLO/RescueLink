/** Ant Design tag color for responder availability and on-incident volunteer status. */
export function responderStatusTagColor(status) {
  const key = String(status || '').trim().toLowerCase();
  switch (key) {
    case 'available':
    case 'resolved':
      return 'green';
    case 'standby':
    case 'en route':
      return 'gold';
    case 'busy':
      return 'red';
    case 'on scene':
      return 'orange';
    case 'assigned':
      return 'blue';
    case 'off-duty':
    case 'off duty':
      return 'default';
    default:
      return 'default';
  }
}
