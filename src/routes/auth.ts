import { Router, Request, Response } from 'express';
import { UserService } from '../database/services';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth';

const router = Router();
const userService = new UserService();

interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

interface RegisterRequest extends Request {
  body: {
    email: string;
    password: string;
    confirmPassword?: string;
  };
}

// Register
router.post('/register', async (req: LoginRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Check if user already exists
    const existingUser = userService.getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'User already exists with this email' });
      return;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = userService.createUser(email, passwordHash, 'user');

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: LoginRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = userService.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
