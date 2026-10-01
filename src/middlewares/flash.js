const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', path: '/' };

export function flashMiddleware(req, res, next) {
  res.locals.flash = {
    success: req.cookies?.flash_success || null,
    error: req.cookies?.flash_error || null,
  };

  if (req.cookies?.flash_success) res.clearCookie('flash_success', COOKIE_OPTIONS);
  if (req.cookies?.flash_error) res.clearCookie('flash_error', COOKIE_OPTIONS);

  res.flash = (type, message) => {
    res.cookie(`flash_${type}`, String(message), { ...COOKIE_OPTIONS, maxAge: 15000 });
  };

  next();
}
