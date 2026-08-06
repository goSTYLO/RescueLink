// Mock data for RescueLink Dagupan City Emergency Management System

export const barangays = [
  "Bacayao Norte", "Bacayao Sur", "Barangay I", "Barangay II", "Barangay IV",
  "Bolosan", "Bonuan Binloc", "Bonuan Boquig", "Bonuan Gueset", "Calmay",
  "Carael", "Caranglaan", "Herrero-Perez", "Lasip Chico", "Lasip Grande",
  "Lomboy", "Lucao", "Malued", "Mamalingling", "Mangin", "Mayombo",
  "Pantal", "Poblacion Oeste", "Pogo Chico", "Pogo Grande", "Pugaro Suit",
  "Salapingao", "Salisay", "Tambac", "Tapuac", "Tebeng"
];

export const departments = [
  { id: "bfp", name: "Bureau of Fire Protection (BFP Dagupan)", type: "Fire", color: "red" },
  { id: "pnp", name: "Philippine National Police (PNP Dagupan)", type: "Police", color: "blue" },
  { id: "health", name: "City Health Office / Hospitals", type: "Medical", color: "green" },
  { id: "drrmo", name: "DRRMO Dagupan", type: "Disaster", color: "orange" },
  { id: "barangay", name: "Barangay Emergency Response", type: "Community", color: "purple" }
];

// System users for role-based login (super-admin, department-admin, personnel)
export const systemUsers = [
  { id: "USR-001", name: "Super Admin", email: "admin@rescuelink.dagupan.gov.ph", role: "super-admin", department: "All", departmentId: null },
  { id: "USR-002", name: "Fire Chief Mendoza", email: "mendoza@fire.dagupan.gov", role: "department-admin", department: "Bureau of Fire Protection (BFP Dagupan)", departmentId: "bfp" },
  { id: "USR-003", name: "Health Director Santos", email: "santos@health.dagupan.gov", role: "department-admin", department: "City Health Office / Hospitals", departmentId: "health" },
  { id: "USR-004", name: "Police Chief Ramos", email: "ramos@pnp.dagupan.gov", role: "department-admin", department: "Philippine National Police (PNP Dagupan)", departmentId: "pnp" },
  { id: "USR-005", name: "DRRMO Director Garcia", email: "garcia@drrmo.dagupan.gov", role: "department-admin", department: "DRRMO Dagupan", departmentId: "drrmo" },
  { id: "USR-006", name: "Officer Pedro Ramos", email: "pedro.ramos@pnp.dagupan.gov", role: "personnel", department: "Philippine National Police (PNP Dagupan)", departmentId: "pnp" },
  { id: "USR-007", name: "EMT Juan Garcia", email: "juan.garcia@health.dagupan.gov", role: "personnel", department: "City Health Office / Hospitals", departmentId: "health" },
];

