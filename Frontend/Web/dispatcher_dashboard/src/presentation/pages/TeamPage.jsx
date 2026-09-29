import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '@/presentation/components/layout/Layout';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { Button, Card, Input, Modal, Pagination, Select, Space, Table, Tabs, Tag } from 'antd';
import { Plus, Edit, Ban, Users, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { alertUser } from '@/presentation/feedback/alertUser';
import { listUsers, createUser, updateUserRole, deactivateUser, reactivateUser } from '@/data/api/adminUsers.api';
import { getDepartments } from '@/data/api/departments.api';
import { ROLES, normalizeRole } from '@/core/constants';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { PhoneInput } from '@/presentation/components/ui/PhoneInput';
import { isValidLocalPhone } from '@/core/utils/inputUtils';

const SWAL_PRIMARY = '#134178';
const ROWS_PER_PAGE = 10;
const LIST_FETCH_LIMIT = 300;

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
  if (r === 'responder') return 'purple';
  return 'default';
}

export function TeamPage() {
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const role = normalizeRole(user.role || '');

  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [listTab, setListTab] = useState('active');
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
  const [pendingActionUserId, setPendingActionUserId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await listUsers({ page: 1, limit: LIST_FETCH_LIMIT, exclude_role: 'user' });
      setUsers(res.users || []);
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
    fetchUsers();
  }, [fetchUsers]);
  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const isActive = u.is_active !== false;
      if (listTab === 'active' && !isActive) return false;
      if (listTab === 'deactivated' && isActive) return false;
      const backendRole = String(u.role || '').toLowerCase();
      if (roleFilter !== 'all' && backendRole !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.department_name,
        roleToLabel(u.role),
        backendRole,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [users, searchQuery, roleFilter, listTab]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, listTab]);

  const activeCount = useMemo(() => users.filter((u) => u.is_active !== false).length, [users]);
  const deactivatedCount = useMemo(() => users.filter((u) => u.is_active === false).length, [users]);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), userTotalPages);
  const pageUsers = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredUsers.slice(start, start + ROWS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const roleFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All roles' },
      ...ROLE_OPTIONS.map((opt) => ({ value: opt.backend, label: opt.label })),
    ],
    []
  );

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
      await fetchUsers();
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
        setPendingActionUserId(u.user_id);
        deactivateUser(u.user_id)
          .then(() => {
            alertUser({ icon: 'success', title: 'User deactivated', timer: 2000, showConfirmButton: false, timerProgressBar: true });
            setListTab('deactivated');
            return fetchUsers();
          })
          .catch((err) => {
            alertUser({ icon: 'error', title: 'Deactivate failed', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
          })
          .finally(() => {
            setPendingActionUserId(null);
          });
      }
    });
  };

  const requestReactivateUser = (u) => {
    alertUser({
      icon: 'question',
      title: 'Reactivate user?',
      html: `Reactivating <strong>${[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.phone_number}</strong> will restore their access.`,
      showCancelButton: true,
      confirmButtonColor: SWAL_PRIMARY,
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, reactivate',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setPendingActionUserId(u.user_id);
        reactivateUser(u.user_id)
          .then(() => {
            alertUser({ icon: 'success', title: 'User reactivated', timer: 2000, showConfirmButton: false, timerProgressBar: true });
            setListTab('active');
            return fetchUsers();
          })
          .catch((err) => {
            alertUser({ icon: 'error', title: 'Reactivate failed', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
          })
          .finally(() => {
            setPendingActionUserId(null);
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
      title: 'Phone',
      dataIndex: 'phone_number',
      render: (v) => v || '—',
    },
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
        pendingActionUserId === u.user_id ? (
          <span style={{ fontSize: 13, opacity: 0.7 }}>{u.is_active === false ? 'Reactivating…' : 'Deactivating…'}</span>
        ) : (
          <Space>
            <Button type="text" icon={<Edit size={16} />} onClick={() => openEditUser(u)} title="Edit" />
            {u.is_active !== false ? (
              <Button type="text" danger icon={<Ban size={16} />} onClick={() => requestDeactivateUser(u)} title="Deactivate" />
            ) : (
              <Button type="text" icon={<RotateCcw size={16} />} onClick={() => requestReactivateUser(u)} title="Reactivate" style={{ color: '#16a34a' }} />
            )}
          </Space>
        )
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
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
          extra={listTab === 'active' ? (
            <Button type="primary" icon={<Plus size={14} />} onClick={openAddUser}>
              Add User
            </Button>
          ) : null}
        >
          <Tabs
            activeKey={listTab}
            onChange={setListTab}
            items={[
              { key: 'active', label: `Active (${activeCount})` },
              { key: 'deactivated', label: `Deactivated (${deactivatedCount})` },
            ]}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 12 }}>
            <Input
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, phone, department…"
            />
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={roleFilterOptions}
            />
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
          </div>
          <Table
            size="small"
            rowKey="user_id"
            loading={loadingUsers}
            columns={columns}
            dataSource={pageUsers}
            pagination={false}
            locale={{ emptyText: listTab === 'deactivated' ? 'No deactivated users.' : 'No users match the current filters.' }}
          />
          {userTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Pagination
                current={currentPage}
                total={filteredUsers.length}
                pageSize={ROWS_PER_PAGE}
                onChange={(nextPage) => setPage(nextPage)}
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
