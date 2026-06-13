import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    projectId: "world-cup-pool-86683",
  });
}

export const adminAuth = getAuth();
