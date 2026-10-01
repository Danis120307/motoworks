import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { loadUser, requireAuth } from './middlewares/auth.js';
import { flashMiddleware } from './middlewares/flash.js';
import { commonLocals } from './middlewares/common.js';
import { loadBadges } from './middlewares/badges.js';
import { notFound, errorHandler } from './middlewares/error.js';

import {
  formatRupiah,
  formatAngka,
  formatTanggal,
  formatTanggalWaktu,
  formatBulan,
  formatHariLengkap,
  statusLabel,
  statusBadgeClass,
  movementBadgeClass,
} from './utils/format.js';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, ORDER_STATUSES } from './utils/constants.js';

import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import serviceTypesRoutes from './routes/service-types.routes.js';
import customersRoutes from './routes/customers.routes.js';
import sparepartsRoutes from './routes/spareparts.routes.js';
import stockRoutes from './routes/stock.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import settingsRoutes from './routes/settings.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  '/vendor/chartjs',
  express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist')),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(flashMiddleware);
app.use(loadUser);
app.use(commonLocals);
app.use(loadBadges);

app.locals.formatRupiah = formatRupiah;
app.locals.formatAngka = formatAngka;
app.locals.formatTanggal = formatTanggal;
app.locals.formatTanggalWaktu = formatTanggalWaktu;
app.locals.formatBulan = formatBulan;
app.locals.formatHariLengkap = formatHariLengkap;
app.locals.statusLabel = statusLabel;
app.locals.statusBadgeClass = statusBadgeClass;
app.locals.movementBadgeClass = movementBadgeClass;
app.locals.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
app.locals.PAYMENT_METHODS = PAYMENT_METHODS;
app.locals.ORDER_STATUSES = ORDER_STATUSES;

app.use('/', authRoutes);

const protectedRouters = [
  dashboardRoutes,
  categoriesRoutes,
  suppliersRoutes,
  serviceTypesRoutes,
  customersRoutes,
  sparepartsRoutes,
  stockRoutes,
  ordersRoutes,
  expensesRoutes,
  reportsRoutes,
  settingsRoutes,
];

for (const router of protectedRouters) {
  app.use('/', requireAuth, router);
}

app.use(notFound);
app.use(errorHandler);
