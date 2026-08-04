# Graph Report - .  (2026-08-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2972 nodes · 4280 edges · 247 communities (211 shown, 36 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 202 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b7db9f88`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.dart
- incident_details_screen.dart
- Path
- auth_service.dart
- controllers/auth.js
- websocket_service.dart
- home_placeholder_screen.dart
- record_incident_on_blockchain
- auth_bloc.dart
- report_history_screen.dart
- incident_service.dart
- websocketManager.js
- package:flutter/material.dart
- settings_screen.dart
- verify_dagupan_residency_screen.dart
- report_ui.dart
- emergency_report_screen.dart
- login_screen.dart
- controllers/incident.js
- animated_fab.dart
- controllers/department.js
- controllers/location.js
- emergency_contacts_screen.dart
- app.js
- api/main.py
- integration.test.js
- dart:io
- String?
- barangay_information_screen.dart
- seed-incidents-from-audio.js
- AuthBloc
- notifications_screen.dart
- List
- gas_optimization_test.js
- constants.dart
- seed-db.js
- fileScanService.js
- mod12_spam_performance_runner.py
- controllers/dispatch.js
- skeleton_placeholder.dart
- signup_screen.dart
- app_theme.dart
- State
- forgot_password_screen.dart
- mod12_spam_security_runner.py
- privacy_security_screen.dart
- change_password_screen.dart
- fileValidation.js
- otp_verification_screen.dart
- verification_otp_screen.dart
- incidents.api.js
- devDependencies
- dependencies
- scripts
- dependencies
- http.js
- responders.api.js
- encryption.js
- aiService.js
- devDependencies
- verify_number_screen.dart
- notification_service.dart
- roles.js
- latencyMetrics.js
- api_service.dart
- train.py
- verify_new_phone_otp_screen.dart
- controllers/responder.js
- middleware/auth.js
- create_new_password_screen.dart
- staggered_fade_in.dart
- request_otp_screen.dart
- app_config.dart
- duplicateBackgroundAnalyzer.js
- db.js
- department.integration.test.js
- rbac.js
- geolocation_service.dart
- mockData.js
- mod12_performance_runner.py
- EmergencyClassifier
- generate_dataset.py
- fileUpload.js
- responsive.dart
- departments.api.js
- mod11_spam_detection_verification.py
- models/responder.js
- models/incident.js
- duplicateDetectionService.js
- glass_card.dart
- SelectParentIncidentDialog.jsx
- mod12_security_runner.py
- controllers/admin.js
- mock_http_client.dart
- user.js
- retryFileScan.js
- decide_fallback_reason
- routes/incident.js
- retryAiClassification.js
- mediaCompressionService.js
- logout_confirmation_screen.dart
- theme_service.dart
- incidentController.security.test.js
- empty_state_illustration.dart
- scripts
- Layout.jsx
- merge_datasets.py
- backup-db.js
- ROLES
- validators.dart
- App.jsx
- constants/index.js
- run_migrations.js
- devDependencies
- setup-db.js
- routes/admin.js
- routes/auditLog.js
- routes/department.js
- routes/dispatch.js
- routes/metrics.js
- routes/responder.js
- test_blockchain_connection.test.js
- phase1_components_test.dart
- adminUsers.api.js
- auditLog.api.js
- location.api.js
- DepartmentPersonnelPage.jsx
- DepartmentsPage.jsx
- IncidentDetailsPage.jsx
- MapViewPage.jsx
- TeamPage.jsx
- config.py
- link-seed-duplicates.js
- firebase_options.dart
- useIncidentWebSocket.js
- Tabs.jsx
- DashboardPage.jsx
- prepare_hf_dataset.py
- Backend/package.json
- endpoints.smoke.test.js
- dispatcher_dashboard/package.json
- session.js
- ThemeContext.jsx
- DepartmentDetailsPage.jsx
- SettingsPage.jsx
- clean_base_reports.py
- create_base_reports.py
- config/firebase.js
- uploadMiddleware.integration.test.js
- compile_contract
- incidentClassification.js
- infrastructure/firebase.js
- CreateNewPassword.jsx
- DepartmentDashboardPage.jsx
- ResetPasswordPage.jsx
- run_master_integration_tests.ps1
- MainActivity
- _openNotifications
- departmentSector.js
- IncidentMap.jsx
- IncidentWebSocketContext.jsx
- AssignedIncidentsPage.jsx
- DepartmentVehiclesPage.jsx
- HelpSupportPage.jsx
- Login.interaction.test.jsx
- add_humanized_reports.py
- test_confidence.py
- express
- express-rate-limit
- multer
- fluent-ffmpeg
- helmet
- jsonwebtoken
- nodemailer
- ws
- HomePlaceholderScreen
- identity-obj-proxy
- jest
- jest-environment-jsdom
- postcss
- tailwindcss
- @testing-library/react
- vite.config.js
- copilot-instructions.md
- TEST_MICROPHONE.sh script
- Exception

## God Nodes (most connected - your core abstractions)
1. `AuthBloc` - 41 edges
2. `ROLES` - 27 edges
3. `scripts` - 19 edges
4. `AuthState` - 15 edges
5. `apiRequest()` - 15 edges
6. `validateString()` - 14 edges
7. `validateOptionalString()` - 14 edges
8. `EmergencyClassifier` - 13 edges
9. `WhisperHandler` - 12 edges
10. `seedIncidents()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AuditLogPage()` --indirect_call--> `log()`  [INFERRED]
  Frontend/Web/dispatcher_dashboard/src/presentation/pages/AuditLogPage.jsx → Backend/tests/integration.test.js
