import { z } from 'zod';

export const requiredText = (label, { max = 120 } = {}) =>
  z
    .string({ required_error: `${label} wajib diisi`, invalid_type_error: `${label} wajib diisi` })
    .trim()
    .min(1, `${label} wajib diisi`)
    .max(max, `${label} maksimal ${max} karakter`);

export const optionalText = ({ max = 255 } = {}) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .transform((v) => (v ? v : null));

export const moneyField = (label) =>
  z.coerce
    .number({ invalid_type_error: `${label} harus berupa angka` })
    .int(`${label} harus bilangan bulat`)
    .min(0, `${label} tidak boleh negatif`);

export const qtyField = (label = 'Jumlah') =>
  z.coerce
    .number({ invalid_type_error: `${label} harus berupa angka` })
    .int(`${label} harus bilangan bulat`)
    .min(1, `${label} minimal 1`);

export const optionalDate = () =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null));

export const firstError = (errors, field) => errors?.[field]?.[0] ?? null;
