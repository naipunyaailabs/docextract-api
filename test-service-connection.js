// Simple test to verify frontend can connect to backend services
fetch('http://localhost:5000/services', {
  headers: {
    'Authorization': 'Bearer 9bRgWiCIzXStqWs7azssmqEQ'
  }
})
.then(response => response.json())
.then(data => {
  console.log('Services fetched successfully:');
  console.log(`Found ${data.length} services`);
  data.forEach(service => {
    console.log(`- ${service.name} (${service.id})`);
  });
})
.catch(error => {
  console.error('Error fetching services:', error);
});