- `onboardPhone()` --calls--> `validateString()`  [EXTRACTED]
  Backend/src/controllers/auth.js → Backend/src/utils/validation.js
- `load_model_and_tokenizer()` --calls--> `EmergencyClassifier`  [INFERRED]
  RescueLink AI/api/main.py → RescueLink AI/models/emergency_classifier.py
- `EmergencyRequest` --uses--> `EmergencyClassifier`  [INFERRED]
  RescueLink AI/api/main.py → RescueLink AI/models/emergency_classifier.py
- `TranscriptionResponse` --uses--> `EmergencyClassifier`  [INFERRED]
  RescueLink AI/api/main.py → RescueLink AI/models/emergency_classifier.py

## Import Cycles
- None detected.

## Communities (247 total, 36 thin omitted)

### Community 0 - "main.dart"
Cohesion: 0.02
Nodes (81): firebase_options.dart, _backToLogin, _checkingSession, createState, didChangeAppLifecycleState, dispose, _emergencyNoAiInProgress, _forgotFlowScreen (+73 more)

### Community 1 - "incident_details_screen.dart"
Cohesion: 0.03
Nodes (65): AudioPlayer, _aiClassification, _aiConfidenceLabel, _apiUnreadCount, _audioDuration, _audioLoaded, _audioPlayer, _audioPosition (+57 more)

### Community 2 - "Path"
Cohesion: 0.07
Nodes (43): Path, build_blockchain_payload(), health_checks(), main(), rpc_gas_used(), run_ai_cases(), run_backend_smoke(), run_blockchain_case() (+35 more)

### Community 3 - "auth_service.dart"
Cohesion: 0.04
Nodes (50): FirebaseAuth, FlutterSecureStorage, _apiService, changePassword, checkLocationInDagupan, clearBiometricData, clearBiometricToken, clearToken (+42 more)

### Community 4 - "controllers/auth.js"
Cohesion: 0.08
Nodes (44): canUseWebEmailAuth(), changePassword(), Department, dispatcherLogin(), DispatcherOtp, dispatcherSignup(), dispatcherVerifyOtp(), firebaseAdmin (+36 more)

### Community 5 - "websocket_service.dart"
Cohesion: 0.04
Nodes (47): barangay, _channel, _cleanup, connect, data, disconnect, dispose, _disposed (+39 more)

### Community 6 - "home_placeholder_screen.dart"
Cohesion: 0.04
Nodes (44): _apiUnreadCount, build, _buildHomeContent, _buildLogo, _buildReportHistoryContent, _buildSettingsContent, _buildSosCountdownOverlay, _cancelSosCountdown (+36 more)

### Community 7 - "record_incident_on_blockchain"
Cohesion: 0.08
Nodes (40): add_request_id_middleware(), health_check(), Any, BaseModel, Request, RescueLink Blockchain Service - FastAPI  Stores verified incident hashes on Ga, Health check and Ganache connection status., Record a verified incident hash on the blockchain.     Creates SHA-256 hash of (+32 more)

### Community 8 - "auth_bloc.dart"
Cohesion: 0.07
Nodes (39): auth_event.dart, auth_state.dart, Equatable, _authService, _onAuthReset, _onBiometricLoginRequested, _onLocationCheckRequested, _onLoginRequested (+31 more)

### Community 9 - "report_history_screen.dart"
Cohesion: 0.05
Nodes (39): FocusNode, build, _buildLogo, createState, dispose, _error, _filterStatus, _filterType (+31 more)

### Community 10 - "incident_service.dart"
Cohesion: 0.05
Nodes (38): api_service.dart, _apiService, _authHeaders, _authService, bytes, _client, close, confidence (+30 more)

### Community 11 - "websocketManager.js"
Cohesion: 0.07
Nodes (33): crypto, pool, TokenBlacklist, app, http, { init: initWebSocket }, pool, DEPARTMENT_SCOPED_ROLES (+25 more)

### Community 12 - "package:flutter/material.dart"
Cohesion: 0.06
Nodes (32): build, IdentityErrorScreen, onTryAgain, build, _buildLogo, onBackToLogin, PasswordUpdatedScreen, build (+24 more)

### Community 13 - "settings_screen.dart"
Cohesion: 0.06
Nodes (36): _biometricLogin, build, _buildSettingsHeaderLogo, _camera, _collapsibleSection, createState, _expandedSections, initState (+28 more)

### Community 14 - "verify_dagupan_residency_screen.dart"
Cohesion: 0.06
Nodes (35): build, _buildLogo, _buildStatusCard, _bypassLocationCheck, createState, _currentLat, _currentLng, _handleRefreshGps (+27 more)

### Community 15 - "report_ui.dart"
Cohesion: 0.05
Nodes (36): assigned, assignedDepartmentDisplayName, badgeBackground, badgeBorder, badgeIcon, badgeText, departmentFromIncidentType, formatIncidentCode (+28 more)

### Community 16 - "emergency_report_screen.dart"
Cohesion: 0.06
Nodes (35): AudioRecorder, dart:typed_data, _additionalDetailsExpanded, _audioBytes, _barangay, build, _buildDisabledMediaButton, _buildMediaAddButton (+27 more)

### Community 17 - "login_screen.dart"
Cohesion: 0.10
Nodes (19): FormState, build, _buildIllustration, _buildLogo, _checkBiometricAvailability, createState, dispose, _formKey (+11 more)

