/**
 * PDFPals Workflow Bridge
 * Universal, offline cross-tool chaining & pipeline communication via IndexedDB.
 */
(function (global) {
    const DB_NAME = 'PDFPalsWorkflowDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'pipeline_store';
    const PIPELINE_KEY = 'active_document';

    function openDB() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                return reject(new Error('IndexedDB not supported in this browser.'));
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    const WorkflowBridge = {
        /**
         * Store a PDF in IndexedDB for passing to the next tool
         */
        async storeFile(blobOrBuffer, fileName) {
            const db = await openDB();
            let arrayBuffer;
            if (blobOrBuffer instanceof ArrayBuffer) {
                arrayBuffer = blobOrBuffer;
            } else if (blobOrBuffer instanceof Blob) {
                arrayBuffer = await blobOrBuffer.arrayBuffer();
            } else if (blobOrBuffer instanceof Uint8Array) {
                arrayBuffer = blobOrBuffer.buffer.slice(blobOrBuffer.byteOffset, blobOrBuffer.byteOffset + blobOrBuffer.byteLength);
            } else {
                throw new Error('Unsupported buffer format for WorkflowBridge.');
            }

            const record = {
                buffer: arrayBuffer,
                name: fileName || 'document.pdf',
                timestamp: Date.now()
            };

            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(record, PIPELINE_KEY);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error);
            });
        },

        /**
         * Retrieve pipeline file from IndexedDB
         */
        async retrieveFile() {
            try {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(PIPELINE_KEY);
                    req.onsuccess = () => {
                        const record = req.result;
                        if (!record || !record.buffer) return resolve(null);
                        // Convert ArrayBuffer back to File
                        const blob = new Blob([record.buffer], { type: 'application/pdf' });
                        const file = new File([blob], record.name || 'document.pdf', { type: 'application/pdf' });
                        resolve(file);
                    };
                    req.onerror = () => reject(req.error);
                });
            } catch (err) {
                console.warn('WorkflowBridge retrieve error:', err);
                return null;
            }
        },

        /**
         * Clear current pipeline document
         */
        async clearPipeline() {
            try {
                const db = await openDB();
                return new Promise((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    tx.objectStore(STORE_NAME).delete(PIPELINE_KEY);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                });
            } catch (e) {
                // Ignore
            }
        },

        /**
         * Store file and redirect to another tool
         */
        async sendToTool(targetHtml, blobOrBuffer, fileName) {
            try {
                await this.storeFile(blobOrBuffer, fileName);
                window.location.href = targetHtml + (targetHtml.includes('?') ? '&' : '?') + 'pipeline=1';
            } catch (err) {
                console.error('Failed to send to next tool:', err);
                alert('Could not pass file to next tool: ' + err.message);
            }
        },

        /**
         * Automatically check on page load if launched via pipeline (?pipeline=1)
         */
        async checkIncomingPipeline(fileHandler) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('pipeline') === '1') {
                const file = await this.retrieveFile();
                if (file && typeof fileHandler === 'function') {
                    // Show top pipeline banner
                    this.showPipelineBanner(file.name);
                    fileHandler(file);
                }
            }
        },

        showPipelineBanner(fileName) {
            if (document.getElementById('workflow-pipeline-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'workflow-pipeline-banner';
            banner.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: linear-gradient(135deg, #1e293b, #0f172a);
                color: #ffffff;
                border: 1px solid rgba(99, 102, 241, 0.4);
                border-radius: 14px;
                padding: 12px 18px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.35);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                font-family: system-ui, sans-serif;
                font-size: 0.88rem;
                animation: slideUp 0.3s ease;
            `;
            banner.innerHTML = `
                <span style="font-size: 1.2rem;">✨</span>
                <div>
                    <strong style="color: #818cf8;">Pipeline Active:</strong>
                    <span style="color: #cbd5e1; margin-left: 4px;">${fileName}</span>
                </div>
                <button id="close-pipeline-banner" style="
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #fff;
                    border-radius: 6px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 0.75rem;
                    margin-left: 8px;
                ">Dismiss</button>
            `;
            document.body.appendChild(banner);
            document.getElementById('close-pipeline-banner').onclick = () => banner.remove();
            setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
        },

        /**
         * Render Next Action bar on export completion
         */
        renderNextActionBar(container, blobOrBuffer, fileName) {
            if (!container) return;
            const existing = document.getElementById('workflow-next-action-card');
            if (existing) existing.remove();

            const card = document.createElement('div');
            card.id = 'workflow-next-action-card';
            card.style.cssText = `
                margin-top: 1.5rem;
                padding: 1.2rem;
                background: rgba(var(--primary-rgb, 79, 70, 229), 0.06);
                border: 1px solid rgba(var(--primary-rgb, 79, 70, 229), 0.2);
                border-radius: 16px;
                display: flex;
                flex-direction: column;
                gap: 0.8rem;
                text-align: left;
                animation: fadeIn 0.3s ease;
            `;

            card.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 0.85rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">
                        ➔ Next Action: Continue Working With This File
                    </span>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">No re-upload needed</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;" id="next-action-btn-row">
                    <button class="btn secondary sm action-chain-btn" data-tool="compress-pdf.html" style="border-radius: 9px; font-size: 0.82rem;">📉 Compress</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="watermark-pdf.html" style="border-radius: 9px; font-size: 0.82rem;">🔏 Watermark</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="edit-pdf.html" style="border-radius: 9px; font-size: 0.82rem;">📝 Edit PDF</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="sign-pdf.html" style="border-radius: 9px; font-size: 0.82rem;">✍️ Sign</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="protect-pdf.html" style="border-radius: 9px; font-size: 0.82rem;">🔒 Protect</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="form-filler.html" style="border-radius: 9px; font-size: 0.82rem;">📋 Form Filler</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="split-pdf.html" style="border-radius: 9px; font-size: 0.82rem;">✂️ Split</button>
                    <button class="btn secondary sm action-chain-btn" data-tool="edit-metadata.html" style="border-radius: 9px; font-size: 0.82rem;">📋 Metadata</button>
                </div>
            `;

            container.appendChild(card);

            const buttons = card.querySelectorAll('.action-chain-btn');
            buttons.forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const tool = btn.dataset.tool;
                    // Detect if tool is in same directory or tools/ folder
                    const currentPath = window.location.pathname;
                    let targetUrl;
                    if (currentPath.includes('/tools/')) {
                        targetUrl = tool;
                    } else {
                        targetUrl = 'tools/' + tool;
                    }
                    WorkflowBridge.sendToTool(targetUrl, blobOrBuffer, fileName);
                };
            });
        }
    };

    global.WorkflowBridge = WorkflowBridge;
})(window);