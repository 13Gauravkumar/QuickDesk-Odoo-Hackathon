const BASE_URL = 'http://localhost:5000/api';

async function testTicketFeatures() {
  console.log('Testing new ticket features...');
  
  try {
    // Test 1: Create a test ticket
    console.log('\n1. Testing ticket creation...');
    const createResponse = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: 'Test Ticket for Features',
        description: 'This is a test ticket to verify new features',
        category: '000000000000000000000001', // Default category
        priority: 'medium'
      })
    });
    
    console.log('Create ticket response status:', createResponse.status);
    if (createResponse.ok) {
      const ticketData = await createResponse.json();
      console.log('✅ Test ticket created successfully');
      const ticketId = ticketData.ticket._id;
      
      // Test 2: Resolve the ticket
      console.log('\n2. Testing ticket resolution...');
      const resolveResponse = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'resolved',
          resolution: 'This ticket has been resolved successfully for testing purposes.'
        })
      });
      
      console.log('Resolve ticket response status:', resolveResponse.status);
      if (resolveResponse.ok) {
        console.log('✅ Ticket resolved successfully');
        
        // Test 3: Reopen the ticket
        console.log('\n3. Testing ticket reopening...');
        const reopenResponse = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'open'
          })
        });
        
        console.log('Reopen ticket response status:', reopenResponse.status);
        if (reopenResponse.ok) {
          console.log('✅ Ticket reopened successfully');
        } else {
          const errorText = await reopenResponse.text();
          console.log('❌ Failed to reopen ticket:', errorText);
        }
      } else {
        const errorText = await resolveResponse.text();
        console.log('❌ Failed to resolve ticket:', errorText);
      }
      
      // Test 4: Delete the ticket
      console.log('\n4. Testing ticket deletion...');
      const deleteResponse = await fetch(`${BASE_URL}/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log('Delete ticket response status:', deleteResponse.status);
      if (deleteResponse.ok) {
        console.log('✅ Ticket deleted successfully');
      } else {
        const errorText = await deleteResponse.text();
        console.log('❌ Failed to delete ticket:', errorText);
      }
    } else {
      const errorText = await createResponse.text();
      console.log('❌ Failed to create test ticket:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testTicketFeatures(); 