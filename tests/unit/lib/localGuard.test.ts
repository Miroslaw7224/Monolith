// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkRequest, isAllowedHost, type GuardInput } from "@/lib/localGuard";

const req = (over: Partial<GuardInput> = {}): GuardInput => ({
  method: "GET",
  host: "localhost:3100",
  origin: null,
  secFetchSite: null,
  clientHeader: null,
  ...over,
});

const HOST = { ok: false, status: 403, reason: "host" } as const;
const ORIGIN = { ok: false, status: 403, reason: "origin" } as const;
const OK = { ok: true } as const;

describe("isAllowedHost", () => {
  it.each(["localhost", "localhost:3100", "127.0.0.1:3100", "[::1]:3100", "LOCALHOST:3100"])(
    "allows %s",
    (host) => {
      expect(isAllowedHost(host)).toBe(true);
    }
  );

  it.each([
    "evil.com",
    "evil.com:3100",
    "localhost.evil.com:3100",
    "127.0.0.1.evil.com",
    "localhost@evil.com",
    "localhost:3100,evil.com",
    "localhost:abc",
    "",
    null,
    "0.0.0.0:3100",
    "192.168.1.5:3100",
  ])("rejects %s", (host) => {
    expect(isAllowedHost(host)).toBe(false);
  });
});

describe("checkRequest", () => {
  it("rejects a GET with a foreign host", () => {
    expect(checkRequest(req({ host: "evil.com" }))).toEqual(HOST);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("allows %s with a good host", (method) => {
    expect(checkRequest(req({ method }))).toEqual(OK);
    expect(checkRequest(req({ method, secFetchSite: "cross-site" }))).toEqual(OK);
  });

  it("checks the host before anything else", () => {
    expect(
      checkRequest(req({ method: "POST", host: "evil.com", secFetchSite: "same-origin" }))
    ).toEqual(HOST);
  });

  it("allows a same-origin POST", () => {
    expect(checkRequest(req({ method: "POST", secFetchSite: "same-origin" }))).toEqual(OK);
  });

  it.each(["cross-site", "same-site", "none"])("rejects a POST with Sec-Fetch-Site %s", (site) => {
    expect(checkRequest(req({ method: "POST", secFetchSite: site }))).toEqual(ORIGIN);
    expect(
      checkRequest(
        req({
          method: "POST",
          secFetchSite: site,
          clientHeader: "1",
          origin: "http://localhost:3100",
        })
      )
    ).toEqual(ORIGIN);
  });

  it("allows a POST whose Origin matches the Host", () => {
    expect(checkRequest(req({ method: "POST", origin: "http://localhost:3100" }))).toEqual(OK);
  });

  it("rejects a POST from another port of the same host", () => {
    expect(checkRequest(req({ method: "POST", origin: "http://localhost:3000" }))).toEqual(ORIGIN);
  });

  it.each(["http://evil.com", "null", "nie-url"])("rejects a POST with Origin %s", (origin) => {
    expect(checkRequest(req({ method: "POST", origin }))).toEqual(ORIGIN);
  });

  it("does not let the client header override a foreign Origin", () => {
    expect(
      checkRequest(req({ method: "POST", origin: "http://evil.com", clientHeader: "1" }))
    ).toEqual(ORIGIN);
  });

  it("rejects a POST without any headers", () => {
    expect(checkRequest(req({ method: "POST" }))).toEqual(ORIGIN);
  });

  it("allows a tool that sends X-Nexus-Client: 1", () => {
    expect(checkRequest(req({ method: "POST", clientHeader: "1" }))).toEqual(OK);
  });

  it.each(["0", "true"])("rejects a bad client header %s", (clientHeader) => {
    expect(checkRequest(req({ method: "POST", clientHeader }))).toEqual(ORIGIN);
  });

  it.each(["PUT", "PATCH", "DELETE"])("applies the POST rules to %s", (method) => {
    expect(checkRequest(req({ method }))).toEqual(ORIGIN);
    expect(checkRequest(req({ method, secFetchSite: "same-origin" }))).toEqual(OK);
  });
});
