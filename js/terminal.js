/* ============================================
   Terminal Style JS - Dragable & Cyber Red
   ============================================ */

function initTerminal() {
  createTerminalInput();
  addTerminalPrompt();
}

function createTerminalInput() {
  if (document.getElementById('terminal-input')) return;

  const terminal = document.createElement('div');
  terminal.id = 'terminal-input';

  // ===== 默认提示文字 =====
  const defaultHint = document.createElement('div');
  defaultHint.className = 'output-hint';
  defaultHint.textContent = 'Welcome. 输入 help 查看命令，/ai <消息> 开始聊天，/exit退出ai模式';
  defaultHint.style.cssText = 'color: #a9a8a8; font-size: 12px; line-height: 1.6;';

  // ===== 三态布局：展开 / 收起输出 / 收起至右 =====
  // 顶部工具栏（按钮行）
  const header = document.createElement('div');
  header.id = 'terminal-header';

  // 收起输出区按钮（📄/📜）
  const toggleOutputBtn = document.createElement('button');
  toggleOutputBtn.id = 'toggle-output-btn';
  toggleOutputBtn.innerHTML = '&#x25BC;'; // ▼ 向下表示可折叠
  toggleOutputBtn.title = '收起聊天记录';

  // 收起至右按钮（→）
  const collapseRightBtn = document.createElement('button');
  collapseRightBtn.id = 'collapse-right-btn';
  collapseRightBtn.innerHTML = '&#x276F;';
  collapseRightBtn.title = '收起终端';

  // 拖动手柄（藏在顶部，当整体收起至右时变成拖动条）
  const dragHandle = document.createElement('div');
  dragHandle.id = 'terminal-drag-handle';

  // 输出区
  const outputArea = document.createElement('div');
  outputArea.id = 'terminal-output';

  // 输入行
  const inputRow = document.createElement('div');
  inputRow.id = 'terminal-input-row';

  const promptLabel = document.createElement('span');
  promptLabel.className = 'terminal-prompt-label';
  promptLabel.textContent = 'PS >';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'terminal-cmd';
  input.placeholder = '输入命令...';
  input.autocomplete = 'off';

  // ---------- 拖拽逻辑（竖向/横向共用） ----------
  let isDraggingH = false; // 横向拖（展开状态）
  let isDraggingV = false; // 竖向拖（收起至右状态）
  let startX, startY, startBottom, startRight;
  let hasMoved = false;
  const MOVE_THRESHOLD = 5;

  // === 竖向拖拽：整体收起至右时，拖动上下位置 ===
  dragHandle.addEventListener('mousedown', function(e) {
    if (!terminal.classList.contains('collapsed-right')) return;
    isDraggingV = true;
    hasMoved = false;
    startY = e.clientY;
    startBottom = parseInt(window.getComputedStyle(terminal).bottom);
    terminal.style.transition = 'none';
    e.stopPropagation();
  });

  // === 横向拖拽：展开状态可横向拖动 ===
  terminal.addEventListener('mousedown', function(e) {
    if (!terminal.classList.contains('collapsed-right')) {
      isDraggingH = true;
      hasMoved = false;
      startX = e.clientX;
      startRight = parseInt(window.getComputedStyle(terminal).right);
      terminal.style.transition = 'none';
    }
  });

  window.addEventListener('mousemove', function(e) {
    if (isDraggingV) {
      const deltaY = startY - e.clientY;
      if (Math.abs(deltaY) > MOVE_THRESHOLD) hasMoved = true;
      const newBottom = Math.max(0, Math.min(window.innerHeight - 50, startBottom + deltaY));
      terminal.style.bottom = newBottom + 'px';
    }
    if (isDraggingH) {
      const deltaX = e.clientX - startX;
      if (Math.abs(deltaX) > MOVE_THRESHOLD) hasMoved = true;
      const newRight = Math.max(0, startRight - deltaX);
      terminal.style.right = newRight + 'px';
    }
  });

  window.addEventListener('mouseup', function() {
    if (isDraggingV) {
      isDraggingV = false;
      terminal.style.transition = 'bottom 0.3s';
    }
    if (isDraggingH) {
      isDraggingH = false;
      hasMoved = false;
      terminal.style.transition = 'right 0.3s';
    }
  });

  // === 收起至右 ===
  collapseRightBtn.addEventListener('click', function(e) {
    if (hasMoved) return;
    terminal.classList.toggle('collapsed-right');
    if (terminal.classList.contains('collapsed-right')) {
      dragHandle.style.display = 'flex';
    } else {
      terminal.style.bottom = '0px';
      terminal.style.right = '0px';
    }
  });

  // === 收起至右状态下点击拖动条 → 展开 ===
  dragHandle.addEventListener('click', function(e) {
    if (!terminal.classList.contains('collapsed-right')) return;
    terminal.classList.remove('collapsed-right');
    terminal.style.bottom = '0px';
    terminal.style.right = '0px';
  });

  // === 收起/展开输出区 ===
  toggleOutputBtn.addEventListener('click', function(e) {
    if (hasMoved) return;
    terminal.classList.toggle('output-collapsed');
  });

  // 回车提交
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const cmd = this.value.trim();
      if (cmd) {
        processCommand(cmd);
        this.value = '';
      }
    }
  });

  // 移动端竖向拖
  dragHandle.addEventListener('touchstart', (e) => {
    if (!terminal.classList.contains('collapsed-right')) return;
    isDraggingV = true;
    hasMoved = false;
    startY = e.touches[0].clientY;
    startBottom = parseInt(window.getComputedStyle(terminal).bottom);
    terminal.style.transition = 'none';
  });
  window.addEventListener('touchmove', (e) => {
    if (!isDraggingV) return;
    const deltaY = startY - e.touches[0].clientY;
    if (Math.abs(deltaY) > MOVE_THRESHOLD) hasMoved = true;
    terminal.style.bottom = Math.max(0, Math.min(window.innerHeight - 50, startBottom + deltaY)) + 'px';
  });
  window.addEventListener('touchend', () => {
    if (isDraggingV) {
      isDraggingV = false;
      terminal.style.transition = 'bottom 0.3s';
    }
  });

  // 组装
  header.appendChild(toggleOutputBtn);
  header.appendChild(collapseRightBtn);
  header.appendChild(dragHandle);

  inputRow.appendChild(promptLabel);
  inputRow.appendChild(input);
  inputRow.appendChild(collapseRightBtn);

  terminal.appendChild(header);
  outputArea.appendChild(defaultHint);
  terminal.appendChild(outputArea);
  terminal.appendChild(inputRow);
  document.body.appendChild(terminal);

  input.addEventListener('focus', () => terminal.style.borderColor = 'var(--terminal-accent)');
  input.addEventListener('blur', () => terminal.style.borderColor = 'var(--terminal-border)');
}