// Incident Timeline Events
export const incidentTimelines = {
  "INC-2026-001": [
    { timestamp: "2026-01-20 08:45:23", action: "Incident Reported", actor: "Maria Santos", actorRole: "Reporter", notes: "Emergency call received" },
    { timestamp: "2026-01-20 08:46:15", action: "Verified", actor: "Operator Juan Cruz", actorRole: "Operator" },
    { timestamp: "2026-01-20 08:47:30", action: "Assigned to BFP Dagupan", actor: "Operator Juan Cruz", actorRole: "Operator" },
    { timestamp: "2026-01-20 08:48:10", action: "Units Dispatched", actor: "SFO3 Ramon Cruz", actorRole: "Fire Officer", notes: "FT-02 and AM-01 en route" },
    { timestamp: "2026-01-20 08:52:45", action: "City Health Office Added", actor: "Supervisor Ana Garcia", actorRole: "Supervisor", notes: "Medical support requested" },
    { timestamp: "2026-01-20 08:55:30", action: "On Scene", actor: "FO1 Jose Mendoza", actorRole: "Firefighter" },
  ],
  "INC-2026-002": [
    { timestamp: "2026-01-20 09:15:47", action: "Incident Reported", actor: "Juan Dela Cruz", actorRole: "Reporter" },
    { timestamp: "2026-01-20 09:16:20", action: "Verified", actor: "Operator Maria Lopez", actorRole: "Operator" },
    { timestamp: "2026-01-20 09:17:00", action: "Assigned to City Health Office", actor: "Operator Maria Lopez", actorRole: "Operator" },
    { timestamp: "2026-01-20 09:18:15", action: "Units Dispatched", actor: "Dr. Elena Gomez", actorRole: "Emergency Physician", notes: "AMB-01 dispatched" },
  ],
  "INC-2026-003": [
    { timestamp: "2026-01-20 10:00:12", action: "Incident Reported", actor: "Ana Reyes", actorRole: "Reporter" },
    { timestamp: "2026-01-20 10:01:05", action: "Pending Verification", actor: "System", actorRole: "System" },
  ],
  "INC-2026-004": [
    { timestamp: "2026-01-20 07:30:56", action: "Incident Reported", actor: "Roberto Garcia", actorRole: "Reporter" },
    { timestamp: "2026-01-20 07:31:30", action: "Verified", actor: "Operator Pedro Santos", actorRole: "Operator" },
    { timestamp: "2026-01-20 07:32:15", action: "Assigned to DRRMO Dagupan", actor: "Operator Pedro Santos", actorRole: "Operator" },
    { timestamp: "2026-01-20 07:33:45", action: "Units Dispatched", actor: "Engr. Roberto Fernandez", actorRole: "Disaster Officer" },
    { timestamp: "2026-01-20 07:45:20", action: "Severity Escalated to Warning", actor: "Supervisor Miguel Reyes", actorRole: "Supervisor", notes: "Multiple areas affected" },
  ],
  "INC-2026-005": [
    { timestamp: "2026-01-19 23:30:41", action: "Incident Reported", actor: "Linda Torres", actorRole: "Reporter" },
    { timestamp: "2026-01-19 23:31:10", action: "Verified", actor: "Operator Night Shift", actorRole: "Operator" },
    { timestamp: "2026-01-19 23:32:00", action: "Assigned to City Health Office", actor: "Operator Night Shift", actorRole: "Operator" },
    { timestamp: "2026-01-19 23:35:30", action: "Units Dispatched", actor: "Nurse Sarah Velasco", actorRole: "Emergency Nurse" },
    { timestamp: "2026-01-19 23:48:15", action: "Patient Transported", actor: "Nurse Sarah Velasco", actorRole: "Emergency Nurse" },
    { timestamp: "2026-01-20 00:15:22", action: "Incident Resolved", actor: "Dr. Elena Gomez", actorRole: "Emergency Physician" },
    { timestamp: "2026-01-20 00:20:00", action: "Incident Closed", actor: "Supervisor Ana Garcia", actorRole: "Supervisor" },
  ],
};

// Escalation History
export const escalationHistory = {
  "INC-2026-001": [
    {
      timestamp: "2026-01-20 08:47:00",
      fromSeverity: "Warning",
      toSeverity: "Critical",
      escalatedBy: "Operator Juan Cruz",
      reason: "Fire spreading rapidly to adjacent structures"
    }
  ],
  "INC-2026-004": [
    {
      timestamp: "2026-01-20 07:45:20",
      fromSeverity: "Low",
      toSeverity: "Warning",
      escalatedBy: "Supervisor Miguel Reyes",
      reason: "Multiple barangays affected, water level rising"
    }
  ]
};

// Post-Incident Reviews
export const postIncidentReviews = {
  "INC-2026-005": {
    incidentId: "INC-2026-005",
    reviewedBy: "Supervisor Ana Garcia",
    reviewDate: "2026-01-20 08:00 AM",
    responseTime: "5 minutes 30 seconds",
    responseTimeRating: "Excellent",
    issuesEncountered: [
      "Heavy traffic on main road",
      "Reporter initially gave wrong street name"
    ],
    supervisorRemarks: "Team performed excellently despite minor navigation issues. Patient was stabilized and transported efficiently.",
    recommendations: [
      "Consider using alternate route during peak hours",
      "Improve caller location verification protocol"
    ],
    overallRating: 4.5
  }
};

// Cross-Department Coordination Notes
export const coordinationNotes = {
  "INC-2026-001": [
    {
      timestamp: "2026-01-20 08:52:00",
      department: "BFP Dagupan",
      author: "SFO3 Ramon Cruz",
      note: "Need medical standby for potential casualties",
      role: "department-admin",
      roleLabel: "Dept Admin"
    },
    {
      timestamp: "2026-01-20 08:53:15",
      department: "City Health Office",
      author: "Dr. Elena Gomez",
      note: "AMB-02 on standby at scene perimeter",
      role: "personnel",
      roleLabel: "Personnel"
    }
  ]
};

