import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export function loadUser(req, res, next) {
  const token = req.cookies?.token;
  req.user = null;
  if (token) {
    try {
      req.user = jwt.verify(token, env.jwtSecret);
    } catch {
      req.user = null;
    }
  }
  res.locals.user = req.user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

export function requireGuest(req, res, next) {
  if (req.user) return res.redirect('/');
  next();
}
