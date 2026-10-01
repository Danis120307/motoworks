(() => {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
    });
  }

  const nav = document.getElementById('sidebarNav');
  if (nav) {
    const storageKey = 'motoworks:sidebar-scroll';
    const saved = window.sessionStorage.getItem(storageKey);

    if (saved !== null && saved !== '') {
      nav.scrollTop = Number(saved) || 0;
    } else {
      const activeLink = nav.querySelector('.nav-link-active');
      if (activeLink) {
        nav.scrollTop = Math.max(
          0,
          activeLink.offsetTop - nav.clientHeight / 2 + activeLink.offsetHeight / 2,
        );
      }
    }

    let scheduled = false;
    nav.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        window.sessionStorage.setItem(storageKey, String(nav.scrollTop));
        scheduled = false;
      });
    });
  }

  document.addEventListener('submit', (event) => {
    const el = event.target.querySelector('[data-confirm]');
    if (el && !window.confirm(el.dataset.confirm)) {
      event.preventDefault();
    }
  });
})();
