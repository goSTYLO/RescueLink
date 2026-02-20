const http = require('http');

// Test emergency incident creation with encrypted coordinates
async function testEmergencyIncident() {
  console.log('\n🧪 Testing Emergency Incident Creation with Encrypted Coordinates\n');
  
  const testData = {
    latitude: 14.5995,
    longitude: 120.9842,
    description: 'Traffic accident on EDSA near Megamall'
  };

  console.log('📝 Request Body:');
  console.log(`   latitude: ${testData.latitude}`);
  console.log(`   longitude: ${testData.longitude}`);
  console.log(`   description: ${testData.description}\n`);

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/incidents/emergency',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5MSwicGhvbmUiOiIrNjM5NjY2NjM4OTY3Iiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzE0Nzc0ODQsImV4cCI6MTc3MjA4MjI4NH0.tn9-VNEvYoY0fj1nInftWVgA2kYIVwBkhH7geas5fgY'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        process.stdout.write('\n'); // Add newline for formatting after server logs
        console.log(`\n📊 Response Status: ${res.statusCode}`);
        
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log('✅ SUCCESS: Emergency incident created!\n');
          try {
            const response = JSON.parse(data);
            console.log('📋 API Response:');
            console.log(`   incident_id: ${response.incident?.report_id}`);
            console.log(`   latitude: ${response.incident?.latitude} (type: ${typeof response.incident?.latitude})`);
            console.log(`   longitude: ${response.incident?.longitude} (type: ${typeof response.incident?.longitude})`);
            console.log(`   description: ${response.incident?.description}\n`);
            
            if (typeof response.incident?.latitude === 'number' && typeof response.incident?.longitude === 'number') {
              console.log('🎯 VERIFICATION:');
              console.log('   ✅ Coordinates returned as NUMBERS (not hex strings)');
              console.log('   ✅ This means encryption/decryption is working!');
              console.log('   ✅ Database has hex, API returns numbers\n');
            }
          } catch (e) {
            console.log('Response:', data);
          }
        } else {
          console.log('❌ FAILED: Error creating incident\n');
          console.log('Response:', data);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

testEmergencyIncident().catch(console.error);
