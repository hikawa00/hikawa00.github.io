/* ============================================
   Terminal Style JS - Dragable & Cyber Red
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
  initTerminal();
});

// PJAX 切换页面后重新初始化 terminal prompt
document.addEventListener('pjax:complete', function() {
  addTerminalPrompt();
});

function initTerminal() {
  createTerminalInput();
  addTerminalPrompt();
  disableHoverAnimation();
}

function createTerminalInput() {
  if (document.getElementById('terminal-input')) return;

  const terminal = document.createElement('div');
  terminal.id = 'terminal-input';

  const promptLabel = document.createElement('span');
  promptLabel.className = 'terminal-prompt-label';
  promptLabel.textContent = 'PS >';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'terminal-cmd';
  input.placeholder = '输入命令...';
  input.autocomplete = 'off';

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const cmd = this.value.trim();
      if (cmd) {
        processCommand(cmd);
        this.value = '';
      }
    }
  });

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'terminal-collapse-btn';
  collapseBtn.innerHTML = '&#x276F;'; 
  collapseBtn.title = '收起终端';

  // --- 拖拽逻辑变量 ---
  let isDragging = false;
  let startY;
  let startBottom;
  let moveThreshold = 5; // 移动超过5像素判定为拖拽
  let hasMoved = false;

  // 鼠标按下
  collapseBtn.addEventListener('mousedown', function(e) {
    if (!terminal.classList.contains('collapsed')) return; // 只在缩回时可拖动
    isDragging = true;
    hasMoved = false;
    startY = e.clientY;
    startBottom = parseInt(window.getComputedStyle(terminal).bottom);
    terminal.style.transition = 'none'; // 拖拽时关闭动画，防止卡顿
  });

  // 鼠标移动
  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    const deltaY = startY - e.clientY; // 向上拖 Y 减小，deltaY 为正
    if (Math.abs(deltaY) > moveThreshold) hasMoved = true;
    
    let newBottom = startBottom + deltaY;
    // 限制范围，不超出屏幕
    newBottom = Math.max(0, Math.min(window.innerHeight - 50, newBottom));
    terminal.style.bottom = newBottom + 'px';
  });

  // 鼠标松开
  window.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    terminal.style.transition = 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.1), bottom 0.3s';
  });

  // 点击事件处理
  collapseBtn.addEventListener('click', function(e) {
    if (hasMoved) {
        e.preventDefault();
        return; // 如果拖动了，就不执行展开/收起
    }
    toggleTerminal();
  });

  // 移动端兼容
  collapseBtn.addEventListener('touchstart', (e) => {
    if (!terminal.classList.contains('collapsed')) return;
    isDragging = true;
    hasMoved = false;
    startY = e.touches[0].clientY;
    startBottom = parseInt(window.getComputedStyle(terminal).bottom);
    terminal.style.transition = 'none';
  });
  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.touches[0].clientY;
    if (Math.abs(deltaY) > moveThreshold) hasMoved = true;
    terminal.style.bottom = Math.max(0, Math.min(window.innerHeight - 50, startBottom + deltaY)) + 'px';
  });
  window.addEventListener('touchend', () => {
    isDragging = false;
    terminal.style.transition = 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.1), bottom 0.3s';
  });

  terminal.appendChild(promptLabel);
  terminal.appendChild(input);
  terminal.appendChild(collapseBtn);
  document.body.appendChild(terminal);

  input.addEventListener('focus', () => terminal.style.borderColor = 'var(--terminal-accent)');
  input.addEventListener('blur', () => terminal.style.borderColor = 'var(--terminal-border)');
}

function toggleTerminal() {
  const terminal = document.getElementById('terminal-input');
  const btn = document.querySelector('.terminal-collapse-btn');
  if (!terminal) return;

  const isCollapsed = terminal.classList.toggle('collapsed');
  btn.innerHTML = isCollapsed ? '&#x276E;' : '&#x276F;'; 
  btn.title = isCollapsed ? '展开终端' : '收起终端';
  
  // 展开时重置到最下方，防止在上方展开挡住视线
  if (!isCollapsed) {
      terminal.style.bottom = '0px';
  }
}

function processCommand(cmd) {
  const commands = {
    help: () => {
      showOutput('可用命令:\n  help  - 显示此帮助\n  clear - 清屏\n  date  - 当前时间\n  ls    - 列出文章\n  /ai <msg> - 与 AI 对话');
    },
    clear: () => {
      const out = document.getElementById('terminal-output');
      if (out) out.innerHTML = '';
      console.clear();
    },
    date: () => showOutput(new Date().toLocaleString()),
    about: () => showOutput('Cyber Red Terminal v1.1\nDragable + AI Support\n输入 /ai <消息> 开始 AI 对话'),
    ls: () => {
      const posts = document.querySelectorAll('.recent-post-item .post-title a');
      if (!posts.length) { showOutput('暂无文章'); return; }
      posts.forEach((p, i) => showOutput(`${i+1}. ${p.textContent.trim()}`));
    }
  };

  // ---------- AI 对话 ----------
  if (cmd.startsWith('/ai ')) {
    const message = cmd.slice(4).trim();
    if (!message) { showOutput('用法: /ai <你的问题>'); return; }
    chatWithAI(message);
    return;
  }

  const parts = cmd.toLowerCase().trim().split(/\s+/);
  if (commands[parts[0]]) commands[parts[0]](parts.slice(1).join(' '));
  else showOutput(`'${parts[0]}' 未识别，输入 help 查看命令`);
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
  let outputDiv = document.getElementById('terminal-ai-output');
  if (!outputDiv) {
    outputDiv = document.createElement('div');
    outputDiv.id = 'terminal-ai-output';
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
  showOutput('00 正在解析你的需求...', 'ai-typing');

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
      appendOutput('\n---\n提示: 输入 /ai 继续对话，00 会记住上下文', 'ai-hint');
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
  // 优先走 DOM 输出（访客可见）
  const terminal = document.getElementById('terminal-input');
  let outputDiv = document.getElementById('terminal-ai-output');
  if (!outputDiv && terminal) {
    outputDiv = document.createElement('div');
    outputDiv.id = 'terminal-ai-output';
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

// 追加字符（用于流式）
function appendOutput(text, cls) {
  const outputDiv = document.getElementById('terminal-ai-output');
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
  const container = document.querySelector('.recent-posts') || document.querySelector('#post') || document.querySelector('#page-header');
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

function disableHoverAnimation() {
  const style = document.createElement('style');
  style.textContent = `.recent-post-item:hover { transform: none !important; }`;
  document.head.appendChild(style);
}