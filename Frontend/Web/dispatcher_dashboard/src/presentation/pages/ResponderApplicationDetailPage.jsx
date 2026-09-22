import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { CheckCircle, XCircle, Clock, FileText, ArrowLeft, Download, ShieldCheck, AlertCircle, Eye, ShieldOff } from 'lucide-react';
import { alertUser } from '@/presentation/feedback/alertUser';
import { getApplicationById, updateApplicationStatus, revokeResponderRole, getDocumentUrl } from '@/data/api/responderApplications.api';
import { useTheme } from '@/presentation/context/ThemeContext';
import { isSuperAdmin } from '@/core/constants';
import { Button, Card, Form, Input, Modal, Select, Tag } from 'antd';
import { REVOKE_REASONS } from '@/core/constants/responderRevokeReasons';

function isImageFile(filepath) {
  if (!filepath) return false;
  const ext = filepath.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
}

const FIELD_TAG_MAP = {
  medical: { label: 'Medical / First Aid', color: 'green' },
  fire: { label: 'Fire Response', color: 'red' },
  police: { label: 'Crime / Law Enforcement', color: 'blue' },
  disaster: { label: 'Disaster & Rescue', color: 'gold' },
};

const STATUS_TAG = {
  approved: { color: 'green', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Approved' },
  rejected: { color: 'red', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Rejected' },
  revoked: { color: 'gold', icon: <ShieldOff className="w-3.5 h-3.5" />, label: 'Revoked' },
  pending: { color: 'gold', icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending Review' },
};

export function ResponderApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  // In-page Modal Document Preview state (no new tab!)
  const [previewDoc, setPreviewDoc] = useState(null); // { url, title, isImage }

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplicationById(id);
      setApplication(data);
      if (data.notes) setReviewNotes(data.notes);
    } catch (err) {
      setError(err.message || 'Failed to load application details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleDecision = async (status) => {
    const proceed = await alertUser({
      title: 'Update application?',
      text: `Are you sure you want to mark this application as ${status.toUpperCase()}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'Cancel',
    });
    if (!proceed.isConfirmed) return;

    setSubmitting(true);
    setError(null);
    setActionSuccess(null);
    try {
      const updated = await updateApplicationStatus(id, {
        status,
        notes: reviewNotes,
      });
      setApplication(updated.application);
      setActionSuccess(`Application status successfully updated to '${status}'.`);
    } catch (err) {
      setError(err.message || 'Failed to update application status.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRevoke = async (values) => {
    const reason = String(values.reason || '').trim();
    const reasonOther = String(values.reason_other || '').trim();
    if (reason === 'other' && reasonOther.length < 10) {
      alertUser({
        icon: 'warning',
        title: 'Details required',
        text: 'Please provide details (minimum 10 characters) for Other.',
      });
      return;
    }
    setSubmitting(true);
    setError(null);
    setActionSuccess(null);
    try {
      const updated = await revokeResponderRole(id, {
        reason,
        reason_other: reason === 'other' ? reasonOther : undefined,
        admin_password: values.admin_password,
      });
      setApplication(updated.application);
      setRevokeOpen(false);
      setActionSuccess('Volunteer first responder role revoked successfully.');
    } catch (err) {
      alertUser({
        icon: 'error',
        title: 'Revoke failed',
        text: err.message || 'Could not revoke responder role.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openPreview = (filepath, title) => {
    const url = getDocumentUrl(id, filepath);
    const isImage = isImageFile(filepath);
    setPreviewDoc({ url, title, isImage, filepath });
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-12 text-center text-slate-500">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
          Loading application detail...
        </div>
      </Layout>
    );
  }

  if (error || !application) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Button type="text" onClick={() => navigate('/responder-applications')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Applications
          </Button>
          <Card size="small">
            <div className="p-2 text-center text-red-500">
              <AlertCircle className="w-10 h-10 mx-auto mb-2" />
              <p className="font-semibold">{error || 'Application not found'}</p>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const applicantName =
    application.first_name && application.last_name
      ? `${application.first_name} ${application.last_name}`
      : application.personal_details?.full_name || `Applicant #${application.user_id}`;
  const details = application.personal_details || {};
  const statusMeta = STATUS_TAG[application.status] || STATUS_TAG.pending;

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb
          items={[
            { label: 'Home', path: '/dashboard' },
            { label: 'Responder Applications', path: '/responder-applications' },
            { label: `Application #${application.id}` },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Button type="text" onClick={() => navigate('/responder-applications')} className="mb-2 px-0">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to List
            </Button>
            <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Application #{application.id} — {applicantName}
            </h1>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Submitted on {new Date(application.submitted_at).toLocaleString()}
            </p>
          </div>

          <Tag color={statusMeta.color} icon={statusMeta.icon} style={{ fontSize: 13, padding: '4px 10px' }}>
            {statusMeta.label}
          </Tag>
        </div>

        {actionSuccess && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {actionSuccess}
          </div>
        )}

        {/* Applicant Personal Details */}
        <Card
          size="small"
          title={(
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-500" /> Personal & Contact Information
            </span>
          )}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="block text-slate-500 font-medium">Full Name</span>
              <span className="font-semibold">{applicantName}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">User Account ID</span>
              <span className="font-mono">#{application.user_id}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Contact Phone</span>
              <span className="font-semibold">{application.phone_number || details.phone_number || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Email Address</span>
              <span>{application.email || details.email || 'N/A'}</span>
            </div>
            <div className="md:col-span-2">
              <span className="block text-slate-500 font-medium">Address</span>
              <span>{details.address || application.address || 'N/A'}</span>
            </div>
            <div className="md:col-span-2">
              <span className="block text-slate-500 font-medium mb-1.5">Applied Specialization Field(s)</span>
              {Array.isArray(application.specialization_fields) && application.specialization_fields.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {application.specialization_fields.map((field) => {
                    const normalized = field.toLowerCase();
                    const tagMeta = FIELD_TAG_MAP[normalized] || { label: field.toUpperCase(), color: 'default' };
                    return (
                      <Tag key={field} color={tagMeta.color}>
                        {tagMeta.label}
                      </Tag>
                    );
                  })}
                </div>
              ) : (
                <span className="text-slate-400 italic">General Volunteer (All Fields)</span>
              )}
            </div>
          </div>

          <hr className="my-6 border-slate-200 dark:border-slate-800" />

          <h3 className="text-md font-bold mb-3">Emergency Contact Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <span className="block text-slate-500 font-medium">Contact Name</span>
              <span className="font-semibold">{details.emergency_contact_name || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Contact Phone</span>
              <span className="font-semibold">{details.emergency_contact_phone || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Relationship</span>
              <span>{details.emergency_contact_relationship || 'N/A'}</span>
            </div>
          </div>
        </Card>

        {/* Uploaded Documents & Credentials with In-Page Previews */}
        <Card
          size="small"
          title={(
            <span className="inline-flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" /> Uploaded Credentials
            </span>
          )}
        >
          <div className="space-y-6">
            {/* Government ID */}
            <div className="p-4 border rounded-xl border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider block">Government ID (Required)</span>
                  <span className="font-semibold text-sm">{application.gov_id_path?.split('/').pop() || 'No ID file uploaded'}</span>
                </div>
                {application.gov_id_path && (
                  <Button onClick={() => openPreview(application.gov_id_path, 'Government ID')} icon={<Eye className="w-4 h-4 text-red-500" />}>
                    Preview ID
                  </Button>
                )}
              </div>

              {/* Inline Thumbnail if Image */}
              {application.gov_id_path && isImageFile(application.gov_id_path) && (
                <div
                  onClick={() => openPreview(application.gov_id_path, 'Government ID')}
                  className="relative group w-48 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 cursor-pointer shadow-sm hover:shadow-md transition-all"
                >
                  <img
                    src={getDocumentUrl(application.id, application.gov_id_path)}
                    alt="Gov ID Preview"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <Eye className="w-4 h-4" /> View Full
                  </div>
                </div>
              )}
            </div>

            {/* Per-Field Proof of Qualification */}
            {application.field_proof_paths && Object.keys(application.field_proof_paths).length > 0 ? (
              <div className="p-4 border rounded-xl border-slate-200 dark:border-slate-800 space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Proof of Qualification per Specialization Field
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(application.field_proof_paths).map(([field, proofPath]) => {
                    const normalized = field.toLowerCase();
                    const tagMeta = FIELD_TAG_MAP[normalized] || { label: field.toUpperCase(), color: 'default' };
                    const filename = proofPath.split('/').pop();
                    const isImg = isImageFile(proofPath);
                    const docUrl = getDocumentUrl(application.id, proofPath);

                    return (
                      <div
                        key={field}
                        className="p-3.5 border rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Tag color={tagMeta.color}>{tagMeta.label}</Tag>
                          <Button
                            type="text"
                            onClick={() => openPreview(proofPath, `Proof for ${tagMeta.label}`)}
                          >
                            <Eye className="w-4 h-4 mr-1 text-red-500" /> View Proof
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 overflow-hidden">
                          {isImg ? (
                            <img
                              src={docUrl}
                              alt={filename}
                              onClick={() => openPreview(proofPath, `Proof for ${tagMeta.label}`)}
                              className="w-16 h-16 rounded-lg object-cover border flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-8 h-8" />
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-300 block truncate" title={filename}>
                              {filename}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">Proof of Qualification</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Legacy Fallback: General Certificates */
              <div className="p-4 border rounded-xl border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Training Certificates & Proofs</span>
                {(!application.certificate_paths || application.certificate_paths.length === 0) ? (
                  <p className="text-sm text-slate-400 italic">No certificates attached.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {application.certificate_paths.map((certPath, idx) => {
                      const filename = certPath.split('/').pop();
                      const isImg = isImageFile(certPath);
                      const docUrl = getDocumentUrl(application.id, certPath);

                      return (
                        <div key={idx} className="p-3 border rounded-lg border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                            {isImg ? (
                              <img
                                src={docUrl}
                                alt={filename}
                                onClick={() => openPreview(certPath, `Certificate ${idx + 1}`)}
                                className="w-12 h-12 rounded object-cover border flex-shrink-0 cursor-pointer hover:opacity-80"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-6 h-6" />
                              </div>
                            )}
                            <span className="font-mono text-xs truncate" title={filename}>{filename}</span>
                          </div>

                          <Button
                            type="text"
                            onClick={() => openPreview(certPath, `Certificate ${idx + 1}`)}
                            className="flex-shrink-0"
                          >
                            <Eye className="w-4 h-4 mr-1 text-blue-500" /> View
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Other Documents */}
            <div className="p-4 border rounded-xl border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Other Supporting Documents</span>
              {(!application.other_doc_paths || application.other_doc_paths.length === 0) ? (
                <p className="text-sm text-slate-400 italic">No other supporting documents attached.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {application.other_doc_paths.map((docPath, idx) => {
                    const filename = docPath.split('/').pop();
                    const isImg = isImageFile(docPath);
                    const docUrl = getDocumentUrl(application.id, docPath);

                    return (
                      <div key={idx} className="p-3 border rounded-lg border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {isImg ? (
                            <img
                              src={docUrl}
                              alt={filename}
                              onClick={() => openPreview(docPath, `Document ${idx + 1}`)}
                              className="w-12 h-12 rounded object-cover border flex-shrink-0 cursor-pointer hover:opacity-80"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}
                          <span className="font-mono text-xs truncate" title={filename}>{filename}</span>
                        </div>

                        <Button
                          type="text"
                          onClick={() => openPreview(docPath, `Document ${idx + 1}`)}
                          className="flex-shrink-0"
                        >
                          <Eye className="w-4 h-4 mr-1 text-purple-500" /> View
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Dispatcher Review & Actions */}
        <Card size="small" title="Dispatcher Review & Notes">
          {application.status === 'pending' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reviewer Notes (Provided to applicant for transparency upon rejection)
                </label>
                <Input.TextArea
                  rows={4}
                  maxLength={500}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter review findings, approval comments, or rejection details..."
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
                <Button
                  danger
                  onClick={() => handleDecision('rejected')}
                  disabled={submitting}
                  icon={<XCircle className="w-4 h-4" />}
                >
                  Reject Application
                </Button>

                <Button
                  type="primary"
                  onClick={() => handleDecision('approved')}
                  disabled={submitting}
                  style={{ background: '#16a34a' }}
                  icon={<CheckCircle className="w-4 h-4" />}
                >
                  Approve & Promote to Responder
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Review Outcome</span>
                <Tag
                  color={
                    application.status === 'approved'
                      ? 'green'
                      : application.status === 'revoked'
                        ? 'gold'
                        : 'red'
                  }
                >
                  {application.status === 'approved'
                    ? 'Approved'
                    : application.status === 'revoked'
                      ? 'Revoked'
                      : 'Rejected'}
                </Tag>
              </div>

              {application.revoked_at && (
                <div className="text-xs text-slate-400">
                  Revoked on {new Date(application.revoked_at).toLocaleString()}
                </div>
              )}

              {application.reviewed_at && application.status !== 'revoked' && (
                <div className="text-xs text-slate-400">
                  Reviewed on {new Date(application.reviewed_at).toLocaleString()}
                </div>
              )}

              {application.notes ? (
                <div>
                  <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {application.status === 'revoked' ? 'Revoke Reason' : 'Reviewer Notes'}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    {application.notes}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No reviewer notes recorded.</p>
              )}

              {isSuperAdmin(currentUser.role) && application.status === 'approved' && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    danger
                    onClick={() => setRevokeOpen(true)}
                    disabled={submitting}
                    icon={<ShieldOff className="w-4 h-4" />}
                  >
                    Revoke Responder Role
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    Requires your admin password. Blocked if the volunteer has active incident assignments.
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        <Modal
          title="Revoke responder role?"
          open={revokeOpen}
          onCancel={() => setRevokeOpen(false)}
          okText="Revoke role"
          okButtonProps={{ danger: true, htmlType: 'submit', form: 'revoke-role-form' }}
          confirmLoading={submitting}
          destroyOnClose
        >
          <p style={{ marginBottom: 12 }}>
            This will immediately remove Volunteer First Responder access for this citizen.
            They can submit a new application afterward.
          </p>
          <Form
            id="revoke-role-form"
            layout="vertical"
            onFinish={submitRevoke}
            requiredMark
          >
            <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Please select a reason.' }]}>
              <Select
                options={REVOKE_REASONS}
                placeholder="Select a reason"
              />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, next) => prev.reason !== next.reason}>
              {({ getFieldValue }) => getFieldValue('reason') === 'other' ? (
                <Form.Item
                  name="reason_other"
                  label="Details"
                  rules={[{ required: true, min: 10, message: 'Please provide details (minimum 10 characters) for Other.' }]}
                >
                  <Input.TextArea rows={3} placeholder="Describe the reason (min 10 characters)" />
                </Form.Item>
              ) : null}
            </Form.Item>
            <Form.Item name="admin_password" label="Your admin password" rules={[{ required: true, message: 'Admin password is required.' }]}>
              <Input.Password placeholder="Enter your password to confirm" />
            </Form.Item>
          </Form>
        </Modal>

        {/* In-Page Interactive Document Preview Modal */}
        <Modal
          title={(
            <span className="inline-flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" />
              {previewDoc?.title}
            </span>
          )}
          open={Boolean(previewDoc)}
          onCancel={() => setPreviewDoc(null)}
          width={896}
          footer={(
            <Button
              href={previewDoc?.url}
              download
              icon={<Download className="w-4 h-4" />}
            >
              Download
            </Button>
          )}
          destroyOnClose
          styles={{ body: { maxHeight: '70vh', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
        >
          {previewDoc?.isImage ? (
            <img
              src={previewDoc.url}
              alt={previewDoc.title}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
            />
          ) : previewDoc ? (
            <iframe
              src={previewDoc.url}
              title={previewDoc.title}
              className="w-full h-[70vh] rounded-lg border-0"
            />
          ) : null}
        </Modal>
      </div>
    </Layout>
  );
}
