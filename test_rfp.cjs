const fs = require('fs');

async function testRfpSummarizer() {
  try {
    // Read the file
    const fileBuffer = fs.readFileSync('test_rfp.txt');
    
    // Create a FormData object
    const FormData = require('form-data');
    const form = new FormData();
    form.append('document', fileBuffer, {
      filename: 'test_rfp.txt',
      contentType: 'text/plain'
    });

    const response = await fetch('http://localhost:5001/summarize-rfp', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': 'Bearer 9bRgWiCIzXStqWs7azssmqEQ'
      }
    });

    console.log('Status:', response.status);
    const result = await response.json();
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testRfpSummarizer();