export function parseDateInput(value, fallback = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return fallback;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function parseMonthInput(value, fallback = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return fallback;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

export const startOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const endOfDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

export const endOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

export const startOfYear = (date = new Date()) => new Date(date.getFullYear(), 0, 1);

export const endOfYear = (date = new Date()) =>
  new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

const pad = (n) => String(n).padStart(2, '0');

export const toYmd = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toYm = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const dayKey = (date) => toYmd(date);

export const monthKey = (date) => toYm(date);
