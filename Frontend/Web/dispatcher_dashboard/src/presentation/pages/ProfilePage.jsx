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
import { Button, Card, Form, Input, Modal, Tag } from 'antd';
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
import { alertUser } from '@/presentation/feedback/alertUser';
import { DEV_MODE } from '@/core/config/app.config';

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
    alertUser({
      title: 'Log out?',
      text: 'Are you sure you want to end your session?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Logout',
      cancelButtonText: 'Cancel',
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

  const handleChangePasswordSubmit = async () => {
    const errors = validateChangePassword();
    if (Object.keys(errors).length > 0) {
      alertUser({
        icon: 'error',
        title: 'Validation failed',
        text: Object.values(errors).join(' '),
        confirmButtonColor: '#134178',
      });
      return;
    }
    setPasswordSubmitting(true);
    try {
      await changePasswordApi(currentPassword, newPassword);
      closeChangePasswordModal();
      setChangePasswordOpen(false);
      clearAuthSession();
      alertUser({
        icon: 'success',
        title: 'Password updated',
        text: 'Please log in again with your new password.',
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
      }).then(() => {
        navigate('/login');
      });
    } catch (err) {
      alertUser({
        icon: 'error',
        title: 'Could not update password',
        text: err.message || 'Current password may be incorrect. Please try again.',
        confirmButtonColor: '#134178',
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
      alertUser({
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

      alertUser({
        icon: 'success',
        title: 'Profile updated',
        timer: 1800,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      alertUser({
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

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Profile' }]} />
        <Card
          size="small"
          style={{ marginTop: 12, marginBottom: 12 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <User size={18} />
              User Profile
            </span>
          )}
        >
          <p style={{ margin: 0, opacity: 0.75 }}>Manage your account settings and information</p>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card
            size="small"
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <UserCircle size={16} />
                Profile Information
              </span>
            )}
            extra={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!profileLoading && !profileError && profile && !isEditing && (
                  <Button icon={<Pencil size={14} />} onClick={startEditing}>Edit</Button>
                )}
                {isEditing && (
                  <>
                    <Button type="primary" disabled={!canSaveProfile} onClick={handleSaveProfile}>
                      {profileSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button onClick={cancelEditing} disabled={profileSaving}>Cancel</Button>
                  </>
                )}
                {profile?.role && (
                  <Tag color="blue">
                    {profile.role === 'dispatcher' ? 'Operator' : (profile.role || '').toUpperCase()}
                  </Tag>
                )}
              </div>
            )}
          >
            {profileLoading && <p>Loading profile...</p>}
            {profileError && <p style={{ color: '#dc2626' }}>{profileError}</p>}
            {!profileLoading && !profileError && profile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  className="sr-only"
                  onChange={handleAvatarPick}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                  <div style={{ position: 'relative' }}>
                    <ProfileAvatar
                      firstName={isEditing ? editFirstName : profile.firstName}
                      lastName={isEditing ? editLastName : profile.lastName}
                      photoUrl={avatarUrl}
                      size="md"
                      rounded="rounded-2xl"
                      onClick={isEditing ? () => avatarInputRef.current?.click() : undefined}
                    />
                    {isEditing && (
                      <span style={{
                        position: 'absolute', bottom: -4, right: -4, width: 28, height: 28,
                        borderRadius: '50%', background: '#134178', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Camera size={14} />
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {isEditing ? (
                      <Form layout="vertical" style={{ maxWidth: 480 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <Form.Item
                            label="First name"
                            validateStatus={nameErrors.firstName ? 'error' : undefined}
                            help={nameErrors.firstName}
                            style={{ marginBottom: 0 }}
                          >
                            <Input
                              maxLength={MAX_NAME_LENGTH}
                              value={editFirstName}
                              onChange={(e) => {
                                setEditFirstName(e.target.value);
                                if (nameErrors.firstName) setNameErrors((p) => ({ ...p, firstName: undefined }));
                              }}
                            />
                          </Form.Item>
                          <Form.Item
                            label="Last name"
                            validateStatus={nameErrors.lastName ? 'error' : undefined}
                            help={nameErrors.lastName}
                            style={{ marginBottom: 0 }}
                          >
                            <Input
                              maxLength={MAX_NAME_LENGTH}
                              value={editLastName}
                              onChange={(e) => {
                                setEditLastName(e.target.value);
                                if (nameErrors.lastName) setNameErrors((p) => ({ ...p, lastName: undefined }));
                              }}
                            />
                          </Form.Item>
                        </div>
                      </Form>
                    ) : (
                      <>
                        <h3 style={{ margin: 0 }}>
                          {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}
                        </h3>
                        <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 13 }}>Emergency Operations Center</p>
                      </>
                    )}
                    {isEditing && (avatarUrl || profile.has_profile_image) && (
                      <Button type="link" danger onClick={handleRemoveAvatar} style={{ paddingLeft: 0 }}>
                        Remove photo
                      </Button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Mail size={16} />
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Email Address</div>
                      <div style={{ fontWeight: 500 }}>{profile.email || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={16} />
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Role</div>
                      <div style={{ fontWeight: 500 }}>
                        {profile.role === 'dispatcher' ? 'Operator' : profile.role || '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Phone size={16} />
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Phone Number</div>
                      <div style={{ fontWeight: 500 }}>{profile.phone || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Clock size={16} />
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>Member since</div>
                      <div style={{ fontWeight: 500 }}>
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true,
                          })
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card
            size="small"
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={16} />
                Change Password
              </span>
            )}
            extra={(
              <Button type="primary" icon={<KeyRound size={14} />} onClick={() => setChangePasswordOpen(true)}>
                Change Password
              </Button>
            )}
          >
            <p style={{ margin: 0, opacity: 0.75 }}>Update your account password</p>
          </Card>

          <Card
            size="small"
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} />
                Session Information
              </span>
            )}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 500 }}>Current Session</div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>Last activity: Just now</div>
              </div>
              <Tag color="blue">Active</Tag>
            </div>
            {profile?.created_at && (
              <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, opacity: 0.7 }}>
                Member since {new Date(profile.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit', hour12: true,
                })}
              </p>
            )}
          </Card>

          <Card size="small">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LogOut size={18} />
                <div>
                  <div style={{ fontWeight: 600 }}>Sign Out</div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>End your current session</div>
                </div>
              </div>
              <Button icon={<LogOut size={14} />} onClick={handleLogout}>Logout</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={changePasswordOpen}
        title="Change Password"
        onCancel={closeChangePasswordModal}
        footer={[
          <Button key="cancel" onClick={closeChangePasswordModal}>Cancel</Button>,
          <Button key="submit" type="primary" loading={passwordSubmitting} onClick={handleChangePasswordSubmit}>
            {passwordSubmitting ? 'Updating...' : 'Update Password'}
          </Button>,
        ]}
      >
        <p style={{ opacity: 0.75, marginTop: 0 }}>Update your account password</p>
        <Form layout="vertical">
          <Form.Item
            label="Current Password"
            validateStatus={passwordErrors.currentPassword ? 'error' : undefined}
            help={passwordErrors.currentPassword}
          >
            <Input.Password
              placeholder="Enter current password"
              value={currentPassword}
              visibilityToggle={{
                visible: showCurrentPassword,
                onVisibleChange: setShowCurrentPassword,
              }}
              iconRender={(visible) => (visible ? <EyeOff size={16} /> : <Eye size={16} />)}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (passwordErrors.currentPassword) setPasswordErrors((p) => ({ ...p, currentPassword: undefined }));
              }}
            />
          </Form.Item>
          <Form.Item
            label="New Password"
            validateStatus={passwordErrors.newPassword ? 'error' : undefined}
            help={passwordErrors.newPassword}
          >
            <Input.Password
              placeholder="Enter new password"
              value={newPassword}
              visibilityToggle={{
                visible: showNewPassword,
                onVisibleChange: setShowNewPassword,
              }}
              iconRender={(visible) => (visible ? <EyeOff size={16} /> : <Eye size={16} />)}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordErrors.newPassword) setPasswordErrors((p) => ({ ...p, newPassword: undefined }));
              }}
            />
          </Form.Item>
          <Form.Item
            label="Confirm New Password"
            validateStatus={passwordErrors.confirmPassword ? 'error' : undefined}
            help={passwordErrors.confirmPassword}
          >
            <Input.Password
              placeholder="Confirm new password"
              value={confirmPassword}
              visibilityToggle={{
                visible: showConfirmPassword,
                onVisibleChange: setShowConfirmPassword,
              }}
              iconRender={(visible) => (visible ? <EyeOff size={16} /> : <Eye size={16} />)}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordErrors.confirmPassword) setPasswordErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