### Community 18 - "controllers/incident.js"
Cohesion: 0.07
Nodes (30): attachAssignedDepartment(), attachDispatchEta(), buildIncidentTimeline(), Department, Dispatch, duplicateConfig, estimateEtaMinutes(), { findPotentialDuplicates, linkAsDuplicate, getDuplicateInfo } (+22 more)

### Community 19 - "animated_fab.dart"
Cohesion: 0.06
Nodes (31): Animation, AnimationController, backgroundColor, build, _controller, createState, dispose, _handleLongPress (+23 more)

### Community 20 - "controllers/department.js"
Cohesion: 0.12
Nodes (26): AuditLog, getAdminLogs(), getAll(), { ROLES }, { validatePagination, validateOptionalString, validateOptionalDate }, Department, departmentController, { isPointInDagupan } (+18 more)

### Community 21 - "controllers/location.js"
Cohesion: 0.11
Nodes (25): ensureIncidentBarangay(), buildCompactDisplayLabel(), DAGUPAN_CITY_CENTER, DAGUPAN_LANDMARKS, Department, fetchNominatimSearchResults(), formatNominatimResult(), getLocalAddressSuggestions() (+17 more)

### Community 22 - "emergency_contacts_screen.dart"
Cohesion: 0.07
Nodes (30): _AddContactFormContent, _AddContactFormContentState, build, _contactCard, _contacts, _contactToDelete, createState, dispose (+22 more)

### Community 23 - "app.js"
Cohesion: 0.07
Nodes (27): adminRoutes, apiLimiter, app, auditLogRoutes, authLimiter, authLimiterGlobal, authRoutes, cors (+19 more)

### Community 24 - "api/main.py"
Cohesion: 0.12
Nodes (27): add_request_id_middleware(), _apply_keyword_fallback(), classify_audio_endpoint(), classify_emergency(), classify_microphone(), EmergencyRequest, get_labels(), health_check() (+19 more)

### Community 25 - "integration.test.js"
Cohesion: 0.16
Nodes (27): assert(), axios, FormData, fs, log(), path, request(), runTests() (+19 more)

### Community 26 - "dart:io"
Cohesion: 0.13
Nodes (22): dart:convert, dart:io, main, main, main, main, main, main (+14 more)

### Community 27 - "String?"
Cohesion: 0.07
Nodes (26): double?, AccountCreatedScreen, build, _goBack, onBackToLogin, onContinueToVerifyPhone, onDone, registeredPhone (+18 more)

### Community 28 - "barangay_information_screen.dart"
Cohesion: 0.07
Nodes (28): _addressController, _addressFocusNode, _applySuggestion, BarangayInformationScreen, _BarangayInformationScreenState, build, createState, _displayAddress (+20 more)

### Community 29 - "seed-incidents-from-audio.js"
Cohesion: 0.11
Nodes (26): args, AUDIO_EXTENSIONS, BARANGAYS, { checkAiHealth, processIncidentWithAudio }, coerceIncidentType(), coerceSeverity(), collectAudioFiles(), DAGUPAN_LOCATION_FIXTURES (+18 more)

### Community 30 - "AuthBloc"
Cohesion: 0.15
Nodes (26): AuthBloc, OtpVerified, ResendOtpRequested, AuthError, AuthInitial, AuthLoading, AuthState, isInDagupan (+18 more)

### Community 31 - "notifications_screen.dart"
Cohesion: 0.08
Nodes (26): build, _collapsedPreview, createState, dispose, _error, _eventTypeLabel, _expandedKeys, _formatTimestamp (+18 more)

### Community 32 - "List"
Cohesion: 0.13
Nodes (23): Bloc, example_event.dart, example_state.dart, ExampleBloc, _onDecrement, _onIncrement, _onReset, ExampleDecrementEvent (+15 more)

### Community 33 - "gas_optimization_test.js"
Cohesion: 0.11
Nodes (22): axios, checkBackend(), checkBlockchainService(), checkGanache(), dotenv, { execSync }, { expect }, getOrCreateTestIncident() (+14 more)

### Community 34 - "constants.dart"
Cohesion: 0.08
Nodes (25): apiAuth, apiDispatches, apiIncidents, apiLocation, apiNotifications, apiResponders, AppConstants, appName (+17 more)

### Community 35 - "seed-db.js"
Cohesion: 0.11
Nodes (23): AUDIO_EXTENSIONS, bcryptjs, collectAudioFiles(), DAGUPAN_LOCATION_FIXTURES, DEPARTMENTS, { encrypt }, encryptNullable(), estimateEncryptedHexLength() (+15 more)

### Community 36 - "fileScanService.js"
Cohesion: 0.13
Nodes (22): BLOCKED_SIGNATURES, CLAMAV_PORT, CLAMAV_TIMEOUT_MS, detectSimulatedThreat(), fsSync, getDeepScanStatus(), hasBlockedSignature(), includesAtOffset() (+14 more)

### Community 37 - "mod12_spam_performance_runner.py"
Cohesion: 0.16
Nodes (24): ai_headers(), case_p1_normal_input(), case_p2_long_input(), case_p3_empty_input(), case_p4_audio_throughput(), case_p5_audio_concurrent_load(), case_p6_blockchain_single(), case_p7_blockchain_batch() (+16 more)

### Community 38 - "controllers/dispatch.js"
Cohesion: 0.10
Nodes (21): Department, Dispatch, dispatchController, emitDispatchEvent(), Incident, { logDispatcherAction }, { persistIncidentNotifications }, Responder (+13 more)

