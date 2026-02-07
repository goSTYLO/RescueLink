import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { MapPin, Filter } from 'lucide-react';
import { incidents, barangays } from '../data/mockData';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export function MapViewPage() {
  const navigate = useNavigate();
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterBarangay, setFilterBarangay] = useState('All');
  const [selectedIncident, setSelectedIncident] = useState(incidents[0] || null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimerRef = useRef(null);
  const [selectStates, setSelectStates] = useState({
    department: false,
    barangay: false,
  });

  // Handle marker click with toggle and auto-hide
  const handleMarkerClick = (incident) => {
    if (selectedIncident?.id === incident.id && showPopup) {
      // Toggle off if same incident and popup is showing
      setShowPopup(false);
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    } else {
      // Select new incident and show popup
      setSelectedIncident(incident);
      setShowPopup(true);
      
      // Clear existing timer
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
      
      // Auto-hide after 5 seconds
      popupTimerRef.current = setTimeout(() => {
        setShowPopup(false);
        popupTimerRef.current = null;
      }, 5000);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, []);

  const filteredIncidents = incidents.filter(inc => {
    if (filterBarangay !== 'All' && inc.barangay !== filterBarangay) return false;
    return true;
  });

  const getTypeEmoji = (type) => {
    switch (type) {
      case 'Fire': return '🔥';
      case 'Medical': return '🏥';
      case 'Police': return '👮';
      case 'Disaster': return '⚠️';
      default: return '';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-500';
      case 'Warning': return 'bg-amber-500';
      case 'Resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Severity: urgency level (Critical=red, Warning=amber, Resolved=green)
  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'Warning': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Resolved': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };


  const departmentOptions = [
    { value: 'All', label: 'All Departments' },
    { value: 'Fire', label: 'Fire Department' },
    { value: 'Medical', label: 'Medical Services' },
    { value: 'Police', label: 'Police' },
    { value: 'Disaster', label: 'DRRMO' },
  ];

  const barangayOptions = [
    { value: 'All', label: 'All Barangays' },
    ...barangays.map(b => ({ value: b, label: b })),
  ];

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Live Emergency Map</h1>
          <p className="text-gray-600 mt-1">Real-time incident locations across Dagupan City</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column - Filters and Legend */}
          <div className="lg:col-span-3 space-y-4 order-1 min-w-0">
            <Card hover={false}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <CardTitle className="text-base">Filters</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block">Department</label>
                  <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    {({ isOpen, setIsOpen, value, onValueChange }) => (
                      <>
                        <SelectTrigger isOpen={selectStates.department} onClick={() => setSelectStates({ ...selectStates, department: !selectStates.department })}>
                          <SelectValue placeholder="All Departments" value={value} options={departmentOptions} />
                        </SelectTrigger>
                        <SelectContent isOpen={selectStates.department}>
                          {departmentOptions.map(option => (
                            <SelectItem 
                              key={option.value} 
                              value={option.value} 
                              onSelect={(val) => { setFilterDepartment(val); setSelectStates({ ...selectStates, department: false }); }}
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
                  <label className="text-sm text-gray-600 mb-1.5 block">Barangay</label>
                  <Select value={filterBarangay} onValueChange={setFilterBarangay}>
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

            {/* Legend */}
            <Card hover={false}>
              <CardHeader>
                <CardTitle className="text-base">Severity Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0"></div>
                  <span className="text-sm text-gray-700">Critical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-500 flex-shrink-0"></div>
                  <span className="text-sm text-gray-700">Warning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0"></div>
                  <span className="text-sm text-gray-700">Resolved</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Map */}
          <div className="lg:col-span-6 order-2 lg:order-none min-w-0">
            <Card hover={false}>
              <CardHeader>
                <CardTitle>Dagupan City Map</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="relative w-full h-[500px] md:h-[600px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg overflow-hidden">
                  {/* Map Background */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-lg font-medium text-gray-700">Dagupan City Map</p>
                    <p className="text-sm text-gray-500 mt-1">Interactive incident markers</p>
                  </div>
                  
                  {/* Incident Markers Container */}
                  <div className="absolute inset-0">
                    {filteredIncidents.map((incident, index) => {
                      const isSelected = selectedIncident?.id === incident.id;
                      const markerLeft = 15 + (index % 4) * 25;
                      const markerTop = 20 + Math.floor(index / 4) * 30;
                      
                      return (
                        <div
                          key={incident.id}
                          className="absolute cursor-pointer"
                          style={{
                            left: `${markerLeft}%`,
                            top: `${markerTop}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          onClick={() => handleMarkerClick(incident)}
                        >
                          <div className={`relative w-6 h-6 rounded-full ${getSeverityColor(incident.severity)} shadow-lg flex items-center justify-center transition-transform hover:scale-110 ${isSelected && showPopup ? 'ring-2 ring-offset-2 ring-gray-400 z-20' : 'z-10'}`}>
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          
                          {/* Pop-up Card - Shows when clicked, auto-hides after 5 seconds */}
                          {isSelected && showPopup && (
                            <div 
                              className="absolute z-30 animate-in fade-in slide-in-from-top-2 duration-200"
                              style={{
                                left: '50%',
                                top: 'calc(100% + 12px)',
                                transform: 'translateX(-50%)',
                                width: '240px'
                              }}
                            >
                              <Card className="w-full shadow-xl border border-gray-200">
                                <CardContent className="p-3">
                                  <p className="font-semibold text-gray-900 mb-1.5 text-sm">{incident.id}</p>
                                  <p className="text-sm text-gray-700 mb-1">{incident.emergencyType}</p>
                                  <p className="text-xs text-gray-600 mb-1">Barangay: {incident.barangay}</p>
                                  <p className="text-xs text-gray-600 mb-2">Time: {incident.timeReported}</p>
                                  <Badge className={`${getSeverityBadgeColor(incident.severity)} border rounded px-2 py-1 text-xs font-semibold`}>
                                    {incident.severity.toUpperCase()}
                                  </Badge>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Active Incidents and Details */}
          <div className="lg:col-span-3 flex flex-col gap-6 min-w-0">
            {/* Active Incidents */}
            <Card hover={false} className="flex-shrink-0">
              <CardHeader>
                <CardTitle>Active Incidents</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {filteredIncidents.slice(0, 6).map((incident) => (
                    <div
                      key={incident.id}
                      className={`flex-shrink-0 p-3 bg-white border rounded-lg cursor-pointer hover:shadow-sm transition-all ${
                        selectedIncident?.id === incident.id 
                          ? 'border-[#134178] bg-green-50' 
                          : 'border-gray-200'
                      }`}
                      onClick={() => {
                        setSelectedIncident(incident);
                        setShowPopup(true);
                        if (popupTimerRef.current) {
                          clearTimeout(popupTimerRef.current);
                        }
                        popupTimerRef.current = setTimeout(() => {
                          setShowPopup(false);
                          popupTimerRef.current = null;
                        }, 5000);
                      }}
                    >
                      <p className="text-sm font-semibold text-gray-900 mb-1">{incident.id}</p>
                      <p className="text-xs text-gray-600 mb-2">
                        {getTypeEmoji(incident.emergencyType)} {incident.emergencyType} • {incident.barangay}
                      </p>
                      <div className="flex items-center justify-end">
                        <div className={`w-2 h-2 rounded-full ${getSeverityColor(incident.severity)}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Incident Details */}
            <Card hover={false} className="flex-shrink-0">
              <CardHeader>
                <CardTitle>Incident Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedIncident ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Incident ID</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedIncident.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Type</p>
                      <p className="text-sm text-gray-900">{selectedIncident.emergencyType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Severity</p>
                      <Badge className={`${getSeverityBadgeColor(selectedIncident.severity)} border rounded px-2 py-1 text-xs font-semibold inline-block`}>
                        {selectedIncident.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Barangay</p>
                      <p className="text-sm text-gray-900">{selectedIncident.barangay}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Time Reported</p>
                      <p className="text-sm text-gray-900">{selectedIncident.timeReported}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Location</p>
                      <p className="text-sm text-gray-900">Corner AB Fernandez Ave and Perez Blvd</p>
                    </div>
                    <Button 
                      className="w-full bg-[#134178] hover:bg-[#0f3256] text-white mt-4"
                      onClick={() => navigate(`/incidents/${selectedIncident.id}`)}
                    >
                      View Full Details
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <p className="text-sm text-gray-500">Select an incident to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
