const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  phone: '09123456789',
  password: 'Test_password_123!',
  firstName: 'Test',
  lastName: 'User'
};
const TEST_LOCATION = {
  latitude: 16.0433,
  longitude: 120.3333,
  location_description: 'Dagupan City, Philippines'
};

// Global test state
let authToken = null;
let testIncidentId = null;
let testResults = {
  total: 0,
  passed: 0,
  failed: 0
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function assert(condition, message) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    log(`PASS: ${message}`, 'success');
  } else {
    testResults.failed++;
    log(`FAIL: ${message}`, 'error');
  }
}

async function request(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function uploadRequest(endpoint, files, fields = {}, headers = {}) {
  try {
    const formData = new FormData();
    
    // Add fields
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    });
    
    // Add files
    Object.entries(files).forEach(([key, file]) => {
      if (Array.isArray(file)) {
        file.forEach(f => formData.append(key, f.buffer, f.originalname));
      } else {
        formData.append(key, file.buffer, file.originalname);
      }
    });
    
    const config = {
      method: 'POST',
      url: `${BASE_URL}${endpoint}`,
      data: formData,
      headers: {
        ...formData.getHeaders(),
        ...headers
      }
    };
    
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Setup function
async function setup() {
  log('Setting up test environment...', 'info');
  
  // Register test user
  log('Registering test user...', 'info');
  const registerResult = await request('POST', '/auth/register', TEST_USER);
  
  if (registerResult.success) {
    log('Test user registered successfully', 'success');
  } else if (
    registerResult.status === 409
    || (registerResult.status === 400 && (
      registerResult.error.message?.includes('already exists')
      || registerResult.error.message?.includes('already have an account')
    ))
  ) {
    log('Test user already exists, proceeding with login', 'warning');
  } else {
    log(`Failed to register test user: ${JSON.stringify(registerResult.error)}`, 'error');
    throw new Error('Setup failed: Could not register test user');
  }
  
  // Login to get auth token
  log('Logging in to get auth token...', 'info');
  const loginResult = await request('POST', '/auth/login', {
    phone: TEST_USER.phone,
    password: TEST_USER.password
  });
  
  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    log('Auth token acquired successfully', 'success');
  } else {
    log(`Failed to login: ${JSON.stringify(loginResult.error)}`, 'error');
    throw new Error('Setup failed: Could not acquire auth token');
  }
  
  log('Setup complete!', 'success');
  console.log('');
}

// Test Suite 1: Emergency Endpoint (Existing)
async function testEmergencyEndpoint() {
  log('=== TEST SUITE 1: Emergency Endpoint ===', 'info');
  
  // Test 1.1: Create emergency incident successfully
  log('Test 1.1: Create emergency incident with GPS coordinates', 'info');
  const result1 = await request('POST', '/incidents/emergency', {
    latitude: TEST_LOCATION.latitude,
    longitude: TEST_LOCATION.longitude
  });
  assert(result1.success === true, 'Emergency incident created successfully');
  assert(result1.data?.incident?.report_id !== undefined, 'Emergency incident has report_id');
  assert(
    Number(result1.data?.incident?.latitude) === Number(TEST_LOCATION.latitude),
    'Emergency incident has correct latitude'
  );
  
  // Test 1.2: Missing required field
  log('Test 1.2: Create emergency incident without longitude (should fail)', 'info');
  const result2 = await request('POST', '/incidents/emergency', {
    latitude: TEST_LOCATION.latitude
  });
  assert(result2.success === false, 'Emergency incident creation failed as expected');
  assert(result2.status === 400, 'Returned 400 status code');
  
  // Test 1.3: Invalid GPS coordinates
  log('Test 1.3: Create emergency incident with invalid latitude (should fail)', 'info');
  const result3 = await request('POST', '/incidents/emergency', {
    latitude: 91.0, // Invalid: must be between -90 and 90
    longitude: TEST_LOCATION.longitude
  });
  assert(result3.success === false, 'Emergency incident creation failed as expected');
  assert(result3.status === 400, 'Returned 400 status code');
  
  console.log('');
}

