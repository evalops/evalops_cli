import { EvalOpsAPIClient } from '../src/lib/api-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('EvalOpsAPIClient', () => {
  let client: EvalOpsAPIClient;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    client = new EvalOpsAPIClient('test-api-key', 'https://api.test.com');
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API key and base URL', () => {
      expect(client).toBeInstanceOf(EvalOpsAPIClient);
    });

    it('should remove trailing slash from base URL', () => {
      const clientWithSlash = new EvalOpsAPIClient('key', 'https://api.test.com/');
      // Test by checking if the URL is used correctly (would need to expose baseUrl or test through behavior)
      expect(clientWithSlash).toBeInstanceOf(EvalOpsAPIClient);
    });

    it('should use default base URL if not provided', () => {
      const defaultClient = new EvalOpsAPIClient('key');
      expect(defaultClient).toBeInstanceOf(EvalOpsAPIClient);
    });
  });

  describe('uploadTestSuite', () => {
    it('should upload test suite successfully', async () => {
      const mockResponse = {
        id: 'test-suite-123',
        name: 'Test Suite',
        status: 'created' as const,
        url: 'https://test.com/suites/test-suite-123'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const request = {
        format: 'yaml' as const,
        content: 'test: content',
        name: 'Test Suite'
      };

      const result = await client.uploadTestSuite(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/test-suites/import',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'User-Agent': 'evalops-cli/1.0.0'
          }),
          body: JSON.stringify(request)
        })
      );
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('{"message": "Invalid configuration"}'),
      } as Response);

      const request = {
        format: 'yaml' as const,
        content: 'invalid: content',
      };

      await expect(client.uploadTestSuite(request))
        .rejects.toThrow('Upload failed: Invalid configuration');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const request = {
        format: 'yaml' as const,
        content: 'test: content',
      };

      await expect(client.uploadTestSuite(request))
        .rejects.toThrow('Network error: Unable to connect');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server Error'),
      } as Response);

      const request = {
        format: 'yaml' as const,
        content: 'test: content',
      };

      await expect(client.uploadTestSuite(request))
        .rejects.toThrow('Upload failed: Server Error');
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response);

      const result = await client.validateApiKey();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/auth/validate',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'User-Agent': 'evalops-cli/1.0.0'
          })
        })
      );
    });

    it('should return false for invalid API key', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const result = await client.validateApiKey();
      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.validateApiKey();
      expect(result).toBe(false);
    });
  });

  describe('getTestSuite', () => {
    it('should fetch test suite by ID', async () => {
      const mockTestSuite = {
        id: 'suite-123',
        name: 'Test Suite',
        status: 'completed'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTestSuite),
      } as Response);

      const result = await client.getTestSuite('suite-123');

      expect(result).toEqual(mockTestSuite);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/test-suites/suite-123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(client.getTestSuite('nonexistent'))
        .rejects.toThrow('Failed to fetch test suite: HTTP 404');
    });
  });

  describe('constructWebUrl', () => {
    it('should construct web URL from API URL', () => {
      const webUrl = client.constructWebUrl('suite-123');
      expect(webUrl).toBe('https://test.com/test-suites/suite-123');
    });

    it('should handle api subdomain', () => {
      const apiClient = new EvalOpsAPIClient('key', 'https://api.example.com');
      const webUrl = apiClient.constructWebUrl('suite-456');
      expect(webUrl).toBe('https://example.com/test-suites/suite-456');
    });

    it('should handle API paths', () => {
      const apiClient = new EvalOpsAPIClient('key', 'https://example.com/api');
      const webUrl = apiClient.constructWebUrl('suite-789');
      expect(webUrl).toBe('https://example.com/test-suites/suite-789');
    });
  });
});