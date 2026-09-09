import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { CheckCircle, XCircle, Clock, FileText, ArrowLeft, Download, ShieldCheck, AlertCircle, Eye, X, Image as ImageIcon, ShieldOff } from 'lucide-react';
import Swal from 'sweetalert2';
import { getApplicationById, updateApplicationStatus, revokeResponderRole, getDocumentUrl } from '@/data/api/responderApplications.api';
import { useTheme } from '@/presentation/context/ThemeContext';
import { isSuperAdmin } from '@/core/constants';
import { REVOKE_REASONS, SWAL_PRIMARY } from '@/core/constants/responderRevokeReasons';
import { attachPasswordToggle } from '@/core/utils/inputUtils';

function isImageFile(filepath) {
  if (!filepath) return false;
  const ext = filepath.split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
}

const FIELD_BADGE_MAP = {
  medical: { label: 'Medical / First Aid', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  fire: { label: 'Fire Response', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  police: { label: 'Crime / Law Enforcement', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  disaster: { label: 'Disaster & Rescue', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
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
    if (!window.confirm(`Are you sure you want to mark this application as ${status.toUpperCase()}?`)) {
      return;
    }

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

  const handleRevoke = async () => {
    const reasonOptions = REVOKE_REASONS.map(
      (r) => `<option value="${r.value}">${r.label}</option>`
    ).join('');

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Revoke responder role?',
      html: `
        <p class="text-sm text-left mb-3" style="color:#64748b">
          This will immediately remove <strong>Volunteer First Responder</strong> access for this citizen.
          They can submit a new application afterward.
        </p>
        <label class="block text-sm font-semibold text-left mb-1" for="swal-revoke-reason">Reason</label>
        <select id="swal-revoke-reason" class="swal2-input" style="width:100%;margin:0 0 12px;padding:8px">
          <option value="">Select a reason…</option>
          ${reasonOptions}
        </select>
        <div id="swal-revoke-other-wrap" style="display:none">
          <label class="block text-sm font-semibold text-left mb-1" for="swal-revoke-other">Details (required for Other)</label>
          <textarea id="swal-revoke-other" class="swal2-textarea" placeholder="Describe the reason (min 10 characters)" rows="3" style="width:100%"></textarea>
        </div>
        <label class="block text-sm font-semibold text-left mb-1 mt-3" for="swal-admin-password">Your admin password</label>
        <input id="swal-admin-password" type="password" class="swal2-input" placeholder="Enter your password to confirm" style="width:100%;margin:0" />
      `,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Revoke role',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      didOpen: () => {
        const reasonSelect = document.getElementById('swal-revoke-reason');
        const otherWrap = document.getElementById('swal-revoke-other-wrap');
        reasonSelect?.addEventListener('change', () => {
          if (otherWrap) {
            otherWrap.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
          }
        });
        attachPasswordToggle('swal-admin-password');
      },
      preConfirm: () => {
        const reason = document.getElementById('swal-revoke-reason')?.value?.trim();
        const reasonOther = document.getElementById('swal-revoke-other')?.value?.trim();
        const adminPassword = document.getElementById('swal-admin-password')?.value;

        if (!reason) {
          Swal.showValidationMessage('Please select a reason.');
          return false;
        }
        if (reason === 'other' && (!reasonOther || reasonOther.length < 10)) {
          Swal.showValidationMessage('Please provide details (minimum 10 characters) for Other.');
          return false;
        }
        if (!adminPassword) {
          Swal.showValidationMessage('Admin password is required.');
          return false;
        }
        return {
          reason,
          reason_other: reason === 'other' ? reasonOther : undefined,
          admin_password: adminPassword,
        };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    setSubmitting(true);
    setError(null);
    setActionSuccess(null);
    try {
      const updated = await revokeResponderRole(id, result.value);
      setApplication(updated.application);
      setActionSuccess('Volunteer first responder role revoked successfully.');
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Revoke failed',
        text: err.message || 'Could not revoke responder role.',
        confirmButtonColor: SWAL_PRIMARY,
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
          <Button variant="ghost" onClick={() => navigate('/responder-applications')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Applications
          </Button>
          <Card className="p-6 text-center text-red-500">
            <AlertCircle className="w-10 h-10 mx-auto mb-2" />
            <p className="font-semibold">{error || 'Application not found'}</p>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/responder-applications')} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to List
            </Button>
            <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Application #{application.id} — {applicantName}
            </h1>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Submitted on {new Date(application.submitted_at).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {application.status === 'approved' && (
              <Badge variant="success" className="px-3 py-1.5 text-sm flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Approved
              </Badge>
            )}
            {application.status === 'rejected' && (
              <Badge variant="danger" className="px-3 py-1.5 text-sm flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> Rejected
              </Badge>
            )}
            {application.status === 'revoked' && (
              <Badge variant="warning" className="px-3 py-1.5 text-sm flex items-center gap-1.5">
                <ShieldOff className="w-4 h-4" /> Revoked
              </Badge>
            )}
            {application.status === 'pending' && (
              <Badge variant="warning" className="px-3 py-1.5 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Pending Review
              </Badge>
            )}
          </div>
        </div>

        {actionSuccess && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {actionSuccess}
          </div>
        )}

        {/* Applicant Personal Details */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-500" /> Personal & Contact Information
          </h2>

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
                    const badgeMeta = FIELD_BADGE_MAP[normalized] || { label: field.toUpperCase(), color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
                    return (
                      <span
                        key={field}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${badgeMeta.color}`}
                      >
                        {badgeMeta.label}
                      </span>
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
        <Card className="p-6 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-500" /> Uploaded Credentials
          </h2>

          <div className="space-y-6">
            {/* Government ID */}
            <div className="p-4 border rounded-xl border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider block">Government ID (Required)</span>
                  <span className="font-semibold text-sm">{application.gov_id_path?.split('/').pop() || 'No ID file uploaded'}</span>
                </div>
                {application.gov_id_path && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPreview(application.gov_id_path, 'Government ID')}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4 text-red-500" /> Preview ID
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
                    const badgeMeta = FIELD_BADGE_MAP[normalized] || { label: field.toUpperCase(), color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
                    const filename = proofPath.split('/').pop();
                    const isImg = isImageFile(proofPath);
                    const docUrl = getDocumentUrl(application.id, proofPath);

                    return (
                      <div
                        key={field}
                        className="p-3.5 border rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${badgeMeta.color}`}>
                            {badgeMeta.label}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPreview(proofPath, `Proof for ${badgeMeta.label}`)}
                            className="text-xs font-semibold"
                          >
                            <Eye className="w-4 h-4 mr-1 text-red-500" /> View Proof
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 overflow-hidden">
                          {isImg ? (
                            <img
                              src={docUrl}
                              alt={filename}
                              onClick={() => openPreview(proofPath, `Proof for ${badgeMeta.label}`)}
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
                            size="sm"
                            variant="ghost"
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
                          size="sm"
                          variant="ghost"
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
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold">Dispatcher Review & Notes</h2>

          {application.status === 'pending' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reviewer Notes (Provided to applicant for transparency upon rejection)
                </label>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter review findings, approval comments, or rejection details..."
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <Button
                  variant="danger"
                  onClick={() => handleDecision('rejected')}
                  disabled={submitting}
                  className="px-6"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject Application
                </Button>

                <Button
                  variant="primary"
                  onClick={() => handleDecision('approved')}
                  disabled={submitting}
                  className="px-6 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve & Promote to Responder
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Review Outcome</span>
                <Badge
                  variant={
                    application.status === 'approved'
                      ? 'success'
                      : application.status === 'revoked'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {application.status === 'approved'
                    ? 'Approved'
                    : application.status === 'revoked'
                      ? 'Revoked'
                      : 'Rejected'}
                </Badge>
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
                    variant="danger"
                    onClick={handleRevoke}
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
                    <ShieldOff className="w-4 h-4 mr-2" />
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

        {/* In-Page Interactive Document Preview Modal (No New Tabs!) */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-base">{previewDoc.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewDoc.url}
                    download
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-slate-950/20">
                {previewDoc.isImage ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full h-[70vh] rounded-lg border-0"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
