import mongoose from 'mongoose';
import Service from './models/Service';
import User from './models/User';

async function debugDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/docapture';
    console.log('Connecting to MongoDB with URI:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('Connected to MongoDB successfully');
    console.log('Database name:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    console.log('Port:', mongoose.connection.port);
    
    // List all databases
    console.log('\n--- Checking databases ---');
    const admin = mongoose.connection.getClient().db('admin');
    try {
      const dbs = await admin.admin().listDatabases();
      console.log('Available databases:');
      dbs.databases.forEach((db: any) => {
        console.log(`- ${db.name} (${db.sizeOnDisk} bytes)`);
      });
    } catch (err) {
      console.log('Could not list databases:', err);
    }
    
    // Check collections in current database
    console.log('\n--- Checking collections in current database ---');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach((collection: any) => {
      console.log(`- ${collection.name}`);
    });
    
    // Check services collection specifically
    console.log('\n--- Checking services collection ---');
    try {
      const serviceCount = await Service.countDocuments();
      console.log(`Services collection has ${serviceCount} documents`);
      
      if (serviceCount > 0) {
        const services = await Service.find().limit(3);
        console.log('Sample services:');
        services.forEach((service: any) => {
          console.log(`- ${service.name} (${service.id})`);
        });
      } else {
        console.log('No services found in collection');
      }
    } catch (err) {
      console.log('Error checking services collection:', err);
    }
    
    // Check users collection
    console.log('\n--- Checking users collection ---');
    try {
      const userCount = await User.countDocuments();
      console.log(`Users collection has ${userCount} documents`);
      
      if (userCount > 0) {
        const users = await User.find().limit(3);
        console.log('Sample users:');
        users.forEach((user: any) => {
          console.log(`- ${user.name} (${user.email})`);
        });
      } else {
        console.log('No users found in collection');
      }
    } catch (err) {
      console.log('Error checking users collection:', err);
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

debugDatabase();