function toggleTerminal() {
  const terminal = document.getElementById('terminal-input');
  if (!terminal) return;
  terminal.classList.toggle('collapsed-right');
}

function processCommand(cmd) {
  // ---------- 退出 AI 模式 ----------
  if (cmd === '/exit') {
    exitAIMode();
    return;
  }

  // ---------- AI 模式下直接发送消息 ----------
  if (window.terminalAIMode) {
    chatWithAI(cmd);
    return;
  }

  const commands = {
    help: () => {
      showOutput('可用命令:\n  help  - 显示此帮助\n  clear - 清屏\n  date  - 当前时间\n  ls    - 列出文章\n  /ai   - 进入 AI 对话模式\n  /exit - 退出 AI 模式');
    },
    clear: () => {
      const out = document.getElementById('terminal-output');
      if (out) out.innerHTML = '';
    },
    date: () => showOutput(new Date().toLocaleString()),
    about: () => showOutput('Cyber Red Terminal v1.1\nDragable + AI Support\n输入 /ai 进入 AI 模式'),
    ls: () => {
      const posts = document.querySelectorAll('.recent-post-item .post-title a, article .post-title a, .article-title a');
      if (!posts.length) { showOutput('暂无文章'); return; }
      posts.forEach((p, i) => showOutput(`${i+1}. ${p.textContent.trim()}`));
    }
  };

  // ---------- AI 对话 ----------
  if (cmd.startsWith('/ai')) {
    enterAIMode();
    // 如果 /ai 后面有内容，直接发送
    const message = cmd.slice(3).trim();
    if (message) {
      chatWithAI(message);
    }
    return;
  }

  const parts = cmd.toLowerCase().trim().split(/\s+/);
  if (commands[parts[0]]) commands[parts[0]](parts.slice(1).join(' '));
  else showOutput(`'${parts[0]}' 未识别，输入 help 查看命令`);
}

// 进入 AI 模式
function enterAIMode() {
  window.terminalAIMode = true;
  const promptLabel = document.querySelector('.terminal-prompt-label');
  if (promptLabel) {
    promptLabel.textContent = 'AI >';
    promptLabel.style.color = 'var(--terminal-accent)';
  }
  showOutput('[AI 模式] 输入内容直接对话，/exit 退出', 'ai-hint');
}

