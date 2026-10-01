import { prisma } from '../config/prisma.js';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  toYmd,
  toYm,
  parseDateInput,
  parseMonthInput,
  dayKey,
  monthKey,
} from '../utils/dates.js';

export function resolvePeriod(query = {}) {
  const now = new Date();
  const period = ['harian', 'bulanan', 'tahunan', 'custom'].includes(query.period)
    ? query.period
    : 'bulanan';

  if (period === 'harian') {
    const d = parseDateInput(query.tanggal, now);
    return { period, start: startOfDay(d), end: endOfDay(d), tanggal: toYmd(d) };
  }

  if (period === 'tahunan') {
    const tahun = Number(query.tahun) || now.getFullYear();
    const d = new Date(tahun, 0, 1);
    return { period, start: startOfYear(d), end: endOfYear(d), tahun };
  }

  if (period === 'custom') {
    const start = startOfDay(parseDateInput(query.start, now));
    const end = endOfDay(parseDateInput(query.end, now));
    return { period, start, end, startStr: toYmd(start), endStr: toYmd(end) };
  }

  const bulanDate = query.bulan ? parseMonthInput(query.bulan, now) : now;
  return {
    period: 'bulanan',
    start: startOfMonth(bulanDate),
    end: endOfMonth(bulanDate),
    bulan: toYm(bulanDate),
  };
}

export async function labaRugi({ start, end }) {
  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { tanggalBayar: { gte: start, lte: end } },
      include: {
        serviceOrder: {
          select: { nomorOrder: true, customer: { select: { nama: true } } },
        },
      },
      orderBy: { tanggalBayar: 'asc' },
    }),
    prisma.expense.findMany({
      where: { tanggal: { gte: start, lte: end } },
      orderBy: { tanggal: 'asc' },
    }),
  ]);

  const totalPendapatan = payments.reduce((acc, p) => acc + p.jumlahBayar, 0);
  const totalPengeluaran = expenses.reduce((acc, e) => acc + e.jumlah, 0);

  const groupByMonth = end.getTime() - start.getTime() > 62 * 24 * 60 * 60 * 1000;
  const keyFn = groupByMonth ? monthKey : dayKey;
  const map = new Map();

  for (const p of payments) {
    const k = keyFn(p.tanggalBayar);
    const row = map.get(k) ?? { key: k, pendapatan: 0, pengeluaran: 0 };
    row.pendapatan += p.jumlahBayar;
    map.set(k, row);
  }
  for (const e of expenses) {
    const k = keyFn(e.tanggal);
    const row = map.get(k) ?? { key: k, pendapatan: 0, pengeluaran: 0 };
    row.pengeluaran += e.jumlah;
    map.set(k, row);
  }

  const breakdown = [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((row) => ({ ...row, selisih: row.pendapatan - row.pengeluaran }));

  return {
    payments,
    expenses,
    totalPendapatan,
    totalPengeluaran,
    labaBersih: totalPendapatan - totalPengeluaran,
    breakdown,
    groupByMonth,
  };
}

