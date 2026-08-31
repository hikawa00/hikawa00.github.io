/**
 * 访客墙评论。仅进入 /visitors/ 时按需加载 Waline，离开页面时销毁实例。
 */
(function () {
  const WALINE_CSS = 'https://unpkg.com/@waline/client@3/dist/waline.css';
  const WALINE_JS = 'https://unpkg.com/@waline/client@3/dist/waline.js';
  let walineInstance = null;
  let activeElement = null;
  let walineModulePromise = null;

  function ensureStylesheet() {
    if (document.querySelector(`link[href="${WALINE_CSS}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = WALINE_CSS;
    document.head.appendChild(link);
  }

  function destroyWaline() {
    walineInstance?.destroy?.();
    walineInstance = null;
    activeElement = null;
  }

  async function initVisitorComments() {
    const element = document.getElementById('waline-wrap');
    if (!element) {
      destroyWaline();
      return;
    }
    if (activeElement === element && walineInstance) return;

    destroyWaline();
    ensureStylesheet();
    walineModulePromise ||= import(WALINE_JS);
    const { init } = await walineModulePromise;

    walineInstance = init({
      el: element,
      serverURL: 'https://blog-visitors-raatnjexj-hikawa00s-projects.vercel.app',
      path: '/visitors/',
      lang: 'zh-CN',
      dark: 'html[data-theme="dark"]',
      login: 'force',
      comment: true,
      requiredMeta: ['nick', 'mail'],
      placeholder: '[WAITING_FOR_INPUT] 期待你的指令...',
      emoji: ['//unpkg.com/@waline/emojis@1.1.0/tieba']
    });
    activeElement = element;
  }

  window.BlogApp.register('visitorComments', initVisitorComments);
})();
