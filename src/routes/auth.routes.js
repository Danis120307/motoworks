import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import env from '../config/env.js';
import { requireGuest } from '../middlewares/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const schema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

router.get('/login', requireGuest, (req, res) => {
  res.render('auth/login', { title: 'Masuk', error: null, values: {} });
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(422).render('auth/login', {
      title: 'Masuk',
      error: 'Email dan password wajib diisi.',
      values: req.body,
    });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!valid) {
    return res.status(401).render('auth/login', {
      title: 'Masuk',
      error: 'Email atau password salah.',
      values: req.body,
    });
  }

  const token = jwt.sign(
    { id: user.id, nama: user.nama, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '7d' },
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.redirect('/');
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.redirect('/login');
});

export default router;