export async function itemTerlaris({ start, end, take = 10 }) {
  const orderWhere = {
    serviceOrder: {
      tanggalMasuk: { gte: start, lte: end },
      statusOrder: { not: 'dibatalkan' },
    },
  };

  const [spareparts, jasa] = await Promise.all([
    prisma.serviceOrderItem.groupBy({
      by: ['sparePartId'],
      where: { tipeItem: 'sparepart', ...orderWhere },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { qty: 'desc' } },
      take,
    }),
    prisma.serviceOrderItem.groupBy({
      by: ['serviceTypeId'],
      where: { tipeItem: 'jasa', ...orderWhere },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { qty: 'desc' } },
      take,
    }),
  ]);

  const partIds = spareparts.map((r) => r.sparePartId).filter(Boolean);
  const typeIds = jasa.map((r) => r.serviceTypeId).filter(Boolean);

  const [parts, types] = await Promise.all([
    prisma.sparePart.findMany({
      where: { id: { in: partIds } },
      select: { id: true, nama: true, kodeItem: true },
    }),
    prisma.serviceType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, namaLayanan: true },
    }),
  ]);

  const partMap = new Map(parts.map((p) => [p.id, p]));
  const typeMap = new Map(types.map((t) => [t.id, t]));

  return {
    spareparts: spareparts.map((r) => ({
      nama: partMap.get(r.sparePartId)?.nama ?? '-',
      kode: partMap.get(r.sparePartId)?.kodeItem ?? '-',
      qty: r._sum.qty ?? 0,
      subtotal: r._sum.subtotal ?? 0,
    })),
    jasa: jasa.map((r) => ({
      nama: typeMap.get(r.serviceTypeId)?.namaLayanan ?? '-',
      qty: r._sum.qty ?? 0,
      subtotal: r._sum.subtotal ?? 0,
    })),
  };
}

export async function stokReport() {
  const parts = await prisma.sparePart.findMany({
    include: { category: true },
    orderBy: { nama: 'asc' },
  });

  const nilaiStok = parts.reduce((acc, p) => acc + p.stokSaatIni * p.hargaBeli, 0);
  const nilaiJual = parts.reduce((acc, p) => acc + p.stokSaatIni * p.hargaJual, 0);
  const menipis = parts
    .filter((p) => p.stokSaatIni <= p.stokMinimum)
    .sort((a, b) => a.stokSaatIni - b.stokSaatIni);

  return {
    parts,
    nilaiStok,
    nilaiJual,
    potensiMargin: nilaiJual - nilaiStok,
    menipis,
    totalItem: parts.length,
    totalQty: parts.reduce((acc, p) => acc + p.stokSaatIni, 0),
  };
}

export async function kasReport(day) {
  const start = startOfDay(day);
  const end = endOfDay(day);

  const [payments, expenses, pastPayments, pastExpenses] = await Promise.all([
    prisma.payment.findMany({
      where: { tanggalBayar: { gte: start, lte: end } },
      include: { serviceOrder: { select: { nomorOrder: true } } },
      orderBy: { tanggalBayar: 'asc' },
    }),
    prisma.expense.findMany({
      where: { tanggal: { gte: start, lte: end } },
      orderBy: { tanggal: 'asc' },
    }),
    prisma.payment.aggregate({
      _sum: { jumlahBayar: true },
      where: { tanggalBayar: { lt: start } },
    }),
    prisma.expense.aggregate({
      _sum: { jumlah: true },
      where: { tanggal: { lt: start } },
    }),
  ]);

  const saldoAwal = (pastPayments._sum.jumlahBayar || 0) - (pastExpenses._sum.jumlah || 0);

  const entries = [
    ...payments.map((p) => ({
      tanggal: p.tanggalBayar,
      tipe: 'masuk',
      keterangan: `Pembayaran ${p.serviceOrder?.nomorOrder ?? '-'} (${p.metodeBayar || 'Tunai'})`,
      jumlah: p.jumlahBayar,
    })),
    ...expenses.map((e) => ({
      tanggal: e.tanggal,
      tipe: 'keluar',
      keterangan: `${e.kategori}${e.keterangan ? ` \u2014 ${e.keterangan}` : ''}`,
      jumlah: e.jumlah,
    })),
  ].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

  let saldo = saldoAwal;
  const rows = entries.map((e) => {
    saldo += e.tipe === 'masuk' ? e.jumlah : -e.jumlah;
    return { ...e, saldo };
  });

  const totalMasuk = payments.reduce((acc, p) => acc + p.jumlahBayar, 0);
  const totalKeluar = expenses.reduce((acc, e) => acc + e.jumlah, 0);

  return {
    start,
    end,
    saldoAwal,
    rows,
    totalMasuk,
    totalKeluar,
    saldoAkhir: saldo,
  };
}

