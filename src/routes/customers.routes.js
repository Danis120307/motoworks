import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { optionalText } from '../utils/validators.js';
import { toInt, trimmed } from '../utils/parse.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';

const router = Router();

const schema = z.object({
  nama: optionalText({ max: 100 }),
  noHp: optionalText({ max: 20 }),
  platMotor: optionalText({ max: 20 }),
  modelMotor: optionalText({ max: 50 }),
});

router.get('/customers', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const q = trimmed(req.query.q);

  const where = q
    ? {
        OR: [
          { nama: { contains: q } },
          { noHp: { contains: q } },
          { platMotor: { contains: q } },
          { modelMotor: { contains: q } },
        ],
      }
    : {};

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { _count: { select: { serviceOrders: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.render('master/customers/index', {
    title: 'Pelanggan',
    active: 'customers',
    customers,
    filters: { q },
    pagination: paginationMeta(total, { page, limit }),
  });
});

router.get('/customers/new', (req, res) => {
  res.render('master/customers/form', {
    title: 'Tambah Pelanggan',
    active: 'customers',
    customer: null,
    errors: {},
    values: {},
  });
});

router.post('/customers', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).render('master/customers/form', {
      title: 'Tambah Pelanggan',
      active: 'customers',
      customer: null,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
    });
  }

  const customer = await prisma.customer.create({ data: parsed.data });
  res.flash('success', 'Pelanggan ditambahkan.');
  res.redirect(`/customers/${customer.id}/edit`);
});

router.get('/customers/:id/edit', async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: toInt(req.params.id) } });
  if (!customer) {
    return res.status(404).render('errors/404', { title: 'Pelanggan tidak ditemukan', active: 'customers' });
  }
  res.render('master/customers/form', {
    title: 'Edit Pelanggan',
    active: 'customers',
    customer,
    errors: {},
    values: customer,
  });
});

router.post('/customers/:id/update', async (req, res) => {
  const id = toInt(req.params.id);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    return res.status(404).render('errors/404', { title: 'Pelanggan tidak ditemukan', active: 'customers' });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).render('master/customers/form', {
      title: 'Edit Pelanggan',
      active: 'customers',
      customer,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
    });
  }

  await prisma.customer.update({ where: { id }, data: parsed.data });
  res.flash('success', 'Data pelanggan diperbarui.');
  res.redirect('/customers');
});

router.post('/customers/:id/delete', async (req, res) => {
  const id = toInt(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { serviceOrders: true } } },
  });
  if (!customer) {
    return res.status(404).render('errors/404', { title: 'Pelanggan tidak ditemukan', active: 'customers' });
  }

  if (customer._count.serviceOrders > 0) {
    res.flash('error', 'Pelanggan memiliki riwayat order service dan tidak dapat dihapus.');
    return res.redirect('/customers');
  }

  await prisma.customer.delete({ where: { id } });
  res.flash('success', 'Pelanggan dihapus.');
  res.redirect('/customers');
});

export default router;
