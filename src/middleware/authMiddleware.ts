import { Request,Response,NextFunction } from "express";
import { verifyToken } from "../utils/auth.js";
import { AppError } from "./errorHandler.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token) {
    throw new AppError('Authentication token is required', 401);
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch (error) {
    throw new AppError('Invalid or expired token', 403);
  }
};


