const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const tanggal = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
const tanggalWaktu = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const bulanTahun = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const hariLengkap = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' });

export const formatRupiah = (value) => rupiah.format(Number(value) || 0);

export const formatAngka = (value) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

export const formatTanggal = (value) => (value ? tanggal.format(new Date(value)) : '-');

export const formatTanggalWaktu = (value) => (value ? tanggalWaktu.format(new Date(value)) : '-');

export const formatBulan = (value) => (value ? bulanTahun.format(new Date(value)) : '-');

export const formatHariLengkap = (value) => (value ? hariLengkap.format(new Date(value)) : '-');

const STATUS_LABELS = {
  menunggu: 'Menunggu',
  dikerjakan: 'Dikerjakan',
  selesai: 'Selesai',
  dibayar: 'Dibayar',
  dibatalkan: 'Dibatalkan',
};

const STATUS_BADGES = {
  menunggu: 'bg-warning/15 text-warning',
  dikerjakan: 'bg-info/15 text-info',
  selesai: 'bg-primary/15 text-primary',
  dibayar: 'bg-success/15 text-success',
  dibatalkan: 'bg-danger/15 text-danger',
};

export const statusLabel = (status) => STATUS_LABELS[status] ?? status;

export const statusBadgeClass = (status) => STATUS_BADGES[status] ?? 'bg-canvas text-body';

export const movementBadgeClass = (tipe) =>
  tipe === 'masuk' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger';
