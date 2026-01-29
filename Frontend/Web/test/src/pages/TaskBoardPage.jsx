import { useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { incidents } from '../data/mockData';
import { useNavigate } from 'react-router-dom';

const TASKS_PER_PAGE = 6;
const COLUMN_STATUS = {
  available: ['New', 'Verified'],
  assigned: ['In Progress'],
  enRoute: ['En Route'],
  resolved: ['Resolved'],
};

function getSeverityBadgeClass(severity) {
  switch (severity) {
    case 'Critical':
      return 'bg-red-100 text-red-800 border-red-300 shadow-sm';
    case 'Warning':
      return 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm';
    case 'Resolved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm';
    case 'Low':
      return 'bg-slate-100 text-slate-700 border-slate-300 shadow-sm';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 shadow-sm';
  }
}

export function TaskBoardPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(() =>
    incidents.map((i) => ({ ...i, status: i.status === 'En Route' ? i.status : i.status }))
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const availableTasks = tasks.filter((i) => COLUMN_STATUS.available.includes(i.status));
  const assignedTasks = tasks.filter((i) => COLUMN_STATUS.assigned.includes(i.status));
  const enRouteTasks = tasks.filter((i) => COLUMN_STATUS.enRoute.includes(i.status));
  const resolvedTasks = tasks.filter((i) => COLUMN_STATUS.resolved.includes(i.status));

  const allColumns = [availableTasks, assignedTasks, enRouteTasks, resolvedTasks];
  const maxTasks = Math.max(...allColumns.map((col) => col.length), 1);
  const totalPages = Math.ceil(maxTasks / TASKS_PER_PAGE);
  const hasPagination = maxTasks > TASKS_PER_PAGE;

  const paginate = (list) =>
    list.slice(currentPage * TASKS_PER_PAGE, (currentPage + 1) * TASKS_PER_PAGE);

  const getStatusForColumn = (columnKey) => {
    switch (columnKey) {
      case 'available': return 'New';
      case 'assigned': return 'In Progress';
      case 'enRoute': return 'En Route';
      case 'resolved': return 'Resolved';
      default: return 'New';
    }
  };

  const handleDragStart = useCallback((e, incident, columnKey) => {
    setDraggedTask({ incident, columnKey });
    e.dataTransfer.setData('text/plain', incident.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ id: incident.id, columnKey }));
  }, []);

  const handleDragOver = useCallback((e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e, toColumnKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const { id, columnKey: fromColumnKey } = JSON.parse(raw);
    if (fromColumnKey === toColumnKey) return;
    const newStatus = getStatusForColumn(toColumnKey);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    setDraggedTask(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
    setDragOverColumn(null);
  }, []);

  const TaskCard = ({ incident, columnKey }) => (
    <Card
      className={`mb-3 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-md ${
        draggedTask?.incident?.id === incident.id ? 'opacity-50 scale-[0.98]' : ''
      }`}
      onClick={() => navigate(`/incidents/${incident.id}`)}
      draggable
      onDragStart={(e) => handleDragStart(e, incident, columnKey)}
      onDragEnd={handleDragEnd}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2 gap-2">
          <span className="text-sm font-mono text-gray-600 shrink-0">{incident.id}</span>
          <Badge className={`${getSeverityBadgeClass(incident.severity)} shrink-0`}>
            {incident.severity}
          </Badge>
        </div>
        <h4 className="font-semibold text-gray-900 mb-2">{incident.emergencyType}</h4>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{incident.description}</p>
        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{incident.barangay}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{incident.timeReported}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">Assigned: {incident.assignedDepartment}</p>
        </div>
      </CardContent>
    </Card>
  );

  const Column = ({ columnKey, title, taskList, emptyLabel = 'No tasks' }) => {
    const paginatedList = paginate(taskList);
    const isDropTarget = dragOverColumn === columnKey;

    return (
      <div
        className={`min-h-[200px] rounded-xl border-2 border-dashed p-3 transition-colors ${
          isDropTarget ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-gray-50/30'
        }`}
        onDragOver={(e) => handleDragOver(e, columnKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, columnKey)}
      >
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500">{taskList.length} tasks</p>
        </div>
        <div className="space-y-3">
          {paginatedList.length === 0 ? (
            <div className="h-24 flex items-center justify-center rounded-lg bg-white/60 border border-gray-100">
              <p className="text-sm text-gray-400">{emptyLabel}</p>
            </div>
          ) : (
            paginatedList.map((task) => (
              <TaskCard key={task.id} incident={task} columnKey={columnKey} />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Department Task Board</h1>
          <p className="text-gray-600 mt-1">Kanban-style task management for emergency response</p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Drag and drop tasks between columns to update their status. Changes are reflected in real-time across the dashboard.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Column columnKey="available" title="Available" taskList={availableTasks} />
          <Column columnKey="assigned" title="Assigned" taskList={assignedTasks} />
          <Column columnKey="enRoute" title="En Route" taskList={enRouteTasks} />
          <Column columnKey="resolved" title="Resolved" taskList={resolvedTasks} />
        </div>

        {hasPagination && (
          <div className="mt-8 flex items-center justify-center gap-4 py-4">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-gray-600 font-medium">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