// 退出 AI 模式
function exitAIMode() {
  window.terminalAIMode = false;
  const promptLabel = document.querySelector('.terminal-prompt-label');
  if (promptLabel) {
    promptLabel.textContent = 'PS >';
    promptLabel.style.color = '';
  }
  showOutput('[已退出 AI 模式]', 'ai-hint');
}

// ===================== AI 对话核心 =====================

// 获取或生成会话 ID（基于域名，跨页面共享同一对话）
function getSessionId() {
  let sid = localStorage.getItem('terminal_session_id');
  if (!sid) {
    sid = 'session_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('terminal_session_id', sid);
  }
  return sid;
}

async function chatWithAI(message) {
  const terminal = document.getElementById('terminal-input');
  const input = document.getElementById('terminal-cmd');
  const AI_API = 'https://mange-blog-ai.furongyouxianghong.workers.dev/api/chat'; // 部署后替换

  // 立即在终端显示用户输入
  showOutput(`PS > ${message}`, 'user-msg');

  // 创建 AI 输出区（保留历史）
  let outputDiv = document.getElementById('terminal-output');
  if (!outputDiv) {
    outputDiv = document.createElement('div');
    outputDiv.id = 'terminal-output';
    outputDiv.style.cssText = `
      font-family: var(--terminal-font);
      font-size: 13px;
      color: var(--terminal-cyan);
      padding: 8px 15px;
      border-top: 1px dashed var(--terminal-border);
      max-height: 260px;
      overflow-y: auto;
      line-height: 1.6;
      display: none;
    `;
    terminal.insertBefore(outputDiv, terminal.lastElementChild);
  }
  outputDiv.style.display = 'block';
  outputDiv.scrollTop = outputDiv.scrollHeight;

  // typing 状态
  input.disabled = true;
  const typingId = 'ai-typing-' + Date.now();
  showOutput('01正在解析你的需求...', 'ai-typing');

  try {
    const res = await fetch(AI_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: getSessionId()
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    // 隐藏 typing，换成实际输出
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;
    let fullText = '';
    let provider = res.headers.get('X-Provider') || 'AI';
    let firstChunk = true;

    // 流式读取
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        // 解析 SSE
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.delta) {
              if (firstChunk) {
                // 第一块字符，立即显示
                appendOutput(parsed.delta, 'ai-msg');
                firstChunk = false;
              } else {
                appendOutput(parsed.delta, 'ai-msg');
              }
              fullText += parsed.delta;
            }
          } catch {}
        }
      }
    }

    // provider 标签
    appendOutput(`\n[${provider}]`, 'ai-provider');
    outputDiv.scrollTop = outputDiv.scrollHeight;

    // 给博主加个快捷查看历史的方式
    if (message.includes('博主') || message.includes('你是谁') || message.includes('blog')) {
      appendOutput('\n---\n提示: 输入 /ai 继续对话，01 会记住上下文', 'ai-hint');
    }

  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    appendOutput(`\n[ERR] AI 连接失败: ${err.message}\n请确认 Worker 已部署`, 'ai-error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// 在终端输出区显示一行
function showOutput(text, cls) {
  // 解析 markdown
  text = parseMarkdown(text);

  // 首次输出时清除默认提示
  const hint = document.querySelector('.output-hint');
  if (hint) hint.remove();

  // 优先走 DOM 输出（访客可见）
  const terminal = document.getElementById('terminal-input');
  let outputDiv = document.getElementById('terminal-output');
  if (!outputDiv && terminal) {
    outputDiv = document.createElement('div');
    outputDiv.id = 'terminal-output';
    outputDiv.style.cssText = `
      font-family: var(--terminal-font);
      font-size: 13px;
      color: var(--terminal-cyan);
      padding: 8px 15px;
      border-top: 1px dashed var(--terminal-border);
      max-height: 260px;
      overflow-y: auto;
      line-height: 1.6;
      display: none;
    `;
    terminal.insertBefore(outputDiv, terminal.lastElementChild);
  }

  if (outputDiv) {
    outputDiv.style.display = 'block';
    const p = document.createElement('div');
    p.className = cls ? `ai-line ${cls}` : '';
    p.textContent = text;
    p.style.cssText = cls === 'user-msg'
      ? 'color: var(--terminal-text); margin-bottom: 4px;'
      : cls === 'ai-error'
      ? 'color: var(--terminal-accent);'
      : cls === 'ai-provider'
      ? 'color: #555; font-size: 11px; margin-top: 2px;'
      : cls === 'ai-typing'
      ? 'color: var(--terminal-amber); font-style: italic;'
      : cls === 'ai-hint'
      ? 'color: #666; font-size: 11px;'
      : 'color: var(--terminal-cyan);';
    outputDiv.appendChild(p);
    outputDiv.scrollTop = outputDiv.scrollHeight;
  }

  // 同时保留 console 输出（调试用）
  console.log(text);
}

// 解析 markdown 为终端可显示的纯文本
// 支持: **粗体**, __粗体__, *斜体*, _斜体_, ~~删除线~~, `行内代码`, # 标题
function parseMarkdown(text) {
  if (!text) return '';

  // 按行处理，识别代码块（```xxx```）
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeBlockLang = '';

  const processed = lines.map(line => {
    // 代码块开始/结束
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        codeBlockLang = '';
        return '[代码块结束]';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        return `[代码块: ${codeBlockLang || 'text'}]`;
      }
    }

    if (inCodeBlock) {
      // 代码块内容：保留原样，行首加缩进标记
      return '  | ' + line;
    }

    // 行内代码 `code` -> 保留内容，两端加引号
    line = line.replace(/`([^`]+)`/g, '"$1"');

    // 标题 # ## ### -> 内容转大写，去掉#号
    line = line.replace(/^(#{1,3})\s+(.+)$/, (m, hashes, content) => {
      return content.toUpperCase();
    });

    // 粗体 **text** 或 __text__ -> 只保留内容
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1');
    line = line.replace(/__([^_]+)__/g, '$1');

    // 斜体 *text* 或 _text_（注意排除列表项等场景）
    line = line.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
    line = line.replace(/(?<!_)_([^_]+)_(?!_)/g, '$1');

    // 删除线 ~~text~~ -> 保留内容，加~修饰
    line = line.replace(/~~([^~]+)~~/g, '~$1~');

    // 引用 > text -> 保留前缀 |
    line = line.replace(/^>\s?/gm, '| ');

    // 无序列表 - item 或 * item -> 保留内容
    line = line.replace(/^[-*]\s+/gm, '• ');

    // 有序列表 1. item -> 保留内容
    line = line.replace(/^\d+\.\s+/gm, (m) => m);

    // 链接 [text](url) -> 只保留文字
    line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 图片 ![alt](url) -> 保留alt文字
    line = line.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[$1]');

    // 水平线 --- 或 *** -> 跳过
    if (line.match(/^[-*_]{3,}$/)) return '';

    // 清理所有残留的 markdown 特殊符号
    line = line.replace(/[*_`#~>]/g, '');

    // 清理多余的空格但保留必要格式
    line = line.replace(/\s+/g, ' ');

    return line;
  });

  return processed.join('\n');
}

