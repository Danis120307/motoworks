export function commonLocals(req, res, next) {
  res.locals.query = req.query;
  res.locals.currentPath = req.path;
  res.locals.appName = 'Motoworks';
  next();
}
