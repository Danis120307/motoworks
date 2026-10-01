import { Router } from 'express';
import { resolvePeriod, labaRugi, itemTerlaris, stokReport, kasReport } from '../services/report.service.js';
import { parseDateInput, toYmd } from '../utils/dates.js';

const router = Router();

router.get('/reports/laba-rugi', async (req, res) => {
  const period = resolvePeriod(req.query);
  const report = await labaRugi({ start: period.start, end: period.end });

  res.render('reports/laba-rugi', {
    title: 'Laporan Laba Rugi',
    active: 'reports-laba-rugi',
    period,
    report,
  });
});

router.get('/reports/stok', async (req, res) => {
  const period = resolvePeriod(req.query);
  const [stock, top] = await Promise.all([
    stokReport(),
    itemTerlaris({ start: period.start, end: period.end, take: 10 }),
  ]);

  res.render('reports/stok', {
    title: 'Laporan Stok',
    active: 'reports-stok',
    period,
    stock,
    top,
  });
});

router.get('/reports/kas', async (req, res) => {
  const day = req.query.tanggal ? parseDateInput(req.query.tanggal) : new Date();
  const kas = await kasReport(day);

  res.render('reports/kas', {
    title: 'Buku Kas Harian',
    active: 'reports-kas',
    kas,
    tanggal: toYmd(day),
  });
});

export default router;
