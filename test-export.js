const BASE_URL = 'http://localhost:5000/api';

async function testExportFunctionality() {
  console.log('Testing export functionality...');
  
  try {
    // Test tickets export
    console.log('\n1. Testing tickets export...');
    const ticketsResponse = await fetch(`${BASE_URL}/tickets/export?format=csv`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Tickets export response status:', ticketsResponse.status);
    if (ticketsResponse.ok) {
      console.log('✅ Tickets export working correctly');
    } else {
      const errorText = await ticketsResponse.text();
      console.log('❌ Tickets export failed:', errorText);
    }
    
    // Test analytics export
    console.log('\n2. Testing analytics export...');
    const analyticsResponse = await fetch(`${BASE_URL}/analytics/export?format=csv`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Analytics export response status:', analyticsResponse.status);
    if (analyticsResponse.ok) {
      console.log('✅ Analytics export working correctly');
    } else {
      const errorText = await analyticsResponse.text();
      console.log('❌ Analytics export failed:', errorText);
    }
    
    // Test users export
    console.log('\n3. Testing users export...');
    const usersResponse = await fetch(`${BASE_URL}/users/export?format=csv`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Users export response status:', usersResponse.status);
    if (usersResponse.ok) {
      console.log('✅ Users export working correctly');
    } else {
      const errorText = await usersResponse.text();
      console.log('❌ Users export failed:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testExportFunctionality(); 