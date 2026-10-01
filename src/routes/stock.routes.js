import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { toArray, toInt, toNullableInt, trimmed } from '../utils/parse.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { parseDateInput, startOfDay, endOfDay, toYmd } from '../utils/dates.js';
import { recordStockIn, recordStockOut, recordOpname, StockError } from '../services/stock.service.js';

const router = Router();

const listSuppliers = () => prisma.supplier.findMany({ orderBy: { nama: 'asc' } });
const listParts = () =>
  prisma.sparePart.findMany({ include: { category: true }, orderBy: { nama: 'asc' } });

const emptyRow = () => ({ sparePartId: '', qty: '', hargaBeli: '' });

router.get('/stock', async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const tipe = ['masuk', 'keluar'].includes(req.query.tipe) ? req.query.tipe : null;
  const start = req.query.start ? startOfDay(parseDateInput(req.query.start)) : null;
  const end = req.query.end ? endOfDay(parseDateInput(req.query.end)) : null;

  const where = {
    ...(tipe ? { tipe } : {}),
    ...(start || end
      ? { tanggal: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
      : {}),
  };

  const [total, movements, allParts] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        sparePart: true,
        supplier: true,
        serviceOrder: { select: { nomorOrder: true } },
      },
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    }),
    listParts(),
  ]);

  const lowStock = allParts.filter((p) => p.stokSaatIni <= p.stokMinimum);

  res.render('stock/index', {
    title: 'Stok Sparepart',
    active: 'stock',
    movements,
    lowStock,
    filters: { tipe: tipe || '', start: req.query.start || '', end: req.query.end || '' },
    pagination: paginationMeta(total, { page, limit }),
  });
});

router.get('/stock/masuk', async (req, res) => {
  const [suppliers, parts] = await Promise.all([listSuppliers(), listParts()]);
  res.render('stock/masuk', {
    title: 'Stok Masuk',
    active: 'stock',
    suppliers,
    parts,
    rows: [emptyRow(), emptyRow(), emptyRow()],
    values: { supplierId: '', tanggal: toYmd(new Date()), keterangan: '', catatPengeluaran: true },
    errors: {},
  });
});

router.post('/stock/masuk', async (req, res) => {
  const ids = toArray(req.body.sparePartId);
  const qtys = toArray(req.body.qty);
  const hargas = toArray(req.body.hargaBeli);

  const rows = ids
    .map((id, i) => ({ sparePartId: id, qty: qtys[i] ?? '', hargaBeli: hargas[i] ?? '' }))
    .filter((r) => r.sparePartId || r.qty !== '' || r.hargaBeli !== '');
  if (!rows.length) rows.push(emptyRow());

  const values = {
    supplierId: req.body.supplierId || '',
    tanggal: req.body.tanggal || toYmd(new Date()),
    keterangan: req.body.keterangan || '',
    catatPengeluaran: req.body.catatPengeluaran === '1' || req.body.catatPengeluaran === 'on',
  };

  const messages = [];
  const items = [];

  rows.forEach((r, i) => {
    const id = toNullableInt(r.sparePartId);
    if (!id) {
      messages.push(`Baris ${i + 1}: pilih sparepart.`);
      return;
    }
    const qty = toInt(r.qty, 0);
    if (qty < 1) {
      messages.push(`Baris ${i + 1}: jumlah minimal 1.`);
      return;
    }
    items.push({ sparePartId: id, qty, hargaBeli: Math.max(0, toInt(r.hargaBeli, 0)) });
  });

  if (messages.length || !items.length) {
    const [suppliers, parts] = await Promise.all([listSuppliers(), listParts()]);
    return res.status(422).render('stock/masuk', {
      title: 'Stok Masuk',
      active: 'stock',
      suppliers,
      parts,
      rows,
      values,
      errors: { items: messages.length ? messages : ['Minimal pilih satu sparepart.'] },
    });
  }

  try {
    const result = await recordStockIn({
      supplierId: toNullableInt(values.supplierId),
      tanggal: parseDateInput(values.tanggal),
      keterangan: trimmed(values.keterangan),
      items,
      catatPengeluaran: values.catatPengeluaran,
    });

    res.flash(
      'success',
      `Stok masuk dicatat: ${result.count} item${values.catatPengeluaran ? ' (pengeluaran otomatis tercatat)' : ''}.`,
    );
    res.redirect('/stock');
  } catch (err) {
    if (!(err instanceof StockError)) throw err;
    const [suppliers, parts] = await Promise.all([listSuppliers(), listParts()]);
    res.status(422).render('stock/masuk', {
      title: 'Stok Masuk',
      active: 'stock',
      suppliers,
      parts,
      rows,
      values,
      errors: { items: [err.message] },
    });
  }
});

router.get('/stock/keluar', async (req, res) => {
  const parts = await listParts();
  res.render('stock/keluar', {
    title: 'Stok Keluar',
    active: 'stock',
    parts,
    values: { tanggal: toYmd(new Date()) },
    errors: {},
  });
});

router.post('/stock/keluar', async (req, res) => {
  const values = {
    sparePartId: req.body.sparePartId || '',
    qty: req.body.qty || '',
    tanggal: req.body.tanggal || toYmd(new Date()),
    keterangan: req.body.keterangan || '',
  };

  const sparePartId = toNullableInt(values.sparePartId);
  const qty = toInt(values.qty, 0);

  try {
    if (!sparePartId) throw new StockError('Pilih sparepart terlebih dahulu.');
    if (qty < 1) throw new StockError('Jumlah minimal 1.');

    await recordStockOut({
      sparePartId,
      qty,
      tanggal: parseDateInput(values.tanggal),
      keterangan: trimmed(values.keterangan),
    });

    res.flash('success', 'Stok keluar dicatat.');
    res.redirect('/stock');
  } catch (err) {
    if (!(err instanceof StockError)) throw err;
    const parts = await listParts();
    res.status(422).render('stock/keluar', {
      title: 'Stok Keluar',
      active: 'stock',
      parts,
      values,
      errors: { form: [err.message] },
    });
  }
});

router.get('/stock/opname', async (req, res) => {
  const parts = await listParts();
  res.render('stock/opname', {
    title: 'Stok Opname',
    active: 'stock',
    parts,
    values: { tanggal: toYmd(new Date()) },
  });
});

router.post('/stock/opname', async (req, res) => {
  const ids = toArray(req.body.sparePartId);
  const fisik = toArray(req.body.stokFisik);
  const items = [];

  for (let i = 0; i < ids.length; i += 1) {
    const id = toNullableInt(ids[i]);
    const raw = fisik[i];
    if (!id || raw === '' || raw === undefined) continue;
    const stokFisik = toInt(raw, -1);
    if (stokFisik < 0) continue;
    items.push({ sparePartId: id, stokFisik });
  }

  const changes = await recordOpname({
    tanggal: parseDateInput(req.body.tanggal),
    items,
  });

  res.flash(
    'success',
    changes > 0 ? `${changes} item disesuaikan dari hasil opname.` : 'Tidak ada selisih stok.',
  );
  res.redirect('/stock/opname');
});

export default router;