export const incidents = [
  {
    id: "INC-2026-001",
    reporterName: "Maria Santos",
    reporterPhone: "+63 912 345 6789",
    barangay: "Bonuan Binloc",
    emergencyType: "Fire",
    severity: "Critical",
    timeReported: "2026-01-20 08:45 AM",
    assignedDepartment: "BFP Dagupan",
    assignedDepartmentId: "bfp",
    assignedDepartments: ["BFP Dagupan", "City Health Office"],
    leadDepartment: "BFP Dagupan",
    status: "In Progress",
    description: "House fire reported near the market area",
    location: { lat: 16.0416, lng: 120.3361 },
    aiSuggestion: "Fire - High confidence (95%)",
    verified: true,
    highPriority: true,
    possibleDuplicates: [],
    closureData: null
  },
  {
    id: "INC-2026-002",
    reporterName: "Juan Dela Cruz",
    reporterPhone: "+63 918 765 4321",
    barangay: "Pantal",
    emergencyType: "Medical",
    severity: "Warning",
    timeReported: "2026-01-20 09:15 AM",
    assignedDepartment: "City Health Office",
    assignedDepartmentId: "health",
    assignedDepartments: ["City Health Office"],
    leadDepartment: "City Health Office",
    status: "Verified",
    description: "Elderly person collapsed, needs immediate medical attention",
    location: { lat: 16.0456, lng: 120.3401 },
    aiSuggestion: "Medical Emergency - Medium confidence (78%)",
    verified: true,
    highPriority: false,
    possibleDuplicates: [],
    closureData: null
  },
  {
    id: "INC-2026-003",
    reporterName: "Ana Reyes",
    reporterPhone: "+63 915 123 7890",
    barangay: "Poblacion Oeste",
    emergencyType: "Police",
    severity: "Warning",
    timeReported: "2026-01-20 10:00 AM",
    assignedDepartment: "PNP Dagupan",
    assignedDepartmentId: "pnp",
    assignedDepartments: ["PNP Dagupan"],
    leadDepartment: "PNP Dagupan",
    status: "New",
    description: "Suspicious activity reported in the area",
    location: { lat: 16.0436, lng: 120.3371 },
    aiSuggestion: "Police - Low confidence (62%)",
    verified: false,
    highPriority: false,
    possibleDuplicates: ["INC-2026-006"],
    closureData: null
  },
  {
    id: "INC-2026-004",
    reporterName: "Roberto Garcia",
    reporterPhone: "+63 920 456 1234",
    barangay: "Bonuan Boquig",
    emergencyType: "Disaster",
    severity: "Warning",
    timeReported: "2026-01-20 07:30 AM",
    assignedDepartment: "DRRMO Dagupan",
    assignedDepartmentId: "drrmo",
    assignedDepartments: ["DRRMO Dagupan", "Barangay Emergency Response"],
    leadDepartment: "DRRMO Dagupan",
    status: "In Progress",
    description: "Flooding due to heavy rainfall, several streets affected",
    location: { lat: 16.0426, lng: 120.3381 },
    aiSuggestion: "Flood - High confidence (91%)",
    verified: true,
    highPriority: false,
    possibleDuplicates: [],
    closureData: null
  },
  {
    id: "INC-2026-005",
    reporterName: "Linda Torres",
    reporterPhone: "+63 917 789 4567",
    barangay: "Carael",
    emergencyType: "Medical",
    severity: "Resolved",
    timeReported: "2026-01-19 11:30 PM",
    assignedDepartment: "City Health Office",
    assignedDepartmentId: "health",
    assignedDepartments: ["City Health Office"],
    leadDepartment: "City Health Office",
    status: "Resolved",
    description: "Child with high fever - transported to hospital",
    location: { lat: 16.0446, lng: 120.3391 },
    aiSuggestion: "Medical Emergency - High confidence (88%)",
    verified: true,
    highPriority: false,
    possibleDuplicates: [],
    closureData: {
      closedBy: "Supervisor Ana Garcia",
      closedAt: "2026-01-20 00:20:00",
      outcome: "Patient transported to hospital, condition stable",
      classification: "Successful Response"
    }
  },
  {
    id: "INC-2026-006",
    reporterName: "Carlos Mendoza",
    reporterPhone: "+63 915 123 7891",
    barangay: "Poblacion Oeste",
    emergencyType: "Police",
    severity: "Warning",
    timeReported: "2026-01-20 10:05 AM",
    assignedDepartment: "PNP Dagupan",
    assignedDepartmentId: "pnp",
    assignedDepartments: ["PNP Dagupan"],
    leadDepartment: "PNP Dagupan",
    status: "Duplicate",
    description: "Suspicious individuals near commercial area",
    location: { lat: 16.0437, lng: 120.3372 },
    aiSuggestion: "Police - Low confidence (65%)",
    verified: false,
    highPriority: false,
    possibleDuplicates: ["INC-2026-003"],
    closureData: {
      closedBy: "Admin Jose Santos",
      closedAt: "2026-01-20 10:10:00",
      outcome: "Marked as duplicate of INC-2026-003",
      classification: "Duplicate Report"
    }
  }
];

