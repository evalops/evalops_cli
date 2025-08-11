import type { APIUploadRequest, APIUploadResponse } from '../types';

export class EvalOpsAPIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.evalops.dev') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async uploadTestSuite(request: APIUploadRequest): Promise<APIUploadResponse> {
    const url = `${this.baseUrl}/api/v1/test-suites/import`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'evalops-cli/1.0.0',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Use the raw error text if it's not JSON
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(`Upload failed: ${errorMessage}`);
      }

      const result = await response.json();
      return result as APIUploadResponse;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error(
            `Network error: Unable to connect to ${url}. Please check your internet connection and API URL.`,
          );
        }
        throw error;
      }
      throw new Error(`Upload failed: ${error}`);
    }
  }

  async validateApiKey(): Promise<boolean> {
    const url = `${this.baseUrl}/api/v1/auth/validate`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'evalops-cli/1.0.0',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getTestSuite(id: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/test-suites/${id}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'evalops-cli/1.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch test suite: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch test suite: ${error}`);
    }
  }

  constructWebUrl(testSuiteId: string): string {
    // Convert API URL to web URL
    const webUrl = this.baseUrl.replace('api.', '').replace('/api', '');
    return `${webUrl}/test-suites/${testSuiteId}`;
  }
}
