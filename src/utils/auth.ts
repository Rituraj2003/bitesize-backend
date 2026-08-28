import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';

const SALT_ROUNDS=10;
const JWT_SECRET = process.env.JWT_SECRET || "Fallback-secret-key-bitesize"

export const hashPassword= async (password:string): Promise<string>=>{
    return await bcrypt.hash(password,SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const generateToken= (userId:string): string=>{
    return jwt.sign(
        {userId},JWT_SECRET,{
            expiresIn:'7d',
        }
    );
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
};
