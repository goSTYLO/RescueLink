# RescueLink: AI & Blockchain-Powered Smart Emergency Response System

**Submitted by:**  
- Leader: Lozano, Melchizedek, Joshua S.  
- Members: Fran, Juliane Celes E.; Munar, Justin Kurt C.; Nelmida, Aljon S.; Tamayo, Aaron Christian B.  



## Acronyms
- AI – Artificial Intelligence  
- API – Application Programming Interface  
- AWS – Amazon Web Services  
- GPS – Global Positioning System  
- HTTPS – Hypertext Transfer Protocol Secure  
- IDS – Intrusion Detection System  
- IoT – Internet of Things  
- JWT – JSON Web Token  
- LGU – Local Government Unit  
- MFA – Multi-Factor Authentication  
- RBAC – Role-Based Access Control  
- SUS – System Usability Scale  
- TLS – Transport Layer Security  

---

## 1. Introduction

### 1.1 Background and Problem Statement
Emergency response systems are critical in urban environments but remain fragmented and manual.  
Problems include:  
- Reliance on phone/text reporting → incomplete or inaccurate data.  
- No integrated digital platforms with GPS, multimedia, or automated classification.  
- Lack of transparency/accountability → records can be altered.  
- False/malicious reports consume resources.  
- Underutilization of mobile, cloud, AI, and blockchain technologies.  
- Poor coordination among agencies.  

**Proposed Solution:** RescueLink – integrates mobile, cloud, AI, and blockchain to improve efficiency, reduce false reports, enhance transparency, and strengthen coordination.

---

### 1.2 Platform Choice Justification
- **Mobile Platform:** Citizen reporting via smartphones (GPS, camera, connectivity).  
- **Cloud Backend:** Scalability, centralized processing, high availability.  
- **Artificial Intelligence:** Incident classification, severity detection, false report filtering.  
- **Blockchain:** Immutable records for accountability and trust.  

---

## 2. Prototype Development

### 2.1 Software Methodology
Agile methodology chosen (iterative, incremental).  
Phases:  
1. Requirements Analysis & Planning  
2. System Design  
3. Development & Implementation  
4. Testing & Validation  
5. Deployment  
6. Maintenance & Continuous Improvement  

---

### 2.2 Sources of Data
- Academic literature  
- Public emergency statistics  
- Simulated incident reports  
- System-generated logs  

---

### 2.3 System Requirements

#### Functional Requirements
- FR-01: User Registration & Authentication  
- FR-02: Emergency Report Submission  
- FR-03: GPS Location Capture  
- FR-04: Multimedia Attachment  
- FR-05: AI Incident Classification  
- FR-06: False Report Detection  
- FR-07: Blockchain Logging  
- FR-08: Responder Dashboard  
- FR-09: Notification Service  

#### Nonfunctional Requirements
- Performance: Minimal latency  
- Scalability: Handle increased volumes  
- Availability: Operational during emergencies  
- Security: Protect sensitive data  
- Reliability: Consistent operation  

#### Software Requirements
- **Mobile Frameworks:** React Native, Flutter  
- **Backend Frameworks:** Django, Node.js, Express.js  
- **AI Libraries:** TensorFlow, PyTorch  
- **Blockchain Platforms:** Ethereum, Hyperledger Fabric  
- **Databases:** MongoDB, PostgreSQL  
- **Cloud/APIs:** AWS, Firebase, Google Maps API  

#### Hardware Requirements
- **Smartphones:** Android v10+ / iOS v14+, GPS, camera, sensors  
- **Development Workstations:** Intel i5/i7 or AMD Ryzen, 16GB+ RAM, GPU support  
- **Servers:** Multi-core CPUs, 32GB+ RAM, SSD, optional GPU  
- **Network Infrastructure:** Stable 4G/5G or broadband  
- **Optional IoT Devices:** Sensors, drones, wearables  

---

### 2.4 System Architecture
RescueLink uses a **layered, multi-tier architecture**:  
- **User Layer:** Mobile app input (reports, GPS, multimedia).  
- **API Gateway:** Secure HTTPS, authentication, validation.  
- **Processing Layer:** Backend logic + AI classification, severity detection, false report filtering.  
- **Data Storage Layer:** Secure databases + blockchain hashes.  
- **Output Layer:** Responder Dashboard + Notification Service.  

---

### 2.5 Sprint 1: Core Feature Development
- **AI Core Feature:** Classification, anomaly detection, efficiency.  
- **Blockchain Core Feature:** Immutable logging, tamper resistance, privacy optimization.  
- **Other Features:** Mobile app, backend APIs, responder dashboard.  

---

### 2.6 Sprint 2: Expansions and Integration
- **Dashboard Enhancements:** Live maps, prioritized queues, real-time status.  
- **Notification Services:** Push/SMS alerts via microservice.  
- **Microservice Integration:** Secure REST APIs, cloud scalability.  

---

## 3. Security Considerations
- Input sanitization, RBAC, MFA for admins.  
- Credentials secured with bcrypt hashing.  
- TLS 1.2+ for API communications.  
- JWT session management.  
- IDS, firewalls, daily backups.  
- Blockchain ensures immutable logs.  

---

## 4. Performance and Scalability
- Cloud deployment for scalability.  
- **Response Time:** 1.4s (normal), 2.6s (multimedia).  
- **Throughput:** Requests per second measured.  
- **AI Accuracy:** Correct categorization rates.  
- **Blockchain Efficiency:** Ethereum gas costs monitored.  

---

## 5. Evaluation and Testing
- **Unit Testing:** AI APIs, blockchain integration.  
- **Integration Testing:** End-to-end data flow.  
- **Performance Testing:** Latency benchmarks.  
- **Security Testing:** RBAC enforcement.  
- **User Acceptance Testing:** SUS usability evaluation.  

