import Service from '../models/Service';
import type { IService } from '../models/Service';
import DatabaseService from './database';

class ServiceService {
  private static instance: ServiceService;
  private inMemoryServices: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): ServiceService {
    if (!ServiceService.instance) {
      ServiceService.instance = new ServiceService();
    }
    return ServiceService.instance;
  }

  async createService(serviceData: Partial<IService>): Promise<IService | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const service = new Service(serviceData);
        return await service.save();
      } else {
        // Fallback to in-memory storage
        const service = {
          ...serviceData,
          _id: Math.random().toString(36).substring(2, 15),
        };
        this.inMemoryServices.set(serviceData.id || serviceData.slug || '', service);
        return service as IService;
      }
    } catch (error) {
      console.error('Error creating service:', error);
      return null;
    }
  }

  async findAllServices(): Promise<IService[] | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const services = await Service.find({ isActive: true }).exec();
        console.log(`[ServiceService] Found ${services.length} services in database`);
        return services;
      } else {
        // Fallback to in-memory storage
        const services = Array.from(this.inMemoryServices.values()) as IService[];
        console.log(`[ServiceService] Found ${services.length} services in memory`);
        return services;
      }
    } catch (error) {
      console.error('[ServiceService] Error finding services:', error);
      return null;
    }
  }

  async findServiceById(id: string): Promise<IService | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        return await Service.findOne({ id, isActive: true }).exec();
      } else {
        // Fallback to in-memory storage
        return this.inMemoryServices.get(id) || null;
      }
    } catch (error) {
      console.error('Error finding service by ID:', error);
      return null;
    }
  }

  async findServiceBySlug(slug: string): Promise<IService | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        return await Service.findOne({ slug, isActive: true }).exec();
      } else {
        // Fallback to in-memory storage
        for (const service of this.inMemoryServices.values()) {
          if (service.slug === slug) {
            return service as IService;
          }
        }
        return null;
      }
    } catch (error) {
      console.error('Error finding service by slug:', error);
      return null;
    }
  }

  async updateService(id: string, updates: Partial<IService>): Promise<IService | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const service = await Service.findOneAndUpdate(
          { id },
          { ...updates, updatedAt: new Date() },
          { new: true }
        ).exec();
        return service;
      } else {
        // Fallback to in-memory storage
        const service = this.inMemoryServices.get(id);
        if (service) {
          const updatedService = { ...service, ...updates, updatedAt: new Date() };
          this.inMemoryServices.set(id, updatedService);
          return updatedService as IService;
        }
        return null;
      }
    } catch (error) {
      console.error('Error updating service:', error);
      return null;
    }
  }

  async deleteService(id: string): Promise<boolean> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const result = await Service.findOneAndUpdate(
          { id },
          { isActive: false, updatedAt: new Date() },
          { new: true }
        ).exec();
        return result !== null;
      } else {
        // Fallback to in-memory storage
        const service = this.inMemoryServices.get(id);
        if (service) {
          service.isActive = false;
          service.updatedAt = new Date();
          this.inMemoryServices.set(id, service);
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      return false;
    }
  }
}

export default ServiceService.getInstance();