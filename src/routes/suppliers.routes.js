import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requiredText, optionalText } from '../utils/validators.js';
import { toInt } from '../utils/parse.js';

const router = Router();

const schema = z.object({
  nama: requiredText('Nama supplier', { max: 100 }),
  kontak: optionalText({ max: 50 }),
  alamat: optionalText({ max: 255 }),
});

const listData = () =>
  prisma.supplier.findMany({
    include: { _count: { select: { stockMovements: true } } },
    orderBy: { nama: 'asc' },
  });

function renderIndex(res, { status = 200, errors = {}, values = {} } = {}) {
  return listData().then((suppliers) =>
    res.status(status).render('master/suppliers/index', {
      title: 'Supplier',
      active: 'suppliers',
      suppliers,
      errors,
      values,
    }),
  );
}

router.get('/suppliers', async (req, res) => renderIndex(res));

router.post('/suppliers', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return renderIndex(res, { status: 422, errors: parsed.error.flatten().fieldErrors, values: req.body });
  }

  await prisma.supplier.create({ data: parsed.data });
  res.flash('success', `Supplier "${parsed.data.nama}" ditambahkan.`);
  res.redirect('/suppliers');
});

router.get('/suppliers/:id/edit', async (req, res) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: toInt(req.params.id) } });
  if (!supplier) {
    return res.status(404).render('errors/404', { title: 'Supplier tidak ditemukan', active: 'suppliers' });
  }
  res.render('master/suppliers/edit', {
    title: 'Edit Supplier',
    active: 'suppliers',
    supplier,
    errors: {},
    values: supplier,
  });
});

router.post('/suppliers/:id/update', async (req, res) => {
  const id = toInt(req.params.id);
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) {
    return res.status(404).render('errors/404', { title: 'Supplier tidak ditemukan', active: 'suppliers' });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).render('master/suppliers/edit', {
      title: 'Edit Supplier',
      active: 'suppliers',
      supplier,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
    });
  }

  await prisma.supplier.update({ where: { id }, data: parsed.data });
  res.flash('success', 'Supplier diperbarui.');
  res.redirect('/suppliers');
});

router.post('/suppliers/:id/delete', async (req, res) => {
  const id = toInt(req.params.id);
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { stockMovements: true } } },
  });
  if (!supplier) {
    return res.status(404).render('errors/404', { title: 'Supplier tidak ditemukan', active: 'suppliers' });
  }

  if (supplier._count.stockMovements > 0) {
    res.flash('error', `Supplier "${supplier.nama}" masih memiliki riwayat transaksi stok.`);
    return res.redirect('/suppliers');
  }

  await prisma.supplier.delete({ where: { id } });
  res.flash('success', 'Supplier dihapus.');
  res.redirect('/suppliers');
});

export default router;
