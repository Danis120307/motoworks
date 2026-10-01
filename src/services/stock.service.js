import { prisma } from '../config/prisma.js';

export class StockError extends Error {}

async function ensureStock(tx, sparePartId, qty) {
  const part = await tx.sparePart.findUnique({ where: { id: sparePartId } });
  if (!part) throw new StockError('Sparepart tidak ditemukan.');
  if (part.stokSaatIni < qty) {
    throw new StockError(`Stok ${part.nama} tidak cukup (tersedia ${part.stokSaatIni}, diminta ${qty}).`);
  }
  return part;
}

export async function recordStockIn({ supplierId, tanggal, keterangan, items, catatPengeluaran }) {
  if (!items.length) throw new StockError('Minimal pilih satu sparepart.');

  return prisma.$transaction(async (tx) => {
    let total = 0;

    for (const item of items) {
      const part = await tx.sparePart.update({
        where: { id: item.sparePartId },
        data: {
          stokSaatIni: { increment: item.qty },
          ...(item.hargaBeli !== null && item.hargaBeli !== undefined
            ? { hargaBeli: item.hargaBeli }
            : {}),
        },
      });

      await tx.stockMovement.create({
        data: {
          sparePartId: item.sparePartId,
          supplierId: supplierId ?? null,
          tipe: 'masuk',
          jumlah: item.qty,
          tanggal,
          keterangan: keterangan || 'Pembelian dari supplier',
        },
      });

      total += item.qty * (item.hargaBeli ?? part.hargaBeli);
    }

    if (catatPengeluaran && total > 0) {
      await tx.expense.create({
        data: {
          kategori: 'Belanja Sparepart',
          keterangan: keterangan || `Pembelian stok (${items.length} item)`,
          jumlah: total,
          tanggal,
        },
      });
    }

    return { total, count: items.length };
  });
}

export async function recordStockOut({ sparePartId, qty, tanggal, keterangan }) {
  return prisma.$transaction(async (tx) => {
    await ensureStock(tx, sparePartId, qty);

    await tx.sparePart.update({
      where: { id: sparePartId },
      data: { stokSaatIni: { decrement: qty } },
    });

    return tx.stockMovement.create({
      data: {
        sparePartId,
        tipe: 'keluar',
        jumlah: qty,
        tanggal,
        keterangan: keterangan || 'Pemakaian manual / penjualan langsung',
      },
    });
  });
}

export async function recordOpname({ tanggal, items }) {
  return prisma.$transaction(async (tx) => {
    let changes = 0;

    for (const item of items) {
      const part = await tx.sparePart.findUnique({ where: { id: item.sparePartId } });
      if (!part) continue;

      const selisih = item.stokFisik - part.stokSaatIni;
      if (selisih === 0) continue;

      await tx.stockMovement.create({
        data: {
          sparePartId: part.id,
          tipe: selisih > 0 ? 'masuk' : 'keluar',
          jumlah: Math.abs(selisih),
          tanggal,
          keterangan: `Stok opname (sistem ${part.stokSaatIni} \u2192 fisik ${item.stokFisik})`,
        },
      });

      await tx.sparePart.update({
        where: { id: part.id },
        data: { stokSaatIni: item.stokFisik },
      });

      changes += 1;
    }

    return changes;
  });
}

export async function kartuStok({ sparePartId, start, end }) {
  const part = await prisma.sparePart.findUnique({
    where: { id: sparePartId },
    include: { category: true },
  });
  if (!part) return null;

  const where = { sparePartId };
  if (start || end) {
    where.tanggal = {};
    if (start) where.tanggal.gte = start;
    if (end) where.tanggal.lte = end;
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { supplier: true, serviceOrder: { select: { nomorOrder: true } } },
    orderBy: [{ tanggal: 'asc' }, { id: 'asc' }],
  });

  let saldoAwal = 0;
  if (start) {
    const before = await prisma.stockMovement.findMany({
      where: { sparePartId, tanggal: { lt: start } },
      select: { tipe: true, jumlah: true },
    });
    saldoAwal = before.reduce((acc, m) => acc + (m.tipe === 'masuk' ? m.jumlah : -m.jumlah), 0);
  }

  let saldo = saldoAwal;
  const rows = movements.map((m) => {
    saldo += m.tipe === 'masuk' ? m.jumlah : -m.jumlah;
    return { ...m, saldo };
  });

  return { part, rows, saldoAwal, saldoAkhir: saldo };
}
