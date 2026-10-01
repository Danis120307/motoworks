(() => {
  const data = window.__CHART__;
  if (!data || typeof Chart === 'undefined') return;

  const mono = "'IBM Plex Mono', ui-monospace, monospace";

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#b9b9b9', font: { family: mono, size: 11 }, boxWidth: 12, boxHeight: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#8b8b8b', font: { family: mono, size: 10 } },
        grid: { color: '#212121' },
      },
      y: {
        ticks: { color: '#8b8b8b', font: { family: mono, size: 10 } },
        grid: { color: '#212121' },
      },
    },
  };

  const render = (id, dataset) => {
    const el = document.getElementById(id);
    if (!el || !dataset) return;

    new Chart(el, {
      type: 'bar',
      data: {
        labels: dataset.labels,
        datasets: [
          {
            label: 'Pendapatan',
            data: dataset.pendapatan,
            backgroundColor: '#f36458',
            borderRadius: 3,
          },
          {
            label: 'Pengeluaran',
            data: dataset.pengeluaran,
            backgroundColor: '#0052ef',
            borderRadius: 3,
          },
        ],
      },
      options,
    });
  };

  render('chart30', data.chart30);
  render('chartBulanan', data.chartBulanan);
})();
