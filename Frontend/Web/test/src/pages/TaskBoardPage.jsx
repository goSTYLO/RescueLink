import { Layout } from '../components/Layout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Clock, MapPin } from 'lucide-react';
import { incidents } from '../data/mockData';
import { useNavigate } from 'react-router-dom';

export function TaskBoardPage() {
  const navigate = useNavigate();
  const availableTasks = incidents.filter(i => i.status === 'New' || i.status === 'Verified');
  const assignedTasks = incidents.filter(i => i.status === 'In Progress');
  const resolvedTasks = incidents.filter(i => i.status === 'Resolved');

  const TaskCard = ({ incident }) => {
    const getSeverityColor = (severity) => {
      switch (severity) {
        case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
        case 'Warning': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    };

    return (
      <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/incidents/${incident.id}`)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-sm font-mono text-gray-600">{incident.id}</span>
            <Badge className={getSeverityColor(incident.severity)}>
              {incident.severity}
            </Badge>
          </div>
          <h4 className="font-semibold text-gray-900 mb-2">{incident.emergencyType}</h4>
          <p className="text-sm text-gray-600 mb-3">{incident.description}</p>
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              <span>{incident.barangay}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>{incident.timeReported}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600">Assigned: {incident.assignedDepartment}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Department Task Board</h1>
          <p className="text-gray-600 mt-1">Kanban-style task management for emergency response</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Available Column */}
          <div>
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">Available</h3>
              <p className="text-sm text-gray-500">{availableTasks.length} tasks</p>
            </div>
            <div className="space-y-3">
              {availableTasks.map(task => (
                <TaskCard key={task.id} incident={task} />
              ))}
            </div>
          </div>

          {/* Assigned Column */}
          <div>
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">Assigned</h3>
              <p className="text-sm text-gray-500">{assignedTasks.length} tasks</p>
            </div>
            <div className="space-y-3">
              {assignedTasks.map(task => (
                <TaskCard key={task.id} incident={task} />
              ))}
            </div>
          </div>

          {/* En Route Column */}
          <div>
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">En Route</h3>
              <p className="text-sm text-gray-500">0 tasks</p>
            </div>
            <div className="h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
              <p className="text-sm text-gray-400">No tasks</p>
            </div>
          </div>

          {/* Resolved Column */}
          <div>
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">Resolved</h3>
              <p className="text-sm text-gray-500">{resolvedTasks.length} tasks</p>
            </div>
            <div className="space-y-3">
              {resolvedTasks.map(task => (
                <TaskCard key={task.id} incident={task} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Drag and drop tasks between columns to update their status. Changes are reflected in real-time across the dashboard.
          </p>
        </div>
      </div>
    </Layout>
  );
}
