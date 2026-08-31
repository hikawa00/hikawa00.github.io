(function () {
  const startDate = new Date('2026-03-01T00:00:00+08:00');
  let timerId = null;

  function updateRuntime() {
    const elapsed = Math.max(0, Date.now() - startDate.getTime());
    const day = 24 * 60 * 60 * 1000;
    const hour = 60 * 60 * 1000;
    const minute = 60 * 1000;
    const days = Math.floor(elapsed / day);
    const hours = Math.floor((elapsed % day) / hour);
    const minutes = Math.floor((elapsed % hour) / minute);
    const seconds = Math.floor((elapsed % minute) / 1000);
    const span = document.getElementById('runtime_span');

    if (span) {
      span.textContent = `本站已不间断运行 🚀 ${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒`;
    }
  }

  function initRuntime() {
    updateRuntime();
    if (timerId === null) timerId = window.setInterval(updateRuntime, 1000);
  }

  window.BlogApp.register('runtime', initRuntime);
})();
