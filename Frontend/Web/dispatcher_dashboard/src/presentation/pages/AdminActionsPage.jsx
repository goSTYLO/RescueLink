import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Label } from '@/presentation/components/ui/Label';
import { Switch } from '@/presentation/components/ui/Switch';
import { Alert, AlertDescription, AlertTitle } from '@/presentation/components/ui/Alert';
import {
  Shield,
  AlertTriangle,
  Merge,
  Users,
  TrendingUp,
  FileText,
  Copy,
  CheckCircle,
  XCircle,
  AlertOctagon,
  MapPin,
  Settings,
  ListChecks,
} from 'lucide-react';
import { incidents, barangays, disasterControlMode } from '@/data/mock/mockData';
import { getAdminLogs } from '@/data/api/auditLog.api';
import { ROLES, normalizeRole } from '@/core/constants';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';

export function AdminActionsPage() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAdmin = normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN;

  const [disasterMode, setDisasterMode] = useState(disasterControlMode.active);
  const [disasterType, setDisasterType] = useState('');
  const [selectedBarangays, setSelectedBarangays] = useState([]);
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminLogsLoading, setAdminLogsLoading] = useState(true);
  const [adminLogsError, setAdminLogsError] = useState(null);
  const [selectStates, setSelectStates] = useState({
    disasterType: false,
    filterAction: false,
    filterUser: false,
  });

  const fetchAdminLogs = useCallback(async () => {
    setAdminLogsLoading(true);
    setAdminLogsError(null);
    try {
      const data = await getAdminLogs({
        limit: 100,
        offset: 0,
        action: filterAction !== 'all' ? filterAction : undefined,
      });
      setAdminLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setAdminLogsError(err.message || 'Failed to load admin logs');
      setAdminLogs([]);
    } finally {
      setAdminLogsLoading(false);
    }
  }, [filterAction]);

  useEffect(() => {
    fetchAdminLogs();
  }, [fetchAdminLogs]);

  const duplicateIncidents = incidents.filter(inc =>
    inc.status === 'Duplicate' || (inc.possibleDuplicates && inc.possibleDuplicates.length > 0)
  );

  const adminUsers = [...new Set(adminLogs.map(log => log.user_email || [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || `User #${log.user_id}`))];

  const filteredLogs = adminLogs.filter(log => {
    const actionMatch = filterAction === 'all' || log.action === filterAction;
    const adminLabel = log.user_email || [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || `User #${log.user_id}`;
    const userMatch = filterUser === 'all' || adminLabel === filterUser;
    return actionMatch && userMatch;
  });

  const handleActivateDisasterMode = () => {
    if (!disasterType) {
      Swal.fire({
        icon: 'warning',
        title: 'Select Disaster Type',
        text: 'Please select a disaster type (e.g., Typhoon, Flood) before activating emergency protocols.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    if (selectedBarangays.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Select Affected Areas',
        text: 'Please select at least one affected barangay to enable Disaster Control Mode.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    setDisasterMode(true);
    const autoEscalateNote = autoEscalate ? '<br><strong>Auto-escalation:</strong> New incidents will automatically be set to Warning.' : '';
    Swal.fire({
      icon: 'success',
      title: 'Disaster Control Mode Activated',
      html: `Emergency protocols are now active for <strong>${disasterType}</strong>.<br><br>
             <strong>Affected barangays:</strong> ${selectedBarangays.join(', ')}${autoEscalateNote}`,
      confirmButtonColor: '#134178',
      confirmButtonText: 'Understood',
    });
  };

  const handleDeactivateDisasterMode = () => {
    Swal.fire({
      title: 'Deactivate Disaster Control Mode?',
      text: 'This will revert to normal operating procedures. Emergency protocols will be disabled.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, deactivate',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setDisasterMode(false);
        setDisasterType('');
        setSelectedBarangays([]);
        setAutoEscalate(false);
        Swal.fire({
          icon: 'success',
          title: 'Deactivated',
          text: 'Disaster Control Mode has been turned off. Normal operations resumed.',
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true,
        });
      }
    });
  };

  if (!isAdmin) {
    return <AccessDeniedNotice message="This page is only accessible to administrators." redirectPath="/dashboard" />;
  }

  const disasterTypeOptions = [
    { value: 'Typhoon', label: 'Typhoon' },
    { value: 'Flood', label: 'Flood' },
    { value: 'Earthquake', label: 'Earthquake' },
    { value: 'Fire - Multiple Locations', label: 'Fire - Multiple Locations' },
    { value: 'Other Mass Emergency', label: 'Other Mass Emergency' },
  ];

  const actionFilterOptions = [
    { value: 'all', label: 'All Actions' },
    { value: 'user_create', label: 'User created' },
    { value: 'user_role_update', label: 'Role change' },
    { value: 'user_deactivate', label: 'User deactivated' },
    { value: 'user_delete', label: 'User deleted' },
    { value: 'user_read', label: 'User read' },
    { value: 'users_list', label: 'Users list' },
    { value: 'stats_view', label: 'Stats view' },
  ];

  function formatActionLabel(action) {
    const opt = actionFilterOptions.find((o) => o.value === action);
    return opt ? opt.label : (action || '—').replace(/_/g, ' ');
  }

  function formatTimestamp(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  function formatDetailsForDisplay(details) {
    if (details == null) return '—';
    const parsed = typeof details === 'object' ? details : (typeof details === 'string' && details.trim().startsWith('{') ? (() => { try { return JSON.parse(details); } catch { return null; } })() : null);
    if (!parsed || typeof parsed !== 'object') return details != null ? String(details) : '—';
    const entries = Object.entries(parsed).filter(([, v]) => v != null && v !== '');
    return entries.length > 0 ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '—';
  }

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${
      accent === 'primary' ? 'text-primary' : accent === 'danger' ? 'text-red-500' : 'text-foreground'
    }`;
  const iconSmClass = () =>
    `w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className={`${heroCardClass} mb-6`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Shield className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Actions</h1>
              <p className="text-muted mt-1">Advanced administrative controls and oversight</p>
            </div>
          </div>
        </div>

        {disasterMode && (
          <Alert className={`mb-6 rounded-xl border ${isLight ? 'border-red-300 bg-red-50' : 'border-red-500/40 bg-red-500/10'}`}>
            <AlertOctagon className={`h-5 w-5 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
            <AlertTitle className={isLight ? 'text-red-900 font-semibold' : 'text-red-200 font-semibold'}>
              Disaster Control Mode Active
            </AlertTitle>
            <AlertDescription className={isLight ? 'text-red-800' : 'text-red-300/90'}>
              Enhanced emergency protocols are currently in effect. Normal operating procedures are overridden.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="logs" className="space-y-6">
          <div className={`w-full rounded-xl p-1 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
            <TabsList className="flex w-full rounded-xl border-0 bg-transparent p-0 gap-1 h-11">
              {/* Disaster Control tab hidden for now - re-enable when ready */}
              {/* <TabsTrigger value="disaster" className="rounded-lg flex-1 min-w-0">Disaster Control</TabsTrigger> */}
              <TabsTrigger value="duplicates" className="rounded-lg flex-1 min-w-0">Duplicate Management</TabsTrigger>
              <TabsTrigger value="logs" className="rounded-lg flex-1 min-w-0">Admin Logs</TabsTrigger>
            </TabsList>
          </div>

          {/* Disaster Control tab content - hidden for now */}
          {false && <TabsContent value="disaster">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className={`${panelClass} ${disasterMode ? (isLight ? 'border-red-300' : 'border-red-500/40') : ''}`}>
                  <div className={headerClass}>
                    <span className={iconBoxClass(disasterMode ? 'danger' : 'primary')}>
                      <AlertOctagon className="w-5 h-5" strokeWidth={2} />
                    </span>
                    <span className="font-medium text-foreground">Disaster Control Mode</span>
                  </div>
                  <div className="p-6 space-y-6">
                    {!disasterMode ? (
                      <>
                        <Alert className={`rounded-xl border ${isLight ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                          <AlertTriangle className={`h-4 w-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                          <AlertTitle className={isLight ? 'text-amber-900' : 'text-amber-200'}>What is Disaster Control Mode?</AlertTitle>
                          <AlertDescription className={isLight ? 'text-amber-800' : 'text-amber-300/90'}>
                            This mode enables emergency protocols for large-scale disasters like typhoons and floods.
                          </AlertDescription>
                        </Alert>

                        <div className="overflow-visible">
                          <Label className="block mb-2">Disaster Type</Label>
                          <Select
                            value={disasterType}
                            onValueChange={setDisasterType}
                            open={selectStates.disasterType}
                            onOpenChange={(open) => setSelectStates((s) => ({ ...s, disasterType: open }))}
                          >
                            {({ value, dropdownRect }) => (
                              <>
                                <SelectTrigger
                                  isOpen={selectStates.disasterType}
                                  onClick={() => setSelectStates((s) => ({ ...s, disasterType: !s.disasterType }))}
                                  className={`mt-2 w-full rounded-xl py-2.5 border-2 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                                >
                                  <SelectValue placeholder="Select disaster type" value={value} options={disasterTypeOptions} />
                                </SelectTrigger>
                                <SelectContent isOpen={selectStates.disasterType} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
                                  {disasterTypeOptions.map(option => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                      onSelect={(val) => { setDisasterType(val); setSelectStates((s) => ({ ...s, disasterType: false })); }}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </>
                            )}
                          </Select>
                        </div>

                        <div>
                          <Label className="mb-2 block">Affected Barangays ({selectedBarangays.length} selected)</Label>
                          <div className={`rounded-xl border p-4 max-h-64 overflow-y-auto ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-white/10 bg-white/5'}`}>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2 mb-2 flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => setSelectedBarangays(barangays)}>
                                  Select All Barangays
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => setSelectedBarangays([])}>
                                  Unselect All Barangays
                                </Button>
                              </div>
                              {barangays.map((brgy) => (
                                <div key={brgy} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`brgy-${brgy}`}
                                    checked={selectedBarangays.includes(brgy)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedBarangays([...selectedBarangays, brgy]);
                                      else setSelectedBarangays(selectedBarangays.filter(b => b !== brgy));
                                    }}
                                    className={`rounded border-2 ${isLight ? 'border-gray-300' : 'border-white/30'}`}
                                  />
                                  <label htmlFor={`brgy-${brgy}`} className="text-sm text-foreground cursor-pointer">
                                    {brgy}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className={`border-t ${isLight ? 'border-gray-200' : 'border-white/10'}`} />

                        <div>
                          <Label className="mb-3 block">Priority Override Rules</Label>
                          <div className={`flex items-center justify-between p-4 rounded-xl border ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-white/10 bg-white/5'}`}>
                            <div>
                              <p className="text-sm font-medium text-foreground">Auto-escalate to Warning</p>
                              <p className="text-xs text-muted">All new incidents automatically set to Warning severity</p>
                            </div>
                            <Switch checked={autoEscalate} onCheckedChange={setAutoEscalate} />
                          </div>
                        </div>

                        <Button className="w-full rounded-xl gap-2 bg-red-600 hover:bg-red-700 text-white font-medium" onClick={handleActivateDisasterMode}>
                          <AlertOctagon className="w-4 h-4" strokeWidth={2} />
                          Activate Disaster Control Mode
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert className={`rounded-xl border ${isLight ? 'border-red-300 bg-red-50' : 'border-red-500/40 bg-red-500/10'}`}>
                          <AlertOctagon className={`h-4 w-4 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
                          <AlertTitle className={isLight ? 'text-red-900' : 'text-red-200'}>Disaster Mode Active</AlertTitle>
                          <AlertDescription className={isLight ? 'text-red-800' : 'text-red-300/90'}>
                            <strong>Type:</strong> {disasterType}<br />
                            <strong>Affected Areas:</strong> {selectedBarangays.length} barangays<br />
                            <strong>Auto-escalation:</strong> {autoEscalate ? 'Enabled' : 'Disabled'}
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-3">
                          <Button className="w-full rounded-xl gap-2" onClick={() => alert('Bulk assignment interface would open here')}>
                            <Users className="w-4 h-4" strokeWidth={2} />
                            Bulk Incident Assignment
                          </Button>
                          <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => navigate('/map')}>
                            <MapPin className="w-4 h-4" strokeWidth={2} />
                            View Affected Areas on Map
                          </Button>
                        </div>

                        <div className={`border-t ${isLight ? 'border-gray-200' : 'border-white/10'}`} />

                        <Button
                          variant="outline"
                          className={`w-full rounded-xl gap-2 ${isLight ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-red-400 border-red-500/40 hover:bg-red-500/10'}`}
                          onClick={handleDeactivateDisasterMode}
                        >
                          <XCircle className="w-4 h-4" strokeWidth={2} />
                          Deactivate Disaster Mode
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className={panelClass}>
                  <div className={headerClass}>
                    <span className={iconBoxClass('primary')}>
                      <Settings className="w-5 h-5" strokeWidth={2} />
                    </span>
                    <span className="font-medium text-foreground text-base">Disaster Mode Features</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex gap-3 items-start">
                        <span className={iconSmClass()}>
                          <CheckCircle className="w-4 h-4" strokeWidth={2} />
                        </span>
                        <span className="text-foreground">Bulk incident assignment by barangay</span>
                      </div>
                      <div className="flex gap-3 items-start">
                        <span className={iconSmClass()}>
                          <CheckCircle className="w-4 h-4" strokeWidth={2} />
                        </span>
                        <span className="text-foreground">Automatic severity escalation</span>
                      </div>
                      <div className="flex gap-3 items-start">
                        <span className={iconSmClass()}>
                          <CheckCircle className="w-4 h-4" strokeWidth={2} />
                        </span>
                        <span className="text-foreground">Priority override controls</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>}

          <TabsContent value="duplicates">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={iconBoxClass('primary')}>
                  <Merge className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="font-medium text-foreground">Duplicate Incident Management</span>
              </div>
              <div className="p-4">
                {duplicateIncidents.length > 0 ? (
                  <div className="space-y-3">
                    {duplicateIncidents.map((incident) => (
                      <div
                        key={incident.id}
                        className={`rounded-xl border p-4 transition-all duration-200 ${isLight ? 'bg-gray-50/80 border-gray-200/80 hover:border-primary/30' : 'bg-white/5 border-white/10 hover:border-primary/30'}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={iconSmClass()}>
                              <Copy className="w-4 h-4" strokeWidth={2} />
                            </span>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-medium text-foreground">{incident.id}</h3>
                                {incident.status === 'Duplicate' && (
                                  <Badge variant="outline" className="rounded-lg bg-secondary/20 text-foreground border-border">
                                    Marked as Duplicate
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted">{incident.emergencyType} — {incident.barangay}</p>
                            </div>
                          </div>
                          <Badge
                            className={`rounded-lg ${
                              incident.severity === 'Critical' ? 'bg-primary/20 text-primary border-primary/50' :
                              incident.severity === 'Warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                              'bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40'
                            }`}
                          >
                            {incident.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground mb-3">{incident.description}</p>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate(`/incidents/${incident.id}`)}>
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <span className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-severity-resolved' : 'neumorphic-dark-inset bg-white/10 text-severity-resolved'}`}>
                      <CheckCircle className="w-7 h-7" strokeWidth={2} />
                    </span>
                    <p className="text-muted">No duplicate incidents detected</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={iconBoxClass('primary')}>
                  <ListChecks className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="font-medium text-foreground flex-1">Admin Action Logs</span>
                <div className="overflow-visible">
                  <Select
                    value={filterAction}
                    onValueChange={setFilterAction}
                    open={selectStates.filterAction}
                    onOpenChange={(open) => setSelectStates((s) => ({ ...s, filterAction: open }))}
                  >
                    {({ value, dropdownRect }) => (
                      <>
                        <SelectTrigger
                          isOpen={selectStates.filterAction}
                          onClick={() => setSelectStates((s) => ({ ...s, filterAction: !s.filterAction }))}
                          className={`w-48 rounded-xl py-2.5 border-2 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                        >
                          <SelectValue placeholder="Filter by action" value={value} options={actionFilterOptions} />
                        </SelectTrigger>
                        <SelectContent isOpen={selectStates.filterAction} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
                          {actionFilterOptions.map(option => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              onSelect={(val) => { setFilterAction(val); setSelectStates((s) => ({ ...s, filterAction: false })); }}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
              </div>
              <div className="p-4">
                {adminLogsError && (
                  <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
                    {adminLogsError}
                  </div>
                )}
                {adminLogsLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted">
                    <ListChecks className="w-10 h-10 animate-pulse" strokeWidth={2} />
                    <span>Loading admin logs...</span>
                  </div>
                ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => {
                    const details = typeof log.details === 'object' ? log.details : (typeof log.details === 'string' && log.details.trim().startsWith('{') ? (() => { try { return JSON.parse(log.details); } catch { return {}; } })() : {});
                    const adminLabel = log.user_email || [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || `User #${log.user_id}`;
                    const incidentId = log.resource_id ?? details?.report_id ?? details?.incident_id ?? details?.user_id;
                    return (
                    <div
                      key={log.id}
                      className={`rounded-xl border p-4 transition-all duration-200 ${isLight ? 'bg-gray-50/80 border-gray-200/80 hover:border-primary/30' : 'bg-white/5 border-white/10 hover:border-primary/30'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {(log.action === 'user_role_update' || log.action === 'user_deactivate' || log.action === 'user_delete') && <span className={iconSmClass()}><Shield className="w-4 h-4" strokeWidth={2} /></span>}
                          {log.action === 'user_create' && <span className={iconSmClass()}><Users className="w-4 h-4" strokeWidth={2} /></span>}
                          {log.action === 'stats_view' && <span className={iconSmClass()}><TrendingUp className="w-4 h-4" strokeWidth={2} /></span>}
                          {!['user_role_update', 'user_deactivate', 'user_delete', 'user_create', 'stats_view'].includes(log.action) && <span className={iconSmClass()}><FileText className="w-4 h-4" strokeWidth={2} /></span>}
                          <Badge variant="outline" className="rounded-lg text-xs border-border bg-primary/5 text-primary">
                            {formatActionLabel(log.action)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted">{formatTimestamp(log.created_at)}</span>
                      </div>
                      <div className="space-y-1 mb-2">
                        <p className="text-sm text-foreground"><strong>Admin:</strong> {adminLabel}</p>
                        <p className="text-sm text-foreground"><strong>Details:</strong> {formatDetailsForDisplay(log.details)}</p>
                        {details?.reason && <p className="text-sm text-muted"><strong>Reason:</strong> {details.reason}</p>}
                      </div>
                      {incidentId && log.resource_type === 'incident' && (
                        <Button size="sm" variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/incidents/${incidentId}`)}>
                          View Incident {incidentId} →
                        </Button>
                      )}
                      {incidentId && log.resource_type === 'user' && (
                        <Button size="sm" variant="link" className="p-0 h-auto text-xs text-primary" onClick={() => navigate(`/admin/users`)}>
                          View user #{incidentId} →
                        </Button>
                      )}
                    </div>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12">
                      <span className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-muted' : 'neumorphic-dark-inset bg-white/10 text-muted'}`}>
                        <FileText className="w-7 h-7" strokeWidth={2} />
                      </span>
                      <p className="text-muted">No admin actions match the current filters</p>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
