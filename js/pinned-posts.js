/**
 * 置顶文章模块
 * 横向排列的小正方形便签样式，显示在右侧文章列表上方
 */

(function() {
  // 硬编码的置顶文章数组
  // 格式：{ title: '标题', link: '/文章路径/', summary: '一句话简介' }
  const PINNED_POSTS = [
    {
      title: 'guessNum',
      link: '/2026/05/19/guessNum/',
      summary: 'Bulls & Cows 猜数字游戏'
    },
    {
      title: '生活记录',
      link: '/life/',
      summary: '',
      type: 'life'
    }
    // 在这里添加更多置顶文章：
    // { title: '文章标题', link: '/2026/01/01/article/', summary: '一句话简介' }
  ];

  // 标准化链接（去除末尾斜杠统一格式）
  function normalizeLink(link) {
    return link ? link.replace(/\/$/, '') : '';
  }

  // 获取置顶文章的标准化链接集合
  const pinnedLinks = new Set(PINNED_POSTS.map(p => normalizeLink(p.link)));

  function formatDuration(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    if (!hours) return `${rest} 分钟`;
    if (!rest) return `${hours} 小时`;
    return `${hours}小时${rest}分`;
  }

  function currentShanghaiMonth() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date()).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}`;
  }

  async function hydrateLifeNote() {
    const note = document.querySelector('.pinned-post-item[data-pinned-type="life"]');
    if (!note) return;
    try {
      const response = await fetch(`${window.BlogConfig?.apiBase || ''}/api/life`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const state = await response.json();
      const month = currentShanghaiMonth();
      const actualItems = (state.items || []).filter(item =>
        (item.status === 'record' || item.status === 'completed') && item.actualDate?.startsWith(month)
      );
      const activeDays = new Set(actualItems.map(item => item.actualDate)).size;
      const total = actualItems.reduce((sum, item) => sum + Number(item.actualMinutes || 0), 0);
      const projectTotals = new Map();
      actualItems.forEach(item => {
        projectTotals.set(item.projectId, (projectTotals.get(item.projectId) || 0) + Number(item.actualMinutes || 0));
      });
      const emoji = (state.projects || [])
        .map(project => ({ emoji: project.emoji, minutes: projectTotals.get(project.id) || 0 }))
        .filter(project => project.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5)
        .map(project => project.emoji)
        .join(' ');
      note.querySelector('.pinned-life-active').innerHTML = `本月活跃 <b>${activeDays}</b> 天`;
      note.querySelector('.pinned-life-time').textContent = `累计 ${formatDuration(total)}`;
      note.querySelector('.pinned-life-emoji').textContent = emoji || '这个月还没留下足迹';
      note.classList.remove('is-loading');
    } catch (error) {
      note.querySelector('.pinned-life-active').textContent = '生活日历';
      note.querySelector('.pinned-life-time').textContent = '点击查看记录';
      note.querySelector('.pinned-life-emoji').textContent = '';
      note.classList.remove('is-loading');
    }
  }

  // 渲染函数
  function renderPinnedPosts() {
    // 检查是否有置顶文章
    if (PINNED_POSTS.length === 0) return;

    // 避免重复渲染
    if (document.getElementById('pinned-posts-container')) return;

    // 生成HTML
    const postsHTML = PINNED_POSTS.map(post => `
      <a href="${post.link}" class="pinned-post-item${post.type === 'life' ? ' pinned-life-note is-loading' : ''}" title="${post.summary || post.title}"${post.type ? ` data-pinned-type="${post.type}"` : ''}>
        <span class="pinned-post-title">${post.title}</span>
        ${post.type === 'life' ? `
          <span class="pinned-life-active">读取本月记录…</span>
          <span class="pinned-life-time"></span>
          <span class="pinned-life-emoji"></span>
        ` : `<span class="pinned-post-summary">${post.summary}</span>`}
        <div class="pinned-post-pin"></div>
      </a>
    `).join('');

    // 创建容器
    const wrapper = document.createElement('div');
    wrapper.id = 'pinned-posts-container';
    wrapper.innerHTML = `
      <div class="pinned-posts-header">
        <i class="fas fa-thumbtack"></i>
        <span>置顶</span>
      </div>
      <div class="pinned-posts-grid">
        ${postsHTML}
      </div>
    `;

    // 找到 #recent-posts 内部的第一个 .recent-post-item，在它前面插入
    const recentPosts = document.getElementById('recent-posts');
    const firstPostItem = recentPosts ? recentPosts.querySelector('.recent-post-item') : null;
    if (firstPostItem && firstPostItem.parentNode) {
      firstPostItem.parentNode.insertBefore(wrapper, firstPostItem);
    } else if (recentPosts && recentPosts.parentNode) {
      recentPosts.parentNode.insertBefore(wrapper, recentPosts);
    }

    // 从正常列表中移除已在置顶区域展示的文章
    const allPostItems = recentPosts ? recentPosts.querySelectorAll('.recent-post-item') : [];
    allPostItems.forEach(item => {
      // 查找文章标题元素
      const titleEl = item.querySelector('.article-title, .post-title, .article-title a, .post-title a');
      if (titleEl) {
        // 获取标题文本
        const titleText = titleEl.textContent.trim();
        // 查找这篇文章的链接
        const linkEl = item.querySelector('a[href]');
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          const normalizedHref = normalizeLink(href);
          // 检查是否在置顶列表中
          if (pinnedLinks.has(normalizedHref)) {
            item.style.display = 'none';
            return;
          }
        }
        // 也通过标题匹配
        const matchedPinned = PINNED_POSTS.find(p => p.title === titleText);
        if (matchedPinned) {
          item.style.display = 'none';
        }
      }
    });

    hydrateLifeNote();
  }

  window.BlogApp.register('pinnedPosts', renderPinnedPosts);
})();
