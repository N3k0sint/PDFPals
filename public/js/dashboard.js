document.addEventListener('DOMContentLoaded', () => {
    // 1. Filter Logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    const toolCards = document.querySelectorAll('.tool-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.dataset.filter;
            toolCards.forEach(card => {
                if (filter === 'all' || card.dataset.category === filter) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // 2. Command Palette (Ctrl + K / Cmd + K)
    const cmdPaletteBtn = document.getElementById('cmd-palette-btn');
    const cmdModal = document.getElementById('cmd-palette-modal');
    const cmdInput = document.getElementById('cmd-search-input');
    const cmdList = document.getElementById('cmd-results-list');

    const toolsData = Array.from(toolCards).map(card => {
        const title = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : '';
        const desc = card.querySelector('p') ? card.querySelector('p').textContent.trim() : '';
        const icon = card.querySelector('.icon-box') ? card.querySelector('.icon-box').textContent.trim() : '📄';
        const href = card.getAttribute('href') || '#';
        const category = card.dataset.category || 'tools';
        return { title, desc, icon, href, category };
    });

    function renderCmdItems(filterText) {
        const query = (filterText || '').toLowerCase().trim();
        const filtered = toolsData.filter(t => 
            t.title.toLowerCase().includes(query) || 
            t.desc.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query)
        );

        if (!filtered.length) {
            cmdList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No matching tools found</div>';
            return;
        }

        cmdList.innerHTML = filtered.map((t, idx) => `
            <a href="${t.href}" class="cmd-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}">
                <div class="cmd-item-left">
                    <span class="cmd-item-icon">${t.icon}</span>
                    <div>
                        <div class="cmd-item-title">${t.title}</div>
                        <div class="cmd-item-desc">${t.desc}</div>
                    </div>
                </div>
                <span class="cmd-item-cat">${t.category}</span>
            </a>
        `).join('');
    }

    function openCmdPalette() {
        if (!cmdModal) return;
        cmdModal.classList.remove('hidden');
        cmdInput.value = '';
        renderCmdItems('');
        setTimeout(() => cmdInput.focus(), 50);
    }

    function closeCmdPalette() {
        if (!cmdModal) return;
        cmdModal.classList.add('hidden');
    }

    if (cmdPaletteBtn) cmdPaletteBtn.onclick = openCmdPalette;
    if (cmdInput) {
        cmdInput.addEventListener('input', () => {
            renderCmdItems(cmdInput.value);
        });
    }

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (cmdModal && cmdModal.classList.contains('hidden')) {
                openCmdPalette();
            } else {
                closeCmdPalette();
            }
        } else if (e.key === 'Escape') {
            if (cmdModal && !cmdModal.classList.contains('hidden')) closeCmdPalette();
            if (smartModal && !smartModal.classList.contains('hidden')) closeSmartModal();
        } else if (cmdModal && !cmdModal.classList.contains('hidden')) {
            const items = Array.from(cmdList.querySelectorAll('.cmd-item'));
            if (!items.length) return;
            const currentSelected = cmdList.querySelector('.cmd-item.selected');
            let idx = items.indexOf(currentSelected);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                idx = (idx + 1) % items.length;
                items.forEach(i => i.classList.remove('selected'));
                items[idx].classList.add('selected');
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                idx = (idx - 1 + items.length) % items.length;
                items.forEach(i => i.classList.remove('selected'));
                items[idx].classList.add('selected');
                items[idx].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentSelected) currentSelected.click();
            }
        }
    });

    if (cmdModal) {
        cmdModal.addEventListener('click', (e) => {
            if (e.target === cmdModal) closeCmdPalette();
        });
    }

    // 3. Global Drag-and-Drop Action Hub
    const dragOverlay = document.getElementById('global-drag-overlay');
    const smartModal = document.getElementById('smart-action-modal');
    const droppedFileName = document.getElementById('dropped-file-name');
    const droppedFileSize = document.getElementById('dropped-file-size');
    const closeActionModalBtn = document.getElementById('close-action-modal');
    const smartActionBtns = document.querySelectorAll('.smart-act-btn');

    let activeDroppedFile = null;
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (dragOverlay) dragOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            if (dragOverlay) dragOverlay.classList.remove('active');
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (dragOverlay) dragOverlay.classList.remove('active');

        if (e.dataTransfer.files && e.dataTransfer.files.length) {
            handleGlobalDrop(e.dataTransfer.files[0]);
        }
    });

    function formatBytes(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function handleGlobalDrop(file) {
        if (!smartModal) return;
        activeDroppedFile = file;
        if (droppedFileName) droppedFileName.textContent = file.name;
        if (droppedFileSize) droppedFileSize.textContent = formatBytes(file.size);
        smartModal.classList.remove('hidden');
    }

    function closeSmartModal() {
        if (smartModal) smartModal.classList.add('hidden');
        activeDroppedFile = null;
    }

    if (closeActionModalBtn) closeActionModalBtn.onclick = closeSmartModal;
    if (smartModal) {
        smartModal.addEventListener('click', (e) => {
            if (e.target === smartModal) closeSmartModal();
        });
    }

    smartActionBtns.forEach(btn => {
        btn.onclick = async () => {
            if (!activeDroppedFile) return;
            const targetTool = btn.dataset.tool;
            btn.textContent = 'Opening...';
            if (window.WorkflowBridge) {
                await window.WorkflowBridge.sendToTool('tools/' + targetTool, activeDroppedFile, activeDroppedFile.name);
            } else {
                window.location.href = 'tools/' + targetTool;
            }
        };
    });
});