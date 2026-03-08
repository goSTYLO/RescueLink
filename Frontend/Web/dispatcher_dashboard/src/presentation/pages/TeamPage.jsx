import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/presentation/components/layout/Layout';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Plus, Edit, Ban, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { listUsers, createUser, updateUserRole, deactivateUser } from '@/data/api/adminUsers.api';
import { getDepartments } from '@/data/api/departments.api';
import { ROLES, normalizeRole } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

const SWAL_PRIMARY = '#134178';
const ROWS_PER_PAGE = 10;

// Frontend display value -> backend API value
const ROLE_TO_BACKEND = {
  [ROLES.SUPER_ADMIN]: 'admin',
  [ROLES.DISPATCHER]: 'dispatcher',
  [ROLES.DEPARTMENT_ADMIN]: 'department-admin',
  [ROLES.DEPARTMENT_HEAD]: 'department-head',
  [ROLES.PERSONNEL]: 'user',
};

const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin', backend: 'admin' },
  { value: ROLES.DISPATCHER, label: 'Dispatcher', backend: 'dispatcher' },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Department Admin', backend: 'department-admin' },
  { value: ROLES.DEPARTMENT_HEAD, label: 'Department Head', backend: 'department-head' },
  { value: ROLES.PERSONNEL, label: 'Personnel', backend: 'user' },
];

function roleToBackend(frontendRole) {
  return ROLE_TO_BACKEND[frontendRole] ?? frontendRole;
}

function roleToLabel(backendRole) {
  const r = String(backendRole || '').toLowerCase();
  const opt = ROLE_OPTIONS.find((o) => o.backend === r);
  return opt ? opt.label : backendRole || '—';
}

