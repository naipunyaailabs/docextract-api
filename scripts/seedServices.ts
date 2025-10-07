import mongoose from 'mongoose';
import Service from '../models/Service';
import { mockServices } from '../../docapture-ui/lib/mock-data';

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docapture';
mongoose.connect(mongoUri);

async function seedServices() {
  try {
    // Clear existing services
    await Service.deleteMany({});
    
    // Insert mock services
    for (const service of mockServices) {
      const serviceData = {
        id: service.id,
        slug: service.id,
        name: service.name,
        description: service.description,
        longDescription: service.longDescription,
        endpoint: service.endpoint,
        supportedFormats: service.supportedFormats,
        supportedFileTypes: service.supportedFileTypes,
        icon: service.icon,
        category: service.category,
        fileFieldName: service.fileFieldName,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await Service.create(serviceData);
      console.log(`Created service: ${service.name}`);
    }
    
    console.log('Services seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding services:', error);
    process.exit(1);
  }
}

seedServices();