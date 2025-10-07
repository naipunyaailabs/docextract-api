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
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  createSession(userId: string): string {
    const token = this.generateSessionToken();
    this.sessions.set(token, userId);
    return token;
  }

  getUserIdFromToken(token: string): string | null {
    return this.sessions.get(token) || null;
  }

  invalidateSession(token: string): void {
    this.sessions.delete(token);
  }

  // In a production environment, you would persist sessions to the database
  // For now, we're using an in-memory store which will be lost on server restart
}

export default SessionService.getInstance();