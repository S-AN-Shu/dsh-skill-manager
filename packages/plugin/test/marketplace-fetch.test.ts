import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHostMarketplaceFetch,
  normalizeWindowsProxy
} from "../src/marketplace-fetch.js";

afterEach(() => vi.restoreAllMocks());

describe("Host marketplace fetch", () => {
  it("normalizes Windows static proxy formats without accepting commands or paths", () => {
    expect(normalizeWindowsProxy("127.0.0.1:9674")).toBe("http://127.0.0.1:9674");
    expect(normalizeWindowsProxy("http=127.0.0.1:8080;https=127.0.0.1:9674")).toBe(
      "http://127.0.0.1:9674"
    );
    expect(normalizeWindowsProxy("https=proxy.example:443;http=proxy.example:80")).toBe(
      "http://proxy.example:443"
    );
    expect(normalizeWindowsProxy("http://127.0.0.1:9674/path")).toBeUndefined();
    expect(normalizeWindowsProxy("127.0.0.1:9674 & whoami")).toBeUndefined();
  });

  it("does not read Windows configuration when an explicit proxy environment exists", () => {
    const readWindowsProxy = vi.fn(() => "http://127.0.0.1:9674");
    createHostMarketplaceFetch({
      environment: { HTTPS_PROXY: "http://proxy.example:8080" },
      platform: "win32",
      readWindowsProxy
    });
    expect(readWindowsProxy).not.toHaveBeenCalled();
  });

  it("uses the proxy transport without exposing proxy metadata in responses", async () => {
    const proxyFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    }));
    const createProxyFetch = vi.fn(() => proxyFetch);
    const fetch = createHostMarketplaceFetch({
      environment: {},
      platform: "win32",
      readWindowsProxy: () => "http://127.0.0.1:9674",
      createProxyFetch
    });
    const response = await fetch("https://example.test/catalog");
    const secondResponse = await fetch("https://example.test/skills");
    expect(await response.json()).toEqual({ ok: true });
    expect(await secondResponse.json()).toEqual({ ok: true });
    expect(createProxyFetch).toHaveBeenCalledOnce();
    expect(createProxyFetch).toHaveBeenCalledWith("http://127.0.0.1:9674");
    expect(proxyFetch).toHaveBeenCalledWith("https://example.test/catalog");
    expect(proxyFetch).toHaveBeenLastCalledWith("https://example.test/skills");
  });

  it("retries a transient TLS connection reset for an idempotent GET", async () => {
    const reset = Object.assign(
      new Error("Client network socket disconnected before secure TLS connection was established"),
      { code: "ECONNRESET" }
    );
    const proxyFetch = vi.fn()
      .mockRejectedValueOnce(reset)
      .mockResolvedValueOnce(new Response("ok"));
    const fetch = createHostMarketplaceFetch({
      environment: {},
      platform: "win32",
      readWindowsProxy: () => "http://127.0.0.1:9674",
      createProxyFetch: () => proxyFetch
    });

    await expect(fetch("https://github.com/trending?since=monthly")).resolves.toMatchObject({ ok: true });
    expect(proxyFetch).toHaveBeenCalledTimes(2);
  });
});
