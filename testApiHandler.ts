import mongoose from 'mongoose';
import Service from './models/Service';
import { createSuccessResponse } from "./utils/errorHandler";

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docapture';
mongoose.connect(mongoUri);

async function testApiHandler() {
  try {
    console.log('Testing API handler simulation...');
    
    // Simulate the listServicesHandler logic
    const services = await Service.find({ isActive: true }).exec();
    console.log(`Found ${services.length} services in database`);
    
    // Simulate createSuccessResponse
    const response = createSuccessResponse(services);
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    // Get the response body
    const responseBody = await response.text();
    console.log(`Response body length: ${responseBody.length} characters`);
    
    // Try to parse it
    const parsed = JSON.parse(responseBody);
    console.log(`Parsed response has ${parsed.length} items`);
    
    // Show first few services
    console.log('\nFirst 3 services:');
    parsed.slice(0, 3).forEach((service: any, index: number) => {
      console.log(`${index + 1}. ${service.name} (${service.id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing API handler:', error);
    process.exit(1);
  }
}

testApiHandler();