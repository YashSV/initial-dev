// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet, set: mockSet, delete: mockDelete })),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(userId: string, email: string, expiresIn = "7d") {
  return new SignJWT({ userId, email, expiresAt: new Date().toISOString() })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sets auth-token cookie with correct options", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockSet).toHaveBeenCalledOnce();
    const [name, , options] = mockSet.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(false); // NODE_ENV is "test"
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBeInstanceOf(Date);
  });

  test("token encodes userId and email", async () => {
    await createSession("user-123", "user@example.com");

    const token = mockSet.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("user@example.com");
  });
});

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns null when no token cookie", async () => {
    mockGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null for malformed token", async () => {
    mockGet.mockReturnValue({ value: "not-a-jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for expired token", async () => {
    const token = await makeToken("user-1", "a@b.com", "-1s");
    mockGet.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for valid token", async () => {
    const token = await makeToken("user-123", "user@example.com");
    mockGet.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-123");
    expect(session?.email).toBe("user@example.com");
  });
});

describe("deleteSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when no auth-token cookie in request", async () => {
    const req = new NextRequest("http://localhost/");
    expect(await verifySession(req)).toBeNull();
  });

  test("returns null for invalid token in request", async () => {
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "auth-token=bad-token" },
    });
    expect(await verifySession(req)).toBeNull();
  });

  test("returns session payload for valid token in request", async () => {
    const token = await makeToken("user-456", "other@example.com");
    const req = new NextRequest("http://localhost/", {
      headers: { cookie: `auth-token=${token}` },
    });

    const session = await verifySession(req);
    expect(session?.userId).toBe("user-456");
    expect(session?.email).toBe("other@example.com");
  });
});
