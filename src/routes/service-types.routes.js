import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requiredText, moneyField } from '../utils/validators.js';
import { toInt } from '../utils/parse.js';

const router = Router();

const schema = z.object({
  namaLayanan: requiredText('Nama layanan', { max: 100 }),
  hargaJasa: moneyField('Harga jasa'),
});

const listData = () =>
  prisma.serviceType.findMany({
    include: { _count: { select: { orderItems: true } } },
    orderBy: { namaLayanan: 'asc' },
  });

function renderIndex(res, { status = 200, errors = {}, values = {} } = {}) {
  return listData().then((serviceTypes) =>
    res.status(status).render('master/service-types/index', {
      title: 'Jenis Layanan Service',
      active: 'service-types',
      serviceTypes,
      errors,
      values,
    }),
  );
}

router.get('/service-types', async (req, res) => renderIndex(res));

router.post('/service-types', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return renderIndex(res, { status: 422, errors: parsed.error.flatten().fieldErrors, values: req.body });
  }

  await prisma.serviceType.create({ data: parsed.data });
  res.flash('success', `Layanan "${parsed.data.namaLayanan}" ditambahkan.`);
  res.redirect('/service-types');
});

router.get('/service-types/:id/edit', async (req, res) => {
  const serviceType = await prisma.serviceType.findUnique({ where: { id: toInt(req.params.id) } });
  if (!serviceType) {
    return res.status(404).render('errors/404', { title: 'Layanan tidak ditemukan', active: 'service-types' });
  }
  res.render('master/service-types/edit', {
    title: 'Edit Jenis Layanan',
    active: 'service-types',
    serviceType,
    errors: {},
    values: serviceType,
  });
});

router.post('/service-types/:id/update', async (req, res) => {
  const id = toInt(req.params.id);
  const serviceType = await prisma.serviceType.findUnique({ where: { id } });
  if (!serviceType) {
    return res.status(404).render('errors/404', { title: 'Layanan tidak ditemukan', active: 'service-types' });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).render('master/service-types/edit', {
      title: 'Edit Jenis Layanan',
      active: 'service-types',
      serviceType,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
    });
  }

  await prisma.serviceType.update({ where: { id }, data: parsed.data });
  res.flash('success', 'Jenis layanan diperbarui.');
  res.redirect('/service-types');
});

router.post('/service-types/:id/delete', async (req, res) => {
  const id = toInt(req.params.id);
  const serviceType = await prisma.serviceType.findUnique({ where: { id } });
  if (!serviceType) {
    return res.status(404).render('errors/404', { title: 'Layanan tidak ditemukan', active: 'service-types' });
  }

  await prisma.serviceType.delete({ where: { id } });
  res.flash('success', 'Jenis layanan dihapus.');
  res.redirect('/service-types');
});

export default router;
