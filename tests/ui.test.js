import { describe, it, expect } from 'vitest';
import { app, request, loginAgent } from './helpers.js';

describe('kepatuhan ui', () => {
  it('halaman login tidak mengandung em-dash atau en-dash', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/[—–]/);
  });

  it('halaman 404 tidak mengandung em-dash atau en-dash', async () => {
    const agent = await loginAgent();
    const res = await agent.get('/rute-yang-tidak-ada');
    expect(res.status).toBe(404);
    expect(res.text).not.toMatch(/[—–]/);
  });

  it.each(['/reports/laba-rugi', '/reports/stok', '/reports/kas'])(
    'hanya satu tab sidebar yang aktif di %s',
    async (path) => {
      const agent = await loginAgent();
      const res = await agent.get(path);
      expect(res.status).toBe(200);
      expect(res.text.match(/nav-link-active/g) || []).toHaveLength(1);
    },
  );
});
