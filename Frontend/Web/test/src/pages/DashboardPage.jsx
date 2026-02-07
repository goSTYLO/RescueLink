import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { AlertTriangle, Filter, Eye, Phone, CheckCircle, Activity, AlertCircle, Clock, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { incidents, barangays } from '../data/mockData';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Icon Container Component (like in the picture)
function IconContainer({ children, className = '' }) {
  return (
    <div className={`w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-blue-100 ${className}`}>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBarangay, setFilterBarangay] = useState('All');
  const [selectStates, setSelectStates] = useState({
    type: false,
    status: false,
    barangay: false,
  });
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredIncidents = incidents.filter(inc => {
    if (filterType !== 'All' && inc.emergencyType !== filterType) return false;
    if (filterStatus !== 'All' && inc.status !== filterStatus) return false;
    if (filterBarangay !== 'All' && inc.barangay !== filterBarangay) return false;
    return true;
  });

  // Sorting logic
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aValue, bValue;
    switch (sortColumn) {
      case 'id':
        aValue = a.id;
        bValue = b.id;
        break;
      case 'reporter':
        aValue = a.reporterName;
        bValue = b.reporterName;
        break;
      case 'barangay':
        aValue = a.barangay;
        bValue = b.barangay;
        break;
      case 'type':
        aValue = a.emergencyType;
        bValue = b.emergencyType;
        break;
      case 'severity':
        aValue = a.severity;
        bValue = b.severity;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'time':
        aValue = a.timeReported;
        bValue = b.timeReported;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedIncidents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIncidents = sortedIncidents.slice(startIndex, endIndex);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 text-gray-600" />
      : <ArrowDown className="w-4 h-4 ml-1 text-gray-600" />;
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStatus, filterBarangay]);

  // Severity: urgency level (Critical=red, Warning=amber, Resolved=green)
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'Warning': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Resolved': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Status: workflow stage (New=blue, Verified=green, In Progress=orange, Resolved=green, Duplicate=gray)
  const getStatusColor = (status) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Verified': return 'bg-green-100 text-green-800 border-green-300';
      case 'In Progress': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Resolved': return 'bg-green-100 text-green-800 border-green-300';
      case 'Duplicate': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeEmoji = (type) => {
    switch (type) {
      case 'Fire': return '🔥';
      case 'Medical': return '🏥';
      case 'Police': return '👮';
      case 'Disaster': return '⚠️';
      default: return '';
    }
  };

  const criticalIncidents = incidents.filter(i => i.severity === 'Critical');

  const typeOptions = [
    { value: 'All', label: 'All Types' },
    { value: 'Fire', label: 'Fire' },
    { value: 'Medical', label: 'Medical' },
    { value: 'Police', label: 'Police' },
    { value: 'Disaster', label: 'Disaster' },
  ];

  const statusOptions = [
    { value: 'All', label: 'All Status' },
    { value: 'New', label: 'New' },
    { value: 'Verified', label: 'Verified' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Resolved', label: 'Resolved' },
  ];

  const barangayOptions = [
    { value: 'All', label: 'All Barangays' },
    ...barangays.map(b => ({ value: b, label: b })),
  ];

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Incident Overview</h1>
          <p className="text-gray-600 mt-1">Monitor and manage emergency incidents across Dagupan City</p>
        </div>

        {/* Alert Banner */}
        {criticalIncidents.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl flex items-start gap-3 shadow-md hover:shadow-lg transition-all duration-300 animate-pulse-glow">
            <IconContainer className="bg-red-100">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </IconContainer>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Critical Incidents Detected</h3>
              <p className="text-sm text-red-700 mt-1">
                {criticalIncidents.length} critical incident(s) requiring immediate attention
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="border-2 border-gray-200 hover:border-[#FF4F52]/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Total Incidents</CardTitle>
                <IconContainer>
                  <Activity className="w-6 h-6 text-blue-700" />
                </IconContainer>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gray-900 transition-all duration-300 hover:scale-105 inline-block">{incidents.length}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-gray-200 hover:border-red-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Critical</CardTitle>
                <IconContainer className="bg-red-50 hover:bg-red-100">
                  <AlertCircle className="w-6 h-6 text-red-700" />
                </IconContainer>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-red-600 transition-all duration-300 hover:scale-105 inline-block">{incidents.filter(i => i.severity === 'Critical').length}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-gray-200 hover:border-amber-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
                <IconContainer className="bg-amber-50 hover:bg-amber-100">
                  <Clock className="w-6 h-6 text-amber-700" />
                </IconContainer>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-amber-600 transition-all duration-300 hover:scale-105 inline-block">{incidents.filter(i => i.status === 'In Progress').length}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-gray-200 hover:border-green-300">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Resolved</CardTitle>
                <IconContainer className="bg-green-50 hover:bg-green-100">
                  <CheckCircle2 className="w-6 h-6 text-green-700" />
                </IconContainer>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600 transition-all duration-300 hover:scale-105 inline-block">{incidents.filter(i => i.severity === 'Resolved').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6" hover={false}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <CardTitle>Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600 mb-1.5 block">Emergency Type</label>
              <Select
                value={filterType}
                onValueChange={setFilterType}
              >
                {({ isOpen, setIsOpen, value, onValueChange }) => (
                  <>
                    <SelectTrigger isOpen={selectStates.type} onClick={() => setSelectStates({ ...selectStates, type: !selectStates.type })}>
                      <SelectValue placeholder="All Types" value={value} options={typeOptions} />
                    </SelectTrigger>
                    <SelectContent isOpen={selectStates.type}>
                      {typeOptions.map(option => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value} 
                          onSelect={(val) => { setFilterType(val); setSelectStates({ ...selectStates, type: false }); }}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600 mb-1.5 block">Status</label>
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
              >
                {({ isOpen, setIsOpen, value, onValueChange }) => (
                  <>
                    <SelectTrigger isOpen={selectStates.status} onClick={() => setSelectStates({ ...selectStates, status: !selectStates.status })}>
                      <SelectValue placeholder="All Status" value={value} options={statusOptions} />
                    </SelectTrigger>
                    <SelectContent isOpen={selectStates.status}>
                      {statusOptions.map(option => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value} 
                          onSelect={(val) => { setFilterStatus(val); setSelectStates({ ...selectStates, status: false }); }}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600 mb-1.5 block">Barangay</label>
              <Select
                value={filterBarangay}
                onValueChange={setFilterBarangay}
              >
                {({ isOpen, setIsOpen, value, onValueChange }) => (
                  <>
                    <SelectTrigger isOpen={selectStates.barangay} onClick={() => setSelectStates({ ...selectStates, barangay: !selectStates.barangay })}>
                      <SelectValue placeholder="All Barangays" value={value} options={barangayOptions} />
                    </SelectTrigger>
                    <SelectContent isOpen={selectStates.barangay} className="max-h-[300px]">
                      {barangayOptions.map(option => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value} 
                          onSelect={(val) => { setFilterBarangay(val); setSelectStates({ ...selectStates, barangay: false }); }}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Incidents Table */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Incident List ({filteredIncidents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center">
                        Incident ID
                        {getSortIcon('id')}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('reporter')}
                    >
                      <div className="flex items-center">
                        Reporter
                        {getSortIcon('reporter')}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('barangay')}
                    >
                      <div className="flex items-center">
                        Barangay
                        {getSortIcon('barangay')}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        Type
                        {getSortIcon('type')}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('severity')}
                    >
                      <div className="flex items-center">
                        Severity
                        {getSortIcon('severity')}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th 
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleSort('time')}
                    >
                      <div className="flex items-center">
                        Time Reported
                        {getSortIcon('time')}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIncidents.map((incident) => (
                    <tr
                      key={incident.id}
                      className="border-b border-gray-100"
                    >
                      <td className="py-4 px-4 text-sm font-mono text-gray-900">{incident.id}</td>
                      <td className="py-4 px-4 text-sm text-gray-900">{incident.reporterName}</td>
                      <td className="py-4 px-4 text-sm text-gray-600">{incident.barangay}</td>
                      <td className="py-4 px-4 text-sm text-gray-900">
                        <span className="mr-1">{getTypeEmoji(incident.emergencyType)}</span>
                        {incident.emergencyType}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={`${getSeverityColor(incident.severity)} border rounded px-2 py-1 text-xs font-semibold`}>
                          {incident.severity.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={`${getStatusColor(incident.status)} border rounded px-2 py-1 text-xs font-semibold`}>
                          {incident.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600">{incident.timeReported}</td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 w-10 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                            title="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </Button>
                          {!incident.verified && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-10 w-10 p-0 text-green-600 hover:bg-green-50 hover:text-green-700" 
                              onClick={(e) => e.stopPropagation()}
                              title="Verify Incident"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-10 w-10 p-0 text-[#134178] hover:bg-[#134178]/10 hover:text-[#0f3256]" 
                            onClick={(e) => e.stopPropagation()}
                            title="Call Reporter"
                          >
                            <Phone className="w-5 h-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-[#134178] text-white hover:bg-[#0f3256]' : ''}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                
                <span className="text-sm text-gray-600 ml-2">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
