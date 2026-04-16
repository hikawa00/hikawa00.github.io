/* ============================================
   Visitor Wall JS - 访客墙
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
  initVisitorWall();
});

// PJAX 切换页面后重新初始化
document.addEventListener('pjax:complete', function() {
  // 延迟一下确保 DOM 就绪
  requestAnimationFrame(() => {
    initVisitorWall();
  });
});

function initVisitorWall() {
  // 检查页面是否包含访客墙容器
  const container = document.getElementById('visitor-wall-container');
  if (!container) return;

  // 防止重复初始化
  if (container.dataset.initialized) return;
  container.dataset.initialized = 'true';

  renderVisitorWall();
}

// ============ Waline 配置 ============
const WALINE_SERVER_URL = 'https://blog-visitors-raatnjexj-hikawa00s-projects.vercel.app';
const VISITOR_WALL_PATH = '/visitors/';

// ============ 从 Waline 获取留言数据 ============
async function fetchWalineComments() {
  try {
    const res = await fetch(`${WALINE_SERVER_URL}/api/comment?type=visitor&path=${VISITOR_WALL_PATH}`);
    const data = await res.json();

    if (data.data && Array.isArray(data.data)) {
      return data.data.map(comment => ({
        id: comment.objectId || comment.id,
        name: comment.nick,
        avatar_url: comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.nick)}`,
        content: comment.comment,
        date: comment.insertedAt || comment.createdAt || new Date().toISOString()
      }));
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch Waline comments:', err);
    return [];
  }
}

// ============ 渲染函数 ============
async function renderVisitorWall() {
  const avatarPool = document.getElementById('avatar-pool');
  const messageStream = document.getElementById('message-stream');

  if (!avatarPool || !messageStream) return;

  // 显示加载状态
  avatarPool.innerHTML = '<div class="wall-empty">正在连接监控节点...</div>';
  messageStream.innerHTML = '<div class="wall-empty">正在获取访客数据...</div>';

  // 从 Waline 获取数据
  const comments = await fetchWalineComments();

  // 如果没有数据，显示空状态
  if (comments.length === 0) {
    avatarPool.innerHTML = '<div class="wall-empty">暂无访客记录</div>';
    messageStream.innerHTML = '<div class="wall-empty">暂无留言，成为第一位访客吧</div>';
    return;
  }

  // 1. 提取唯一访客（去重）
  const uniqueVisitors = {};
  comments.forEach(v => {
    if (!uniqueVisitors[v.name]) {
      uniqueVisitors[v.name] = v;
    }
  });

  // 2. 渲染头像池
  avatarPool.innerHTML = '';
  Object.values(uniqueVisitors).forEach(visitor => {
    const avatarEl = document.createElement('div');
    avatarEl.className = 'visitor-avatar';
    avatarEl.innerHTML = `
      <img src="${visitor.avatar_url}" alt="${escapeHtml(visitor.name)}" loading="lazy">
      <span class="avatar-tooltip">${escapeHtml(visitor.name)}</span>
    `;
    avatarPool.appendChild(avatarEl);
  });

  // 3. 渲染留言流（按日期倒序）
  messageStream.innerHTML = '';
  const sortedMessages = [...comments].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  sortedMessages.forEach(msg => {
    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';
    messageEl.innerHTML = `
      <div class="message-avatar">
        <img src="${msg.avatar_url}" alt="${escapeHtml(msg.name)}">
      </div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-nick">${escapeHtml(msg.name)}</span>
          <span class="message-date">${formatDate(msg.date)}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
      </div>
    `;
    messageStream.appendChild(messageEl);
  });
}

// ============ 工具函数 ============
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
