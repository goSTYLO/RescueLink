import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Label } from '../components/ui/Label';
import { Input } from '../components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/Dialog';
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const PROFILE_THEME = '#134178';
const PROFILE_THEME_HOVER = '#0f3260';
const MIN_PASSWORD_LENGTH = 8;

export function ProfilePage() {
  const navigate = useNavigate();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({});
  const [emergencyErrors, setEmergencyErrors] = useState({});

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
        title: 'text-gray-900 text-xl',
        htmlContainer: 'text-gray-600',
        confirmButton: 'rounded-xl px-5 py-2.5 font-medium',
        cancelButton: 'rounded-xl px-5 py-2.5 font-medium',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('user');
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

  const handleChangePasswordSubmit = (e) => {
    e.preventDefault();
    const errors = validateChangePassword();
    if (Object.keys(errors).length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Validation failed',
        text: Object.values(errors).join(' '),
        confirmButtonColor: PROFILE_THEME,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
      return;
    }
    closeChangePasswordModal();
    Swal.fire({
      icon: 'success',
      title: 'Password updated',
      text: 'Your password has been changed successfully.',
      timer: 2000,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: { popup: 'rounded-2xl shadow-xl' },
    });
  };

  const validateEmergencyContact = () => {
    const err = {};
    if (!emergencyName.trim()) err.name = 'Emergency contact name is required.';
    const phone = emergencyPhone.replace(/\s/g, '');
    if (!phone) err.phone = 'Emergency contact phone is required.';
    else if (!/^\+?[\d\s-]{10,}$/.test(phone)) err.phone = 'Please enter a valid phone number.';
    setEmergencyErrors(err);
    return err;
  };

  const handleSaveEmergencyContact = (e) => {
    e.preventDefault();
    const errors = validateEmergencyContact();
    if (Object.keys(errors).length > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Validation failed',
        text: Object.values(errors).join(' '),
        confirmButtonColor: PROFILE_THEME,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
      return;
    }
    Swal.fire({
      icon: 'success',
      title: 'Contact saved',
      text: 'Emergency contact has been saved successfully.',
      timer: 2000,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: { popup: 'rounded-2xl shadow-xl' },
    });
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
      <div className="p-8 max-w-4xl relative min-h-[calc(100vh-8rem)]">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-medium text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-1 text-base">
            Manage your account settings and information
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Information */}
          <Card className="animate-slide-up">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Profile Information</CardTitle>
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase border text-white"
                style={{
                  backgroundColor: PROFILE_THEME,
                  borderColor: PROFILE_THEME,
                }}
              >
                OPERATOR
              </span>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-5">
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md"
                  style={{ backgroundColor: PROFILE_THEME }}
                >
                  <User className="w-8 h-8" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Officer Rodriguez
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Emergency Operations Center
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex items-center gap-3 text-gray-700">
                  <Mail className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Email Address</p>
                    <p className="text-sm font-medium text-gray-900">
                      rodriguez@rescuelink-dagupan.gov
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Shield className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="text-sm font-medium text-gray-900">Operator</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Phone className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Phone Number</p>
                    <p className="text-sm font-medium text-gray-900">
                      +639171234567
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Clock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Last Login</p>
                    <p className="text-sm font-medium text-gray-900">
                      1/20/2026, 9:00:00 AM
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Change Password</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Update your account password
                </p>
              </div>
              <Button
                className="gap-2 text-white border-0 focus:ring-[#134178] shrink-0"
                style={{
                  backgroundColor: PROFILE_THEME,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = PROFILE_THEME_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = PROFILE_THEME;
                }}
                onClick={() => setChangePasswordOpen(true)}
              >
                <KeyRound className="w-4 h-4" />
                Change Password
              </Button>
            </CardHeader>
          </Card>

          {/* Session Information */}
          <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle>Session Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Current Session
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Last activity: Just now
                  </p>
                </div>
                <span className="px-3 py-1 rounded-lg text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                  Active
                </span>
              </div>
              <p className="text-sm text-gray-500 pt-1">
                Logged in since 1/20/2026, 9:00:00 AM
              </p>
            </CardContent>
          </Card>

          {/* Emergency Contact Information */}
          <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <CardHeader>
              <CardTitle>Emergency Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="emergency-name">Emergency Contact Name</Label>
                <Input
                  id="emergency-name"
                  placeholder="Enter emergency contact name"
                  className="mt-1.5 bg-gray-50 border-gray-200"
                  value={emergencyName}
                  onChange={(e) => {
                    setEmergencyName(e.target.value);
                    if (emergencyErrors.name) setEmergencyErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  error={!!emergencyErrors.name}
                />
                {emergencyErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{emergencyErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="emergency-phone">Emergency Contact Phone</Label>
                <Input
                  id="emergency-phone"
                  placeholder="+63 9XX XXX XXXX"
                  className="mt-1.5 bg-gray-50 border-gray-200"
                  value={emergencyPhone}
                  onChange={(e) => {
                    setEmergencyPhone(e.target.value);
                    if (emergencyErrors.phone) setEmergencyErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  error={!!emergencyErrors.phone}
                />
                {emergencyErrors.phone && (
                  <p className="text-red-500 text-sm mt-1">{emergencyErrors.phone}</p>
                )}
              </div>
              <Button variant="secondary" className="mt-2" onClick={handleSaveEmergencyContact}>
                Save Emergency Contact
              </Button>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card className="animate-slide-up bg-red-50/30 border-red-100" style={{ animationDelay: '200ms' }}>
            <CardContent className="p-6 flex flex-row flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sign Out
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  End your current session
                </p>
              </div>
              <Button
                className="gap-2 bg-red-500 hover:bg-red-600 text-white border-0 focus:ring-red-500"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </CardContent>
          </Card>
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
        <DialogContent className="rounded-xl shadow-sm border border-gray-200 animate-fade-in">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-900">
              Change Password
            </DialogTitle>
            <DialogDescription className="text-gray-500 mt-0.5">
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
                  className="pr-10 bg-gray-50 border-gray-200"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                  className="pr-10 bg-gray-50 border-gray-200"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  onClick={() => setShowNewPassword((v) => !v)}
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                  className="pr-10 bg-gray-50 border-gray-200"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword}</p>
              )}
            </div>
            <DialogFooter className="justify-between mt-6">
              <Button
                type="submit"
                className="gap-2 text-white border-0 focus:ring-[#134178]"
                style={{
                  backgroundColor: PROFILE_THEME,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = PROFILE_THEME_HOVER;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = PROFILE_THEME;
                }}
              >
                Update Password
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 border border-gray-200 text-gray-700 hover:bg-gray-100"
                onClick={closeChangePasswordModal}
              >
                <KeyRound className="w-4 h-4" />
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
