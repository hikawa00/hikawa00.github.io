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
    help: () => console.log('可用命令: help, clear, date, about, ls, cat'),
    clear: () => console.clear(),
    date: () => console.log(new Date().toLocaleString()),
    about: () => console.log('Cyber Red Terminal v1.1 - Dragable Support'),
    ls: () => {
      const posts = document.querySelectorAll('.recent-post-item .post-title a');
      posts.forEach((p, i) => console.log(`${i+1}. ${p.textContent.trim()}`));
    }
  };
  const parts = cmd.toLowerCase().trim().split(/\s+/);
  if (commands[parts[0]]) commands[parts[0]](parts.slice(1).join(' '));
  else console.log(`'${parts[0]}' 未识别。`);
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