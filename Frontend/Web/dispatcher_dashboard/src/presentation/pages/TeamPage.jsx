import { useState } from 'react';
import { Layout } from '@/presentation/components/layout/Layout';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Switch } from '@/presentation/components/ui/Switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Plus, Edit, Ban, Building2, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { departments as initialDepartments, systemUsers as initialUsers } from '@/data/mock/mockData';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

const SWAL_PRIMARY = '#134178';
const ROWS_PER_PAGE = 5;

const ROLE_OPTIONS = [
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.DEPARTMENT_ADMIN, label: 'Department Admin' },
  { value: ROLES.PERSONNEL, label: 'Personnel' },
];

export function TeamPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = user.role || '';

  const cardClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80' : 'glass neumorphic-dark bg-card/60 border-white/10'}`;
  const cardHeaderClass = `px-6 py-4 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const tableHeadClass = `px-6 py-3 text-left text-sm font-semibold uppercase tracking-wider ${isLight ? 'text-gray-600 bg-gray-100/80' : 'text-muted bg-white/5'}`;
  const tableRowClass = (idx) => `transition-colors ${isLight ? (idx % 2 === 0 ? 'bg-white hover:bg-gray-50/80' : 'bg-gray-50/50 hover:bg-gray-100/80') : (idx % 2 === 0 ? 'bg-transparent hover:bg-white/5' : 'bg-white/5 hover:bg-white/10')}`;
  const iconBoxClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const btnActionClass = (primary) => `p-2 rounded-xl transition-all duration-200 ${primary ? (isLight ? 'hover:bg-primary/15 hover:shadow-sm text-primary' : 'hover:bg-primary/20 hover:shadow-sm text-primary') : (isLight ? 'hover:bg-red-50 text-red-500' : 'hover:bg-red-500/20 text-red-400')}`;

  const [departments, setDepartments] = useState(initialDepartments);
  const [users, setUsers] = useState(initialUsers);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [departmentForm, setDepartmentForm] = useState({ name: '', type: 'Fire', adminEmail: '', status: 'active' });
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: ROLES.PERSONNEL, departmentId: '', department: '', status: 'active' });
  const [deptSelectOpen, setDeptSelectOpen] = useState(false);
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [deptPage, setDeptPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const deptTotalPages = Math.max(1, Math.ceil(departments.length / ROWS_PER_PAGE));
  const userTotalPages = Math.max(1, Math.ceil(users.length / ROWS_PER_PAGE));
  const paginatedDepartments = departments.slice((deptPage - 1) * ROWS_PER_PAGE, deptPage * ROWS_PER_PAGE);
  const paginatedUsers = users.slice((userPage - 1) * ROWS_PER_PAGE, userPage * ROWS_PER_PAGE);

  const openAddDepartment = () => {
    setEditingDepartment(null);
    setDepartmentForm({ name: '', type: 'Fire', adminEmail: '', status: 'active' });
    setDepartmentModalOpen(true);
  };

  const openEditDepartment = (dept) => {
    setEditingDepartment(dept);
    setDepartmentForm({ name: dept.name, type: dept.type, adminEmail: '', status: 'active' });
    setDepartmentModalOpen(true);
  };

  const saveDepartment = () => {
    if (!departmentForm.name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing name',
        text: 'Please enter a department name.',
        confirmButtonColor: SWAL_PRIMARY,
      });
      return;
    }
    if (editingDepartment) {
      setDepartments(departments.map((d) => (d.id === editingDepartment.id ? { ...d, name: departmentForm.name, type: departmentForm.type } : d)));
      setDepartmentModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Department updated',
        text: `"${departmentForm.name}" has been updated successfully.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } else {
      const newId = departments.length ? String.fromCharCode(97 + departments.length) : 'new';
      setDepartments([...departments, { id: newId, name: departmentForm.name, type: departmentForm.type, color: 'gray' }]);
      setDepartmentModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Department created',
        text: `"${departmentForm.name}" has been added. The department dashboard and admin access are now available.`,
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', role: ROLES.PERSONNEL, departmentId: '', department: '', status: 'active' });
    setUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, role: u.role, departmentId: u.departmentId || '', department: u.department || '', status: 'active' });
    setUserModalOpen(true);
  };

  const saveUser = () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing required fields',
        text: 'Please enter full name and email.',
        confirmButtonColor: SWAL_PRIMARY,
      });
      return;
    }
    if ((userForm.role === ROLES.DEPARTMENT_ADMIN || userForm.role === ROLES.PERSONNEL) && !userForm.departmentId) {
      Swal.fire({
        icon: 'warning',
        title: 'Department required',
        text: 'Please select a department for this role.',
        confirmButtonColor: SWAL_PRIMARY,
      });
      return;
    }
    const dept = departments.find((d) => d.id === userForm.departmentId);
    const departmentName = dept ? dept.name : userForm.department;
    if (editingUser) {
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, name: userForm.name, email: userForm.email, role: userForm.role, department: departmentName, departmentId: userForm.departmentId || null } : u)));
      setUserModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'User updated',
        text: `"${userForm.name}" has been updated successfully.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } else {
      setUsers([...users, { id: `USR-${users.length + 1}`, name: userForm.name, email: userForm.email, role: userForm.role, department: departmentName, departmentId: userForm.departmentId || null }]);
      setUserModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'User created',
        text: `"${userForm.name}" has been added and can now sign in with their role.`,
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    }
  };

  const getRoleLabel = (r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;
  const getRoleBadgeClass = (r) => {
    if (r === ROLES.SUPER_ADMIN) return 'bg-primary/20 text-primary';
    if (r === ROLES.DEPARTMENT_ADMIN) return 'bg-blue-500/20 text-blue-400';
    return 'bg-gray-500/20 text-gray-400';
  };

  const requestDisableDepartment = (dept) => {
    Swal.fire({
      icon: 'warning',
      title: 'Disable department?',
      html: `Disabling <strong>${dept.name}</strong> will revoke access and hide the department dashboard. This action can be reversed later.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, disable department',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
        Swal.fire({
          icon: 'success',
          title: 'Department disabled',
          text: `"${dept.name}" has been disabled. Access has been revoked.`,
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true,
        });
      }
    });
  };

  const requestDeactivateUser = (u) => {
    Swal.fire({
      icon: 'warning',
      title: 'Deactivate user?',
      html: `Deactivating <strong>${u.name}</strong> will revoke their access immediately. They will no longer be able to sign in.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, deactivate user',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setUsers((prev) => prev.filter((user) => user.id !== u.id));
        Swal.fire({
          icon: 'success',
          title: 'User deactivated',
          text: `"${u.name}" has been deactivated and can no longer access the system.`,
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true,
        });
      }
    });
  };

  if (role !== ROLES.SUPER_ADMIN) {
    return (
      <AccessDeniedNotice
        message="Only super administrators can manage teams and departments."
        redirectPath="/dashboard"
      />
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Hero card: glass + neumorphism */}
        <div className={`rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={iconBoxClass}>
              <Users className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted mt-1">Manage departments and user access for Dagupan City Emergency Response</p>
            </div>
          </div>
        </div>

        {/* Departments card */}
        <div className={cardClass}>
          <div className={`${cardHeaderClass} flex items-center justify-between flex-wrap gap-3`}>
            <div className="flex items-center gap-3">
              <span className={iconBoxClass}>
                <Building2 className="w-5 h-5" strokeWidth={2} />
              </span>
              <h2 className="text-xl font-semibold text-foreground">Departments</h2>
            </div>
            <Button
              onClick={openAddDepartment}
              className={`flex items-center gap-2 rounded-xl font-medium transition-all duration-300 ${isLight ? 'bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg hover:shadow-primary/25' : 'bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg hover:shadow-primary/30'}`}
            >
              <Plus className="w-4 h-4" />
              Add Department
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isLight ? 'border-b border-gray-200/80 bg-gray-50/60' : 'border-b border-white/10 bg-white/5'}>
                  <th className={tableHeadClass}>Department Name</th>
                  <th className={tableHeadClass}>Type</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-gray-200/80' : 'divide-white/10'}`}>
                {paginatedDepartments.map((dept, idx) => (
                  <tr key={dept.id} className={tableRowClass((deptPage - 1) * ROWS_PER_PAGE + idx)}>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{dept.name}</td>
                    <td className="px-6 py-4 text-sm text-muted capitalize">{dept.type}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">Active</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditDepartment(dept)} className={btnActionClass(true)} title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => requestDisableDepartment(dept)} className={btnActionClass(false)} title="Disable">
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deptTotalPages > 1 && (
            <div className={`flex items-center justify-end gap-2 px-6 py-4 border-t ${isLight ? 'border-gray-200/80' : 'border-white/10'}`}>
              <Button variant="ghost" size="sm" onClick={() => setDeptPage((p) => Math.max(1, p - 1))} disabled={deptPage === 1} className="h-9 w-9 p-0 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, deptTotalPages) }, (_, i) => {
                  let pageNum = deptTotalPages <= 5 ? i + 1 : deptPage <= 3 ? i + 1 : deptPage >= deptTotalPages - 2 ? deptTotalPages - 4 + i : deptPage - 2 + i;
                  pageNum = Math.max(1, Math.min(deptTotalPages, pageNum));
                  return (
                    <Button key={pageNum} variant="ghost" size="sm" onClick={() => setDeptPage(pageNum)} className={`h-9 w-9 p-0 rounded-lg min-w-[36px] ${deptPage === pageNum ? (isLight ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-primary text-white hover:bg-primary-hover') : ''}`}>
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDeptPage((p) => Math.min(deptTotalPages, p + 1))} disabled={deptPage === deptTotalPages} className="h-9 w-9 p-0 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted ml-2">Page {deptPage} of {deptTotalPages}</span>
            </div>
          )}
        </div>

        {/* Users & Roles card */}
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
                {paginatedUsers.map((u, idx) => (
                  <tr key={u.id} className={tableRowClass((userPage - 1) * ROWS_PER_PAGE + idx)}>
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-muted">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(u.role)}`}>{getRoleLabel(u.role)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">{u.department || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-500">Active</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditUser(u)} className={btnActionClass(true)} title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => requestDeactivateUser(u)} className={btnActionClass(false)} title="Deactivate">
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {userTotalPages > 1 && (
            <div className={`flex items-center justify-end gap-2 px-6 py-4 border-t ${isLight ? 'border-gray-200/80' : 'border-white/10'}`}>
              <Button variant="ghost" size="sm" onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={userPage === 1} className="h-9 w-9 p-0 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, userTotalPages) }, (_, i) => {
                  let pageNum = userTotalPages <= 5 ? i + 1 : userPage <= 3 ? i + 1 : userPage >= userTotalPages - 2 ? userTotalPages - 4 + i : userPage - 2 + i;
                  pageNum = Math.max(1, Math.min(userTotalPages, pageNum));
                  return (
                    <Button key={pageNum} variant="ghost" size="sm" onClick={() => setUserPage(pageNum)} className={`h-9 w-9 p-0 rounded-lg min-w-[36px] ${userPage === pageNum ? (isLight ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-primary text-white hover:bg-primary-hover') : ''}`}>
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))} disabled={userPage === userTotalPages} className="h-9 w-9 p-0 rounded-lg">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted ml-2">Page {userPage} of {userTotalPages}</span>
            </div>
          )}
        </div>

        {/* Department Modal */}
        <Dialog open={departmentModalOpen} onOpenChange={setDepartmentModalOpen}>
          <DialogContent className={`max-w-lg rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <DialogHeader>
              <DialogTitle>{editingDepartment ? 'Edit Department' : 'Add Department'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-foreground">Department Name *</Label>
                <Input value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} placeholder="e.g. Dagupan Fire Department" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-foreground">Type</Label>
                <Select value={departmentForm.type} onValueChange={(v) => setDepartmentForm({ ...departmentForm, type: v })} open={typeSelectOpen} onOpenChange={setTypeSelectOpen}>
                  {({ value, onValueChange, dropdownRect }) => (
                    <>
                      <SelectTrigger isOpen={typeSelectOpen} onClick={() => setTypeSelectOpen((o) => !o)} className="mt-1.5">
                        <SelectValue value={value} options={[{ value: 'Fire', label: 'Fire' }, { value: 'Medical', label: 'Medical' }, { value: 'Police', label: 'Police' }, { value: 'Disaster', label: 'Disaster' }, { value: 'Community', label: 'Community' }]} />
                      </SelectTrigger>
                      <SelectContent isOpen={typeSelectOpen} dropdownRect={dropdownRect}>
                        {['Fire', 'Medical', 'Police', 'Disaster', 'Community'].map((t) => (
                          <SelectItem key={t} value={t} onSelect={(v) => { setDepartmentForm({ ...departmentForm, type: v }); setTypeSelectOpen(false); }}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Admin Email (optional)</Label>
                <Input type="email" value={departmentForm.adminEmail} onChange={(e) => setDepartmentForm({ ...departmentForm, adminEmail: e.target.value })} placeholder="admin@dagupan.gov.ph" className="mt-1.5" />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground cursor-pointer">Status</Label>
                  <p className="text-xs text-muted">Enable or disable this department</p>
                </div>
                <Switch checked={departmentForm.status === 'active'} onCheckedChange={(c) => setDepartmentForm({ ...departmentForm, status: c ? 'active' : 'disabled' })} />
              </div>
              <div className="flex justify-between gap-3 pt-2">
                <Button onClick={saveDepartment} className="flex-1 bg-primary hover:bg-primary-hover text-white">{(editingDepartment ? 'Save' : 'Create') + ' Department'}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (departmentForm.name.trim() && !editingDepartment) {
                      Swal.fire({
                        icon: 'question',
                        title: 'Discard new department?',
                        text: 'You have entered data. Closing without saving will discard it.',
                        showCancelButton: true,
                        confirmButtonColor: SWAL_PRIMARY,
                        cancelButtonText: 'Keep editing',
                        confirmButtonText: 'Discard',
                      }).then((result) => { if (result.isConfirmed) setDepartmentModalOpen(false); });
                    } else {
                      setDepartmentModalOpen(false);
                    }
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* User Modal */}
        <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
          <DialogContent className={`max-w-lg rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-foreground">Full Name *</Label>
                <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="e.g. Juan dela Cruz" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-foreground">Email *</Label>
                <Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="user@dagupan.gov.ph" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-foreground">Role *</Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })} open={roleSelectOpen} onOpenChange={setRoleSelectOpen}>
                  {({ value, onValueChange, dropdownRect }) => (
                    <>
                      <SelectTrigger isOpen={roleSelectOpen} onClick={() => setRoleSelectOpen((o) => !o)} className="mt-1.5">
                        <SelectValue value={value} options={ROLE_OPTIONS} />
                      </SelectTrigger>
                      <SelectContent isOpen={roleSelectOpen} dropdownRect={dropdownRect}>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} onSelect={(v) => { setUserForm({ ...userForm, role: v }); setRoleSelectOpen(false); }}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              {(userForm.role === ROLES.DEPARTMENT_ADMIN || userForm.role === ROLES.PERSONNEL) && (
                <div>
                  <Label className="text-foreground">Department *</Label>
                  <Select value={userForm.departmentId} onValueChange={(v) => { const d = departments.find((x) => x.id === v); setUserForm({ ...userForm, departmentId: v, department: d?.name || '' }); }} open={deptSelectOpen} onOpenChange={setDeptSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => (
                      <>
                        <SelectTrigger isOpen={deptSelectOpen} onClick={() => setDeptSelectOpen((o) => !o)} className="mt-1.5">
                          <SelectValue value={value} options={[{ value: '', label: 'Select department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent isOpen={deptSelectOpen} dropdownRect={dropdownRect}>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id} onSelect={(v) => { setUserForm({ ...userForm, departmentId: v, department: d.name }); setDeptSelectOpen(false); }}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-foreground cursor-pointer">Status</Label>
                  <p className="text-xs text-muted">Enable or disable this user</p>
                </div>
                <Switch checked={userForm.status === 'active'} onCheckedChange={(c) => setUserForm({ ...userForm, status: c ? 'active' : 'disabled' })} />
              </div>
              <div className="flex justify-between gap-3 pt-2">
                <Button onClick={saveUser} className="flex-1 bg-primary hover:bg-primary-hover text-white">{(editingUser ? 'Save' : 'Create') + ' User'}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const hasData = userForm.name.trim() || userForm.email.trim();
                    if (hasData && !editingUser) {
                      Swal.fire({
                        icon: 'question',
                        title: 'Discard new user?',
                        text: 'You have entered data. Closing without saving will discard it.',
                        showCancelButton: true,
                        confirmButtonColor: SWAL_PRIMARY,
                        cancelButtonText: 'Keep editing',
                        confirmButtonText: 'Discard',
                      }).then((result) => { if (result.isConfirmed) setUserModalOpen(false); });
                    } else {
                      setUserModalOpen(false);
                    }
                  }}
                  className="flex-1"
                >
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
