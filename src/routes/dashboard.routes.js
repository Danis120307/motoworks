import { Router } from 'express';
import { dashboardData } from '../services/report.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const data = await dashboardData();
  res.render('dashboard/index', {
    title: 'Dashboard',
    active: 'dashboard',
    ...data,
  });
});

export default router;
