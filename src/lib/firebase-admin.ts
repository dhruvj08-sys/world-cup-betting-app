import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    projectId: "gen-lang-client-0794500578",
  });
}

export const adminAuth = getAuth();
