const testPdfRfpCreation = async () => {
  try {
    const response = await fetch('http://localhost:5001/create-rfp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 9bRgWiCIzXStqWs7azssmqEQ'
      },
      body: JSON.stringify({
        title: 'Website Development RFP',
        organization: 'Tech Corp',
        deadline: '2025-12-31'
      })
    });

    if (response.ok) {
      console.log('RFP PDF created successfully!');
      console.log('Content-Type:', response.headers.get('Content-Type'));
      
      // Get the PDF as blob
      const blob = await response.blob();
      console.log('PDF size:', blob.size, 'bytes');
      
      // For testing purposes, we'll just log that it worked
      console.log('PDF generation test passed!');
    } else {
      const error = await response.json();
      console.error('Error:', error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

testPdfRfpCreation();