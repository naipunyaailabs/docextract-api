import User from '../models/User';
import type { IUser } from '../models/User';
import DatabaseService from './database';

class UserService {
  private static instance: UserService;
  private inMemoryUsers: Map<string, any> = new Map();

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async createUser(userData: Partial<IUser>): Promise<IUser | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const user = new User(userData);
        return await user.save();
      } else {
        // Fallback to in-memory storage
        const user = {
          ...userData,
          _id: Math.random().toString(36).substring(2, 15),
        };
        this.inMemoryUsers.set(userData.userId || '', user);
        return user as IUser;
      }
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        return await User.findOne({ email }).exec();
      } else {
        // Fallback to in-memory storage
        for (const user of this.inMemoryUsers.values()) {
          if (user.email === email) {
            return user as IUser;
          }
        }
        return null;
      }
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  async findUserById(userId: string): Promise<IUser | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        return await User.findOne({ userId }).exec();
      } else {
        // Fallback to in-memory storage
        return this.inMemoryUsers.get(userId) || null;
      }
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  async findUserBySessionToken(token: string): Promise<IUser | null> {
    // In a real implementation, we would have a separate Session model
    // For now, we'll use the userId as the token
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        return await User.findOne({ userId: token }).exec();
      } else {
        // Fallback to in-memory storage
        return this.inMemoryUsers.get(token) || null;
      }
    } catch (error) {
      console.error('Error finding user by session token:', error);
      return null;
    }
  }

  async findUserByVerificationToken(token: string): Promise<IUser | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        return await User.findOne({ 
          emailVerificationToken: token,
          emailVerificationTokenExpiry: { $gt: new Date() }
        }).exec();
      } else {
        // Fallback to in-memory storage
        for (const user of this.inMemoryUsers.values()) {
          if (user.emailVerificationToken === token && 
              user.emailVerificationTokenExpiry && 
              user.emailVerificationTokenExpiry > new Date()) {
            return user as IUser;
          }
        }
        return null;
      }
    } catch (error) {
      console.error('Error finding user by verification token:', error);
      return null;
    }
  }

  async updateUserLastLogin(userId: string): Promise<boolean> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const result = await User.updateOne(
          { userId },
          { lastLoginAt: new Date() }
        ).exec();
        return result.modifiedCount > 0;
      } else {
        // Fallback to in-memory storage
        const user = this.inMemoryUsers.get(userId);
        if (user) {
          user.lastLoginAt = new Date();
          this.inMemoryUsers.set(userId, user);
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Error updating user last login:', error);
      return false;
    }
  }

  async updateUser(userId: string, updates: Partial<IUser>): Promise<IUser | null> {
    try {
      // If database is connected, use it
      if (DatabaseService.isConnectedToDatabase()) {
        const user = await User.findOneAndUpdate(
          { userId },
          updates,
          { new: true }
        ).exec();
        return user;
      } else {
        // Fallback to in-memory storage
        const user = this.inMemoryUsers.get(userId);
        if (user) {
          const updatedUser = { ...user, ...updates };
          this.inMemoryUsers.set(userId, updatedUser);
          return updatedUser as IUser;
        }
        return null;
      }
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }
}

export default UserService.getInstance();