import { describe, it, expect } from 'vitest';
import { prisma, createTestSparepart } from './helpers.js';
import { recordStockIn, recordStockOut, recordOpname, StockError } from '../src/services/stock.service.js';

describe('manajemen stok', () => {
  it('stok masuk menambah stok dan mutasi', async () => {
    const part = await createTestSparepart({ stok: 4 });

    await recordStockIn({
      supplierId: null,
      tanggal: new Date(),
      keterangan: 'Uji',
      catatPengeluaran: false,
      items: [{ sparePartId: part.id, qty: 6, hargaBeli: 45000 }],
    });

    const updated = await prisma.sparePart.findUnique({ where: { id: part.id } });
    expect(updated.stokSaatIni).toBe(10);
    expect(updated.hargaBeli).toBe(45000);

    const movement = await prisma.stockMovement.findFirst({
      where: { sparePartId: part.id, tipe: 'masuk' },
      orderBy: { id: 'desc' },
    });
    expect(movement.jumlah).toBe(6);
  });

  it('stok masuk berbayar mencatat pengeluaran otomatis', async () => {
    const part = await createTestSparepart({ stok: 0 });
    const before = await prisma.expense.count();

    await recordStockIn({
      supplierId: null,
      tanggal: new Date(),
      keterangan: 'Uji beli',
      catatPengeluaran: true,
      items: [{ sparePartId: part.id, qty: 2, hargaBeli: 50000 }],
    });

    expect(await prisma.expense.count()).toBe(before + 1);
    const expense = await prisma.expense.findFirst({
      where: { keterangan: 'Uji beli' },
      orderBy: { id: 'desc' },
    });
    expect(expense.jumlah).toBe(100000);
    await prisma.expense.delete({ where: { id: expense.id } });
  });

  it('stok keluar mengurangi stok', async () => {
    const part = await createTestSparepart({ stok: 7 });

    await recordStockOut({ sparePartId: part.id, qty: 3, tanggal: new Date(), keterangan: 'Uji' });

    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(4);
  });

  it('stok keluar melebihi stok ditolak', async () => {
    const part = await createTestSparepart({ stok: 2 });

    await expect(
      recordStockOut({ sparePartId: part.id, qty: 5, tanggal: new Date(), keterangan: 'Uji' }),
    ).rejects.toThrow(StockError);
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(2);
  });

  it('opname menyesuaikan selisih stok', async () => {
    const part = await createTestSparepart({ stok: 10 });

    const changes = await recordOpname({
      tanggal: new Date(),
      items: [{ sparePartId: part.id, stokFisik: 8 }],
    });

    expect(changes).toBe(1);
    expect((await prisma.sparePart.findUnique({ where: { id: part.id } })).stokSaatIni).toBe(8);

    const movement = await prisma.stockMovement.findFirst({
      where: { sparePartId: part.id, tipe: 'keluar' },
      orderBy: { id: 'desc' },
    });
    expect(movement.jumlah).toBe(2);
    expect(movement.keterangan).toContain('opname');
  });
});
