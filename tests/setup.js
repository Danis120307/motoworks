process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

await prisma.user.upsert({
  where: { email: 'owner@test.local' },
  update: {},
  create: {
    nama: 'Owner Test',
    email: 'owner@test.local',
    passwordHash: await bcrypt.hash('rahasia123', 10),
    role: 'owner',
  },
});

await prisma.setting.upsert({
  where: { id: 1 },
  update: {},
  create: { id: 1, namaBengkel: 'Bengkel Test' },
});

await prisma.$disconnect();
