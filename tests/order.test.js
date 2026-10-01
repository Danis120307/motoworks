import { describe, it, expect } from 'vitest';
import {
  prisma,
  loginAgent,
  createTestSparepart,
  createTestServiceType,
  createTestOrder,
} from './helpers.js';

describe('alur order service sampai pembayaran', () => {
  it('order penuh: tambah item, bayar lunas, stok berkurang', async () => {
    const agent = await loginAgent();
    const part = await createTestSparepart({ stok: 10, hargaJual: 48000 });
    const service = await createTestServiceType({ hargaJasa: 25000 });
    const orderId = await createTestOrder(agent);

    let res = await agent.post(`/orders/${orderId}/items`).type('form').send({
      tipeItem: 'sparepart',
      sparePartId: String(part.id),
      qty: '2',
    });
    expect(res.status).toBe(302);
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(8);

    res = await agent.post(`/orders/${orderId}/items`).type('form').send({
      tipeItem: 'jasa',
      serviceTypeId: String(service.id),
      qty: '1',
    });
    expect(res.status).toBe(302);

    let order = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    expect(order.totalSparepart).toBe(96000);
    expect(order.totalJasa).toBe(25000);
    expect(order.totalKeseluruhan).toBe(121000);

    res = await agent.post(`/orders/${orderId}/items`).type('form').send({
      tipeItem: 'sparepart',
      sparePartId: String(part.id),
      qty: '100',
    });
    expect(res.status).toBe(302);
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(8);

    await agent.post(`/orders/${orderId}/status`).type('form').send({ status: 'dikerjakan' });
    await agent.post(`/orders/${orderId}/status`).type('form').send({ status: 'selesai' });

    res = await agent.post(`/orders/${orderId}/payment`).type('form').send({
      jumlahBayar: '121000',
      metodeBayar: 'Tunai',
    });
    expect(res.status).toBe(302);

    order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    expect(order.statusOrder).toBe('dibayar');
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0].jumlahBayar).toBe(121000);

    const movement = await prisma.stockMovement.findFirst({
      where: { serviceOrderId: orderId, tipe: 'keluar' },
    });
    expect(movement).not.toBeNull();
    expect(movement.jumlah).toBe(2);
  });

  it('menghapus item mengembalikan stok', async () => {
    const agent = await loginAgent();
    const part = await createTestSparepart({ stok: 5, hargaJual: 10000 });
    const orderId = await createTestOrder(agent);

    await agent.post(`/orders/${orderId}/items`).type('form').send({
      tipeItem: 'sparepart',
      sparePartId: String(part.id),
      qty: '2',
    });
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(3);

    const item = await prisma.serviceOrderItem.findFirst({
      where: { serviceOrderId: orderId, sparePartId: part.id },
    });
    const res = await agent.post(`/orders/${orderId}/items/${item.id}/delete`);
    expect(res.status).toBe(302);
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(5);
  });

  it('membatalkan order mengembalikan semua stok', async () => {
    const agent = await loginAgent();
    const part = await createTestSparepart({ stok: 6, hargaJual: 20000 });
    const orderId = await createTestOrder(agent);

    await agent.post(`/orders/${orderId}/items`).type('form').send({
      tipeItem: 'sparepart',
      sparePartId: String(part.id),
      qty: '3',
    });

    const res = await agent
      .post(`/orders/${orderId}/status`)
      .type('form')
      .send({ status: 'dibatalkan' });
    expect(res.status).toBe(302);
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(6);
    expect((await prisma.serviceOrder.findUnique({ where: { id: orderId } })).statusOrder).toBe(
      'dibatalkan',
    );
  });

  it('pembayaran bertahap: tolak kelebihan, lunasi sisa', async () => {
    const agent = await loginAgent();
    const service = await createTestServiceType({ hargaJasa: 30000 });
    const orderId = await createTestOrder(agent);

    await agent.post(`/orders/${orderId}/items`).type('form').send({
      tipeItem: 'jasa',
      serviceTypeId: String(service.id),
      qty: '1',
    });
    await agent.post(`/orders/${orderId}/status`).type('form').send({ status: 'dikerjakan' });
    await agent.post(`/orders/${orderId}/status`).type('form').send({ status: 'selesai' });

    await agent
      .post(`/orders/${orderId}/payment`)
      .type('form')
      .send({ jumlahBayar: '10000', metodeBayar: 'Tunai' });
    let order = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    expect(order.statusOrder).toBe('selesai');

    await agent
      .post(`/orders/${orderId}/payment`)
      .type('form')
      .send({ jumlahBayar: '25000', metodeBayar: 'Tunai' });
    order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    expect(order.payments).toHaveLength(1);
    expect(order.statusOrder).toBe('selesai');

    await agent
      .post(`/orders/${orderId}/payment`)
      .type('form')
      .send({ jumlahBayar: '20000', metodeBayar: 'Tunai' });
    order = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    expect(order.statusOrder).toBe('dibayar');
  });
});
