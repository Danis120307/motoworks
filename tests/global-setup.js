import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export default async function setup() {
  const dbFile = path.join(process.cwd(), 'prisma', 'test.db');
  fs.rmSync(dbFile, { force: true });

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  return async () => {};
}