// 追加字符（用于流式）
function appendOutput(text, cls) {
  // 解析 markdown 并返回处理后的纯文本
  text = parseMarkdown(text);
  const outputDiv = document.getElementById('terminal-output');
  if (!outputDiv) return;
  let last = outputDiv.lastElementChild;
  if (!last || last.className !== `ai-line ${cls}`) {
    last = document.createElement('div');
    last.className = cls ? `ai-line ${cls}` : '';
    last.style.cssText = cls === 'ai-provider'
      ? 'color: #555; font-size: 11px; margin-top: 2px;'
      : cls === 'ai-error'
      ? 'color: var(--terminal-accent);'
      : cls === 'ai-typing'
      ? 'color: var(--terminal-amber); font-style: italic;'
      : cls === 'ai-hint'
      ? 'color: #666; font-size: 11px;'
      : 'color: var(--terminal-cyan);';
    outputDiv.appendChild(last);
  }
  last.textContent += text;
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

function addTerminalPrompt() {
  // 1. 寻找主页容器或文章页容器
  const container = document.querySelector('.recent-posts') || document.querySelector('#page') || document.querySelector('#archive')|| document.querySelector('#post');
  if (!container || document.querySelector('.terminal-prompt')) return;

  const prompt = document.createElement('div');
  prompt.className = 'terminal-prompt';

  // 2. 获取当前路径
  const path = window.location.pathname;
  let displayPath = 'C:\\Users\\Blog' + path.replace(/\//g, '\\');
  if (path.endsWith('\\')) displayPath = displayPath.slice(0, -1);

  prompt.setAttribute('data-path', displayPath);
  
  // 3. 插入到最前面
  container.insertBefore(prompt, container.firstChild);
}

window.BlogApp.register('terminal', initTerminal);
