import { createHash, randomBytes } from "node:crypto";
import Session from '../models/Session';
import DatabaseService from './database';

class SessionService {
  private static instance: SessionService;

  private constructor() { }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Generates a cryptographically secure random token.
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hashes a token using SHA-256 for secure storage.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Creates a session for a user.
   * Returns the plaintext token (to be sent to client) but stores the hash.
   */
  async createSession(userId: string): Promise<string> {
    if (!DatabaseService.isConnectedToDatabase()) {
      throw new Error("Cannot create session: Database not connected");
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      await Session.create({ token: tokenHash, userId, expiresAt });
      return token;
    } catch (error) {
      console.error("Failed to create session in DB", error);
      throw new Error("Session creation failed");
    }
  }

  /**
   * Validates a token and returns the userId if valid.
   */
  async getUserIdFromToken(token: string): Promise<string | null> {
    if (!DatabaseService.isConnectedToDatabase()) {
      return null;
    }

    try {
      const tokenHash = this.hashToken(token);
      const session = await Session.findOne({ token: tokenHash });

      if (!session) return null;

      if (session.expiresAt < new Date()) {
        await Session.deleteOne({ _id: session._id }); // Cleanup expired
        return null;
      }

      return session.userId;
    } catch (error) {
      console.error("Failed to fetch session from DB", error);
      return null;
    }
  }

  /**
   * Invalidates a session (logout).
   */
  async invalidateSession(token: string): Promise<void> {
    if (!DatabaseService.isConnectedToDatabase()) {
      return;
    }

    try {
      const tokenHash = this.hashToken(token);
      await Session.deleteOne({ token: tokenHash });
    } catch (error) {
      console.error("Failed to delete session from DB", error);
    }
  }
}

export default SessionService.getInstance();
