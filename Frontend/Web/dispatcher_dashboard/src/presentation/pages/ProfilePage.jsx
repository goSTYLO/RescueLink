import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/presentation/components/layout/Layout';
import {
  getMe,
  changePassword as changePasswordApi,
  updateMe,
  fetchAvatarBlob,
  uploadAvatar,
  deleteAvatar,
} from '@/data/api/auth.api';
import { ProfileAvatar } from '@/presentation/components/common/ProfileAvatar';
import { clearAuthSession, getAuthToken, getStoredUser, persistAuthUser } from '@/core/auth/session';
import { Button } from '@/presentation/components/ui/Button';
import { Label } from '@/presentation/components/ui/Label';
import { Input } from '@/presentation/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/Dialog';
import {
  User,
  Mail,
  Shield,
  Phone,
  Clock,
  KeyRound,
  LogOut,
  Eye,
  EyeOff,
  UserCircle,
  Activity,
  Pencil,
  Camera,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import Swal from 'sweetalert2';
import { DEV_MODE } from '@/core/config/app.config';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

function syncSessionUser(user) {
  try {
    persistAuthUser({
      ...getStoredUser(),
      firstName: user.firstName,
      lastName: user.lastName,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      has_profile_image: user.has_profile_image,
    });
    window.dispatchEvent(new CustomEvent('profile-updated'));
  } catch (_) {}
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [nameErrors, setNameErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  const loadAvatar = async (hasImage) => {
    if (!hasImage) {
      setAvatarUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const blob = await fetchAvatarBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  useEffect(() => () => {
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  }, [avatarUrl]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token && !DEV_MODE) {
      navigate('/login', { replace: true });
      return;
    }
    if (DEV_MODE && !token) {
      const user = getStoredUser();
      if (user.role) {
        setProfile({
          firstName: user.firstName || user.username?.split(' ')[0],
          lastName: user.lastName || user.username?.split(' ').slice(1).join(' '),
          email: user.email || 'designer@rescuelink.com',
          role: user.role?.toLowerCase() === 'admin' ? 'admin' : 'dispatcher',
          phone: user.phone || '—',
          created_at: user.created_at || new Date().toISOString(),
        });
      }
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);
    getMe()
      .then(async (user) => {
        if (cancelled) return;
        setProfile(user);
        setEditFirstName(user.firstName || '');
        setEditLastName(user.lastName || '');
        await loadAvatar(user.has_profile_image);
      })
      .catch((err) => {
        if (!cancelled) setProfileError(err.message || 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const handleLogout = () => {
    Swal.fire({
      title: 'Log out?',
      text: 'Are you sure you want to end your session?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Logout',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'rounded-2xl shadow-xl',
        title: 'text-foreground text-xl',
        htmlContainer: 'text-muted',
        confirmButton: 'rounded-xl px-5 py-2.5 font-medium',
        cancelButton: 'rounded-xl px-5 py-2.5 font-medium',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        clearAuthSession();
        navigate('/login');
      }
    });
  };

  const validateChangePassword = () => {
    const err = {};
    if (!currentPassword.trim()) err.currentPassword = 'Current password is required.';
    if (!newPassword.trim()) err.newPassword = 'New password is required.';
    else if (newPassword.length < MIN_PASSWORD_LENGTH) err.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (confirmPassword !== newPassword) err.confirmPassword = 'Passwords do not match.';
    setPasswordErrors(err);
    return err;
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    const errors = validateChangePassword();
    if (Object.keys(errors).length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Validation failed',
        text: Object.values(errors).join(' '),
        confirmButtonColor: '#134178',
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
      return;
    }
    setPasswordSubmitting(true);
    try {
      await changePasswordApi(currentPassword, newPassword);
      closeChangePasswordModal();
      setChangePasswordOpen(false);
      clearAuthSession();
      Swal.fire({
        icon: 'success',
        title: 'Password updated',
        text: 'Please log in again with your new password.',
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      }).then(() => {
        navigate('/login');
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Could not update password',
        text: err.message || 'Current password may be incorrect. Please try again.',
        confirmButtonColor: '#134178',
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const validateNames = () => {
    const err = {};
    const first = editFirstName.trim();
    const last = editLastName.trim();
    if (!first) err.firstName = 'First name is required.';
    else if (first.length > MAX_NAME_LENGTH) err.firstName = `First name must not exceed ${MAX_NAME_LENGTH} characters.`;
    if (!last) err.lastName = 'Last name is required.';
    else if (last.length > MAX_NAME_LENGTH) err.lastName = `Last name must not exceed ${MAX_NAME_LENGTH} characters.`;
    setNameErrors(err);
    return err;
  };

  const canSaveProfile = editFirstName.trim().length > 0
    && editLastName.trim().length > 0
    && editFirstName.trim().length <= MAX_NAME_LENGTH
    && editLastName.trim().length <= MAX_NAME_LENGTH
    && !profileSaving;

  const startEditing = () => {
    if (!profile) return;
    setEditFirstName(profile.firstName || '');
    setEditLastName(profile.lastName || '');
    setPendingAvatarFile(null);
    setRemoveAvatar(false);
    setNameErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (profile) {
      setEditFirstName(profile.firstName || '');
      setEditLastName(profile.lastName || '');
    }
    setPendingAvatarFile(null);
    setRemoveAvatar(false);
    setNameErrors({});
    setIsEditing(false);
    if (profile?.has_profile_image) {
      loadAvatar(true);
    } else {
      loadAvatar(false);
    }
  };

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png)$/i.test(file.type)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid file',
        text: 'Please choose a JPG or PNG image.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    setPendingAvatarFile(file);
    setRemoveAvatar(false);
    const preview = URL.createObjectURL(file);
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setPendingAvatarFile(null);
    setRemoveAvatar(true);
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleSaveProfile = async () => {
    const errors = validateNames();
    if (Object.keys(errors).length > 0) return;

    setProfileSaving(true);
    try {
      let user = await updateMe({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
      });

      if (removeAvatar) {
        user = await deleteAvatar();
      } else if (pendingAvatarFile) {
        user = await uploadAvatar(pendingAvatarFile);
      }

      setProfile(user);
      syncSessionUser(user);
      setPendingAvatarFile(null);
      setRemoveAvatar(false);
      setIsEditing(false);
      await loadAvatar(user.has_profile_image);

      Swal.fire({
        icon: 'success',
        title: 'Profile updated',
        timer: 1800,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Could not save profile',
        text: err.message || 'Please try again.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const closeChangePasswordModal = () => {
    setChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordErrors({});
  };

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${accent === 'primary' ? 'text-primary' : 'text-foreground'}`;
  const iconSmClass = () =>
    `w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto relative min-h-[calc(100vh-8rem)]">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Profile' }]} />
        <div className={`${heroCardClass} mb-8`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <User className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">User Profile</h1>
              <p className="text-muted mt-1">Manage your account settings and information</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass('primary')}>
                <UserCircle className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground flex-1">Profile Information</span>
              {!profileLoading && !profileError && profile && !isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl gap-2 shrink-0"
                  onClick={startEditing}
                >
                  <Pencil className="w-4 h-4" strokeWidth={2} />
                  Edit
                </Button>
              )}
              {isEditing && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    className="rounded-xl bg-primary hover:bg-primary-hover text-white"
                    disabled={!canSaveProfile}
                    onClick={handleSaveProfile}
                  >
                    {profileSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={cancelEditing} disabled={profileSaving}>
                    Cancel
                  </Button>
                </div>
              )}
              {profile?.role && (
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold uppercase bg-primary text-white border border-primary">
                  {profile.role === 'dispatcher' ? 'Operator' : (profile.role || '').toUpperCase()}
                </span>
              )}
            </div>
            <div className="p-6 space-y-6">
              {profileLoading && <p className="text-muted">Loading profile...</p>}
              {profileError && <p className="text-red-500 text-sm">{profileError}</p>}
              {!profileLoading && !profileError && profile && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    className="sr-only"
                    onChange={handleAvatarPick}
                  />
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="relative">
                      <ProfileAvatar
                        firstName={isEditing ? editFirstName : profile.firstName}
                        lastName={isEditing ? editLastName : profile.lastName}
                        photoUrl={avatarUrl}
                        size="md"
                        rounded="rounded-2xl"
                        onClick={isEditing ? () => avatarInputRef.current?.click() : undefined}
                      />
                      {isEditing && (
                        <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center border-2 border-background">
                          <Camera className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      {isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="edit-first-name">First name</Label>
                            <Input
                              id="edit-first-name"
                              maxLength={MAX_NAME_LENGTH}
                              value={editFirstName}
                              onChange={(e) => {
                                setEditFirstName(e.target.value);
                                if (nameErrors.firstName) setNameErrors((p) => ({ ...p, firstName: undefined }));
                              }}
                              error={!!nameErrors.firstName}
                              className="mt-1 rounded-xl"
                            />
                            {nameErrors.firstName && (
                              <p className="text-red-500 text-sm mt-1" role="alert">{nameErrors.firstName}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="edit-last-name">Last name</Label>
                            <Input
                              id="edit-last-name"
                              maxLength={MAX_NAME_LENGTH}
                              value={editLastName}
                              onChange={(e) => {
                                setEditLastName(e.target.value);
                                if (nameErrors.lastName) setNameErrors((p) => ({ ...p, lastName: undefined }));
                              }}
                              error={!!nameErrors.lastName}
                              className="mt-1 rounded-xl"
                            />
                            {nameErrors.lastName && (
                              <p className="text-red-500 text-sm mt-1" role="alert">{nameErrors.lastName}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-foreground">
                            {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}
                          </h3>
                          <p className="text-sm text-muted mt-0.5">Emergency Operations Center</p>
                        </>
                      )}
                      {isEditing && (avatarUrl || profile.has_profile_image) && (
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:underline mt-2"
                          onClick={handleRemoveAvatar}
                        >
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={`border-t pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5 ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
                    <div className="flex items-center gap-3">
                      <span className={iconSmClass()}>
                        <Mail className="w-4 h-4" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-xs text-muted">Email Address</p>
                        <p className="text-sm font-medium text-foreground">{profile.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={iconSmClass()}>
                        <Shield className="w-4 h-4" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-xs text-muted">Role</p>
                        <p className="text-sm font-medium text-foreground">
                          {profile.role === 'dispatcher' ? 'Operator' : profile.role || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={iconSmClass()}>
                        <Phone className="w-4 h-4" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-xs text-muted">Phone Number</p>
                        <p className="text-sm font-medium text-foreground">{profile.phone || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={iconSmClass()}>
                        <Clock className="w-4 h-4" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="text-xs text-muted">Member since</p>
                        <p className="text-sm font-medium text-foreground">
                          {profile.created_at ? new Date(profile.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass('primary')}>
                <KeyRound className="w-5 h-5" strokeWidth={2} />
              </span>
              <div className="flex-1">
                <p className="font-medium text-foreground">Change Password</p>
                <p className="text-sm text-muted mt-0.5">Update your account password</p>
              </div>
              <Button className="rounded-xl gap-2 bg-primary hover:bg-primary-hover text-white shrink-0" onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="w-4 h-4" strokeWidth={2} />
                Change Password
              </Button>
            </div>
          </div>

          {/* Session Information */}
          <div className={panelClass}>
            <div className={headerClass}>
              <span className={iconBoxClass('primary')}>
                <Activity className="w-5 h-5" strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">Session Information</span>
            </div>
            <div className="p-6 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Current Session</p>
                  <p className="text-sm text-muted mt-0.5">Last activity: Just now</p>
                </div>
                <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/20 text-primary border border-primary/40">
                  Active
                </span>
              </div>
              {profile?.created_at && (
                <p className="text-sm text-muted pt-1">Member since {new Date(profile.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              )}
            </div>
          </div>

          {/* Sign Out */}
          <div className={panelClass}>
            <div className="p-6 flex flex-row flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={iconBoxClass('primary')}>
                  <LogOut className="w-5 h-5" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Sign Out</h3>
                  <p className="text-sm text-muted mt-0.5">End your current session</p>
                </div>
              </div>
              <Button variant="outline" className="rounded-xl gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white" onClick={handleLogout}>
                <LogOut className="w-4 h-4" strokeWidth={2} />
                Logout
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* Change Password Modal */}
      <Dialog
        open={changePasswordOpen}
        onOpenChange={(open) => {
          setChangePasswordOpen(open);
          if (!open) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordErrors({});
          }
        }}
        className="max-w-md w-full"
      >
        <DialogContent className="rounded-2xl shadow-xl border border-border bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-foreground">
              Change Password
            </DialogTitle>
            <DialogDescription className="text-muted mt-0.5">
              Update your account password
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 mt-6" onSubmit={handleChangePasswordSubmit}>
            <div>
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter current password"
                  className={`pr-10 rounded-xl border-2 py-2.5 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (passwordErrors.currentPassword) setPasswordErrors((p) => ({ ...p, currentPassword: undefined }));
                  }}
                  error={!!passwordErrors.currentPassword}
                />
                <button
                  type="button"
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground focus:outline-none"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="text-red-500 text-sm mt-1">{passwordErrors.currentPassword}</p>
              )}
            </div>
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className={`pr-10 rounded-xl border-2 py-2.5 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordErrors.newPassword) setPasswordErrors((p) => ({ ...p, newPassword: undefined }));
                  }}
                  error={!!passwordErrors.newPassword}
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground focus:outline-none"
                  onClick={() => setShowNewPassword((v) => !v)}
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className={`pr-10 rounded-xl border-2 py-2.5 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordErrors.confirmPassword) setPasswordErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }}
                  error={!!passwordErrors.confirmPassword}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground focus:outline-none"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword}</p>
              )}
            </div>
            <DialogFooter className="justify-between mt-6 gap-3">
              <Button
                type="submit"
                disabled={passwordSubmitting}
                className="rounded-xl gap-2 bg-primary hover:bg-primary-hover text-white"
              >
                {passwordSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl gap-2 text-foreground hover:bg-muted/50 hover:text-foreground"
                onClick={closeChangePasswordModal}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
