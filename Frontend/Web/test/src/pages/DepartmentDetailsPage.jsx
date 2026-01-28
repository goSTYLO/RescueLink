import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Label } from '../components/ui/Label';
import { ArrowLeft, Truck, Users as UsersIcon, ClipboardList, Wrench, Award, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { departments, units, personnel, incidents } from '../data/mockData';

export function DepartmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const department = departments.find(d => d.id === id);
  const deptUnits = units[id || ''] || [];
  const deptPersonnel = personnel[id || ''] || [];
  const deptIncidents = incidents.filter(i => i.status === 'In Progress');

  if (!department) {
    return (
      <Layout>
        <div className="p-8">
          <p>Department not found</p>
        </div>
      </Layout>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-700 border-green-200';
      case 'On Dispatch': case 'On Duty': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Busy': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Under Maintenance': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Out of Service': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCertificationStatus = (status) => {
    switch (status) {
      case 'Valid': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Valid</Badge>;
      case 'Expiring Soon': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Expiring Soon</Badge>;
      case 'Expired': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Expired</Badge>;
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/departments')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Departments
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">{department.name}</h1>
          <p className="text-gray-600 mt-1">{department.type} Response Department</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Department Type</p>
                <p className="font-semibold text-gray-900">{department.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Officer-in-Charge</p>
                <p className="font-semibold text-gray-900">Chief Roberto Santos</p>
                <p className="text-xs text-gray-500">+63 917 123 4567</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <Badge className="bg-green-100 text-green-700 border-green-200">Available</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Operational Units</p>
                <p className="font-semibold text-teal-600">
                  {deptUnits.filter(u => u.maintenanceStatus === 'Operational').length}/{deptUnits.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="units" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="personnel">Personnel</TabsTrigger>
            <TabsTrigger value="tasks">Active Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Department Units & Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptUnits.map((unit) => (
                    <div key={unit.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">{unit.name}</p>
                            {unit.maintenanceStatus === 'Under Maintenance' && (
                              <Wrench className="w-4 h-4 text-orange-600" />
                            )}
                            {unit.maintenanceStatus === 'Out of Service' && (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{unit.type}</p>
                          {unit.assignedIncident && (
                            <p className="text-xs text-blue-600 mt-1">
                              Assigned: <Button 
                                variant="link" 
                                className="p-0 h-auto text-xs text-blue-600"
                                onClick={() => navigate(`/incidents/${unit.assignedIncident}`)}
                              >
                                {unit.assignedIncident}
                              </Button>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={getStatusColor(unit.status)}>
                            {unit.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 bg-white rounded border border-gray-200">
                          <p className="text-gray-600 mb-1">Last Maintenance</p>
                          <p className="font-medium text-gray-900">{unit.lastMaintenance}</p>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-200">
                          <p className="text-gray-600 mb-1">Next Scheduled</p>
                          <p className="font-medium text-gray-900">{unit.nextMaintenance}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personnel" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="w-5 h-5" />
                  Department Personnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptPersonnel.map((person, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{person.name}</p>
                          <p className="text-sm text-gray-600">{person.role}</p>
                          <p className="text-xs text-gray-500 mt-1">Unit: {person.unit}</p>
                        </div>
                        <Badge className={getStatusColor(person.status)}>
                          {person.status}
                        </Badge>
                      </div>

                      {person.certifications && person.certifications.length > 0 && (
                        <div className="mb-3">
                          <Label className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            Certifications
                          </Label>
                          <div className="space-y-2">
                            {person.certifications.map((cert, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-gray-900">{cert.name}</p>
                                  <p className="text-xs text-gray-500">Valid until: {cert.validUntil}</p>
                                </div>
                                {getCertificationStatus(cert.status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {person.specialSkills && person.specialSkills.length > 0 && (
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Special Skills</Label>
                          <div className="flex flex-wrap gap-1">
                            {person.specialSkills.map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Active Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-gray-900">{incident.id}</p>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          {incident.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{incident.description}</p>
                      <p className="text-xs text-gray-500">Barangay: {incident.barangay}</p>
                    </div>
                  ))}
                  {deptIncidents.length === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                      <p className="text-gray-600">No active tasks at this time</p>
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
