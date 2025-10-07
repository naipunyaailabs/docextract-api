const API_KEY = '9bRgWiCIzXStqWs7azssmqEQ'; // Correct API key from server logs

async function testStandardRfp() {
  try {
    const response = await fetch('http://localhost:5002/create-rfp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        title: 'Website Development',
        organization: 'Zoho Corp',
        deadline: '2025-09-26'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error);
      return;
    }

    // Save the response as a Word document
    const buffer = await response.arrayBuffer();
    await Bun.write('test_standard_rfp_updated.docx', buffer);
    console.log('Standard RFP document created successfully!');
  } catch (error) {
    console.error('Error creating standard RFP:', error);
  }
}

testStandardRfp();