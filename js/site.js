/**
 * 站点自定义组件调度器。
 * 所有组件只向 BlogApp 注册初始化函数，由这里统一响应首次加载和 PJAX。
 */
(function () {
  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  window.BlogConfig = Object.freeze({
    apiBase: isLocalPreview
      ? 'http://127.0.0.1:8787'
      : 'https://mange-blog-ai.furongyouxianghong.workers.dev'
  });

  const initializers = new Map();
  let domReady = document.readyState !== 'loading';

  function runOne(name, initialize) {
    try {
      Promise.resolve(initialize()).catch(error => {
        console.error(`[BlogApp] ${name} 初始化失败`, error);
      });
    } catch (error) {
      console.error(`[BlogApp] ${name} 初始化失败`, error);
    }
  }

  function runAll() {
    initializers.forEach((initialize, name) => runOne(name, initialize));
  }

  window.BlogApp = {
    register(name, initialize) {
      if (typeof initialize !== 'function') return;
      initializers.set(name, initialize);
      if (domReady) queueMicrotask(() => runOne(name, initialize));
    },
    refresh: runAll
  };

  if (!domReady) {
    document.addEventListener('DOMContentLoaded', () => {
      domReady = true;
      runAll();
    }, { once: true });
  }

  document.addEventListener('pjax:complete', runAll);
})();
