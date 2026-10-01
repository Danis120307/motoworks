import { prisma } from '../config/prisma.js';
import { startOfDay, endOfDay, toYmd } from '../utils/dates.js';

export class OrderError extends Error {}

const LOCKED_STATUSES = ['dibayar', 'dibatalkan'];

const ALLOWED_TRANSITIONS = {
  menunggu: ['dikerjakan', 'dibatalkan'],
  dikerjakan: ['selesai', 'dibatalkan'],
  selesai: ['dibatalkan'],
};

async function recalcTotals(tx, orderId) {
  const items = await tx.serviceOrderItem.findMany({ where: { serviceOrderId: orderId } });
  const totalJasa = items
    .filter((i) => i.tipeItem === 'jasa')
    .reduce((acc, i) => acc + i.subtotal, 0);
  const totalSparepart = items
    .filter((i) => i.tipeItem === 'sparepart')
    .reduce((acc, i) => acc + i.subtotal, 0);

  await tx.serviceOrder.update({
    where: { id: orderId },
    data: { totalJasa, totalSparepart, totalKeseluruhan: totalJasa + totalSparepart },
  });
}

export async function createOrder({ customerId, userId, keluhan, mekanik, tanggalMasuk }) {
  const date = tanggalMasuk ?? new Date();

  return prisma.$transaction(async (tx) => {
    const count = await tx.serviceOrder.count({
      where: { tanggalMasuk: { gte: startOfDay(date), lte: endOfDay(date) } },
    });
    const nomorOrder = `ORD-${toYmd(date).replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;

    return tx.serviceOrder.create({
      data: {
        nomorOrder,
        customerId: customerId ?? null,
        userId,
        keluhan: keluhan || null,
        mekanik: mekanik || null,
        ...(tanggalMasuk ? { tanggalMasuk } : {}),
      },
    });
  });
}

export async function addItem({ orderId, tipeItem, sparePartId, serviceTypeId, qty }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError('Order tidak ditemukan.');
    if (LOCKED_STATUSES.includes(order.statusOrder)) {
      throw new OrderError(`Order berstatus "${order.statusOrder}" tidak dapat diubah.`);
    }

    if (tipeItem === 'sparepart') {
      const part = await tx.sparePart.findUnique({ where: { id: sparePartId } });
      if (!part) throw new OrderError('Sparepart tidak ditemukan.');
      if (part.stokSaatIni < qty) {
        throw new OrderError(`Stok ${part.nama} tidak cukup (tersedia ${part.stokSaatIni}).`);
      }

      const item = await tx.serviceOrderItem.create({
        data: {
          serviceOrderId: orderId,
          tipeItem: 'sparepart',
          sparePartId,
          qty,
          hargaSatuan: part.hargaJual,
          subtotal: part.hargaJual * qty,
        },
      });

      await tx.sparePart.update({
        where: { id: sparePartId },
        data: { stokSaatIni: { decrement: qty } },
      });

      await tx.stockMovement.create({
        data: {
          sparePartId,
          serviceOrderId: orderId,
          tipe: 'keluar',
          jumlah: qty,
          keterangan: `Pemakaian order ${order.nomorOrder}`,
        },
      });

      await recalcTotals(tx, orderId);
      return item;
    }

    if (tipeItem === 'jasa') {
      const service = await tx.serviceType.findUnique({ where: { id: serviceTypeId } });
      if (!service) throw new OrderError('Jenis layanan tidak ditemukan.');

      const item = await tx.serviceOrderItem.create({
        data: {
          serviceOrderId: orderId,
          tipeItem: 'jasa',
          serviceTypeId,
          qty,
          hargaSatuan: service.hargaJasa,
          subtotal: service.hargaJasa * qty,
        },
      });

      await recalcTotals(tx, orderId);
      return item;
    }

    throw new OrderError('Tipe item tidak valid.');
  });
}

export async function removeItem({ orderId, itemId }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError('Order tidak ditemukan.');
    if (LOCKED_STATUSES.includes(order.statusOrder)) {
      throw new OrderError(`Order berstatus "${order.statusOrder}" tidak dapat diubah.`);
    }

    const item = await tx.serviceOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.serviceOrderId !== orderId) throw new OrderError('Item tidak ditemukan.');

    await tx.serviceOrderItem.delete({ where: { id: itemId } });

    if (item.tipeItem === 'sparepart' && item.sparePartId) {
      await tx.sparePart.update({
        where: { id: item.sparePartId },
        data: { stokSaatIni: { increment: item.qty } },
      });

      await tx.stockMovement.create({
        data: {
          sparePartId: item.sparePartId,
          serviceOrderId: orderId,
          tipe: 'masuk',
          jumlah: item.qty,
          keterangan: `Batal item order ${order.nomorOrder}`,
        },
      });
    }

    await recalcTotals(tx, orderId);
  });
}

export async function updateStatus({ orderId, status }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new OrderError('Order tidak ditemukan.');

    const allowed = ALLOWED_TRANSITIONS[order.statusOrder] ?? [];
    if (!allowed.includes(status)) {
      throw new OrderError(`Status tidak dapat diubah dari "${order.statusOrder}" ke "${status}".`);
    }

    if (status === 'dibatalkan') {
      for (const item of order.items) {
        if (item.tipeItem === 'sparepart' && item.sparePartId) {
          await tx.sparePart.update({
            where: { id: item.sparePartId },
            data: { stokSaatIni: { increment: item.qty } },
          });

          await tx.stockMovement.create({
            data: {
              sparePartId: item.sparePartId,
              serviceOrderId: orderId,
              tipe: 'masuk',
              jumlah: item.qty,
              keterangan: `Pembatalan order ${order.nomorOrder}`,
            },
          });
        }
      }
    }

    return tx.serviceOrder.update({ where: { id: orderId }, data: { statusOrder: status } });
  });
}

export async function recordPayment({ orderId, jumlahBayar, metodeBayar }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.serviceOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new OrderError('Order tidak ditemukan.');
    if (order.statusOrder === 'dibatalkan') throw new OrderError('Order sudah dibatalkan.');
    if (order.statusOrder === 'dibayar') throw new OrderError('Order sudah dibayar lunas.');
    if (order.statusOrder === 'menunggu' || order.statusOrder === 'dikerjakan') {
      throw new OrderError('Selesaikan pekerjaan terlebih dahulu sebelum pembayaran.');
    }
    if (order.totalKeseluruhan <= 0) throw new OrderError('Order belum memiliki item.');

    const sudahBayar = order.payments.reduce((acc, p) => acc + p.jumlahBayar, 0);
    const sisa = order.totalKeseluruhan - sudahBayar;
    if (jumlahBayar > sisa) {
      throw new OrderError(`Jumlah bayar melebihi sisa tagihan (sisa ${sisa}).`);
    }

    const payment = await tx.payment.create({
      data: {
        serviceOrderId: orderId,
        jumlahBayar,
        metodeBayar: metodeBayar || 'Tunai',
      },
    });

    if (sudahBayar + jumlahBayar >= order.totalKeseluruhan) {
      await tx.serviceOrder.update({ where: { id: orderId }, data: { statusOrder: 'dibayar' } });
    }

    return payment;
  });
}
