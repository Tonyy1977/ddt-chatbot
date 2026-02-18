// lib/buildium/client.ts - Buildium API HTTP wrapper with rate limiting
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Token bucket rate limiter to stay under Buildium's 10 req/sec limit
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(maxPerSecond: number = 9) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

export class BuildiumClient {
  private http: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    const clientId = process.env.BUILDIUM_CLIENT_ID;
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set');
    }

    const baseURL = process.env.BUILDIUM_ENV === 'sandbox'
      ? 'https://apisandbox.buildium.com/v1'
      : 'https://api.buildium.com/v1';

    this.http = axios.create({
      baseURL,
      headers: {
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

    // Retry on 429 (rate limited)
    this.http.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 250));
          return this.http.request(error.config);
        }
        throw error;
      },
    );

    this.rateLimiter = new RateLimiter(9);
  }

  async get<T = any>(path: string, params?: Record<string, any>): Promise<AxiosResponse<T>> {
    await this.rateLimiter.acquire();
    return this.http.get<T>(path, { params });
  }

  async post<T = any>(path: string, data?: any): Promise<AxiosResponse<T>> {
    await this.rateLimiter.acquire();
    return this.http.post<T>(path, data);
  }

  async put<T = any>(path: string, data?: any): Promise<AxiosResponse<T>> {
    await this.rateLimiter.acquire();
    return this.http.put<T>(path, data);
  }

  async del<T = any>(path: string): Promise<AxiosResponse<T>> {
    await this.rateLimiter.acquire();
    return this.http.delete<T>(path);
  }

  // Paginate through all results for a list endpoint
  async listAll<T = any>(path: string, params?: Record<string, any>): Promise<T[]> {
    const limit = 200;
    let offset = 0;
    const allItems: T[] = [];

    while (true) {
      const res = await this.get<T[]>(path, { ...params, limit, offset, orderby: 'Id asc' });
      const items = res.data || [];
      allItems.push(...items);

      const totalCount = parseInt(res.headers['x-total-count'] || '0', 10);
      offset += limit;
      if (offset >= totalCount || items.length < limit) break;
    }

    return allItems;
  }
}

// Singleton
let _client: BuildiumClient | null = null;

export function getBuildiumClient(): BuildiumClient {
  if (!_client) {
    _client = new BuildiumClient();
  }
  return _client;
}
