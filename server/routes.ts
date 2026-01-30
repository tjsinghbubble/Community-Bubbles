import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertBubbleSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "bubble-secret-key-change-in-production";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post('/api/auth/send-verification', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await storage.createVerificationCode({
        email,
        code,
        expiresAt,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
      }

      res.json({ success: true, message: 'Verification code sent' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/verify-code', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
      }

      const verificationCode = await storage.getValidVerificationCode(email, code);
      if (!verificationCode) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      await storage.markCodeAsUsed(verificationCode.id);

      res.json({ success: true, verified: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
      
      res.json({ 
        user: { id: user.id, name: user.name, email: user.email, interests: user.interests },
        token 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/auth/delete-account', authMiddleware, async (req, res) => {
    try {
      await storage.deleteUser(req.userId!);
      res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
      
      res.json({ 
        user: { id: user.id, name: user.name, email: user.email, interests: user.interests },
        token 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/bubbles', async (req, res) => {
    try {
      const bubbles = await storage.getBubbles();
      res.json(bubbles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bubbles/my', authMiddleware, async (req, res) => {
    try {
      const memberships = await storage.getUserMemberships(req.userId!);
      const bubbles = memberships.map(m => m.bubble);
      res.json(bubbles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bubbles/:id', async (req, res) => {
    try {
      const bubble = await storage.getBubble(req.params.id);
      if (!bubble) {
        return res.status(404).json({ error: 'Bubble not found' });
      }
      res.json(bubble);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/bubbles', authMiddleware, async (req, res) => {
    try {
      const data = insertBubbleSchema.parse({
        ...req.body,
        creatorId: req.userId,
      });
      
      const bubble = await storage.createBubble(data);
      
      await storage.createMembership({
        userId: req.userId!,
        bubbleId: bubble.id,
      });
      
      res.json(bubble);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/bubbles/:id/join', authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const bubble = await storage.getBubble(bubbleId);
      
      if (!bubble) {
        return res.status(404).json({ error: 'Bubble not found' });
      }

      const isMember = await storage.isMember(req.userId!, bubbleId);
      if (isMember) {
        return res.status(400).json({ error: 'Already a member' });
      }

      await storage.createMembership({
        userId: req.userId!,
        bubbleId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/bubbles/:id/leave', authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const isMember = await storage.isMember(req.userId!, bubbleId);
      
      if (!isMember) {
        return res.status(400).json({ error: 'Not a member' });
      }

      await storage.deleteMembership(req.userId!, bubbleId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/bubbles/:id/members', async (req, res) => {
    try {
      const members = await storage.getBubbleMemberships(req.params.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/bubbles/:id/membership', authMiddleware, async (req, res) => {
    try {
      const isMember = await storage.isMember(req.userId!, req.params.id);
      res.json({ isMember });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