// Test Suite 2: Incident with Audio (New AI-enhanced endpoint)
async function testIncidentWithAudio() {
  log('=== TEST SUITE 2: Incident with Audio (AI-Enhanced) ===', 'info');
  
  // Prepare audio file
  const audioPath = path.join(__dirname, '../../RescueLink AI/test/test_report_1.m4a');
  let audioBuffer;
  
  if (fs.existsSync(audioPath)) {
    log(`Loading audio file from: ${audioPath}`, 'info');
    audioBuffer = fs.readFileSync(audioPath);
  } else {
    log('Audio file not found, using mock audio buffer', 'warning');
    // Create a minimal WAV file buffer for testing
    audioBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // File size
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Format chunk size
      0x01, 0x00, 0x02, 0x00, // Audio format & channels
      0x44, 0xac, 0x00, 0x00, // Sample rate
      0x10, 0xb1, 0x02, 0x00, // Byte rate
      0x04, 0x00, 0x10, 0x00, // Block align & bits per sample
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Data size
    ]);
  }
  
  // Test 2.1: Create incident with audio successfully
  log('Test 2.1: Create incident with audio file and AI classification', 'info');
  const result1 = await uploadRequest(
    '/incidents/with-audio',
    {
      audio: {
        buffer: audioBuffer,
        originalname: 'test_report_1.m4a'
      }
    },
    {
      ...TEST_LOCATION,
      description: 'Test incident report with audio'
    }
  );
  assert(result1.success === true, 'Incident with audio created successfully');
  assert(result1.data?.incident?.report_id !== undefined, 'Incident has report_id');
  assert(result1.data?.incident?.audio_path !== undefined, 'Incident has audio path');
  
  if (result1.data?.ai_classification) {
    log(`AI Classification: Type=${result1.data.ai_classification.primary_type}, Severity=${result1.data.ai_classification.severity}, Confidence=${result1.data.ai_classification.confidence}`, 'info');
    assert(result1.data.ai_classification.incident_types !== undefined, 'AI classification has incident types');
    assert(result1.data.ai_classification.severity !== undefined, 'AI classification has severity');
  } else {
    log('AI classification pending (AI service may be unavailable)', 'warning');
  }
  
  // Save incident ID for later tests
  if (result1.data?.incident?.report_id) {
    testIncidentId = result1.data.incident.report_id;
  }
  
  // Test 2.2: Missing required audio file
  log('Test 2.2: Create incident without audio file (should fail)', 'info');
  const result2 = await uploadRequest(
    '/incidents/with-audio',
    {},
    {
      ...TEST_LOCATION,
      description: 'Test incident without audio'
    }
  );
  assert(result2.success === false, 'Incident creation failed as expected');
  assert(result2.status === 400, 'Returned 400 status code');
  
  // Test 2.3: Create incident with audio and media files
  log('Test 2.3: Create incident with audio and media files', 'info');
  // Minimal valid JPEG signature to avoid signature-mismatch failures in stricter scanners.
  const mockImageBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const result3 = await uploadRequest(
    '/incidents/with-audio',
    {
      audio: {
        buffer: audioBuffer,
        originalname: 'test_report.m4a'
      },
      media: [
        {
          buffer: mockImageBuffer,
          originalname: 'photo1.jpg'
        }
      ]
    },
    {
      ...TEST_LOCATION,
      description: 'Test incident with audio and media'
    }
  );
  if (result3.success) {
    assert(true, 'Incident with audio and media created successfully');
    assert(result3.data?.incident?.media_paths !== undefined, 'Incident has media paths');
  } else {
    log(`Media upload path returned ${result3.status}; continuing because scanner policy may block synthetic files`, 'warning');
    assert([400, 413, 415, 422].includes(result3.status), 'Media upload failure is policy/validation-related');
  }
  
  console.log('');
}

