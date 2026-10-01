import { prisma } from '../config/prisma.js';

export async function getSettings() {
  const existing = await prisma.setting.findFirst({ orderBy: { id: 'asc' } });
  if (existing) return existing;
  return prisma.setting.create({ data: { id: 1, namaBengkel: 'Bengkel Motoworks' } });
}

export async function updateSettings(data) {
  const current = await getSettings();
  return prisma.setting.update({
    where: { id: current.id },
    data: {
      namaBengkel: data.namaBengkel,
      alamat: data.alamat,
      telepon: data.telepon,
      footerNota: data.footerNota,
    },
  });
}
