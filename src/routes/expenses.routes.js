import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { EXPENSE_CATEGORIES } from '../utils/constants.js';
import { optionalText, moneyField } from '../utils/validators.js';
import { toInt } from '../utils/parse.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { parseMonthInput, startOfMonth, endOfMonth, toYm } from '../utils/dates.js';

const router = Router();

const schema = z.object({
  kategori: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: 'Kategori tidak valid' }),
  }),
  keterangan: optionalText({ max: 255 }),
  jumlah: moneyField('Jumlah').refine((v) => v > 0, 'Jumlah harus lebih dari 0'),
});

async function renderIndex(res, { status = 200, errors = {}, values = {}, bulan } = {}) {
  const bulanDate = parseMonthInput(bulan);
  const where = { tanggal: { gte: startOfMonth(bulanDate), lte: endOfMonth(bulanDate) } };
  const { page, limit, skip } = getPagination(res.req.query);

  const [total, expenses, agg] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.expense.aggregate({ _sum: { jumlah: true }, where }),
  ]);

  return res.status(status).render('expenses/index', {
    title: 'Pengeluaran',
    active: 'expenses',
    expenses,
    errors,
    values,
    bulan: toYm(bulanDate),
    totalBulan: agg._sum.jumlah || 0,
    pagination: paginationMeta(total, { page, limit }),
  });
}

router.get('/expenses', async (req, res) => {
  renderIndex(res, { bulan: req.query.bulan || toYm(new Date()) });
});

router.post('/expenses', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return renderIndex(res, {
      status: 422,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
      bulan: req.body.bulan || toYm(new Date()),
    });
  }

  await prisma.expense.create({
    data: {
      kategori: parsed.data.kategori,
      keterangan: parsed.data.keterangan,
      jumlah: parsed.data.jumlah,
      tanggal: req.body.tanggal ? new Date(`${req.body.tanggal}T12:00:00`) : new Date(),
    },
  });

  res.flash('success', 'Pengeluaran dicatat.');
  res.redirect(`/expenses?bulan=${toYm(new Date())}`);
});

router.post('/expenses/:id/delete', async (req, res) => {
  const id = toInt(req.params.id);
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    res.flash('error', 'Pengeluaran tidak ditemukan.');
    return res.redirect('/expenses');
  }

  await prisma.expense.delete({ where: { id } });
  res.flash('success', 'Pengeluaran dihapus.');
  res.redirect(`/expenses?bulan=${toYm(expense.tanggal)}`);
});

export default router;
