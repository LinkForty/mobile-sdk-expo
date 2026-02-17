import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkManager } from '../../src/network/network-manager';
import { LinkFortyError, LinkFortyErrorCode } from '../../src/errors/linkforty-error';

describe('NetworkManager', () => {
  const originalFetch = globalThis.fetch;
  let network: NetworkManager;

  beforeEach(() => {
    network = new NetworkManager('https://go.example.com', 'test-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('makes a successful GET request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'hello' }),
    });

    const result = await network.request<{ data: string }>('/api/test');
    expect(result).toEqual({ data: 'hello' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://go.example.com/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('makes a successful POST request with body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const body = JSON.stringify({ name: 'test' });
    const result = await network.request<{ success: boolean }>('/api/test', {
      method: 'POST',
      body,
    });

    expect(result).toEqual({ success: true });
  });

  it('does not include Authorization header without apiKey', async () => {
    const noKeyNetwork = new NetworkManager('https://go.example.com');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await noKeyNetwork.request('/api/test');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers).not.toHaveProperty('Authorization');
  });

  it('throws INVALID_RESPONSE on 4xx without retrying', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Not found' }),
    });

    await expect(network.request('/api/test')).rejects.toThrow(LinkFortyError);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No retry
  });

  it('retries on 5xx and eventually succeeds', async () => {
    let attempt = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    const result = await network.request<{ success: boolean }>('/api/test');
    expect(result).toEqual({ success: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('throws NETWORK_ERROR on fetch failure after retries', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));

    try {
      await network.request('/api/test');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LinkFortyError);
      expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.NETWORK_ERROR);
    }
  });

  it('throws DECODING_ERROR on invalid JSON response without retrying', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    try {
      await network.request('/api/test');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(LinkFortyError);
      expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.DECODING_ERROR);
    }
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('strips trailing slashes from base URL', async () => {
    const net = new NetworkManager('https://go.example.com///');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await net.request('/api/test');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://go.example.com/api/test',
      expect.anything(),
    );
  });
});
