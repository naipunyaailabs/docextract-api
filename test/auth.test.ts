import { validateApiKey, authenticateRequest } from '../utils/auth';

describe('auth', () => {
  describe('validateApiKey', () => {
    it('should return true when no API key is configured (development mode)', () => {
      // Save the original API_KEY
      const originalApiKey = process.env.API_KEY;
      delete process.env.API_KEY;
      
      const result = validateApiKey({
        headers: {
          get: jest.fn().mockReturnValue('Bearer test-key')
        }
      } as any);
      
      // Restore the original API_KEY
      if (originalApiKey) {
        process.env.API_KEY = originalApiKey;
      }
      
      expect(result).toBe(true);
    });

    it('should return true when API key matches', () => {
      // Save the original API_KEY
      const originalApiKey = process.env.API_KEY;
      process.env.API_KEY = 'test-key';
      
      const result = validateApiKey({
        headers: {
          get: jest.fn().mockReturnValue('Bearer test-key')
        }
      } as any);
      
      // Restore the original API_KEY
      if (originalApiKey) {
        process.env.API_KEY = originalApiKey;
      } else {
        delete process.env.API_KEY;
      }
      
      expect(result).toBe(true);
    });

    it('should return false when API key does not match', () => {
      // Save the original API_KEY
      const originalApiKey = process.env.API_KEY;
      process.env.API_KEY = 'correct-key';
      
      const result = validateApiKey({
        headers: {
          get: jest.fn().mockReturnValue('Bearer wrong-key')
        }
      } as any);
      
      // Restore the original API_KEY
      if (originalApiKey) {
        process.env.API_KEY = originalApiKey;
      } else {
        delete process.env.API_KEY;
      }
      
      expect(result).toBe(false);
    });

    it('should return false when no Authorization header is present', () => {
      const result = validateApiKey({
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      } as any);
      
      expect(result).toBe(false);
    });
  });

  describe('authenticateRequest', () => {
    it('should return null when authentication is successful', () => {
      // Save the original API_KEY
      const originalApiKey = process.env.API_KEY;
      process.env.API_KEY = 'test-key';
      
      const result = authenticateRequest({
        headers: {
          get: jest.fn().mockReturnValue('Bearer test-key')
        }
      } as any);
      
      // Restore the original API_KEY
      if (originalApiKey) {
        process.env.API_KEY = originalApiKey;
      } else {
        delete process.env.API_KEY;
      }
      
      expect(result).toBeNull();
    });

    it('should return Response object when authentication fails', () => {
      const result = authenticateRequest({
        headers: {
          get: jest.fn().mockReturnValue('Bearer wrong-key')
        }
      } as any);
      
      expect(result).toBeInstanceOf(Response);
      expect(result?.status).toBe(401);
    });
  });
});