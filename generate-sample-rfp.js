import { writeFileSync } from 'fs';

const generateSampleRfp = async () => {
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
      const htmlContent = await response.text();
      console.log('RFP created successfully!');
      
      // Save to file
      writeFileSync('sample-rfp.html', htmlContent);
      console.log('RFP saved to sample-rfp.html');
      
      // Also save a custom RFP
      const customResponse = await fetch('http://localhost:5001/create-rfp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 9bRgWiCIzXStqWs7azssmqEQ'
        },
        body: JSON.stringify({
          title: 'Mobile App Development RFP',
          organization: 'StartUp Innovations',
          deadline: '2025-11-15',
          sections: [
            {
              title: "Project Overview",
              content: "We are seeking a qualified vendor to develop a mobile application for our food delivery service."
            },
            {
              title: "Technical Requirements",
              content: "The app must be available on both iOS and Android platforms, support real-time tracking, and integrate with our payment gateway."
            },
            {
              title: "Budget Information",
              content: "Our budget for this project is $75,000. Please provide detailed pricing for all components and services."
            }
          ]
        })
      });
      
      if (customResponse.ok) {
        const customHtmlContent = await customResponse.text();
        writeFileSync('custom-rfp.html', customHtmlContent);
        console.log('Custom RFP saved to custom-rfp.html');
      } else {
        const error = await customResponse.json();
        console.error('Error creating custom RFP:', error);
      }
    } else {
      const error = await response.json();
      console.error('Error:', error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

generateSampleRfp();