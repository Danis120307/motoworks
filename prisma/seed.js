import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const KATEGORI = [
  'Oli & Pelumas',
  'Ban & Velg',
  'Kampas Rem',
  'Aki & Kelistrikan',
  'Mesin & CVT',
  'Rantai & Gear',
  'Filter & Busi',
  'Body & Aksesoris',
];

const SUPPLIER = [
  { nama: 'CV Jaya Motor Parts', kontak: '0812-3456-7890', alamat: 'Jl. Raya Bekasi No. 12' },
  { nama: 'Toko Sparepart Sumber Rejeki', kontak: '0857-1122-3344', alamat: 'Jl. Industri No. 45' },
  { nama: 'Distributor Oli Nusantara', kontak: '021-555-0123', alamat: 'Jl. Mangga Dua Raya No. 8' },
];

const JENIS_LAYANAN = [
  { namaLayanan: 'Ganti Oli Mesin', hargaJasa: 15000 },
  { namaLayanan: 'Servis Ringan (Tune Up)', hargaJasa: 50000 },
  { namaLayanan: 'Servis CVT', hargaJasa: 75000 },
  { namaLayanan: 'Servis Besar (Turun Mesin)', hargaJasa: 350000 },
  { namaLayanan: 'Ganti Kampas Rem', hargaJasa: 25000 },
  { namaLayanan: 'Tambal Ban', hargaJasa: 15000 },
  { namaLayanan: 'Ganti Ban', hargaJasa: 30000 },
  { namaLayanan: 'Servis Kelistrikan', hargaJasa: 40000 },
  { namaLayanan: 'Cuci Motor', hargaJasa: 15000 },
  { namaLayanan: 'Pasang Aksesoris', hargaJasa: 20000 },
];

const SPAREPART = [
  ['OLI-YAM-01', 'Oli Mesin Yamalube Matic 0.8L', 'Oli & Pelumas', 'botol', 38000, 48000, 24, 6],
  ['OLI-MPX-02', 'Oli Mesin MPX2 0.8L', 'Oli & Pelumas', 'botol', 42000, 55000, 18, 6],
  ['OLI-GAR-03', 'Oli Gardan Yamaha 100ml', 'Oli & Pelumas', 'botol', 12000, 18000, 30, 10],
  ['OLI-SHL-04', 'Oli Shell Advance AX7 0.8L', 'Oli & Pelumas', 'botol', 45000, 58000, 3, 6],
  ['BAN-IRCI-01', 'Ban Luar IRC 80/90-14', 'Ban & Velg', 'pcs', 115000, 145000, 8, 2],
  ['BAN-FDR-02', 'Ban Luar FDR 90/90-14', 'Ban & Velg', 'pcs', 135000, 165000, 6, 2],
  ['BAN-DAL-03', 'Ban Dalam 80/90-14', 'Ban & Velg', 'pcs', 25000, 35000, 12, 4],
  ['KMP-DEP-01', 'Kampas Rem Depan Aspira', 'Kampas Rem', 'set', 28000, 40000, 15, 4],
  ['KMP-BLK-02', 'Kampas Rem Belakang Aspira', 'Kampas Rem', 'set', 32000, 45000, 10, 4],
  ['AKI-GS-01', 'Aki GS Astra GTZ5S', 'Aki & Kelistrikan', 'pcs', 185000, 235000, 5, 2],
  ['BUSI-NGK-01', 'Busi NGK CPR9EA-9', 'Filter & Busi', 'pcs', 28000, 40000, 20, 6],
  ['FLT-UD-01', 'Filter Udara Vario 125', 'Filter & Busi', 'pcs', 35000, 50000, 9, 3],
  ['RNT-SSS-01', 'Rantai + Gear Set Vario', 'Rantai & Gear', 'set', 145000, 190000, 4, 2],
  ['VB-CVT-01', 'V-Belt CVT Vario 125', 'Mesin & CVT', 'pcs', 78000, 105000, 7, 3],
  ['ROL-CVT-01', 'Roller CVT Vario 125 (Set)', 'Mesin & CVT', 'set', 45000, 65000, 6, 3],
  ['LMP-LED-01', 'Lampu LED Depan Vario', 'Body & Aksesoris', 'pcs', 65000, 90000, 5, 2],
];

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@motoworks.local';
  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      nama: 'Owner',
      email: ownerEmail,
      passwordHash: await bcrypt.hash(process.env.SEED_OWNER_PASSWORD || 'owner123', 10),
      role: 'owner',
    },
  });

  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      namaBengkel: 'Bengkel Motoworks',
      alamat: 'Jl. Merdeka No. 10, Jakarta',
      telepon: '0812-0000-1234',
      footerNota: 'Terima kasih atas kepercayaan Anda. Garansi jasa 7 hari.',
    },
  });

  if ((await prisma.sparePart.count()) === 0) {
    for (const nama of KATEGORI) {
      await prisma.category.upsert({
        where: { namaKategori: nama },
        update: {},
        create: { namaKategori: nama },
      });
    }

    for (const s of SUPPLIER) {
      const found = await prisma.supplier.findFirst({ where: { nama: s.nama } });
      if (!found) await prisma.supplier.create({ data: s });
    }

    for (const j of JENIS_LAYANAN) {
      const found = await prisma.serviceType.findFirst({ where: { namaLayanan: j.namaLayanan } });
      if (!found) await prisma.serviceType.create({ data: j });
    }

    const categories = await prisma.category.findMany();
    const categoryIdByName = new Map(categories.map((c) => [c.namaKategori, c.id]));

    for (const [kode, nama, kategori, satuan, beli, jual, stok, min] of SPAREPART) {
      const part = await prisma.sparePart.create({
        data: {
          kodeItem: kode,
          nama,
          categoryId: categoryIdByName.get(kategori) ?? null,
          satuan,
          hargaBeli: beli,
          hargaJual: jual,
          stokSaatIni: stok,
          stokMinimum: min,
        },
      });
      await prisma.stockMovement.create({
        data: {
          sparePartId: part.id,
          tipe: 'masuk',
          jumlah: stok,
          keterangan: 'Stok awal (seed)',
        },
      });
    }

    console.log(`Seed selesai: ${KATEGORI.length} kategori, ${JENIS_LAYANAN.length} jenis layanan, ${SPAREPART.length} sparepart.`);
  } else {
    console.log('Data sparepart sudah ada — seed contoh dilewati.');
  }

  console.log(`Akun owner: ${ownerEmail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