export const units = {
  bfp: [
    { 
      id: "FT-01", 
      name: "Fire Truck 01", 
      type: "Fire Truck", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-15",
      nextMaintenance: "2026-02-15",
      activeTaskCount: 0
    },
    { 
      id: "FT-02", 
      name: "Fire Truck 02", 
      type: "Fire Truck", 
      status: "On Dispatch", 
      assignedIncident: "INC-2026-001",
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-10",
      nextMaintenance: "2026-02-10",
      activeTaskCount: 1
    },
    { 
      id: "AM-01", 
      name: "Ambulance 01", 
      type: "Rescue", 
      status: "Under Maintenance", 
      assignedIncident: null,
      maintenanceStatus: "Under Maintenance",
      lastMaintenance: "2026-01-20",
      nextMaintenance: "2026-02-20",
      maintenanceNotes: "Routine engine check and brake replacement",
      activeTaskCount: 0
    },
  ],
  pnp: [
    { 
      id: "PC-01", 
      name: "Patrol Car 01", 
      type: "Patrol", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-12",
      nextMaintenance: "2026-02-12",
      activeTaskCount: 0
    },
    { 
      id: "PC-02", 
      name: "Patrol Car 02", 
      type: "Patrol", 
      status: "Busy", 
      assignedIncident: "INC-2026-003",
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-18",
      nextMaintenance: "2026-02-18",
      activeTaskCount: 2
    },
    { 
      id: "MC-01", 
      name: "Motorcycle 01", 
      type: "Mobile", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-14",
      nextMaintenance: "2026-02-14",
      activeTaskCount: 1
    },
  ],
  health: [
    { 
      id: "AMB-01", 
      name: "Ambulance 01", 
      type: "Emergency", 
      status: "On Dispatch", 
      assignedIncident: "INC-2026-002",
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-16",
      nextMaintenance: "2026-02-16",
      activeTaskCount: 1
    },
    { 
      id: "AMB-02", 
      name: "Ambulance 02", 
      type: "Emergency", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-19",
      nextMaintenance: "2026-02-19",
      activeTaskCount: 0
    },
    { 
      id: "MRU-01", 
      name: "Mobile Response Unit", 
      type: "Medical", 
      status: "Out of Service", 
      assignedIncident: null,
      maintenanceStatus: "Out of Service",
      lastMaintenance: "2026-01-05",
      nextMaintenance: "2026-01-25",
      maintenanceNotes: "Equipment upgrade in progress",
      activeTaskCount: 0
    },
  ],
  drrmo: [
    { 
      id: "RT-01", 
      name: "Rescue Team 01", 
      type: "Rescue", 
      status: "On Dispatch", 
      assignedIncident: "INC-2026-004",
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-17",
      nextMaintenance: "2026-02-17",
      activeTaskCount: 1
    },
    { 
      id: "RT-02", 
      name: "Rescue Team 02", 
      type: "Rescue", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-13",
      nextMaintenance: "2026-02-13",
      activeTaskCount: 3
    },
  ],
  barangay: [
    { 
      id: "BT-01", 
      name: "Barangay Team 01", 
      type: "Community", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-11",
      nextMaintenance: "2026-02-11",
      activeTaskCount: 0
    },
    { 
      id: "BT-02", 
      name: "Barangay Team 02", 
      type: "Community", 
      status: "Available", 
      assignedIncident: null,
      maintenanceStatus: "Operational",
      lastMaintenance: "2026-01-09",
      nextMaintenance: "2026-02-09",
      activeTaskCount: 0
    },
  ]
};

