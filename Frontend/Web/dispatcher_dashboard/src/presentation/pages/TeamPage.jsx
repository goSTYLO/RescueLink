import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/presentation/components/layout/Layout';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { Button, Card, Input, Modal, Pagination, Select, Space, Table, Tag } from 'antd';
import { Plus, Edit, Ban, Users, Eye, EyeOff } from 'lucide-react';
import { alertUser } from '@/presentation/feedback/alertUser';
import { listUsers, createUser, updateUserRole, deactivateUser } from '@/data/api/adminUsers.api';
import { getDepartments } from '@/data/api/departments.api';
import { ROLES, normalizeRole } from '@/core/constants';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { PhoneInput } from '@/presentation/components/ui/PhoneInput';
import { isValidLocalPhone } from '@/core/utils/inputUtils';

const SWAL_PRIMARY = '#134178';
const ROWS_PER_PAGE = 10;

// Frontend display value -> backend API value
const FIELD_RESPONDER = 'field-responder';

const ROLE_TO_BACKEND = {
  [ROLES.SUPER_ADMIN]: 'admin',
  [ROLES.DISPATCHER]: 'dispatcher',
  [ROLES.DEPARTMENT_ADMIN]: 'department-admin',
  [ROLES.DEPARTMENT_HEAD]: 'department-head',
  [ROLES.PERSONNEL]: 'user',
  [FIELD_RESPONDER]: 'responder',
};

const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin', backend: 'admin' },
  { value: ROLES.DISPATCHER, label: 'Dispatcher', backend: 'dispatcher' },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Department Admin', backend: 'department-admin' },
  { value: ROLES.DEPARTMENT_HEAD, label: 'Department Head', backend: 'department-head' },
  { value: ROLES.PERSONNEL, label: 'Personnel', backend: 'user' },
  { value: FIELD_RESPONDER, label: 'Field Responder', backend: 'responder' },
];

const ROLE_OPTIONS_FOR_ADD = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin', backend: 'admin' },
  { value: ROLES.DISPATCHER, label: 'Dispatcher', backend: 'dispatcher' },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Department Admin', backend: 'department-admin' },
  { value: FIELD_RESPONDER, label: 'Field Responder', backend: 'responder' },
];

function roleToBackend(frontendRole) {
  return ROLE_TO_BACKEND[frontendRole] ?? frontendRole;
}

function roleToLabel(backendRole) {
  const r = String(backendRole || '').toLowerCase();
  const opt = ROLE_OPTIONS.find((o) => o.backend === r);
  return opt ? opt.label : backendRole || '—';
}

function roleTagColor(backendRole) {
  const r = String(backendRole || '').toLowerCase();
  if (r === 'admin') return 'blue';
  if (r === 'dispatcher') return 'cyan';
  if (r === 'department-admin') return 'geekblue';
  if (r === 'department-head') return 'gold';
  return 'default';
}

