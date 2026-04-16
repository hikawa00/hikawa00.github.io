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
  const url = `${WALINE_SERVER_URL}/api/comment?path=${encodeURIComponent(VISITOR_WALL_PATH)}&pageSize=100`;

  try {
    const res = await fetch(url);
    const result = await res.json();

    // Waline 返回结构: { errno, errmsg, data: { page, totalPages, pageSize, count, data: [...] } }
    const comments = result.data ? result.data.data : [];

    console.log(`[Visitor Wall] Fetched ${comments.length} comments from Waline`);

    return comments.map(comment => ({
      id: comment.objectId || comment.id,
      name: comment.nick,
      avatar_url: comment.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.nick)}`,
      content: comment.comment,
      date: comment.insertedAt || comment.createdAt || new Date().toISOString()
    }));
  } catch (err) {
    console.error('[Visitor Wall] Fetch Error:', err);
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
        <div class="message-content">${safeHtml(msg.content)}</div>
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

// 安全地渲染评论内容 - 链接可点击，图片可显示
function safeHtml(text) {
  if (!text) return '';
  let escaped;
  // 检查是否包含 HTML 标签（已有 HTML 结构）
  if (/<[^>]+>/.test(text)) {
    // 已有 HTML，直接处理
    escaped = text;
  } else {
    // 纯文本，用 textContent 安全转义
    const tmp = document.createElement('div');
    tmp.textContent = text;
    escaped = tmp.innerHTML;
    // 把 < 和 > 转回去，让 HTML 标签能显示
    escaped = escaped.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  // Markdown 图片语法 ![alt](url) 或 [](url) 转为 <img> 标签
  escaped = escaped.replace(/!\[([^\]]*)\]\((.+?)\)/g, function(_, alt, url) {
    return '<img src="' + url + '" alt="' + alt + '" style="max-width:100%;max-height:200px;border-radius:4px;" onerror="this.style.display=\'none\'">';
  });
  // 为已有 <img> 标签添加样式
  escaped = escaped.replace(/<img\b([^>]*)\/?>/g, function(match, attrs) {
    if (!attrs.includes('style=')) {
      attrs += ' style="max-width:100%;max-height:200px;border-radius:4px;"';
    }
    if (!attrs.includes('onerror=')) {
      attrs += ' onerror="this.style.display=\'none\'"';
    }
    return '<img' + attrs + '>';
  });
  // 用 DOM 操作把 img 包装成可点击的锚点（避免正则引号问题）
  const tmp = document.createElement('div');
  tmp.innerHTML = escaped;
  tmp.querySelectorAll('img').forEach(img => {
    const anchor = document.createElement('a');
    anchor.href = img.src;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.appendChild(img);
  });
  escaped = tmp.innerHTML;
  // 所有剩余的链接转为可点击的 <a> 标签
  escaped = escaped.replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return escaped;
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
