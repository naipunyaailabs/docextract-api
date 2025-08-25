import { maskApiKey } from '../utils/config';

describe('config', () => {
  describe('maskApiKey', () => {
    it('should mask API keys properly', () => {
      const apiKey = 'sk-proj-1234567890abcdef';
      const masked = maskApiKey(apiKey);
      expect(masked).toBe('sk-p****');
    });

    it('should return empty string for empty input', () => {
      const masked = maskApiKey('');
      expect(masked).toBe('');
    });

    it('should handle short API keys', () => {
      const apiKey = 'abc';
      const masked = maskApiKey(apiKey);
      expect(masked).toBe('abc****');
    });
  });
});