export function TeamPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = normalizeRole(user.role || '');

  const cardClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80' : 'glass neumorphic-dark bg-card/60 border-white/10'}`;
  const cardHeaderClass = `px-6 py-4 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const tableHeadClass = `px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider ${isLight ? 'text-gray-600 bg-gray-100/80' : 'text-muted bg-white/5'}`;
  const tableRowClass = (idx) => `transition-colors ${isLight ? (idx % 2 === 0 ? 'bg-white hover:bg-gray-50/80' : 'bg-gray-50/50 hover:bg-gray-100/80') : (idx % 2 === 0 ? 'bg-transparent hover:bg-white/5' : 'bg-white/5 hover:bg-white/10')}`;
  const iconBoxClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const btnActionClass = (primary) => `p-2 rounded-xl transition-all duration-200 ${primary ? (isLight ? 'hover:bg-primary/15 hover:shadow-sm text-primary' : 'hover:bg-primary/20 hover:shadow-sm text-primary') : (isLight ? 'hover:bg-red-50 text-red-500' : 'hover:bg-red-500/20 text-red-400')}`;

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
  });
  const [deptSelectOpen, setDeptSelectOpen] = useState(false);
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);

  const fetchUsers = useCallback(async (page = pagination.page) => {
    setLoadingUsers(true);
    try {
      const res = await listUsers({ page, limit: ROWS_PER_PAGE });
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
      Swal.fire({ icon: 'error', title: 'Failed to load users', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
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
      role: ROLES.PERSONNEL,
      department_id: '',
    });
    setUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    const frontendRole = u.role === 'admin' ? ROLES.SUPER_ADMIN : (ROLE_OPTIONS.find((o) => o.backend === u.role)?.value ?? u.role);
    setUserForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      password: '',
      role: frontendRole,
      department_id: u.department_id != null ? String(u.department_id) : '',
    });
    setUserModalOpen(true);
  };

  const requiresDepartment = (r) =>
    r === ROLES.DEPARTMENT_HEAD || r === ROLES.DEPARTMENT_ADMIN || r === ROLES.PERSONNEL;

  const saveUser = async () => {
    const { first_name, last_name, email, password, role: frontendRole, department_id } = userForm;
    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing required fields', text: 'Please enter first name, last name, and email.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (requiresDepartment(frontendRole) && !department_id) {
      Swal.fire({ icon: 'warning', title: 'Department required', text: 'Please select a department for this role.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (!editingUser && !password?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Password required', text: 'Please enter a password for the new user.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }
    if (!editingUser && password.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Invalid password', text: 'Password must be at least 8 characters.', confirmButtonColor: SWAL_PRIMARY });
      return;
    }

    const backendRole = roleToBackend(frontendRole);
    const deptId = requiresDepartment(frontendRole) && department_id ? parseInt(department_id, 10) : null;

    try {
      if (editingUser) {
        await updateUserRole(editingUser.user_id, {
          role: backendRole,
          department_id: deptId,
        });
        Swal.fire({ icon: 'success', title: 'User updated', text: 'User role and department have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      } else {
        await createUser({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim(),
          password: password.trim(),
          role: backendRole,
          department_id: deptId,
        });
        Swal.fire({ icon: 'success', title: 'User created', text: 'The user can now sign in with their email and password.', timer: 2500, showConfirmButton: false, timerProgressBar: true });
      }
      setUserModalOpen(false);
      await fetchUsers(currentPage);
    } catch (err) {
      Swal.fire({ icon: 'error', title: editingUser ? 'Update failed' : 'Create failed', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
    }
  };

  const requestDeactivateUser = (u) => {
    Swal.fire({
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
        deactivateUser(u.user_id)
          .then(() => {
            Swal.fire({ icon: 'success', title: 'User deactivated', timer: 2000, showConfirmButton: false, timerProgressBar: true });
            return fetchUsers(currentPage);
          })
          .catch((err) => {
            Swal.fire({ icon: 'error', title: 'Deactivate failed', text: err.message || 'Please try again.', confirmButtonColor: SWAL_PRIMARY });
          });
      }
    });
  };

  const getRoleBadgeClass = (backendRole) => {
    const r = String(backendRole || '').toLowerCase();
    if (r === 'admin') return 'bg-primary/20 text-primary';
    if (r === 'dispatcher') return 'bg-blue-500/20 text-blue-400';
    if (r === 'department-admin') return 'bg-indigo-500/20 text-indigo-400';
    if (r === 'department-head') return 'bg-amber-500/20 text-amber-500';
    return 'bg-gray-500/20 text-gray-400';
  };

  if (role !== ROLES.SUPER_ADMIN) {
    return (
      <AccessDeniedNotice
        message="Only super administrators can manage users and roles."
        redirectPath="/dashboard"
      />
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={`rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={iconBoxClass}>
              <Users className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted mt-1">Manage user access and roles</p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className={`${cardHeaderClass} flex items-center justify-between flex-wrap gap-3`}>
            <div className="flex items-center gap-3">
              <span className={iconBoxClass}>
                <Users className="w-5 h-5" strokeWidth={2} />
              </span>
              <h2 className="text-xl font-semibold text-foreground">Users & Roles</h2>
            </div>
            <Button
              onClick={openAddUser}
              className={`flex items-center gap-2 rounded-xl font-medium transition-all duration-300 ${isLight ? 'bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg hover:shadow-primary/25' : 'bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg hover:shadow-primary/30'}`}
            >
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>
          {loadingUsers ? (
            <div className="px-6 py-8 text-center text-muted">Loading users...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={isLight ? 'border-b border-gray-200/80 bg-gray-50/60' : 'border-b border-white/10 bg-white/5'}>
                      <th className={tableHeadClass}>Full Name</th>
                      <th className={tableHeadClass}>Email</th>
                      <th className={tableHeadClass}>Role</th>
                      <th className={tableHeadClass}>Department</th>
                      <th className={tableHeadClass}>Status</th>
                      <th className={tableHeadClass}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-gray-200/80' : 'divide-white/10'}`}>
                    {users.map((u, idx) => (
                      <tr key={u.user_id} className={tableRowClass(idx)}>
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">{u.email || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(u.role)}`}>
                            {roleToLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">{u.department_name || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${u.is_active !== false ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'}`}>
                            {u.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditUser(u)} className={btnActionClass(true)} title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            {u.is_active !== false && (
                              <button onClick={() => requestDeactivateUser(u)} className={btnActionClass(false)} title="Deactivate">
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="px-6 py-8 text-center text-muted">No users found.</div>
              )}
              {userTotalPages > 1 && (
                <div className={`flex items-center justify-end gap-2 px-6 py-4 border-t ${isLight ? 'border-gray-200/80' : 'border-white/10'}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchUsers(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="h-9 w-9 p-0 rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted">
                    Page {currentPage} of {userTotalPages} ({pagination.total} users)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchUsers(Math.min(userTotalPages, currentPage + 1))}
                    disabled={currentPage >= userTotalPages}
                    className="h-9 w-9 p-0 rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
          <DialogContent className={`max-w-lg rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">First name *</Label>
                  <Input
                    value={userForm.first_name}
                    onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                    placeholder="First name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-foreground">Last name *</Label>
                  <Input
                    value={userForm.last_name}
                    onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                    placeholder="Last name"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label className="text-foreground">Email *</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="mt-1.5"
                  disabled={!!editingUser}
                />
              </div>
              {!editingUser && (
                <div>
                  <Label className="text-foreground">Password * (min 8 characters)</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="mt-1.5"
                  />
                </div>
              )}
              <div>
                <Label className="text-foreground">Role *</Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })} open={roleSelectOpen} onOpenChange={setRoleSelectOpen}>
                  {({ value, dropdownRect }) => (
                    <>
                      <SelectTrigger isOpen={roleSelectOpen} onClick={() => setRoleSelectOpen((o) => !o)} className="mt-1.5">
                        <SelectValue value={value} options={ROLE_OPTIONS} />
                      </SelectTrigger>
                      <SelectContent isOpen={roleSelectOpen} dropdownRect={dropdownRect}>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(v) => {
                              setUserForm({ ...userForm, role: v });
                              setRoleSelectOpen(false);
                            }}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              {requiresDepartment(userForm.role) && (
                <div>
                  <Label className="text-foreground">Department *</Label>
                  <Select
                    value={userForm.department_id}
                    onValueChange={(v) => setUserForm({ ...userForm, department_id: v })}
                    open={deptSelectOpen}
                    onOpenChange={setDeptSelectOpen}
                  >
                    {({ value, dropdownRect }) => (
                      <>
                        <SelectTrigger isOpen={deptSelectOpen} onClick={() => setDeptSelectOpen((o) => !o)} className="mt-1.5">
                          <SelectValue
                            value={value}
                            options={[{ value: '', label: 'Select department' }, ...departments.map((d) => ({ value: String(d.department_id), label: d.name }))]}
                            placeholder="Select department"
                          />
                        </SelectTrigger>
                        <SelectContent isOpen={deptSelectOpen} dropdownRect={dropdownRect}>
                          {departments.map((d) => (
                            <SelectItem
                              key={d.department_id}
                              value={String(d.department_id)}
                              onSelect={(v) => {
                                setUserForm({ ...userForm, department_id: v });
                                setDeptSelectOpen(false);
                              }}
                            >
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
              )}
              <div className="flex justify-between gap-3 pt-2">
                <Button onClick={saveUser} className="flex-1 bg-primary hover:bg-primary-hover text-white">
                  {editingUser ? 'Save' : 'Create'} User
                </Button>
                <Button variant="outline" onClick={() => setUserModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
