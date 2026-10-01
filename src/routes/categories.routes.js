import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requiredText } from '../utils/validators.js';
import { toInt } from '../utils/parse.js';

const router = Router();

const schema = z.object({
  namaKategori: requiredText('Nama kategori', { max: 50 }),
});

const listData = () =>
  prisma.category.findMany({
    include: { _count: { select: { spareParts: true } } },
    orderBy: { namaKategori: 'asc' },
  });

function renderIndex(res, { status = 200, errors = {}, values = {} } = {}) {
  return listData().then((categories) =>
    res.status(status).render('master/categories/index', {
      title: 'Kategori Sparepart',
      active: 'categories',
      categories,
      errors,
      values,
    }),
  );
}

router.get('/categories', async (req, res) => renderIndex(res));

router.post('/categories', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return renderIndex(res, { status: 422, errors: parsed.error.flatten().fieldErrors, values: req.body });
  }

  const exists = await prisma.category.findUnique({
    where: { namaKategori: parsed.data.namaKategori },
  });
  if (exists) {
    return renderIndex(res, {
      status: 422,
      errors: { namaKategori: ['Kategori sudah ada.'] },
      values: req.body,
    });
  }

  await prisma.category.create({ data: parsed.data });
  res.flash('success', `Kategori "${parsed.data.namaKategori}" ditambahkan.`);
  res.redirect('/categories');
});

router.get('/categories/:id/edit', async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: toInt(req.params.id) } });
  if (!category) {
    return res.status(404).render('errors/404', { title: 'Kategori tidak ditemukan', active: 'categories' });
  }
  res.render('master/categories/edit', {
    title: 'Edit Kategori',
    active: 'categories',
    category,
    errors: {},
    values: category,
  });
});

router.post('/categories/:id/update', async (req, res) => {
  const id = toInt(req.params.id);
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    return res.status(404).render('errors/404', { title: 'Kategori tidak ditemukan', active: 'categories' });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).render('master/categories/edit', {
      title: 'Edit Kategori',
      active: 'categories',
      category,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
    });
  }

  const dup = await prisma.category.findFirst({
    where: { namaKategori: parsed.data.namaKategori, id: { not: id } },
  });
  if (dup) {
    return res.status(422).render('master/categories/edit', {
      title: 'Edit Kategori',
      active: 'categories',
      category,
      errors: { namaKategori: ['Kategori sudah ada.'] },
      values: req.body,
    });
  }

  await prisma.category.update({ where: { id }, data: parsed.data });
  res.flash('success', 'Kategori diperbarui.');
  res.redirect('/categories');
});

router.post('/categories/:id/delete', async (req, res) => {
  const id = toInt(req.params.id);
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { spareParts: true } } },
  });
  if (!category) {
    return res.status(404).render('errors/404', { title: 'Kategori tidak ditemukan', active: 'categories' });
  }

  if (category._count.spareParts > 0) {
    res.flash('error', `Kategori "${category.namaKategori}" masih dipakai ${category._count.spareParts} sparepart.`);
    return res.redirect('/categories');
  }

  await prisma.category.delete({ where: { id } });
  res.flash('success', 'Kategori dihapus.');
  res.redirect('/categories');
});

export default router;
