import mongoose from 'mongoose';
import Service from './models/Service';

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docapture';
mongoose.connect(mongoUri);

async function testServices() {
  try {
    console.log('Testing services retrieval...');
    
    // Get all services
    const services = await Service.find({ isActive: true }).exec();
    console.log(`Found ${services.length} services:`);
    
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} (${service.id}) - ${service.endpoint}`);
    });
    
    // Test the response format
    console.log('\n--- Testing response format ---');
    const responseText = JSON.stringify(services);
    console.log(`Response length: ${responseText.length} characters`);
    
    // Try to parse it back
    const parsed = JSON.parse(responseText);
    console.log(`Parsed back: ${parsed.length} items`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing services:', error);
    process.exit(1);
  }
}

testServices();