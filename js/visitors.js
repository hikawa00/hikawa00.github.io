/* ============================================
   Visitor Wall JS - 访客墙
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
  initVisitorWall();
  setupPageChangeObserver();
});

// PJAX 切换页面后重新初始化
document.addEventListener('pjax:complete', function() {
  requestAnimationFrame(() => {
    initVisitorWall();
  });
});

// 页面可见性变化时检查是否需要初始化（处理 PJAX 切换后页面未初始化的情况）
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    initVisitorWall();
  }
});

// 使用 MutationObserver 监听页面变化，处理 PJAX 切换
let pageObserver = null;

function setupPageChangeObserver() {
  if (pageObserver) return;

  pageObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 检查是否添加了访客墙容器
          if (node.id === 'visitor-wall-container' || node.querySelector?.('#visitor-wall-container')) {
            requestAnimationFrame(() => {
              initVisitorWall();
            });
          }
        }
      }
    }
  });

  pageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function initVisitorWall() {
  const container = document.getElementById('visitor-wall-container');
  if (!container) return;
  if (container.dataset.initialized === 'true') return;
  container.dataset.initialized = 'true';

  renderAvatarPool();
}

// ============ Waline 配置 ============
const WALINE_SERVER_URL = 'https://blog-visitors-raatnjexj-hikawa00s-projects.vercel.app';
const VISITOR_WALL_PATH = '/visitors/';

// ============ 从 Waline 获取留言数据 ============
async function fetchWalineComments() {
  const url = `${WALINE_SERVER_URL}/api/comment?path=${encodeURIComponent(VISITOR_WALL_PATH)}&pageSize=100`;

  try {
    const res = await fetch(url);
    const result = await res.json();
    const comments = result.data ? result.data.data : [];
    console.log(`[Visitor Wall] Fetched ${comments.length} comments from Waline`);
    return comments;
  } catch (err) {
    console.error('[Visitor Wall] Fetch Error:', err);
    return [];
  }
}

// ============ 渲染头像池 ============
async function renderAvatarPool() {
  const avatarPool = document.getElementById('avatar-pool');
  if (!avatarPool) return;

  avatarPool.innerHTML = '<div class="wall-empty">正在连接监控节点...</div>';

  const comments = await fetchWalineComments();

  if (comments.length === 0) {
    avatarPool.innerHTML = '<div class="wall-empty">暂无访客记录</div>';
    return;
  }

  // 提取唯一访客（去重）
  const uniqueVisitors = {};
  comments.forEach(v => {
    const name = v.nick;
    if (!uniqueVisitors[name]) {
      uniqueVisitors[name] = {
        name: name,
        avatar_url: v.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
      };
    }
  });

  avatarPool.innerHTML = '';
  Object.values(uniqueVisitors).forEach(visitor => {
    const avatarEl = document.createElement('div');
    avatarEl.className = 'visitor-avatar';
    avatarEl.innerHTML = `
      <img src="${escapeHtml(visitor.avatar_url)}" alt="${escapeHtml(visitor.name)}" loading="lazy">
      <span class="avatar-tooltip">${escapeHtml(visitor.name)}</span>
    `;
    avatarPool.appendChild(avatarEl);
  });
}

// ============ 工具函数 ============
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
