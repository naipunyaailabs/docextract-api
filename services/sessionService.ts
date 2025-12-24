import { randomBytes } from "node:crypto";
import Session from '../models/Session';
import DatabaseService from './database';

class SessionService {
  private static instance: SessionService;
  private sessions: Map<string, string> = new Map(); // token -> userId

  private constructor() {}

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createSession(userId: string): Promise<string> {
    const token = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (DatabaseService.isConnectedToDatabase()) {
      try {
        await Session.create({ token, userId, expiresAt });
      } catch (error) {
        console.error("Failed to create session in DB, falling back to memory", error);
        this.sessions.set(token, userId);
      }
    } else {
      this.sessions.set(token, userId);
    }
    return token;
  }

  async getUserIdFromToken(token: string): Promise<string | null> {
    if (DatabaseService.isConnectedToDatabase()) {
      try {
        const session = await Session.findOne({ token });
        if (session) return session.userId;
      } catch (error) {
        console.error("Failed to fetch session from DB", error);
      }
    }
    // Check memory as fallback (e.g. created before DB connected or during DB outage fallback)
    return this.sessions.get(token) || null;
  }

  async invalidateSession(token: string): Promise<void> {
    if (DatabaseService.isConnectedToDatabase()) {
      try {
        await Session.deleteOne({ token });
      } catch (error) {
        console.error("Failed to delete session from DB", error);
      }
    }
    this.sessions.delete(token);
  }
}

export default SessionService.getInstance();