export function TeamPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const role = normalizeRole(user.role || '');

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: ROWS_PER_PAGE, total: 0, pages: 1 });
  const [departments, setDepartments] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: ROLES.PERSONNEL,
    department_id: '',
    phone_number: '',
  });
  const [savingUser, setSavingUser] = useState(false);
  const [deactivatingUserId, setDeactivatingUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async (page = pagination.page) => {
    setLoadingUsers(true);
    try {
      const res = await listUsers({ page, limit: ROWS_PER_PAGE, exclude_role: 'user,responder' });
      setUsers(res.users || []);
      setPagination((prev) => ({
        ...prev,
        page: Number(res.pagination?.page) || page,
        limit: Number(res.pagination?.limit) || ROWS_PER_PAGE,
        total: Number(res.pagination?.total) || 0,
        pages: Math.max(1, Number(res.pagination?.pages) || 1),
      }));
    } catch (err) {
      setUsers([]);
      alertUser({ icon: 'error', title: 'Failed to load users', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const rows = await getDepartments();
      setDepartments(Array.isArray(rows) ? rows : []);
    } catch {
      setDepartments([]);
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const userTotalPages = pagination.pages;
  const currentPage = Math.min(Math.max(1, pagination.page), userTotalPages);

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      role: ROLES.DEPARTMENT_ADMIN,
      department_id: '',
      phone_number: '',
    });
    setUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    const backendRole = String(u.role || '').toLowerCase();
    const frontendRole = backendRole === 'admin' ? ROLES.SUPER_ADMIN : (ROLE_OPTIONS.find((o) => o.backend === backendRole)?.value ?? (ROLE_OPTIONS_FOR_ADD.find((o) => o.backend === backendRole)?.value ?? u.role));
    setUserForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      password: '',
      role: frontendRole,
      department_id: u.department_id != null ? String(u.department_id) : '',
      phone_number: u.phone_number || '',
    });
    setUserModalOpen(true);
  };

  const requiresDepartment = (r) =>
    r === ROLES.DEPARTMENT_HEAD || r === ROLES.DEPARTMENT_ADMIN || r === ROLES.PERSONNEL || r === FIELD_RESPONDER;

  const saveUser = async () => {
    const { first_name, last_name, email, password, role: frontendRole, department_id, phone_number } = userForm;
    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      alertUser({ icon: 'warning', title: 'Missing required fields', text: 'Please enter first name, last name, and email.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (requiresDepartment(frontendRole) && !department_id) {
      alertUser({ icon: 'warning', title: 'Department required', text: 'Please select a department for this role.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (frontendRole === FIELD_RESPONDER && !isValidLocalPhone(phone_number)) {
      alertUser({ icon: 'warning', title: 'Phone required', text: 'Field responders need a local mobile number (09XXXXXXXXX) to sign in on the app.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (!editingUser && !password?.trim()) {
      alertUser({ icon: 'warning', title: 'Password required', text: 'Please enter a password for the new user.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (!editingUser && password.length < 8) {
      alertUser({ icon: 'warning', title: 'Invalid password', text: 'Password must be at least 8 characters.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }

    const backendRole = roleToBackend(frontendRole);
    const deptId = requiresDepartment(frontendRole) && department_id ? parseInt(department_id, 10) : null;
    const isFieldResponder = frontendRole === FIELD_RESPONDER;

    setSavingUser(true);
    try {
      if (editingUser) {
        await updateUserRole(editingUser.user_id, {
          role: backendRole,
          department_id: deptId,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          ...(isFieldResponder ? { phone_number: phone_number.trim() } : {}),
        });
        alertUser({ icon: 'success', title: 'User updated', text: isFieldResponder ? 'They sign in on mobile with phone + password, not the web dispatcher portal.' : 'User role, department, and name have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      } else {
        await createUser({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim(),
          password: password.trim(),
          role: backendRole,
          department_id: deptId,
          ...(isFieldResponder ? { phone_number: phone_number.trim() } : {}),
        });
        alertUser({
          icon: 'success',
          title: 'User created',
          text: isFieldResponder
            ? 'They sign in on the mobile app with their phone number and password, not the web dispatcher portal.'
            : 'The user can now sign in with their email and password.',
          timer: 2500,
          showConfirmButton: false,
          timerProgressBar: true,
        });
      }
      setUserModalOpen(false);
      await fetchUsers(currentPage);
    } catch (err) {
      alertUser({ icon: 'error', title: editingUser ? 'Update failed' : 'Create failed', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
    } finally {
      setSavingUser(false);
    }
  };

  const requestDeactivateUser = (u) => {
    alertUser({
      icon: 'warning',
      title: 'Deactivate user?',
      html: `Deactivating <strong>${[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}</strong> will revoke their access immediately.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, deactivate',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setDeactivatingUserId(u.user_id);
        deactivateUser(u.user_id)
          .then(() => {
            alertUser({ icon: 'success', title: 'User deactivated', timer: 2000, showConfirmButton: false, timerProgressBar: true });
            return fetchUsers(currentPage);
          })
          .catch((err) => {
            alertUser({ icon: 'error', title: 'Deactivate failed', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
          })
          .finally(() => {
            setDeactivatingUserId(null);
          });
      }
    });
  };

  const roleOptionsForModal =
    editingUser && String(editingUser.role || '').toLowerCase() === 'department-head'
      ? [...ROLE_OPTIONS_FOR_ADD, { value: ROLES.DEPARTMENT_HEAD, label: 'Department Head', backend: 'department-head' }]
      : ROLE_OPTIONS_FOR_ADD;

  if (role !== ROLES.SUPER_ADMIN) {
    return (
      <AccessDeniedNotice
        message="Only super administrators can manage users and roles."
        redirectPath="/dashboard"
      />
    );
  }

  const columns = [
    {
      title: 'Full Name',
      key: 'name',
      render: (_, u) => [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
    },
    { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (r) => <Tag color={roleTagColor(r)}>{roleToLabel(r)}</Tag>,
    },
    { title: 'Department', dataIndex: 'department_name', render: (v) => v || '—' },
    {
      title: 'Status',
      key: 'status',
      render: (_, u) => (
        <Tag color={u.is_active !== false ? 'green' : 'default'}>
          {u.is_active !== false ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, u) => (
        deactivatingUserId === u.user_id ? (
          <span style={{ fontSize: 13, opacity: 0.7 }}>Deactivating…</span>
        ) : (
          <Space>
            <Button type="text" icon={<Edit size={16} />} onClick={() => openEditUser(u)} title="Edit" />
            {u.is_active !== false && (
              <Button type="text" danger icon={<Ban size={16} />} onClick={() => requestDeactivateUser(u)} title="Deactivate" />
            )}
          </Space>
        )
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Team' }]} />

        <Card size="small" title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} />
            Team
          </span>
        )}>
          <p style={{ margin: 0 }}>Manage user access and roles</p>
        </Card>

        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} />
              Users & Roles
            </span>
          )}
          extra={(
            <Button type="primary" icon={<Plus size={14} />} onClick={openAddUser}>
              Add User
            </Button>
          )}
        >
          <Table
            size="small"
            rowKey="user_id"
            loading={loadingUsers}
            columns={columns}
            dataSource={users}
            pagination={false}
            locale={{ emptyText: 'No users found.' }}
          />
          {userTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Pagination
                current={currentPage}
                total={pagination.total}
                pageSize={ROWS_PER_PAGE}
                onChange={(page) => fetchUsers(page)}
                showSizeChanger={false}
                showTotal={(total) => `${total} users`}
              />
            </div>
          )}
        </Card>

        <Modal
          open={userModalOpen}
          title={editingUser ? 'Edit User' : 'Add User'}
          onCancel={() => setUserModalOpen(false)}
          footer={(
            <Space style={{ width: '100%', justifyContent: 'stretch' }}>
              <Button type="primary" onClick={saveUser} loading={savingUser} block>
                {editingUser ? 'Save' : 'Create'} User
              </Button>
              <Button onClick={() => setUserModalOpen(false)} disabled={savingUser} block>
                Cancel
              </Button>
            </Space>
          )}
          destroyOnClose
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ marginBottom: 4, fontSize: 13 }}>First name *</div>
                <Input
                  maxLength={100}
                  value={userForm.first_name}
                  onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                  placeholder="First name"
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontSize: 13 }}>Last name *</div>
                <Input
                  maxLength={100}
                  value={userForm.last_name}
                  onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 13 }}>Email *</div>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@example.com"
                disabled={!!editingUser}
              />
            </div>
            {!editingUser && (
              <div>
                <div style={{ marginBottom: 4, fontSize: 13 }}>Password * (min 8 characters)</div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="••••••••"
                  suffix={(
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                />
              </div>
            )}
            <div>
              <div style={{ marginBottom: 4, fontSize: 13 }}>Role *</div>
              <Select
                value={userForm.role}
                onChange={(v) => setUserForm({ ...userForm, role: v })}
                options={roleOptionsForModal.map((o) => ({ value: o.value, label: o.label }))}
                style={{ width: '100%' }}
              />
            </div>
            {userForm.role === FIELD_RESPONDER && (
              <div>
                <div style={{ marginBottom: 4, fontSize: 13 }}>Mobile phone *</div>
                <PhoneInput
                  value={userForm.phone_number}
                  onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })}
                />
                <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Used to sign in on the mobile app (09XXXXXXXXX).</p>
              </div>
            )}
            {requiresDepartment(userForm.role) && (
              <div>
                <div style={{ marginBottom: 4, fontSize: 13 }}>Department *</div>
                <Select
                  value={userForm.department_id || undefined}
                  onChange={(v) => setUserForm({ ...userForm, department_id: v })}
                  placeholder="Select department"
                  loading={loadingDepts}
                  options={departments.map((d) => ({ value: String(d.department_id), label: d.name }))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </Space>
        </Modal>
      </div>
    </Layout>
  );
}
