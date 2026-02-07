import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Label } from '../components/ui/Label';
import { Switch } from '../components/ui/Switch';
import { Separator } from '../components/ui/Separator';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { 
  Shield, AlertTriangle, Merge, Users, 
  TrendingUp, FileText, Copy, CheckCircle, XCircle,
  AlertOctagon, MapPin
} from 'lucide-react';
import { adminActionLogs, incidents, barangays, disasterControlMode } from '../data/mockData';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export function AdminActionsPage() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'Admin';

  const [disasterMode, setDisasterMode] = useState(disasterControlMode.active);
  const [disasterType, setDisasterType] = useState('');
  const [selectedBarangays, setSelectedBarangays] = useState([]);
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [selectStates, setSelectStates] = useState({
    disasterType: false,
    filterAction: false,
    filterUser: false,
  });

  const duplicateIncidents = incidents.filter(inc => 
    inc.status === 'Duplicate' || (inc.possibleDuplicates && inc.possibleDuplicates.length > 0)
  );

  const adminUsers = [...new Set(adminActionLogs.map(log => log.adminUser))];

  const filteredLogs = adminActionLogs.filter(log => {
    const actionMatch = filterAction === 'all' || log.action === filterAction;
    const userMatch = filterUser === 'all' || log.adminUser === filterUser;
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
    return (
      <Layout>
        <div className="p-8">
          <Alert className="border-red-200 bg-red-50">
            <AlertOctagon className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Access Denied</AlertTitle>
            <AlertDescription className="text-red-800">
              This page is only accessible to administrators.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
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
    { value: 'Severity Escalation', label: 'Severity Escalation' },
    { value: 'Department Addition', label: 'Department Addition' },
    { value: 'Mark as Duplicate', label: 'Mark as Duplicate' },
    { value: 'Role Change', label: 'Role Change' },
    { value: 'Incident Closure', label: 'Incident Closure' },
  ];

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#134178]" />
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Admin Actions</h1>
              <p className="text-gray-600 mt-1">Advanced administrative controls and oversight</p>
            </div>
          </div>
        </div>

        {disasterMode && (
          <Alert className="mb-6 border-red-300 bg-red-50">
            <AlertOctagon className="h-5 w-5 text-red-600" />
            <AlertTitle className="text-red-900 font-semibold">
              Disaster Control Mode Active
            </AlertTitle>
            <AlertDescription className="text-red-800">
              Enhanced emergency protocols are currently in effect. Normal operating procedures are overridden.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="disaster" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="disaster">Disaster Control</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicate Management</TabsTrigger>
            <TabsTrigger value="logs">Admin Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="disaster">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className={disasterMode ? 'border-red-300' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertOctagon className={`w-5 h-5 ${disasterMode ? 'text-red-600' : 'text-gray-600'}`} />
                      Disaster Control Mode
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!disasterMode ? (
                      <>
                        <Alert className="border-amber-200 bg-amber-50">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertTitle className="text-amber-900">What is Disaster Control Mode?</AlertTitle>
                          <AlertDescription className="text-amber-800">
                            This mode enables emergency protocols for large-scale disasters like typhoons and floods.
                          </AlertDescription>
                        </Alert>

                        <div>
                          <Label>Disaster Type</Label>
                          <Select value={disasterType} onValueChange={setDisasterType}>
                            {({ isOpen, setIsOpen, value, onValueChange }) => (
                              <>
                                <SelectTrigger isOpen={selectStates.disasterType} onClick={() => setSelectStates({ ...selectStates, disasterType: !selectStates.disasterType })} className="mt-2">
                                  <SelectValue placeholder="Select disaster type" value={value} options={disasterTypeOptions} />
                                </SelectTrigger>
                                <SelectContent isOpen={selectStates.disasterType}>
                                  {disasterTypeOptions.map(option => (
                                    <SelectItem 
                                      key={option.value} 
                                      value={option.value} 
                                      onSelect={(val) => { setDisasterType(val); setSelectStates({ ...selectStates, disasterType: false }); }}
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
                          <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2 mb-2 flex gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex-1"
                                  onClick={() => setSelectedBarangays(barangays)}
                                >
                                  Select All Barangays
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="flex-1"
                                  onClick={() => setSelectedBarangays([])}
                                >
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
                                      if (e.target.checked) {
                                        setSelectedBarangays([...selectedBarangays, brgy]);
                                      } else {
                                        setSelectedBarangays(selectedBarangays.filter(b => b !== brgy));
                                      }
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                  <label htmlFor={`brgy-${brgy}`} className="text-sm text-gray-700 cursor-pointer">
                                    {brgy}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <Label className="mb-3 block">Priority Override Rules</Label>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">Auto-escalate to Warning</p>
                                <p className="text-xs text-gray-600">All new incidents automatically set to Warning severity</p>
                              </div>
                              <Switch 
                                checked={autoEscalate}
                                onCheckedChange={setAutoEscalate}
                              />
                            </div>
                          </div>
                        </div>

                        <Button 
                          className="w-full bg-red-600 hover:bg-red-700 gap-2"
                          onClick={handleActivateDisasterMode}
                        >
                          <AlertOctagon className="w-4 h-4" />
                          Activate Disaster Control Mode
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert className="border-red-300 bg-red-50">
                          <AlertOctagon className="h-4 w-4 text-red-600" />
                          <AlertTitle className="text-red-900">Disaster Mode Active</AlertTitle>
                          <AlertDescription className="text-red-800">
                            <strong>Type:</strong> {disasterType}<br />
                            <strong>Affected Areas:</strong> {selectedBarangays.length} barangays<br />
                            <strong>Auto-escalation:</strong> {autoEscalate ? 'Enabled' : 'Disabled'}
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-3">
                          <Button 
                            className="w-full gap-2"
                            onClick={() => alert('Bulk assignment interface would open here')}
                          >
                            <Users className="w-4 h-4" />
                            Bulk Incident Assignment
                          </Button>

                          <Button 
                            variant="outline"
                            className="w-full gap-2"
                            onClick={() => navigate('/map')}
                          >
                            <MapPin className="w-4 h-4" />
                            View Affected Areas on Map
                          </Button>
                        </div>

                        <Separator />

                        <Button 
                          variant="outline"
                          className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
                          onClick={handleDeactivateDisasterMode}
                        >
                          <XCircle className="w-4 h-4" />
                          Deactivate Disaster Mode
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card hover={false}>
                  <CardHeader>
                    <CardTitle className="text-base">Disaster Mode Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Bulk incident assignment by barangay</span>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Automatic severity escalation</span>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">Priority override controls</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="duplicates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Merge className="w-5 h-5" />
                  Duplicate Incident Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                {duplicateIncidents.length > 0 ? (
                  <div className="space-y-4">
                    {duplicateIncidents.map((incident) => (
                      <div 
                        key={incident.id} 
                        className="p-4 border border-gray-200 rounded-lg hover:border-[#FF4F52]/30 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900">{incident.id}</h3>
                              {incident.status === 'Duplicate' && (
                                <Badge variant="outline" className="bg-gray-100 text-gray-700">
                                  <Copy className="w-3 h-3 mr-1" />
                                  Marked as Duplicate
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{incident.emergencyType} - {incident.barangay}</p>
                          </div>
                          <Badge className={
                            incident.severity === 'Critical' ? 'bg-red-100 text-red-800 border-red-300' :
                            incident.severity === 'Warning' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-green-100 text-green-800 border-green-300'
                          }>
                            {incident.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{incident.description}</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/incidents/${incident.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <p className="text-gray-600">No duplicate incidents detected</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Admin Action Logs
                  </CardTitle>
                  <div className="flex gap-2">
                    <Select value={filterAction} onValueChange={setFilterAction}>
                      {({ isOpen, setIsOpen, value, onValueChange }) => (
                        <>
                          <SelectTrigger isOpen={selectStates.filterAction} onClick={() => setSelectStates({ ...selectStates, filterAction: !selectStates.filterAction })} className="w-48">
                            <SelectValue placeholder="Filter by action" value={value} options={actionFilterOptions} />
                          </SelectTrigger>
                          <SelectContent isOpen={selectStates.filterAction}>
                            {actionFilterOptions.map(option => (
                              <SelectItem 
                                key={option.value} 
                                value={option.value} 
                                onSelect={(val) => { setFilterAction(val); setSelectStates({ ...selectStates, filterAction: false }); }}
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
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-4 border border-gray-200 rounded-lg hover:border-[#FF4F52]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.action === 'Severity Escalation' && <TrendingUp className="w-4 h-4 text-amber-600" />}
                          {log.action === 'Department Addition' && <Users className="w-4 h-4 text-blue-600" />}
                          {log.action === 'Mark as Duplicate' && <Copy className="w-4 h-4 text-gray-600" />}
                          {log.action === 'Role Change' && <Shield className="w-4 h-4 text-purple-600" />}
                          {log.action === 'Incident Closure' && <CheckCircle className="w-4 h-4 text-green-600" />}
                          <Badge variant="outline" className="text-xs">
                            {log.action}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                      </div>
                      
                      <div className="space-y-1 mb-2">
                        <p className="text-sm text-gray-900">
                          <strong>Admin:</strong> {log.adminUser}
                        </p>
                        <p className="text-sm text-gray-700">
                          <strong>Details:</strong> {log.details}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Reason:</strong> {log.reason}
                        </p>
                      </div>

                      {log.affectedIncident && (
                        <Button 
                          size="sm" 
                          variant="link" 
                          className="p-0 h-auto text-xs text-[#134178]"
                          onClick={() => navigate(`/incidents/${log.affectedIncident}`)}
                        >
                          View Incident {log.affectedIncident} →
                        </Button>
                      )}
                    </div>
                  ))}

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No admin actions match the current filters</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