### Community 39 - "skeleton_placeholder.dart"
Cohesion: 0.11
Nodes (23): BoxShape, _DeleteContactDialog, borderRadius, build, cardCount, height, inputHeight, shape (+15 more)

### Community 40 - "signup_screen.dart"
Cohesion: 0.08
Nodes (23): build, _buildIllustration, _buildLogo, _confirmPasswordController, createState, dagupanBarangays, dispose, _firstNameController (+15 more)

### Community 41 - "app_theme.dart"
Cohesion: 0.08
Nodes (23): AppTheme, baseFontSize, _buildTextTheme, darkBackground, darkBorder, darkCard, darkSurface, darkTextMuted (+15 more)

### Community 42 - "State"
Cohesion: 0.13
Nodes (23): RescueLinkApp, _RescueLinkAppState, CreateNewPasswordScreen, _CreateNewPasswordScreenState, ForgotPasswordScreen, _ForgotPasswordScreenState, SignUpScreen, _SignUpScreenState (+15 more)

### Community 43 - "forgot_password_screen.dart"
Cohesion: 0.09
Nodes (21): build, _buildLogo, createState, dispose, _handleRequestCode, _isLoading, onBackToLogin, _phoneController (+13 more)

### Community 44 - "mod12_spam_security_runner.py"
Cohesion: 0.14
Nodes (22): ai_headers(), case_s1_authorization(), case_s2_invalid_input(), case_s3_data_exposure(), case_s4_ai_adversarial_bypass(), case_s5_audio_security_validation(), case_s6_blockchain_replay(), case_s7_blockchain_unauthorized_access() (+14 more)

### Community 45 - "privacy_security_screen.dart"
Cohesion: 0.10
Nodes (21): _aiIncidentAnalysis, _autoLogoutOption, _autoLogoutSheet, _biometricLogin, build, createState, initState, _loadBiometricPreference (+13 more)

### Community 46 - "change_password_screen.dart"
Cohesion: 0.10
Nodes (20): build, ChangePasswordScreen, _ChangePasswordScreenState, _confirmController, createState, _currentController, dispose, _inputCard (+12 more)

### Community 47 - "fileValidation.js"
Cohesion: 0.15
Nodes (19): compressPhoto(), { compressPhoto, compressVideo }, crypto, deleteFile(), deleteIncidentFiles(), ensureQuarantineDir(), fileExists(), generateFilename() (+11 more)

### Community 48 - "otp_verification_screen.dart"
Cohesion: 0.11
Nodes (19): _authService, build, _captureLocationAndVerify, createState, dispose, _getOTPCode, _handleOTPInput, _handleResendOTP (+11 more)

### Community 49 - "verification_otp_screen.dart"
Cohesion: 0.06
Nodes (33): bloc/auth/auth_bloc.dart, bloc/auth/auth_event.dart, bloc/auth/auth_state.dart, build, _buildLogo, _canResend, cityRegion, _controllers (+25 more)

### Community 50 - "incidents.api.js"
Cohesion: 0.12
Nodes (6): CANONICAL_INCIDENT_STATUSES, getIncidents(), incidentsCache, inflightRequests, normalizeIncidentStatus(), updateIncidentStatus()

