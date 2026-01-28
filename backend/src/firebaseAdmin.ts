import admin from "firebase-admin";
import fs from "node:fs";

function initFirebaseAdmin() {
  if (admin.apps.length) return admin;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = "prj-mgmt-fabb3-firebase-adminsdk-fbsvc-7c752b4d01.json";

  if (json) {
    const serviceAccount = JSON.parse(json);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin;
  }

  if (path) {
    const raw = fs.readFileSync(path, "utf8");
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin;
  }

  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.",
  );
}

export const firebaseAdmin = initFirebaseAdmin();
export const adminAuth = firebaseAdmin.auth();
export const adminDb = firebaseAdmin.firestore();
