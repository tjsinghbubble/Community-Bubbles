import jwt from "jsonwebtoken";

export interface AuthUserStorage {
  getUser(id: string): Promise<any>;
}

export function makeAuthMiddleware(storage: AuthUserStorage, jwtSecret: string) {
  return async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; tokenVersion: number };
      const user = await storage.getUser(decoded.userId);
      if (!user || user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ error: "Token revoked" });
      }
      if (user.isActive === false) {
        return res.status(403).json({ error: "This account has been deactivated." });
      }
      req.userId = decoded.userId;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
