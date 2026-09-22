import { Button, Modal } from 'antd';
import { Siren, CheckCircle2 } from 'lucide-react';
import { ResponderStatusTag } from '@/presentation/components/common/ResponderStatusTag';

const TARGET_LABELS = {
  cdrrmo: 'CDRRMO / official units',
  nearby_responders: 'Nearby volunteers',
  both: 'CDRRMO + nearby volunteers',
};

export function BackupRequestDialog({
  open,
  onOpenChange,
  incidentId,
  onAcknowledge,
  onDispatch,
  onAssignTeam,
  acknowledging = false,
  target = null,
  broadcastCount = null,
  backupVolunteers = [],
  openBackupStatus = 'pending',
  canAcknowledge = false,
  canNotifyDepartment = false,
  canAssignTeam = false,
}) {
  const targetLabel = target ? (TARGET_LABELS[target] || target) : null;
  const joinedVolunteers = (backupVolunteers || []).filter((v) => v?.status !== 'declined');
  const isAcknowledged = String(openBackupStatus || '').toLowerCase() === 'acknowledged';

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isAcknowledged ? <CheckCircle2 size={18} /> : <Siren size={18} />}
          {isAcknowledged ? 'Backup acknowledged' : 'Backup requested'}
        </span>
      )}
      footer={[
        <Button key="cancel" onClick={() => onOpenChange(false)} disabled={acknowledging}>Cancel</Button>,
        canAcknowledge && !isAcknowledged ? (
          <Button key="ack" onClick={onAcknowledge} loading={acknowledging}>
            {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
          </Button>
        ) : null,
        canNotifyDepartment ? (
          <Button key="notify" type="primary" onClick={onDispatch} disabled={acknowledging}>Notify Department</Button>
        ) : null,
        canAssignTeam ? (
          <Button key="assign" type="primary" onClick={onAssignTeam} disabled={acknowledging}>Assign Team</Button>
        ) : null,
      ]}
    >
      <p>
        {isAcknowledged
          ? `Backup for Incident #${incidentId} was acknowledged. Notify a department or assign an official backup team.`
          : `A volunteer responder requested backup for Incident #${incidentId}. Acknowledge when seen, or dispatch official units.`}
      </p>
      {(targetLabel || broadcastCount != null) && (
        <p>
          {targetLabel && <span>Target: {targetLabel}. </span>}
          {broadcastCount != null && Number(broadcastCount) >= 0 && <span>Nearby alerted: {broadcastCount} volunteer(s).</span>}
        </p>
      )}
      {joinedVolunteers.length > 0 && (
        <div>
          <strong>Backup volunteers joined</strong>
          <ul>
            {joinedVolunteers.map((vol) => (
              <li key={vol.user_id || vol.name}>
                {vol.name || 'Volunteer'} — <ResponderStatusTag status={vol.responder_status || 'assigned'}>{vol.responder_status || 'Assigned'}</ResponderStatusTag>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
