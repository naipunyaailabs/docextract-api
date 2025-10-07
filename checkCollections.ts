import mongoose from 'mongoose';
import Service from './models/Service';

async function checkCollections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docapture';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Get all collection names
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Available collections:');
      collections.forEach(collection => {
        console.log(`- ${collection.name}`);
      });
    } else {
      console.log('Database connection not available');
    }
    
    // Check if services collection exists and has data
    const serviceCount = await Service.countDocuments();
    console.log(`\nServices collection has ${serviceCount} documents`);
    
    if (serviceCount > 0) {
      const services = await Service.find().limit(5);
      console.log('\nSample services:');
      services.forEach(service => {
        console.log(`- ${service.name} (${service.id})`);
      });
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error checking collections:', error);
    process.exit(1);
  }
}

checkCollections();