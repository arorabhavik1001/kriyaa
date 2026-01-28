import { adminDb } from "./firebaseAdmin.js";

export type StoredGoogleToken = {
  refreshToken: string;
  scope?: string;
  tokenType?: string;
  updatedAt: number;
};

const collectionName = "googleTokens";

export async function getRefreshToken(uid: string) {
  console.log(`[tokenStore] getRefreshToken uid=${uid}`);
  const snap = await adminDb.collection(collectionName).doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<StoredGoogleToken> | undefined;
  if (!data?.refreshToken) return null;
  console.log(`[tokenStore] refreshToken exists uid=${uid} updatedAt=${data.updatedAt ?? "unknown"}`);
  return data.refreshToken;
}

export async function upsertRefreshToken(uid: string, token: StoredGoogleToken) {
  console.log(`[tokenStore] upsertRefreshToken uid=${uid} updatedAt=${token.updatedAt} scope=${token.scope ?? ""}`);
  await adminDb.collection(collectionName).doc(uid).set(token, { merge: true });
}
