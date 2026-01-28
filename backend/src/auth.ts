import jwt from "jsonwebtoken";
import { adminAuth } from "./firebaseAdmin.js";

export type AuthState = {
  uid?: string;
  mode?: "login" | "connect";
};

export async function verifyFirebaseIdToken(idToken: string) {
  return adminAuth.verifyIdToken(idToken);
}

export function signState(state: AuthState) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  return jwt.sign(state, secret, { expiresIn: "10m" });
}

export function verifyState(token: string): AuthState {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== "object" || decoded === null) throw new Error("Invalid state");
  
  // Basic validation
  // We expect either uid (connect) or mode="login"
  const payload = decoded as any;
  if (!payload.uid && payload.mode !== "login") {
    throw new Error("Invalid state payload");
  }
  
  return { uid: payload.uid, mode: payload.mode };
}