### Community 51 - "devDependencies"
Cohesion: 0.11
Nodes (19): autoprefixer, babel-jest, @babel/preset-env, @babel/preset-react, devDependencies, autoprefixer, babel-jest, @babel/preset-env (+11 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, axios, bcryptjs, cors, dotenv, ffmpeg-static, firebase-admin, node-cron (+11 more)

### Community 53 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, analyze-duplicates, backup-db, dev, link-seed-duplicates, migrate, seed-db, seed-db:full (+11 more)

### Community 54 - "dependencies"
Cohesion: 0.11
Nodes (19): firebase, dependencies, firebase, leaflet, lucide-react, react, react-dom, react-leaflet (+11 more)

### Community 55 - "http.js"
Cohesion: 0.17
Nodes (15): clearLatencyEventsSnapshot(), getAuthHeaders(), getAuthToken(), getLatencyEventsSnapshot(), getStoredLatencyEvents(), installFetchTimingInstrumentation(), logError(), logInfo() (+7 more)

### Community 56 - "responders.api.js"
Cohesion: 0.21
Nodes (18): addTeamMember(), apiRequest(), assertNotRateLimited(), createResponder(), createResponderTeam(), getResponders(), getResponderTeams(), getRetryAfterMs() (+10 more)

### Community 57 - "encryption.js"
Cohesion: 0.19
Nodes (16): AuditLog, decodeAuditRow(), decodeAuditUserFields(), { decrypt }, looksEncryptedValue(), pool, { recursivelyDecrypt }, tryDecryptValue() (+8 more)

### Community 58 - "aiService.js"
Cohesion: 0.20
Nodes (16): AI_CIRCUIT_FAILURE_THRESHOLD, AI_CIRCUIT_RESET_MS, AI_HEALTH_PRECHECK_ENABLED, axios, buildAuthHeaders(), checkAiHealth(), classifyAudio(), classifyText() (+8 more)

### Community 59 - "devDependencies"
Cohesion: 0.11
Nodes (17): description, devDependencies, axios, chai, dotenv, mocha, web3, axios (+9 more)

### Community 60 - "verify_number_screen.dart"
Cohesion: 0.12
Nodes (17): build, _buildLogo, _code, _controllers, createState, dispose, _focusNodes, initState (+9 more)

### Community 61 - "notification_service.dart"
Cohesion: 0.12
Nodes (16): auth_service.dart, Client, _authService, _client, close, _extractErrorMessage, getNotifications, getUnreadCount (+8 more)

### Community 62 - "roles.js"
Cohesion: 0.14
Nodes (14): hasPermission(), PERMISSIONS, requiresOwnership(), RESOURCES, requiresPermission(), adminToken, app, dispatcherToken (+6 more)

### Community 63 - "latencyMetrics.js"
Cohesion: 0.18
Nodes (13): latencyMetrics, metricsController, { recordRequest, normalizePath }, VERBOSE_TIMING_LOGS, aggregateSamples(), endpointSamples, getSummary(), keyFor() (+5 more)

### Community 64 - "api_service.dart"
Cohesion: 0.12
Nodes (16): dart:async, ApiException, ApiService, baseUrl, _buildHeaders, _buildUri, client, close (+8 more)

### Community 65 - "train.py"
Cohesion: 0.20
Nodes (13): Dataset, best_threshold_from_probs(), build_label_maps(), detect_device(), EmergencyDataset, evaluate(), load_df(), make_dataloaders() (+5 more)

### Community 66 - "verify_new_phone_otp_screen.dart"
Cohesion: 0.12
Nodes (16): build, _canResend, _controllers, createState, dispose, _focusNodes, initState, onBack (+8 more)

### Community 67 - "controllers/responder.js"
Cohesion: 0.14
Nodes (13): Department, INCIDENT_TASK_TYPES, { logDispatcherAction }, normalizeTaskType(), normalizeTaskTypes(), RESOLVER_STATUSES, Responder, responderController (+5 more)

### Community 68 - "middleware/auth.js"
Cohesion: 0.12
Nodes (13): jwt, { JWT_SECRET }, TokenBlacklist, authController, authMiddleware, express, router, authMiddleware (+5 more)

### Community 69 - "create_new_password_screen.dart"
Cohesion: 0.12
Nodes (15): bool get, build, _buildLogo, _confirmController, createState, dispose, _handleReset, idToken (+7 more)

### Community 70 - "staggered_fade_in.dart"
Cohesion: 0.12
Nodes (15): Duration, _animations, build, children, _controller, createState, didUpdateWidget, dispose (+7 more)

### Community 71 - "request_otp_screen.dart"
Cohesion: 0.13
Nodes (15): _authService, build, createState, initState, _isLoading, _obscureConfirmPassword, _obscurePassword, onBackTap (+7 more)

### Community 72 - "app_config.dart"
Cohesion: 0.12
Nodes (15): apiBaseUrl, apiTimeout, AppConfig, defaultLatitude, defaultLongitude, defaultPageSize, enableApiLogging, enableDebugLogging (+7 more)

### Community 73 - "duplicateBackgroundAnalyzer.js"
Cohesion: 0.18
Nodes (12): main(), pool, { runDuplicateAnalysis }, runRealtimeDuplicateCheck(), cron, duplicateConfig, {
  findPotentialDuplicates,
}, getRecentReportsToAnalyze() (+4 more)

### Community 74 - "db.js"
Cohesion: 0.13
Nodes (8): { Pool }, crypto, DispatcherOtp, pool, IncidentCoordinationNote, pool, Incident, pool

### Community 75 - "department.integration.test.js"
Cohesion: 0.13
Nodes (10): app, jwt, { JWT_SECRET }, request, { ROLES }, app, jwt, { JWT_SECRET } (+2 more)

### Community 76 - "rbac.js"
Cohesion: 0.19
Nodes (12): applyRoleFilter(), authorize(), checkOwnership(), isResourceOwner(), normalizeRoleAlias(), { ROLES, PERMISSIONS, hasPermission, requiresOwnership }, authMiddleware, { authorize, checkOwnership } (+4 more)

### Community 77 - "geolocation_service.dart"
Cohesion: 0.13
Nodes (14): dart:math, calculateDistance, checkLocationPermission, _dagupanPolygon, _distanceToLineSegment, GeolocationService, getCurrentPosition, isPointInDagupan (+6 more)

### Community 78 - "mockData.js"
Cohesion: 0.13
Nodes (14): adminActionLogs, auditLogs, barangays, coordinationNotes, departments, disasterControlMode, escalationHistory, incidents (+6 more)

### Community 79 - "mod12_performance_runner.py"
Cohesion: 0.35
Nodes (14): ai_headers(), case_p1_normal_input(), case_p2_long_input(), case_p3_empty_input(), case_p4_audio_latency(), case_p5_blockchain_single(), case_p6_blockchain_burst(), case_p7_blockchain_duplicate_gas_skip() (+6 more)

### Community 80 - "EmergencyClassifier"
Cohesion: 0.18
Nodes (10): AudioClassificationResponse, EmergencyResponse, get_audio_stats(), HealthResponse, BaseModel, Get Whisper STT usage statistics (monitoring), UsageStatsResponse, load_metadata() (+2 more)

### Community 81 - "generate_dataset.py"
Cohesion: 0.20
Nodes (14): add_paraphrase_variation(), generate_combination(), has_location_leakage(), load_base_reports(), main(), Generate realistic Filipino/Taglish emergency reports for training. Uses curate, Run quality checks and return summary., Remove location references (GPS collected separately). (+6 more)

### Community 82 - "fileUpload.js"
Cohesion: 0.18
Nodes (11): AUDIO_EXTENSIONS, multer, path, PHOTO_EXTENSIONS, { runUploadSecurityChecks, FILE_SCAN_FAIL_OPEN }, storage, upload, uploadMiddleware() (+3 more)

### Community 83 - "responsive.dart"
Cohesion: 0.14
Nodes (13): brandSubtitleSize, brandTitleSize, horizontalPadding, isCompact, logoSize, navItemHorizontalPadding, navLabelSize, Responsive (+5 more)

### Community 84 - "departments.api.js"
Cohesion: 0.22
Nodes (8): assertNotRateLimited(), getDepartmentById(), getDepartments(), getDepartmentUnits(), getRetryAfterMs(), inflightMap, readCache, readWithCache()

### Community 85 - "mod11_spam_detection_verification.py"
Cohesion: 0.25
Nodes (13): ai_headers(), main(), now_ms(), Test Case 2: Audio Report Validation          BEFORE: No validation, all audio, Test Case 3: Report Audit Trail (Blockchain Integration)          BEFORE: Repo, Write results in markdown format for easy reading., Run a test case and return structured results for Before vs After table., Test Case 1: Text Report Spam Detection          BEFORE: Manual review of all (+5 more)

### Community 86 - "models/responder.js"
Cohesion: 0.17
Nodes (9): Dispatch, pool, Responder, normalizeIncidentType(), normalizeIncidentTypes(), pool, Responder, pool (+1 more)

### Community 87 - "models/incident.js"
Cohesion: 0.19
Nodes (9): decodeReporterFields(), { encrypt, decrypt }, Incident, INCIDENT_STATUS_FLOW, looksEncryptedValue(), pool, { ROLES }, tryDecryptValue() (+1 more)

### Community 88 - "duplicateDetectionService.js"
Cohesion: 0.19
Nodes (9): { calculateDistance }, calculateDuplicateConfidence(), duplicateConfig, getDuplicateCluster(), getDuplicateInfo(), getPrimaryReportId(), pool, { tryDecryptValue } (+1 more)

### Community 89 - "glass_card.dart"
Cohesion: 0.15
Nodes (12): Color, dart:ui, EdgeInsetsGeometry?, backgroundColor, blurSigma, borderColor, borderRadius, build (+4 more)

### Community 90 - "SelectParentIncidentDialog.jsx"
Cohesion: 0.19
Nodes (11): mapApiIncidentToDisplay(), normalizeIncidentStatusLabel(), SEVERITY_MAP, STATUS_MAP, TYPE_MAP, mapSeverityFilterToApi(), mapStatusFilterToApi(), SelectParentIncidentDialog() (+3 more)

### Community 91 - "mod12_security_runner.py"
Cohesion: 0.31
Nodes (12): ai_headers(), case_s1_authorization_non_owner(), case_s2_invalid_input(), case_s3_data_exposure(), case_s4_ai_token_enforcement_probe(), case_s5_blockchain_invalid_payload(), case_s6_blockchain_duplicate_replay(), case_s7_ai_empty_input_validation() (+4 more)

### Community 92 - "controllers/admin.js"
Cohesion: 0.18
Nodes (8): adminController, { hashPassword }, { logAdminAction }, { ROLES }, User, { validateEmail, validatePhoneNumber, validateOptionalString, validatePagination }, AuditLog, logAdminAction()

### Community 93 - "mock_http_client.dart"
Cohesion: 0.17
Nodes (11): addIncidentsResponse, addLoginResponse, addNotificationsResponse, addProfileResponse, addResponse, MockHttpClient, requests, _responses (+3 more)

### Community 94 - "user.js"
Cohesion: 0.22
Nodes (9): accounts, { comparePassword }, User, decodeUserFields(), { decrypt }, looksEncryptedValue(), pool, tryDecryptValue() (+1 more)

### Community 95 - "retryFileScan.js"
Cohesion: 0.22
Nodes (9): cron, FILE_SCAN_MAX_BATCH, Incident, { performDeepScan }, pool, processPendingScan(), { quarantineIncidentFiles }, runFileScanRetryJob() (+1 more)

### Community 96 - "decide_fallback_reason"
Cohesion: 0.29
Nodes (5): TestFallbackRules, apply_keyword_fallback(), decide_fallback_reason(), _normalize_text(), _resolve_label()

### Community 97 - "routes/incident.js"
Cohesion: 0.20
Nodes (9): authMiddleware, { authorize, checkOwnership }, express, incidentController, incidentReportLimiter, { rateLimit, ipKeyGenerator }, { ROLES }, router (+1 more)

### Community 98 - "retryAiClassification.js"
Cohesion: 0.29
Nodes (8): retryClassification(), cron, Incident, manualRetry(), processPendingIncident(), { retryClassification }, runRetryJob(), startRetryService()

### Community 99 - "mediaCompressionService.js"
Cohesion: 0.27
Nodes (9): compressVideo(), createTempPath(), crypto, getVideoMetadata(), os, path, PHOTO_EXTENSIONS, transcodeVideo() (+1 more)

### Community 100 - "logout_confirmation_screen.dart"
Cohesion: 0.22
Nodes (9): build, _bullet, createState, LogoutConfirmationScreen, _LogoutConfirmationScreenState, _logOutFromAllDevices, onBack, onCancel (+1 more)

### Community 101 - "theme_service.dart"
Cohesion: 0.20
Nodes (8): getThemeMode, setThemeMode, _themeKey, ThemeService, load, setupIntegrationTest, package:flutter_dotenv/flutter_dotenv.dart, package:shared_preferences/shared_preferences.dart

### Community 102 - "incidentController.security.test.js"
Cohesion: 0.22
Nodes (7): computeInitialScanStatus(), Incident, incidentController, pool, { processIncidentWithAudio }, { queueDeepScanJob, computeInitialScanStatus }, { saveAudioFile, saveMediaFiles }

### Community 103 - "empty_state_illustration.dart"
Cohesion: 0.22
Nodes (8): actionLabel, build, EmptyStateIllustration, icon, onAction, subtitle, title, IconData

### Community 104 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, preview, test, test:all, test:ci, test:e2e:smoke (+1 more)

### Community 105 - "Layout.jsx"
Cohesion: 0.28
Nodes (8): DEV_ROLE_PRESETS, formatNotificationTime(), Layout(), NAV_DEPARTMENT_ADMIN, NAV_DEPARTMENT_HEAD, NAV_DISPATCHER, NAV_PERSONNEL, NAV_SUPER_ADMIN

### Community 106 - "merge_datasets.py"
Cohesion: 0.31
Nodes (8): load_and_map_hf_dataset(), load_synthetic_dataset(), main(), map_hf_incidents_to_target(), Merge synthetic and HF datasets with unified 6-category schema Maps HF's 35 inc, Map HF incident list to target 6 categories, Load and process synthetic dataset, Load HF dataset and map to target categories

### Community 107 - "backup-db.js"
Cohesion: 0.25
Nodes (7): backupsDir, fs, outPath, path, result, { spawnSync }, timestamp

### Community 108 - "ROLES"
Cohesion: 0.29
Nodes (5): ROLES, getOwnershipFilter(), isOwner(), { ROLES }, validateOwnership()

### Community 109 - "validators.dart"
Cohesion: 0.25
Nodes (7): formatPhoneForFirebase, validateEmail, validateName, validatePassword, validatePasswordConfirmation, validatePhoneNumber, Validators

### Community 110 - "App.jsx"
Cohesion: 0.29
Nodes (5): ANY_AUTH_ROLE, App(), DASHBOARD_OPERATIONS_ROLES, DEPARTMENT_AND_UP, SUPER_ADMIN_ONLY

### Community 111 - "constants/index.js"
Cohesion: 0.43
Nodes (7): getDefaultRouteByRole(), getRoleDisplayLabel(), isDepartmentAdmin(), isPersonnel(), isSuperAdmin(), normalizeRole(), ROLES

### Community 113 - "run_migrations.js"
Cohesion: 0.29
Nodes (5): fs, MIGRATION_ORDER, MIGRATIONS_DIR, path, pool

### Community 114 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, jest, nodemon, supertest, jest, nodemon, supertest

### Community 115 - "setup-db.js"
Cohesion: 0.29
Nodes (5): fs, MIGRATION_ORDER, MIGRATIONS_DIR, path, { Pool }

### Community 116 - "routes/admin.js"
Cohesion: 0.29
Nodes (6): adminController, authMiddleware, { authorize }, express, { ROLES }, router

### Community 117 - "routes/auditLog.js"
Cohesion: 0.29
Nodes (6): auditLogController, authMiddleware, { authorize }, express, { ROLES }, router

### Community 118 - "routes/department.js"
Cohesion: 0.29
Nodes (6): authMiddleware, { authorize }, departmentController, express, { ROLES }, router

### Community 119 - "routes/dispatch.js"
Cohesion: 0.29
Nodes (6): authMiddleware, { authorize }, dispatchController, express, { ROLES }, router

### Community 120 - "routes/metrics.js"
Cohesion: 0.29
Nodes (6): authMiddleware, { authorize }, express, metricsController, { ROLES }, router

### Community 121 - "routes/responder.js"
Cohesion: 0.29
Nodes (6): authMiddleware, { authorize }, express, responderController, { ROLES }, router

### Community 122 - "test_blockchain_connection.test.js"
Cohesion: 0.29
Nodes (5): axios, dotenv, { expect }, path, Web3

### Community 123 - "phase1_components_test.dart"
Cohesion: 0.29
Nodes (6): main, MaterialApp, package:rescuelink_mobile/widgets/animated_fab.dart, package:rescuelink_mobile/widgets/bottom_sheet_wrapper.dart, package:rescuelink_mobile/widgets/glass_card.dart, package:rescuelink_mobile/widgets/skeleton_placeholder.dart

### Community 125 - "auditLog.api.js"
Cohesion: 0.38
Nodes (5): cacheMap, getAuditLogs(), inflightMap, readCache(), writeCache()

### Community 126 - "location.api.js"
Cohesion: 0.52
Nodes (6): getClosestUnits(), getGeofenceAlerts(), getHeatmapHotspots(), parseJsonResponse(), reverseDagupanLocation(), searchDagupanLocations()

### Community 127 - "DepartmentPersonnelPage.jsx"
Cohesion: 0.43
Nodes (6): AVAILABILITY_OPTIONS, DepartmentPersonnelPage(), getStoredAssignments(), getStoredVehicleAssignments(), TASK_TYPES, toggleTaskType()

### Community 128 - "DepartmentsPage.jsx"
Cohesion: 0.33
Nodes (5): AVAILABILITY_OPTIONS, DEPARTMENT_TYPES, inferDepartmentSectorCode(), normalizeSectorCode(), TASK_TYPES

### Community 129 - "IncidentDetailsPage.jsx"
Cohesion: 0.57
Nodes (6): ACTIVE_SECTOR_IDS, getDefaultSectorByIncidentType(), IncidentDetailsPage(), mapApiToIncidentDetails(), mapSeverityToDisplay(), normalizeSeverityToDbLevel()

### Community 130 - "MapViewPage.jsx"
Cohesion: 0.48
Nodes (6): ACTIVE_STATUSES, buildMapLinks(), DAGUPAN_CENTER, getSeverityMarkerIcon(), mapApiIncidentToMap(), MapViewPage()

### Community 131 - "TeamPage.jsx"
Cohesion: 0.52
Nodes (6): ROLE_OPTIONS, ROLE_OPTIONS_FOR_ADD, ROLE_TO_BACKEND, roleToBackend(), roleToLabel(), TeamPage()

### Community 132 - "config.py"
Cohesion: 0.43
Nodes (5): Namespace, dump_config(), load_config(), parse_args(), TrainConfig

### Community 133 - "link-seed-duplicates.js"
Cohesion: 0.40
Nodes (5): { linkAsDuplicate }, main(), pool, { tryDecryptValue }, linkAsDuplicate()

### Community 134 - "firebase_options.dart"
Cohesion: 0.33
Nodes (5): android, DefaultFirebaseOptions, package:firebase_core/firebase_core.dart, package:flutter/foundation.dart, static const FirebaseOptions

### Community 139 - "DashboardPage.jsx"
Cohesion: 0.60
Nodes (5): DashboardPage(), dedupeIncidentsById(), mapApiIncidentToDashboard(), mapSeverityFilterToApi(), mapStatusFilterToApi()

### Community 140 - "prepare_hf_dataset.py"
Cohesion: 0.33
Nodes (5): clean_text(), map_severity_conservative(), Prepare Hugging Face emergency_classification_alpaca dataset Maps to RescueLink, Conservative START triage mapping:     - Black: death present     - Red: acute, Clean and validate text

### Community 141 - "Backend/package.json"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 142 - "endpoints.smoke.test.js"
Cohesion: 0.50
Nodes (4): app, endpoints, issueRequest(), request

### Community 143 - "dispatcher_dashboard/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 146 - "ThemeContext.jsx"
Cohesion: 0.50
Nodes (3): getStoredTheme(), ThemeContext, ThemeProvider()

### Community 147 - "DepartmentDetailsPage.jsx"
Cohesion: 0.60
Nodes (4): AVAILABILITY_OPTIONS, DepartmentDetailsPage(), normalizeStatus(), toTitleCase()

### Community 148 - "SettingsPage.jsx"
Cohesion: 0.40
Nodes (3): defaultSettings, fireThresholdOptions, medicalThresholdOptions

### Community 149 - "clean_base_reports.py"
Cohesion: 0.50
Nodes (4): is_synthetic(), main(), One-off script to remove synthetic template rows from realistic_base_reports.jso, Return True if row is synthetic template (should be removed).

### Community 150 - "create_base_reports.py"
Cohesion: 0.50
Nodes (4): expand_phrase(), main(), Create realistic_base_reports.jsonl with curated Filipino/Taglish emergency repo, Return text as single variant (no location injection - GPS collected separately)

### Community 152 - "uploadMiddleware.integration.test.js"
Cohesion: 0.67
Nodes (3): express, loadApp(), request

### Community 153 - "compile_contract"
Cohesion: 0.67
Nodes (3): compile_contract(), main(), Compile a Solidity contract and return (abi, bytecode).

### Community 156 - "infrastructure/firebase.js"
Cohesion: 0.50
Nodes (3): app, auth, firebaseConfig

### Community 158 - "CreateNewPassword.jsx"
Cohesion: 0.83
Nodes (3): CreateNewPassword(), validateConfirmPassword(), validatePassword()

### Community 159 - "DepartmentDashboardPage.jsx"
Cohesion: 0.83
Nodes (3): DepartmentDashboardPage(), getStoredAssignments(), mapApiIncidentToRow()

### Community 160 - "ResetPasswordPage.jsx"
Cohesion: 0.83
Nodes (3): ResetPasswordPage(), validateConfirmPassword(), validatePassword()

### Community 163 - "_openNotifications"
Cohesion: 0.67
Nodes (3): _openNotifications, _openNotifications, MaterialPageRoute

## Knowledge Gaps
- **1514 isolated node(s):** `graphify`, `fs`, `path`, `pool`, `MIGRATIONS_DIR` (+1509 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthBloc` connect `AuthBloc` to `main.dart`, `List`, `auth_bloc.dart`, `State`, `login_screen.dart`, `verification_otp_screen.dart`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `ROLES` connect `ROLES` to `controllers/auth.js`, `websocketManager.js`, `controllers/incident.js`, `controllers/department.js`, `seed-incidents-from-audio.js`, `seed-db.js`, `controllers/dispatch.js`, `roles.js`, `controllers/responder.js`, `middleware/auth.js`, `department.integration.test.js`, `rbac.js`, `models/incident.js`, `controllers/admin.js`, `routes/incident.js`, `routes/admin.js`, `routes/auditLog.js`, `routes/department.js`, `routes/dispatch.js`, `routes/metrics.js`, `routes/responder.js`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `_AuthNavigatorState` connect `auth_bloc.dart` to `main.dart`, `State`, `AuthBloc`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `graphify`, `fs`, `path` to the rest of the system?**
  _1514 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.dart` be split into smaller, more focused modules?**
  _Cohesion score 0.024390243902439025 - nodes in this community are weakly interconnected._
- **Should `incident_details_screen.dart` be split into smaller, more focused modules?**
  _Cohesion score 0.03076923076923077 - nodes in this community are weakly interconnected._
- **Should `Path` be split into smaller, more focused modules?**
  _Cohesion score 0.06663141195134849 - nodes in this community are weakly interconnected._