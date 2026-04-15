const initPhotoWall = () => {
    const header = document.getElementById('page-header');
    if (header && header.classList.contains('full_page')) {
        if (document.querySelector('.photo-grid')) return;

        const grid = document.createElement('div');
        grid.className = 'photo-grid';
        
        // --- 核心修复：补上缺失的 baseCount 定义 ---
        const baseCount = 28; // 每屏显示的基数 (7列 * 4行)
        const baseUrl = "https://cdn.jsdelivr.net/gh/hikawa00/typora-img-bed@main/wall/";
        const myPhotoCount = 36; // 你实际上传的照片张数

        // 循环生成两倍的图片实现无缝滚动
        // 核心：第一半 (0 ~ baseCount-1) 和第二半 (baseCount ~ baseCount*2-1) 必须显示完全相同的照片
        for (let i = 0; i < baseCount * 2; i++) {
            const img = document.createElement('img');

            // 让第二半的照片索引映射回第一半，实现真正的无缝拼接
            const photoIndex = i < baseCount ? i : i - baseCount;
            const imgNumber = (photoIndex % myPhotoCount) + 1;
            img.src = `${baseUrl}${imgNumber}.jpg?v=1`;
            
            img.className = 'photo-tile';
            img.draggable = false;
            
            // 点击逻辑
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                
                // 1. 将这张图的地址设为 Header 的背景图
                header.style.backgroundImage = `url(${this.src})`;
                
                // 2. 隐藏整个网格
                grid.classList.add('has-active');
                
                // 3. 停止动画节省资源
                grid.style.animationPlayState = 'paused';
                
                // 4. 给 header 加个类，用来显示文字
                header.classList.add('header-show-text');
                
                console.log('大图已切换，文字已浮现');
            });
            grid.appendChild(img);
        }
        
        header.insertBefore(grid, header.firstChild);

        // 双击还原逻辑（已补全移除类名的逻辑）
        header.addEventListener('dblclick', () => {
            grid.classList.remove('has-active');
            grid.style.animationPlayState = 'running';
            header.style.backgroundImage = ''; 

            // 移除显示文字的类
            header.classList.remove('header-show-text');

            // 核心修复：清除全选高亮
            if (window.getSelection) {
                window.getSelection().removeAllRanges(); 
            } else if (document.selection) {
                document.selection.empty(); 
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initPhotoWall);
document.addEventListener('pjax:complete', initPhotoWall);