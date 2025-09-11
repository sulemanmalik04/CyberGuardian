import type { Request } from 'express';
import type { User, Session } from '@shared/schema';

export interface AuthenticatedRequest extends Request {
  user: User;
  session: Session;
}

export interface UploadRequest extends Request {
  file: Express.Multer.File;
}

export interface AuthenticatedUploadRequest extends AuthenticatedRequest {
  file: Express.Multer.File;
}