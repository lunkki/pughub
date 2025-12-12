import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function createSession(userId: number) {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.userId as number;
  } catch {
    return null;
  }
}
