import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { toInt, toNullableInt, trimmed } from '../utils/parse.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { ORDER_STATUSES } from '../utils/constants.js';
import { parseDateInput } from '../utils/dates.js';
import {
  createOrder,
  addItem,
  removeItem,
  updateStatus,
  recordPayment,
  OrderError,
} from '../services/order.service.js';
import { getSettings } from '../services/settings.service.js';

const router = Router();

const sumPayments = (payments = []) => payments.reduce((acc, p) => acc + p.jumlahBayar, 0);

router.get('/orders', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null;
  const q = trimmed(req.query.q);

  const where = {
    ...(status ? { statusOrder: status } : {}),
    ...(q
      ? {
          OR: [
            { nomorOrder: { contains: q } },
            { customer: { nama: { contains: q } } },
            { customer: { platMotor: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.serviceOrder.count({ where }),
    prisma.serviceOrder.findMany({
      where,
      include: {
        customer: true,
        payments: true,
        _count: { select: { items: true } },
      },
      orderBy: { tanggalMasuk: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  res.render('orders/index', {
    title: 'Order Service',
    active: 'orders',
    orders,
    filters: { status: status || '', q },
    pagination: paginationMeta(total, { page, limit }),
  });
});

router.get('/orders/new', async (req, res) => {
  const customers = await prisma.customer.findMany({
    orderBy: { nama: 'asc' },
  });

  res.render('orders/new', {
    title: 'Buat Order Service',
    active: 'orders',
    customers,
    errors: {},
    values: {},
  });
});

router.post('/orders', async (req, res) => {
  let customerId = toNullableInt(req.body.customerId);

  if (!customerId) {
    const nama = trimmed(req.body.nama);
    const platMotor = trimmed(req.body.platMotor);

    if (nama || platMotor) {
      const customer = await prisma.customer.create({
        data: {
          nama: nama || null,
          noHp: trimmed(req.body.noHp) || null,
          platMotor: platMotor || null,
          modelMotor: trimmed(req.body.modelMotor) || null,
        },
      });
      customerId = customer.id;
    }
  }

  const order = await createOrder({
    customerId,
    userId: req.user.id,
    keluhan: trimmed(req.body.keluhan),
    mekanik: trimmed(req.body.mekanik),
    tanggalMasuk: req.body.tanggalMasuk ? parseDateInput(req.body.tanggalMasuk) : undefined,
  });

  res.flash('success', `Order ${order.nomorOrder} dibuat.`);
  res.redirect(`/orders/${order.id}`);
});

router.get('/orders/:id', async (req, res) => {
  const id = toInt(req.params.id);
  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { nama: true } },
      items: { include: { sparePart: true, serviceType: true } },
      payments: { orderBy: { tanggalBayar: 'asc' } },
    },
  });

  if (!order) {
    return res.status(404).render('errors/404', { title: 'Order tidak ditemukan', active: 'orders' });
  }

  const [spareparts, serviceTypes, settings] = await Promise.all([
    prisma.sparePart.findMany({ orderBy: { nama: 'asc' } }),
    prisma.serviceType.findMany({ orderBy: { namaLayanan: 'asc' } }),
    getSettings(),
  ]);

  const sudahBayar = sumPayments(order.payments);

  res.render('orders/detail', {
    title: `Order ${order.nomorOrder}`,
    active: 'orders',
    order,
    spareparts,
    serviceTypes,
    settings,
    sudahBayar,
    sisa: order.totalKeseluruhan - sudahBayar,
  });
});

router.post('/orders/:id/items', async (req, res) => {
  const orderId = toInt(req.params.id);

  try {
    await addItem({
      orderId,
      tipeItem: req.body.tipeItem === 'jasa' ? 'jasa' : 'sparepart',
      sparePartId: toNullableInt(req.body.sparePartId),
      serviceTypeId: toNullableInt(req.body.serviceTypeId),
      qty: toInt(req.body.qty, 1),
    });
    res.flash('success', 'Item ditambahkan ke order.');
  } catch (err) {
    if (!(err instanceof OrderError)) throw err;
    res.flash('error', err.message);
  }

  res.redirect(`/orders/${orderId}`);
});

router.post('/orders/:id/items/:itemId/delete', async (req, res) => {
  const orderId = toInt(req.params.id);
  const itemId = toInt(req.params.itemId);

  try {
    await removeItem({ orderId, itemId });
    res.flash('success', 'Item dihapus, stok dikembalikan bila sparepart.');
  } catch (err) {
    if (!(err instanceof OrderError)) throw err;
    res.flash('error', err.message);
  }

  res.redirect(`/orders/${orderId}`);
});

router.post('/orders/:id/status', async (req, res) => {
  const orderId = toInt(req.params.id);

  try {
    await updateStatus({ orderId, status: trimmed(req.body.status) });
    res.flash('success', 'Status order diperbarui.');
  } catch (err) {
    if (!(err instanceof OrderError)) throw err;
    res.flash('error', err.message);
  }

  res.redirect(`/orders/${orderId}`);
});

router.post('/orders/:id/payment', async (req, res) => {
  const orderId = toInt(req.params.id);

  try {
    await recordPayment({
      orderId,
      jumlahBayar: toInt(req.body.jumlahBayar, 0),
      metodeBayar: trimmed(req.body.metodeBayar) || 'Tunai',
    });
    res.flash('success', 'Pembayaran dicatat.');
  } catch (err) {
    if (!(err instanceof OrderError)) throw err;
    res.flash('error', err.message);
  }

  res.redirect(`/orders/${orderId}`);
});

router.get('/orders/:id/invoice', async (req, res) => {
  const id = toInt(req.params.id);
  const [order, settings] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        user: { select: { nama: true } },
        items: { include: { sparePart: true, serviceType: true } },
        payments: { orderBy: { tanggalBayar: 'asc' } },
      },
    }),
    getSettings(),
  ]);

  if (!order) {
    return res.status(404).render('errors/404', { title: 'Order tidak ditemukan', active: 'orders' });
  }

  const sudahBayar = sumPayments(order.payments);

  res.render('print/invoice', {
    layout: false,
    order,
    settings,
    sudahBayar,
    sisa: order.totalKeseluruhan - sudahBayar,
  });
});

export default router;
