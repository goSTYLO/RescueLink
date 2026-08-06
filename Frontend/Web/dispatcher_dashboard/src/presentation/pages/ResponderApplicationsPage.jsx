import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { UserCheck, Eye, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { listApplications } from '@/data/api/responderApplications.api';
import { useTheme } from '@/presentation/context/ThemeContext';

export function ResponderApplicationsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [statusFilter, setStatusFilter] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listApplications({
        status: statusFilter === 'all' ? null : statusFilter,
        limit: 50,
        offset: 0,
      });
      setApplications(res.applications);
      setTotal(res.total);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
      default:
        return <Badge variant="warning" className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Review</Badge>;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Responder Applications' }]} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Responder Onboarding Applications
            </h1>
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Review credential submissions from citizens applying as volunteer first responders.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={fetchApplications} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {[
            { key: 'pending', label: 'Pending Review' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'all', label: 'All Submissions' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                statusFilter === tab.key
                  ? 'bg-red-600 text-white'
                  : isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Card */}
        <Card className="overflow-hidden">
          {error && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-red-500" />
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserCheck className="w-12 h-12 mx-auto mb-3 text-slate-400 opacity-50" />
              <p className="text-base font-semibold">No applications found</p>
              <p className="text-sm">There are no responder applications with status '{statusFilter}'.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'}`}>
                  <tr>
                    <th className="p-4 font-semibold">App ID</th>
                    <th className="p-4 font-semibold">Applicant Name</th>
                    <th className="p-4 font-semibold">Contact Info</th>
                    <th className="p-4 font-semibold">Date Submitted</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {applications.map((app) => {
                    const applicantName =
                      app.first_name && app.last_name
                        ? `${app.first_name} ${app.last_name}`
                        : app.personal_details?.full_name || `Applicant #${app.user_id}`;
                    const contact = app.phone_number || app.personal_details?.phone_number || app.email || 'N/A';
                    const submittedDate = app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'N/A';

                    return (
                      <tr key={app.id} className={`${isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/50'} transition-colors`}>
                        <td className="p-4 font-mono font-medium">#{app.id}</td>
                        <td className="p-4 font-semibold">{applicantName}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">{contact}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400">{submittedDate}</td>
                        <td className="p-4">{getStatusBadge(app.status)}</td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/responder-applications/${app.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
