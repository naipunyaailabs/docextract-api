const testCustomRfpCreation = async () => {
  try {
    const response = await fetch('http://localhost:5001/create-rfp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 9bRgWiCIzXStqWs7azssmqEQ'
      },
      body: JSON.stringify({
        title: 'Custom Software Development RFP',
        organization: 'InnovateTech Solutions',
        deadline: '2025-11-30',
        sections: [
          {
            title: "Project Overview",
            content: "We are seeking a qualified vendor to develop a custom inventory management system for our retail operations."
          },
          {
            title: "Technical Requirements",
            content: "The system must be web-based, support real-time inventory tracking, and integrate with our existing POS system."
          },
          {
            title: "Budget Information",
            content: "Our budget for this project is $150,000. Please provide detailed pricing for all components and services."
          }
        ]
      })
    });

    if (response.ok) {
      const htmlContent = await response.text();
      console.log('Custom RFP created successfully!');
      console.log('Content-Type:', response.headers.get('Content-Type'));
      console.log('RFP content received (first 500 characters):');
      console.log(htmlContent.substring(0, 500) + '...');
    } else {
      const error = await response.json();
      console.error('Error:', error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

testCustomRfpCreation();