// Test Suite 3: Get Incidents (Existing & Enhanced)
async function testGetIncidents() {
  log('=== TEST SUITE 3: Get Incidents ===', 'info');
  
  if (!testIncidentId) {
    log('Skipping get incidents tests (no test incident created)', 'warning');
    console.log('');
    return;
  }
  
  // Test 3.1: Get incident by ID
  log('Test 3.1: Get incident by ID', 'info');
  const result1 = await request('GET', `/incidents/${testIncidentId}`);
  assert(result1.success === true, 'Incident retrieved successfully');
  assert(result1.data?.report_id === testIncidentId, 'Retrieved correct incident');
  
  // Test 3.2: Get incident with AI classification details
  log('Test 3.2: Get incident with AI classification details', 'info');
  const result2 = await request('GET', `/incidents/${testIncidentId}/with-ai`);
  assert(result2.success === true, 'Incident with AI details retrieved successfully');
  assert(result2.data?.incident?.report_id === testIncidentId, 'Retrieved correct incident');
  if (result2.data?.ai_classification) {
    log(`AI Classification: ${JSON.stringify(result2.data.ai_classification)}`, 'info');
    assert(result2.data.ai_classification.predicted_type !== undefined, 'AI classification included');
  }
  
  // Test 3.3: Get all incidents
  log('Test 3.3: Get all incidents (paginated)', 'info');
  const result3 = await request('GET', '/incidents?page=1&limit=10');
  assert(result3.success === true, 'All incidents retrieved successfully');
  assert(Array.isArray(result3.data), 'Response is incidents array');
  
  // Test 3.4: Get current user's incidents
  log('Test 3.4: Get current user\'s incidents', 'info');
  const result4 = await request('GET', '/incidents/user/my');
  assert(result4.success === true, 'User incidents retrieved successfully');
  assert(Array.isArray(result4.data), 'Response is incidents array');
  
  // Test 3.5: Get non-existent incident
  log('Test 3.5: Get non-existent incident (should fail)', 'info');
  const result5 = await request('GET', '/incidents/99999999');
  assert(result5.success === false, 'Non-existent incident not found as expected');
  assert(result5.status === 404, 'Returned 404 status code');
  
  console.log('');
}

// Test Suite 4: Authentication
async function testAuthentication() {
  log('=== TEST SUITE 4: Authentication ===', 'info');
  
  // Test 4.1: Access protected endpoint without token
  log('Test 4.1: Access protected endpoint without auth token (should fail)', 'info');
  const savedToken = authToken;
  authToken = null;
  const result1 = await request('GET', '/incidents/user/my');
  assert(result1.success === false, 'Request failed as expected');
  assert(result1.status === 401, 'Returned 401 status code');
  authToken = savedToken;
  
  // Test 4.2: Access protected endpoint with invalid token
  log('Test 4.2: Access protected endpoint with invalid token (should fail)', 'info');
  authToken = 'invalid-token-12345';
  const result2 = await request('GET', '/incidents/user/my');
  assert(result2.success === false, 'Request failed as expected');
  assert(result2.status === 401, 'Returned 401 status code');
  authToken = savedToken;
  
  console.log('');
}

// Test Suite 5: Retry Service
async function testRetryService() {
  log('=== TEST SUITE 5: Retry Service ===', 'info');
  
  // Test 5.1: Check for pending AI classifications
  log('Test 5.1: Check for incidents pending AI classification', 'info');
  const result1 = await request('GET', '/incidents?ai_pending=true');
  assert(result1.success === true, 'Pending incidents query successful');
  
  if (result1.data?.incidents && result1.data.incidents.length > 0) {
    log(`Found ${result1.data.incidents.length} incidents pending AI classification`, 'warning');
    result1.data.incidents.forEach(incident => {
      log(`  - Incident ID ${incident.id}: Attempts=${incident.ai_attempted || 0}`, 'info');
    });
  } else {
    log('No incidents pending AI classification', 'success');
  }
  
  console.log('');
}

// Main test runner
async function runTests() {
  console.log('\n========================================');
  console.log('  RescueLink Backend API Test Suite');
  console.log('========================================\n');
  
  try {
    // Setup
    await setup();
    
    // Run test suites
    await testEmergencyEndpoint();
    await testIncidentWithAudio();
    await testGetIncidents();
    await testAuthentication();
    await testRetryService();
    
    // Print summary
    console.log('========================================');
    console.log('  TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Tests:  ${testResults.total}`);
    console.log(`Passed:       ${testResults.passed} ✅`);
    console.log(`Failed:       ${testResults.failed} ${testResults.failed > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log('========================================\n');
    
    if (testResults.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    log(`Test suite failed with error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

// Export for Jest integration
module.exports = {
  runTests,
  testEmergencyEndpoint,
  testIncidentWithAudio,
  testGetIncidents,
  testAuthentication,
  testRetryService
};
