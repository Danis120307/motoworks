import request from 'supertest';
import { expect } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

export { app, prisma, request };

export const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export async function loginAgent(email = 'owner@test.local', password = 'rahasia123') {
  const agent = request.agent(app);
  const res = await agent.post('/login').type('form').send({ email, password });

  if (res.status !== 302 || res.headers.location !== '/') {
    throw new Error(`Login gagal: status ${res.status}`);
  }

  return agent;
}

export async function createTestSparepart({ kode, stok = 10, hargaJual = 50000, hargaBeli = 40000 } = {}) {
  const code = kode || `TST-${uid()}`.toUpperCase();
  return prisma.sparePart.create({
    data: {
      kodeItem: code,
      nama: `Sparepart ${code}`,
      satuan: 'pcs',
      hargaBeli,
      hargaJual,
      stokSaatIni: stok,
      stokMinimum: 2,
    },
  });
}

export async function createTestServiceType({ hargaJasa = 25000 } = {}) {
  return prisma.serviceType.create({
    data: { namaLayanan: `Layanan ${uid()}`, hargaJasa },
  });
}

export async function createTestOrder(agent, { customerName = 'Pelanggan Uji' } = {}) {
  const res = await agent
    .post('/orders')
    .type('form')
    .send({ nama: `${customerName} ${uid()}`, keluhan: 'Uji', mekanik: 'Uji' });

  expect(res.status).toBe(302);
  const id = Number(res.headers.location.split('/').pop());
  expect(Number.isFinite(id)).toBe(true);
  return id;
}
