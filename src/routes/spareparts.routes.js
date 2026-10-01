import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requiredText, optionalText, moneyField } from '../utils/validators.js';
import { toInt, toNullableInt, trimmed } from '../utils/parse.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { kartuStok } from '../services/stock.service.js';
import { parseDateInput, startOfDay, endOfDay } from '../utils/dates.js';

const router = Router();

const categoryField = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
  z.number({ invalid_type_error: 'Kategori tidak valid' }).int().positive().nullable(),
);

const baseSchema = {
  kodeItem: requiredText('Kode item', { max: 30 }),
  nama: requiredText('Nama sparepart', { max: 100 }),
  categoryId: categoryField,
  satuan: optionalText({ max: 20 }),
  hargaBeli: moneyField('Harga beli'),
  hargaJual: moneyField('Harga jual'),
  stokMinimum: moneyField('Stok minimum'),
};

const createSchema = z.object({
  ...baseSchema,
  stokAwal: moneyField('Stok awal'),
});

const updateSchema = z.object(baseSchema);

const listCategories = () => prisma.category.findMany({ orderBy: { namaKategori: 'asc' } });

async function renderForm(res, { status = 200, part = null, errors = {}, values = {} } = {}) {
  const categories = await listCategories();
  return res.status(status).render('master/spareparts/form', {
    title: part ? 'Edit Sparepart' : 'Tambah Sparepart',
    active: 'spareparts',
    part,
    categories,
    errors,
    values,
  });
}

router.get('/spareparts', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const q = trimmed(req.query.q);
  const categoryId = toNullableInt(req.query.kategori);
  const lowOnly = req.query.menipis === '1';

  const where = {
    ...(q ? { OR: [{ nama: { contains: q } }, { kodeItem: { contains: q } }] } : {}),
    ...(categoryId ? { categoryId } : {}),
  };

  const [all, categories] = await Promise.all([
    prisma.sparePart.findMany({ where, include: { category: true }, orderBy: { nama: 'asc' } }),
    listCategories(),
  ]);

  const filtered = lowOnly ? all.filter((p) => p.stokSaatIni <= p.stokMinimum) : all;
  const rows = filtered.slice(skip, skip + limit);

  res.render('master/spareparts/index', {
    title: 'Data Sparepart',
    active: 'spareparts',
    parts: rows,
    categories,
    filters: { q, kategori: req.query.kategori || '', menipis: lowOnly },
    pagination: paginationMeta(filtered.length, { page, limit }),
  });
});

router.get('/spareparts/new', async (req, res) => {
  renderForm(res, { values: { stokMinimum: 5, stokAwal: 0, hargaBeli: 0, hargaJual: 0 } });
});

router.post('/spareparts', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return renderForm(res, { status: 422, errors: parsed.error.flatten().fieldErrors, values: req.body });
  }

  const dup = await prisma.sparePart.findUnique({ where: { kodeItem: parsed.data.kodeItem } });
  if (dup) {
    return renderForm(res, {
      status: 422,
      errors: { kodeItem: ['Kode item sudah dipakai.'] },
      values: req.body,
    });
  }

  const { stokAwal, ...data } = parsed.data;
  const part = await prisma.sparePart.create({
    data: { ...data, stokSaatIni: stokAwal },
  });

  if (stokAwal > 0) {
    await prisma.stockMovement.create({
      data: {
        sparePartId: part.id,
        tipe: 'masuk',
        jumlah: stokAwal,
        keterangan: 'Stok awal',
      },
    });
  }

  res.flash('success', `Sparepart "${part.nama}" ditambahkan.`);
  res.redirect('/spareparts');
});

router.get('/spareparts/:id/edit', async (req, res) => {
  const part = await prisma.sparePart.findUnique({ where: { id: toInt(req.params.id) } });
  if (!part) {
    return res.status(404).render('errors/404', { title: 'Sparepart tidak ditemukan', active: 'spareparts' });
  }
  renderForm(res, { part, values: part });
});

router.post('/spareparts/:id/update', async (req, res) => {
  const id = toInt(req.params.id);
  const part = await prisma.sparePart.findUnique({ where: { id } });
  if (!part) {
    return res.status(404).render('errors/404', { title: 'Sparepart tidak ditemukan', active: 'spareparts' });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return renderForm(res, { status: 422, part, errors: parsed.error.flatten().fieldErrors, values: req.body });
  }

  const dup = await prisma.sparePart.findFirst({
    where: { kodeItem: parsed.data.kodeItem, id: { not: id } },
  });
  if (dup) {
    return renderForm(res, {
      status: 422,
      part,
      errors: { kodeItem: ['Kode item sudah dipakai.'] },
      values: req.body,
    });
  }

  await prisma.sparePart.update({ where: { id }, data: parsed.data });
  res.flash('success', 'Data sparepart diperbarui.');
  res.redirect('/spareparts');
});

router.post('/spareparts/:id/delete', async (req, res) => {
  const id = toInt(req.params.id);
  const part = await prisma.sparePart.findUnique({
    where: { id },
    include: { _count: { select: { stockMovements: true, orderItems: true } } },
  });
  if (!part) {
    return res.status(404).render('errors/404', { title: 'Sparepart tidak ditemukan', active: 'spareparts' });
  }

  if (part._count.stockMovements > 0 || part._count.orderItems > 0) {
    res.flash('error', `Sparepart "${part.nama}" memiliki riwayat stok/order dan tidak dapat dihapus.`);
    return res.redirect('/spareparts');
  }

  await prisma.sparePart.delete({ where: { id } });
  res.flash('success', 'Sparepart dihapus.');
  res.redirect('/spareparts');
});

router.get('/spareparts/:id/kartu-stok', async (req, res) => {
  const start = req.query.start ? startOfDay(parseDateInput(req.query.start)) : null;
  const end = req.query.end ? endOfDay(parseDateInput(req.query.end)) : null;

  const result = await kartuStok({ sparePartId: toInt(req.params.id), start, end });
  if (!result) {
    return res.status(404).render('errors/404', { title: 'Sparepart tidak ditemukan', active: 'spareparts' });
  }

  res.render('master/spareparts/kartu-stok', {
    title: `Kartu Stok - ${result.part.nama}`,
    active: 'spareparts',
    ...result,
    filters: { start: req.query.start || '', end: req.query.end || '' },
  });
});

export default router;