export const personnel = {
  bfp: [
    { 
      name: "SFO3 Ramon Cruz", 
      role: "Fire Officer", 
      unit: "FT-01", 
      status: "Available",
      certifications: [
        { name: "Firefighter I & II", validUntil: "2027-06-30", status: "Valid" },
        { name: "Hazmat Operations", validUntil: "2026-12-31", status: "Valid" },
        { name: "Emergency Medical Responder", validUntil: "2027-03-15", status: "Valid" }
      ],
      specialSkills: ["Urban Search & Rescue", "Fire Investigation", "Team Leadership"]
    },
    { 
      name: "FO1 Jose Mendoza", 
      role: "Firefighter", 
      unit: "FT-02", 
      status: "On Duty",
      certifications: [
        { name: "Firefighter I", validUntil: "2026-09-30", status: "Valid" },
        { name: "First Aid & CPR", validUntil: "2026-08-15", status: "Expiring Soon" }
      ],
      specialSkills: ["Structural Firefighting", "Vehicle Extrication"]
    },
    { 
      name: "SFO2 Carlos Ramirez", 
      role: "Rescue Officer", 
      unit: "AM-01", 
      status: "Available",
      certifications: [
        { name: "Firefighter I & II", validUntil: "2027-01-30", status: "Valid" },
        { name: "Water Rescue Technician", validUntil: "2026-11-20", status: "Valid" },
        { name: "Rope Rescue Operations", validUntil: "2027-04-10", status: "Valid" }
      ],
      specialSkills: ["Swift Water Rescue", "High Angle Rescue", "Confined Space Entry"]
    },
  ],
  pnp: [
    { 
      name: "PO3 Michael Santos", 
      role: "Patrol Officer", 
      unit: "PC-01", 
      status: "Available",
      certifications: [
        { name: "Basic Police Officer Course", validUntil: "2028-12-31", status: "Valid" },
        { name: "Firearms Proficiency", validUntil: "2026-06-30", status: "Valid" },
        { name: "Crisis Intervention", validUntil: "2027-02-28", status: "Valid" }
      ],
      specialSkills: ["Crime Scene Investigation", "Community Policing", "Traffic Management"]
    },
    { 
      name: "PO2 Jennifer Lopez", 
      role: "Patrol Officer", 
      unit: "PC-02", 
      status: "On Duty",
      certifications: [
        { name: "Basic Police Officer Course", validUntil: "2028-06-30", status: "Valid" },
        { name: "Firearms Proficiency", validUntil: "2026-05-15", status: "Expiring Soon" }
      ],
      specialSkills: ["Patrol Operations", "First Response"]
    },
    { 
      name: "PO1 Rico Tan", 
      role: "Traffic Officer", 
      unit: "MC-01", 
      status: "Available",
      certifications: [
        { name: "Basic Police Officer Course", validUntil: "2027-11-30", status: "Valid" },
        { name: "Traffic Management", validUntil: "2026-10-20", status: "Valid" },
        { name: "Motorcycle Operations", validUntil: "2027-07-15", status: "Valid" }
      ],
      specialSkills: ["Traffic Control", "Accident Investigation", "Motorcycle Patrol"]
    },
  ],
  health: [
    { 
      name: "Dr. Elena Gomez", 
      role: "Emergency Physician", 
      unit: "AMB-01", 
      status: "On Duty",
      certifications: [
        { name: "Medical License", validUntil: "2028-12-31", status: "Valid" },
        { name: "ACLS (Advanced Cardiac Life Support)", validUntil: "2026-09-30", status: "Valid" },
        { name: "ATLS (Advanced Trauma Life Support)", validUntil: "2027-03-15", status: "Valid" },
        { name: "PALS (Pediatric Advanced Life Support)", validUntil: "2026-11-20", status: "Valid" }
      ],
      specialSkills: ["Emergency Medicine", "Trauma Care", "Critical Care", "Pediatric Emergency"]
    },
    { 
      name: "Nurse Sarah Velasco", 
      role: "Emergency Nurse", 
      unit: "AMB-02", 
      status: "Available",
      certifications: [
        { name: "Nursing License", validUntil: "2028-06-30", status: "Valid" },
        { name: "BLS (Basic Life Support)", validUntil: "2026-07-15", status: "Valid" },
        { name: "ACLS", validUntil: "2026-10-30", status: "Valid" }
      ],
      specialSkills: ["Emergency Nursing", "IV Therapy", "Patient Assessment"]
    },
    { 
      name: "EMT Pedro Aquino", 
      role: "Paramedic", 
      unit: "MRU-01", 
      status: "Available",
      certifications: [
        { name: "EMT-Paramedic", validUntil: "2027-08-31", status: "Valid" },
        { name: "BLS", validUntil: "2026-12-15", status: "Valid" },
        { name: "ACLS", validUntil: "2027-01-20", status: "Valid" }
      ],
      specialSkills: ["Pre-hospital Care", "Advanced Airway Management", "Cardiac Emergency"]
    },
  ],
  drrmo: [
    { 
      name: "Engr. Roberto Fernandez", 
      role: "Disaster Officer", 
      unit: "RT-01", 
      status: "On Duty",
      certifications: [
        { name: "Disaster Risk Management", validUntil: "2027-12-31", status: "Valid" },
        { name: "Incident Command System", validUntil: "2026-11-30", status: "Valid" },
        { name: "Search and Rescue Operations", validUntil: "2027-05-15", status: "Valid" }
      ],
      specialSkills: ["Disaster Response Coordination", "Emergency Planning", "Resource Management", "Flood Response"]
    },
    { 
      name: "Mark Reyes", 
      role: "Rescue Specialist", 
      unit: "RT-02", 
      status: "Available",
      certifications: [
        { name: "Technical Rescue", validUntil: "2027-04-30", status: "Valid" },
        { name: "Water Rescue", validUntil: "2026-08-20", status: "Valid" }
      ],
      specialSkills: ["Swift Water Rescue", "Structural Collapse Rescue", "Emergency Response"]
    },
  ],
  barangay: [
    { 
      name: "Brgy. Captain Antonio Cruz", 
      role: "Barangay Captain", 
      unit: "BT-01", 
      status: "Available",
      certifications: [
        { name: "Community Emergency Response", validUntil: "2027-06-30", status: "Valid" },
        { name: "First Aid & CPR", validUntil: "2026-09-15", status: "Valid" }
      ],
      specialSkills: ["Community Coordination", "Emergency Communication", "Local Resource Management"]
    },
    { 
      name: "Kagawad Maria Lopez", 
      role: "Councilor", 
      unit: "BT-02", 
      status: "Available",
      certifications: [
        { name: "First Aid & CPR", validUntil: "2026-10-20", status: "Valid" }
      ],
      specialSkills: ["Community Mobilization", "Emergency Communication"]
    },
  ]
};

