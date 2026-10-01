(() => {
  const table = document.getElementById('stockInRows');
  const template = document.getElementById('stockInRowTemplate');
  const addButton = document.getElementById('addStockInRow');

  if (!table || !template || !addButton) return;

  const bindRow = (row) => {
    const select = row.querySelector('select[name="sparePartId"]');
    const harga = row.querySelector('input[name="hargaBeli"]');

    if (select && harga) {
      select.addEventListener('change', () => {
        const option = select.selectedOptions[0];
        if (option && option.dataset.harga) {
          harga.value = option.dataset.harga;
        }
      });
    }

    const remove = row.querySelector('[data-remove-row]');
    if (remove) {
      remove.addEventListener('click', () => row.remove());
    }
  };

  table.querySelectorAll('tr').forEach(bindRow);

  addButton.addEventListener('click', () => {
    const fragment = template.content.cloneNode(true);
    const row = fragment.querySelector('tr');
    bindRow(row);
    table.appendChild(fragment);
  });
})();
