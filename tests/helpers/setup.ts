import { PrismaClient } from "@prisma/client";

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

export const prisma = new PrismaClient();

/**
 * Get a NextAuth session cookie by signing in with credentials.
 * Uses the CSRF token + credentials sign-in flow.
 */
export async function getSessionCookie(
  email: string,
  password: string = "password123"
): Promise<string> {
  // Step 1: Get CSRF token from the signin page
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = (await csrfRes.json()) as { csrfToken: string };
  const csrfToken = csrfData.csrfToken;

  // Collect cookies from CSRF response
  const csrfCookies = csrfRes.headers.getSetCookie?.() || [];
  const cookieHeader = csrfCookies.map((c) => c.split(";")[0]).join("; ");

  // Step 2: Sign in with credentials
  const signInRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      json: "true",
    }).toString(),
    redirect: "manual",
  });

  // Collect all session cookies
  const signInCookies = signInRes.headers.getSetCookie?.() || [];
  const allCookies = [...csrfCookies, ...signInCookies]
    .map((c) => c.split(";")[0])
    .join("; ");

  if (!allCookies.includes("next-auth.session-token")) {
    throw new Error(`Failed to get session cookie for ${email}. Status: ${signInRes.status}`);
  }

  return allCookies;
}

/**
 * Create a fetch function that includes auth cookies.
 */
export function makeAuthFetch(cookies: string) {
  return async (path: string, init?: RequestInit) => {
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        ...init?.headers,
      },
    });
  };
}
