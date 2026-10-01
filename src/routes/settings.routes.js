import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { requiredText, optionalText } from '../utils/validators.js';
import { getSettings, updateSettings } from '../services/settings.service.js';
import { toYmd } from '../utils/dates.js';

const router = Router();

const profileSchema = z.object({
  namaBengkel: requiredText('Nama bengkel', { max: 100 }),
  alamat: optionalText({ max: 255 }),
  telepon: optionalText({ max: 30 }),
  footerNota: optionalText({ max: 255 }),
});

router.get('/settings', async (req, res) => {
  const settings = await getSettings();
  res.render('settings/index', {
    title: 'Pengaturan',
    active: 'settings',
    settings,
    errors: {},
    values: settings,
  });
});

router.post('/settings', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  const settings = await getSettings();

  if (!parsed.success) {
    return res.status(422).render('settings/index', {
      title: 'Pengaturan',
      active: 'settings',
      settings,
      errors: parsed.error.flatten().fieldErrors,
      values: req.body,
    });
  }

  await updateSettings(parsed.data);
  res.flash('success', 'Profil bengkel diperbarui.');
  res.redirect('/settings');
});

router.post('/settings/password', async (req, res) => {
  const settings = await getSettings();
  const { oldPassword = '', newPassword = '', confirmPassword = '' } = req.body;
  const errors = {};

  if (!oldPassword) errors.oldPassword = ['Password lama wajib diisi.'];
  if (newPassword.length < 6) errors.newPassword = ['Password baru minimal 6 karakter.'];
  if (newPassword !== confirmPassword) errors.confirmPassword = ['Konfirmasi password tidak sama.'];

  if (Object.keys(errors).length) {
    return res.status(422).render('settings/index', {
      title: 'Pengaturan',
      active: 'settings',
      settings,
      errors,
      values: settings,
    });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = user ? await bcrypt.compare(oldPassword, user.passwordHash) : false;

  if (!valid) {
    return res.status(422).render('settings/index', {
      title: 'Pengaturan',
      active: 'settings',
      settings,
      errors: { oldPassword: ['Password lama salah.'] },
      values: settings,
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  res.flash('success', 'Password berhasil diperbarui.');
  res.redirect('/settings');
});

router.get('/settings/backup', async (req, res) => {
  const tmp = path.join(os.tmpdir(), `motoworks-backup-${Date.now()}.db`);
  const escaped = tmp.replace(/\\/g, '/').replace(/'/g, "''");

  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
    const filename = `motoworks-backup-${toYmd(new Date())}.db`;

    res.download(tmp, filename, (err) => {
      fs.unlink(tmp, () => {});
      if (err && !res.headersSent) res.status(500).end();
    });
  } catch (error) {
    fs.unlink(tmp, () => {});
    console.error(error);
    res.flash('error', 'Gagal membuat backup database.');
    res.redirect('/settings');
  }
});

export default router;
