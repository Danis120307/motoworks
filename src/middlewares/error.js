export function notFound(req, res) {
  res.status(404).render('errors/404', { title: 'Halaman Tidak Ditemukan', active: null });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).render('errors/500', {
    title: 'Terjadi Kesalahan',
    active: null,
    message: err.expose ? err.message : 'Terjadi kesalahan pada server. Silakan coba lagi.',
  });
}
