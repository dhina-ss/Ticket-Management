// ── Theme toggle ──────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('cm-theme', next);
  updateThemeIcon(next);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  const btn  = document.getElementById('themeToggle');
  if (!icon) return;
  if (theme === 'dark') {
    icon.className = 'bi bi-sun-fill';
    if (btn) btn.title = 'Switch to Light mode';
  } else {
    icon.className = 'bi bi-moon-fill';
    if (btn) btn.title = 'Switch to Dark mode';
  }
}

// Auto-dismiss alerts after 5 seconds
document.addEventListener('DOMContentLoaded', () => {
  // Sync icon with current theme on every page load
  updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'dark');
  document.querySelectorAll('.alert.alert-dismissible').forEach(el => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
      if (bsAlert) bsAlert.close();
    }, 5000);
  });

  // Bootstrap form validation
  document.querySelectorAll('.needs-validation').forEach(form => {
    form.addEventListener('submit', e => {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      form.classList.add('was-validated');
    });
  });

  // Uppercase branch code input
  const codeInput = document.querySelector('input[name="code"]');
  if (codeInput) codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase(); });

  // Row click → view detail (courier list)
  document.querySelectorAll('table.table-hover tbody tr[data-href]').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', e => {
      if (!e.target.closest('a,button,form')) window.location = row.dataset.href;
    });
  });
});