const monthShort = new Intl.DateTimeFormat('id-ID', { month: 'short' });

export async function dashboardData() {
  const now = new Date();

  const [
    payToday,
    payMonth,
    expMonth,
    orderAktif,
    parts,
    recentOrders,
    topItems,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { jumlahBayar: true },
      where: { tanggalBayar: { gte: startOfDay(now), lte: endOfDay(now) } },
    }),
    prisma.payment.aggregate({
      _sum: { jumlahBayar: true },
      where: { tanggalBayar: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    }),
    prisma.expense.aggregate({
      _sum: { jumlah: true },
      where: { tanggal: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    }),
    prisma.serviceOrder.count({ where: { statusOrder: { in: ['menunggu', 'dikerjakan'] } } }),
    prisma.sparePart.findMany({ select: { stokSaatIni: true, stokMinimum: true } }),
    prisma.serviceOrder.findMany({
      orderBy: { tanggalMasuk: 'desc' },
      take: 6,
      include: { customer: true, payments: true },
    }),
    itemTerlaris({ start: startOfMonth(now), end: endOfMonth(now), take: 5 }),
  ]);

  const start30 = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));

  const [p30, e30, pYear, eYear] = await Promise.all([
    prisma.payment.findMany({
      where: { tanggalBayar: { gte: start30 } },
      select: { tanggalBayar: true, jumlahBayar: true },
    }),
    prisma.expense.findMany({
      where: { tanggal: { gte: start30 } },
      select: { tanggal: true, jumlah: true },
    }),
    prisma.payment.findMany({
      where: { tanggalBayar: { gte: startOfYear(now), lte: endOfYear(now) } },
      select: { tanggalBayar: true, jumlahBayar: true },
    }),
    prisma.expense.findMany({
      where: { tanggal: { gte: startOfYear(now), lte: endOfYear(now) } },
      select: { tanggal: true, jumlah: true },
    }),
  ]);

  const days = [];
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(start30.getFullYear(), start30.getMonth(), start30.getDate() + i);
    days.push({ key: dayKey(d), label: `${d.getDate()}/${d.getMonth() + 1}`, pendapatan: 0, pengeluaran: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.key, d]));
  for (const p of p30) {
    const row = dayMap.get(dayKey(p.tanggalBayar));
    if (row) row.pendapatan += p.jumlahBayar;
  }
  for (const e of e30) {
    const row = dayMap.get(dayKey(e.tanggal));
    if (row) row.pengeluaran += e.jumlah;
  }

  const months = [];
  for (let m = 0; m < 12; m += 1) {
    const d = new Date(now.getFullYear(), m, 1);
    months.push({ key: monthKey(d), label: monthShort.format(d), pendapatan: 0, pengeluaran: 0 });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));
  for (const p of pYear) {
    const row = monthMap.get(monthKey(p.tanggalBayar));
    if (row) row.pendapatan += p.jumlahBayar;
  }
  for (const e of eYear) {
    const row = monthMap.get(monthKey(e.tanggal));
    if (row) row.pengeluaran += e.jumlah;
  }

  return {
    pendapatanHariIni: payToday._sum.jumlahBayar || 0,
    pendapatanBulanIni: payMonth._sum.jumlahBayar || 0,
    pengeluaranBulanIni: expMonth._sum.jumlah || 0,
    labaBulanIni: (payMonth._sum.jumlahBayar || 0) - (expMonth._sum.jumlah || 0),
    orderAktif,
    lowStock: parts.filter((p) => p.stokSaatIni <= p.stokMinimum).length,
    recentOrders,
    topItems,
    chart30: {
      labels: days.map((d) => d.label),
      pendapatan: days.map((d) => d.pendapatan),
      pengeluaran: days.map((d) => d.pengeluaran),
    },
    chartBulanan: {
      labels: months.map((m) => m.label),
      pendapatan: months.map((m) => m.pendapatan),
      pengeluaran: months.map((m) => m.pengeluaran),
    },
  };
}
