import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { departments, units, personnel, incidents } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import { Flame, Shield, Heart, AlertTriangle, Users } from 'lucide-react';

export function DepartmentsPage() {
  const navigate = useNavigate();

  const getDepartmentIcon = (type) => {
    switch (type) {
      case 'Fire': return Flame;
      case 'Police': return Shield;
      case 'Medical': return Heart;
      case 'Disaster': return AlertTriangle;
      default: return Users;
    }
  };

  const getDepartmentStats = (deptId) => {
    const deptUnits = units[deptId] || [];
    const activeIncidents = incidents.filter(i => i.status === 'In Progress').length;
    const availableUnits = deptUnits.filter(u => u.status === 'Available').length;
    const totalUnits = deptUnits.length;

    let status = 'Available';
    if (availableUnits === 0) status = 'Critical Load';
    else if (availableUnits < totalUnits / 2) status = 'Partially Busy';

    return { activeIncidents, availableUnits, totalUnits, status };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-700 border-green-200';
      case 'Partially Busy': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Critical Load': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const totalActiveIncidents = incidents.filter(i => i.status === 'In Progress').length;
  const totalAvailableUnits = Object.values(units).flat().filter(u => u.status === 'Available').length;

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Department Management</h1>
          <p className="text-gray-600 mt-1">Centralized view of all emergency departments</p>
        </div>

        {/* Summary Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Active Incidents</p>
                <p className="text-3xl font-semibold text-gray-900">{totalActiveIncidents}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Available Units</p>
                <p className="text-3xl font-semibold text-[#FF4F52]">{totalAvailableUnits}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">City-wide Alert Level</p>
                <Badge className="bg-green-100 text-green-700 border-green-200 text-lg px-3 py-1">Normal</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const Icon = getDepartmentIcon(dept.type);
            const stats = getDepartmentStats(dept.id);

            return (
              <Card
                key={dept.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/departments/${dept.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-blue-100">
                        <Icon className="w-6 h-6 text-blue-700" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{dept.name}</CardTitle>
                        <p className="text-sm text-gray-600">{dept.type} Response</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge className={getStatusColor(stats.status)}>
                      {stats.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Incidents</span>
                      <span className="font-semibold text-gray-900">{stats.activeIncidents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Available Units</span>
                      <span className="font-semibold text-teal-600">{stats.availableUnits}/{stats.totalUnits}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/departments/${dept.id}`);
                    }}
                  >
                    View Department
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
