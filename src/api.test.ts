import { describe, expect, it, vi } from "vitest";
import { createApiClient, type TokenStore } from "./api";

describe("API client", () => {
  it("refreshes once, rotates tokens, and retries a protected request", async () => {
    const tokens = { accessToken: "old-access", refreshToken: "old-refresh" };
    const store: TokenStore = {
      clear: vi.fn(),
      read: () => tokens,
      write: vi.fn((next) => Object.assign(tokens, next)),
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 401, message: "Expired", error: "Unauthorized" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 200, message: "Tokens refreshed", data: { accessToken: "new-access", refreshToken: "new-refresh" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 200, message: "Cart fetched", data: { id: "cart-1" } }), { status: 200 }));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchFn, tokens: store });

    await expect(client.get<{ id: string }>("/cart", { authenticated: true })).resolves.toEqual({ id: "cart-1" });

    expect(fetchFn).toHaveBeenNthCalledWith(1, "https://api.example.test/cart", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer old-access" }) }));
    expect(fetchFn).toHaveBeenNthCalledWith(2, "https://api.example.test/auth/refresh", expect.objectContaining({ body: JSON.stringify({ refreshToken: "old-refresh" }) }));
    expect(fetchFn).toHaveBeenNthCalledWith(3, "https://api.example.test/cart", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer new-access" }) }));
    expect(store.write).toHaveBeenCalledWith({ accessToken: "new-access", refreshToken: "new-refresh" });
    expect(store.clear).not.toHaveBeenCalled();
  });

  it("clears the browser session when refresh is rejected", async () => {
    const store: TokenStore = {
      clear: vi.fn(),
      read: () => ({ accessToken: "expired-access", refreshToken: "expired-refresh" }),
      write: vi.fn(),
    };
    const onAuthFailure = vi.fn();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 401, message: "Expired", error: "Unauthorized" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 403, message: "Replay", error: "Forbidden" }), { status: 403 }));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchFn, onAuthFailure, tokens: store });

    await expect(client.get("/cart", { authenticated: true })).rejects.toThrow("Expired");

    expect(store.clear).toHaveBeenCalledOnce();
    expect(onAuthFailure).toHaveBeenCalledOnce();
  });
});
