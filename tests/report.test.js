import { describe, it, expect } from 'vitest';
import { prisma, loginAgent } from './helpers.js';
import { labaRugi, kasReport, stokReport } from '../src/services/report.service.js';
import { startOfYear, endOfYear } from '../src/utils/dates.js';

describe('laporan keuangan', () => {
  it('laba rugi menghitung pendapatan dan pengeluaran', async () => {
    const now = new Date();
    const range = { start: startOfYear(now), end: endOfYear(now) };
    const before = await labaRugi(range);

    const expense = await prisma.expense.create({
      data: { kategori: 'Operasional', keterangan: 'Uji laporan', jumlah: 75000, tanggal: now },
    });

    const after = await labaRugi(range);
    expect(after.totalPengeluaran - before.totalPengeluaran).toBe(75000);
    expect(after.labaBersih).toBe(after.totalPendapatan - after.totalPengeluaran);
    expect(after.expenses.some((e) => e.id === expense.id)).toBe(true);

    await prisma.expense.delete({ where: { id: expense.id } });
  });

  it('halaman laporan dapat diakses', async () => {
    const agent = await loginAgent();
    const year = new Date().getFullYear();

    for (const url of [
      `/reports/laba-rugi?period=tahunan&tahun=${year}`,
      '/reports/stok?period=bulanan',
      '/reports/kas',
    ]) {
      const res = await agent.get(url);
      expect(res.status).toBe(200);
    }
  });

  it('buku kas menghitung saldo berjalan dengan benar', async () => {
    const kas = await kasReport(new Date());
    expect(kas.saldoAkhir).toBe(kas.saldoAwal + kas.totalMasuk - kas.totalKeluar);
  });

  it('laporan stok menghitung nilai stok', async () => {
    const stock = await stokReport();
    const expected = stock.parts.reduce((acc, p) => acc + p.stokSaatIni * p.hargaBeli, 0);
    expect(stock.nilaiStok).toBe(expected);
    expect(stock.menipis.every((p) => p.stokSaatIni <= p.stokMinimum)).toBe(true);
  });
});
