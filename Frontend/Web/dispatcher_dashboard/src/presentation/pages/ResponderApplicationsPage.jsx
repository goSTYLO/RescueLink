import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Table, Tabs, Tag } from 'antd';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { UserCheck, Eye, RefreshCw } from 'lucide-react';
import { listApplications } from '@/data/api/responderApplications.api';

export function ResponderApplicationsPage() {
  const navigate = useNavigate();

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

  const statusColor = (status) => {
    if (status === 'approved') return 'green';
    if (status === 'rejected') return 'red';
    if (status === 'revoked') return 'gold';
    return 'gold';
  };

  const columns = [
    { title: 'App ID', dataIndex: 'id', render: (id) => `#${id}` },
    {
      title: 'Applicant Name',
      key: 'name',
      render: (_, app) => (
        app.first_name && app.last_name
          ? `${app.first_name} ${app.last_name}`
          : app.personal_details?.full_name || `Applicant #${app.user_id}`
      ),
    },
    {
      title: 'Contact Info',
      key: 'contact',
      render: (_, app) => app.phone_number || app.personal_details?.phone_number || app.email || 'N/A',
    },
    {
      title: 'Date Submitted',
      dataIndex: 'submitted_at',
      render: (value) => (value ? new Date(value).toLocaleString() : 'N/A'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => <Tag color={statusColor(status)}>{status || 'pending'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, app) => (
        <Button icon={<Eye size={14} />} onClick={() => navigate(`/responder-applications/${app.id}`)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Responder Applications' }]} />
        <Card
          size="small"
          style={{ marginTop: 12 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={18} />
              Responder Onboarding Applications
            </span>
          )}
          extra={(
            <Button icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />} onClick={fetchApplications} disabled={loading}>
              Refresh
            </Button>
          )}
        >
          <p style={{ marginBottom: 12 }}>Review credential submissions from citizens applying as volunteer first responders. {total} total.</p>
          <Tabs
            activeKey={statusFilter}
            onChange={setStatusFilter}
            items={[
              { key: 'pending', label: 'Pending Review' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'revoked', label: 'Revoked' },
              { key: 'all', label: 'All Submissions' },
            ]}
          />
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
          <Table
            size="small"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={applications}
            pagination={false}
            locale={{ emptyText: `No applications found for status '${statusFilter}'.` }}
          />
        </Card>
      </div>
    </Layout>
  );
}
