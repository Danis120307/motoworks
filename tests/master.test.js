import { describe, it, expect } from 'vitest';
import { prisma, loginAgent, uid } from './helpers.js';

describe('master data', () => {
  it('membuat kategori baru', async () => {
    const agent = await loginAgent();
    const nama = `Kategori ${uid()}`;

    const res = await agent.post('/categories').type('form').send({ namaKategori: nama });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/categories');

    const found = await prisma.category.findUnique({ where: { namaKategori: nama } });
    expect(found).not.toBeNull();
  });

  it('menolak kategori duplikat', async () => {
    const agent = await loginAgent();
    const nama = `Kategori ${uid()}`;
    await agent.post('/categories').type('form').send({ namaKategori: nama });

    const res = await agent.post('/categories').type('form').send({ namaKategori: nama });
    expect(res.status).toBe(422);
    expect(res.text).toContain('sudah ada');
  });

  it('menolak kategori tanpa nama', async () => {
    const agent = await loginAgent();
    const res = await agent.post('/categories').type('form').send({ namaKategori: '' });
    expect(res.status).toBe(422);
    expect(res.text).toContain('wajib diisi');
  });

  it('membuat sparepart dengan kode unik', async () => {
    const agent = await loginAgent();
    const kode = `TST-${uid()}`.toUpperCase();

    const res = await agent.post('/spareparts').type('form').send({
      kodeItem: kode,
      nama: 'Oli Uji',
      categoryId: '',
      satuan: 'botol',
      hargaBeli: '38000',
      hargaJual: '48000',
      stokMinimum: '5',
      stokAwal: '10',
    });

    expect(res.status).toBe(302);

    const part = await prisma.sparePart.findUnique({ where: { kodeItem: kode } });
    expect(part).not.toBeNull();
    expect(part.stokSaatIni).toBe(10);

    const movement = await prisma.stockMovement.findFirst({
      where: { sparePartId: part.id, tipe: 'masuk' },
    });
    expect(movement).not.toBeNull();
    expect(movement.jumlah).toBe(10);
  });

  it('menolak kode sparepart duplikat', async () => {
    const agent = await loginAgent();
    const kode = `TST-${uid()}`.toUpperCase();
    const payload = {
      kodeItem: kode,
      nama: 'Part A',
      satuan: 'pcs',
      hargaBeli: '1000',
      hargaJual: '2000',
      stokMinimum: '1',
      stokAwal: '0',
    };

    await agent.post('/spareparts').type('form').send(payload);
    const res = await agent.post('/spareparts').type('form').send(payload);
    expect(res.status).toBe(422);
    expect(res.text).toContain('sudah dipakai');
  });

  it('membuat supplier, jenis layanan, dan pelanggan', async () => {
    const agent = await loginAgent();
    const suffix = uid();

    const supplier = await agent
      .post('/suppliers')
      .type('form')
      .send({ nama: `Supplier ${suffix}`, kontak: '0811', alamat: 'Jl. Uji' });
    expect(supplier.status).toBe(302);

    const service = await agent
      .post('/service-types')
      .type('form')
      .send({ namaLayanan: `Layanan ${suffix}`, hargaJasa: '25000' });
    expect(service.status).toBe(302);

    const customer = await agent
      .post('/customers')
      .type('form')
      .send({ nama: `Plg ${suffix}`, platMotor: 'B 1 UJI' });
    expect(customer.status).toBe(302);
  });
});