export const auditLogs = [
  { incidentId: "INC-2026-001", incidentHash: "0x7a9f2e4b8c1d", timestamp: "2026-01-20 08:45:23", verificationStatus: "Verified", department: "Dagupan Fire Department", barangay: "Bonuan Binloc", severity: "Critical" },
  { incidentId: "INC-2026-002", incidentHash: "0x3b6e1c9a2f5d", timestamp: "2026-01-20 09:15:47", verificationStatus: "Verified", department: "City Health Office", barangay: "Pantal", severity: "Warning" },
  { incidentId: "INC-2026-003", incidentHash: "0x8c4f2a7e3b1d", timestamp: "2026-01-20 10:00:12", verificationStatus: "Verified", department: "PNP Dagupan", barangay: "Poblacion Oeste", severity: "Warning" },
  { incidentId: "INC-2026-004", incidentHash: "0x2d9e6f1a5c8b", timestamp: "2026-01-20 07:30:56", verificationStatus: "Verified", department: "DRRMO Dagupan", barangay: "Bonuan Boquig", severity: "Warning" },
  { incidentId: "INC-2026-005", incidentHash: "0x5f3a8e2b9c1d", timestamp: "2026-01-19 23:30:41", verificationStatus: "Verified", department: "City Health Office", barangay: "Carael", severity: "Resolved" },
  { incidentId: "INC-2026-006", incidentHash: "0x1a2b3c4d5e6f", timestamp: "2026-01-20 09:35:00", verificationStatus: "Verified", department: "Dagupan Fire Department", barangay: "Bonuan Binloc", severity: "Critical" },
  { incidentId: "INC-2026-007", incidentHash: "0x9e8d7c6b5a4f", timestamp: "2026-01-20 11:20:15", verificationStatus: "Verified", department: "City Health Office", barangay: "Lucao", severity: "Resolved" },
  { incidentId: "INC-2026-008", incidentHash: "0x4f5e6d7c8b9a", timestamp: "2026-01-19 14:00:00", verificationStatus: "Verified", department: "DRRMO Dagupan", barangay: "Tapuac", severity: "Critical" },
  { incidentId: "INC-2026-009", incidentHash: "0x2b3c4d5e6f7a", timestamp: "2026-01-20 08:00:22", verificationStatus: "Verified", department: "PNP Dagupan", barangay: "Poblacion Oeste", severity: "Warning" },
  { incidentId: "INC-2026-010", incidentHash: "0x7c8d9e0f1a2b", timestamp: "2026-01-19 18:45:33", verificationStatus: "Verified", department: "City Health Office", barangay: "Carael", severity: "Resolved" },
  { incidentId: "INC-2026-011", incidentHash: "0x3d4e5f6a7b8c", timestamp: "2026-01-20 07:15:10", verificationStatus: "Verified", department: "Dagupan Fire Department", barangay: "Bonuan Boquig", severity: "Critical" },
  { incidentId: "INC-2026-012", incidentHash: "0x8e9f0a1b2c3d", timestamp: "2026-01-20 12:30:00", verificationStatus: "Verified", department: "DRRMO Dagupan", barangay: "Pantal", severity: "Resolved" },
];

