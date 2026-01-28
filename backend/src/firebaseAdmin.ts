import admin from "firebase-admin";
import fs from "node:fs";

function normalizeServiceAccount(serviceAccount: any) {
  // Render/env providers often store multiline private keys with escaped newlines.
  // firebase-admin expects actual newlines.
  if (typeof serviceAccount?.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

function initFirebaseAdmin() {
  if (admin.apps.length) return admin;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  const logMeta = (source: string, sa: any) => {
    const clientEmail = typeof sa?.client_email === "string" ? sa.client_email : "";
    const projectId = typeof sa?.project_id === "string" ? sa.project_id : "";
    const privateKeyId = typeof sa?.private_key_id === "string" ? sa.private_key_id : "";
    console.log(`[firebaseAdmin] init source=${source} projectId=${projectId} clientEmail=${clientEmail} privateKeyId=${privateKeyId}`);
  };

  const initWith = (serviceAccount: any, source: string) => {
    const sa = normalizeServiceAccount(serviceAccount);
    logMeta(source, sa);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
    return admin;
  };

  if (b64) {
    const raw = Buffer.from(b64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(raw);
    return initWith(serviceAccount, "b64");
  }

  if (json) {
    const serviceAccount = JSON.parse(json);
    return initWith(serviceAccount, "json");
  }

  if (path) {
    const raw = fs.readFileSync(path, "utf8");
    const serviceAccount = JSON.parse(raw);
    return initWith(serviceAccount, "path");
  }

  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_B64, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_SERVICE_ACCOUNT_PATH.",
  );
}

export const firebaseAdmin = initFirebaseAdmin();
export const adminAuth = firebaseAdmin.auth();
export const adminDb = firebaseAdmin.firestore();
