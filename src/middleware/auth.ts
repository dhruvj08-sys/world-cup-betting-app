import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.js';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateUser } from '../db/users.js';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: any; // The record from PG users table
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Attempt to sync the user to postgres if they don't already exist or update info
    const dbUser = await getOrCreateUser(
      decodedToken.uid, 
      decodedToken.email || '', 
      decodedToken.name, 
      decodedToken.picture
    );
    req.dbUser = dbUser;

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