// Admin Action Logs (separate from blockchain audit logs)
export const adminActionLogs = [
  {
    id: "ADM-2026-001",
    timestamp: "2026-01-20 08:47:00",
    adminUser: "Operator Juan Cruz",
    action: "Severity Escalation",
    details: "INC-2026-001: Warning → Critical",
    reason: "Fire spreading rapidly",
    affectedIncident: "INC-2026-001"
  },
  {
    id: "ADM-2026-002",
    timestamp: "2026-01-20 08:52:45",
    adminUser: "Supervisor Ana Garcia",
    action: "Department Addition",
    details: "INC-2026-001: Added City Health Office",
    reason: "Medical standby required",
    affectedIncident: "INC-2026-001"
  },
  {
    id: "ADM-2026-003",
    timestamp: "2026-01-20 10:10:00",
    adminUser: "Admin Jose Santos",
    action: "Mark as Duplicate",
    details: "INC-2026-006 merged into INC-2026-003",
    reason: "Same location and time frame",
    affectedIncident: "INC-2026-006"
  },
  {
    id: "ADM-2026-004",
    timestamp: "2026-01-19 15:30:00",
    adminUser: "Admin Jose Santos",
    action: "Role Change",
    details: "User 'operator2' promoted to Supervisor",
    reason: "Performance excellence",
    affectedIncident: null
  },
  {
    id: "ADM-2026-005",
    timestamp: "2026-01-20 07:45:20",
    adminUser: "Supervisor Miguel Reyes",
    action: "Severity Escalation",
    details: "INC-2026-004: Low → Warning",
    reason: "Multiple barangays affected",
    affectedIncident: "INC-2026-004"
  },
  {
    id: "ADM-2026-006",
    timestamp: "2026-01-20 00:20:00",
    adminUser: "Supervisor Ana Garcia",
    action: "Incident Closure",
    details: "INC-2026-005 closed with successful outcome",
    reason: "Patient stabilized and transported",
    affectedIncident: "INC-2026-005"
  }
];

// Disaster Control Mode Settings (Admin-Only)
export const disasterControlMode = {
  active: false,
  activatedBy: null,
  activatedAt: null,
  disasterType: null,
  affectedBarangays: [],
  priorityOverrides: {
    autoEscalateToWarning: false,
    requireSupervisorApproval: false,
    enableBulkAssignment: false
  }
};

export const users = [
  { username: "operator1", email: "operator1@dagupancity.gov.ph", password: "rescue2026", role: "Operator", department: "BFP Dagupan" },
  { username: "admin", email: "admin@dagupancity.gov.ph", password: "admin2026", role: "Admin", department: "All" },
  { username: "supervisor1", email: "supervisor1@dagupancity.gov.ph", password: "super2026", role: "Supervisor", department: "DRRMO Dagupan" },
];
