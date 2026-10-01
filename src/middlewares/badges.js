import { prisma } from '../config/prisma.js';

export async function loadBadges(req, res, next) {
  res.locals.lowStockCount = 0;
  if (!res.locals.user) return next();

  try {
    const parts = await prisma.sparePart.findMany({
      select: { stokSaatIni: true, stokMinimum: true },
    });
    res.locals.lowStockCount = parts.filter((p) => p.stokSaatIni <= p.stokMinimum).length;
  } catch {
    res.locals.lowStockCount = 0;
  }
  next();
}
