import { describe, it, expect } from 'vitest';
import { app, request, loginAgent } from './helpers.js';

describe('autentikasi', () => {
  it('mengalihkan tamu ke halaman login', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('menampilkan halaman login', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Masuk');
  });

  it('menolak kredensial yang salah', async () => {
    const res = await request(app)
      .post('/login')
      .type('form')
      .send({ email: 'owner@test.local', password: 'salah' });

    expect(res.status).toBe(401);
    expect(res.text).toContain('Email atau password salah');
  });

  it('login berhasil lalu bisa membuka dashboard', async () => {
    const agent = await loginAgent();
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Dashboard');
  });

  it('logout mengakhiri sesi', async () => {
    const agent = await loginAgent();
    await agent.post('/logout');
    const res = await agent.get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
