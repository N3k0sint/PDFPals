import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

const workerSrc = new URL('../vendor/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const canvasContainer = document.getElementById('canvas-container');
    const pdfRenderCanvas = document.getElementById('pdf-render-canvas');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    const addBoxBtn = document.getElementById('add-box-btn');
    const clearBoxesBtn = document.getElementById('clear-boxes-btn');
    const changeFileBtn = document.getElementById('change-file-btn');
    const eraseScope = document.getElementById('erase-scope');
    const rangeGroup = document.getElementById('range-group');
    const pageRangeInput = document.getElementById('page-range-input');
    const fillColorInput = document.getElementById('fill-color');
    const modeTabs = document.querySelectorAll('.mode-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const watermarkPhraseInput = document.getElementById('watermark-phrase');
    const presetBadges = document.querySelectorAll('.preset-badge');
    const detectedContainer = document.getElementById('detected-container');
    const detectedList = document.getElementById('detected-list');
    const stripAnnotsToggle = document.getElementById('strip-annots-toggle');
    const applyBtn = document.getElementById('apply-btn');

    let pdfBytes = null;
    let pdfDocJs = null;
    let totalPages = 1;
    let currentPage = 1;
    let currentViewport = null;
    let originalFileName = 'document.pdf';

    // Eraser Boxes State: array of { id, x, y, w, h } in canvas pixel space
    let eraseBoxes = [];
    let isDrawingBox = false;
    let startX = 0, startY = 0;
    let currentDrawingBox = null;

    // Tab Switching
    modeTabs.forEach(tab => {
        tab.onclick = () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.add('hidden'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            const pane = document.getElementById(`tab-${target}`);
            if (pane) pane.classList.remove('hidden');
        };
    });

    // Erase Scope Toggle
    eraseScope.onchange = () => {
        if (eraseScope.value === 'range') {
            rangeGroup.classList.remove('hidden');
        } else {
            rangeGroup.classList.add('hidden');
        }
    };

    // Text Presets
    presetBadges.forEach(badge => {
        badge.onclick = () => {
            watermarkPhraseInput.value = badge.dataset.phrase;
        };
    });

    // File Handling
    dropZone.onclick = (e) => {
        if (e.target.tagName !== 'LABEL') fileInput.click();
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
    dropZone.ondragleave = () => dropZone.classList.remove('active');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };
    fileInput.onchange = (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    };

    changeFileBtn.onclick = () => {
        pdfBytes = null;
        pdfDocJs = null;
        eraseBoxes = [];
        document.querySelectorAll('.erase-box').forEach(b => b.remove());
        workspace.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileInput.value = '';
    };

    async function handleFile(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a valid PDF document.');
            return;
        }
        originalFileName = file.name;
        const buffer = await file.arrayBuffer();
        pdfBytes = new Uint8Array(buffer);

        dropZone.classList.add('hidden');
        workspace.classList.remove('hidden');

        try {
            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
            pdfDocJs = await loadingTask.promise;
            totalPages = pdfDocJs.numPages;
            currentPage = 1;
            await renderCurrentPage();
            scanForWatermarkText();
        } catch (err) {
            console.error('Failed to load PDF:', err);
            alert('Error loading PDF document.');
        }
    }

    if (window.WorkflowBridge) {
        window.WorkflowBridge.checkIncomingPipeline(handleFile);
    }

    // Render Page via PDF.js
    async function renderCurrentPage() {
        if (!pdfDocJs) return;
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;

        const page = await pdfDocJs.getPage(currentPage);
        const stdViewport = page.getViewport({ scale: 1.0 });

        // Responsive fit
        const panelWidth = Math.min(800, window.innerWidth - 440);
        const fitScale = Math.max(0.6, Math.min(1.5, panelWidth / stdViewport.width));
        currentViewport = page.getViewport({ scale: fitScale });

        pdfRenderCanvas.width = currentViewport.width;
        pdfRenderCanvas.height = currentViewport.height;
        canvasContainer.style.width = `${currentViewport.width}px`;
        canvasContainer.style.height = `${currentViewport.height}px`;

        const ctx = pdfRenderCanvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: currentViewport }).promise;

        renderAllBoxes();
    }

    prevPageBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
        }
    };

    nextPageBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
        }
    };

    // Auto-detect repeating watermark candidates
    async function scanForWatermarkText() {
        if (!pdfDocJs) return;
        try {
            const maxScan = Math.min(5, totalPages);
            const textCounts = new Map();

            for (let p = 1; p <= maxScan; p++) {
                const page = await pdfDocJs.getPage(p);
                const tc = await page.getTextContent();
                const seenOnThisPage = new Set();

                for (const item of tc.items) {
                    const str = (item.str || '').trim();
                    if (str.length >= 4 && str.length <= 40 && !seenOnThisPage.has(str)) {
                        seenOnThisPage.add(str);
                        textCounts.set(str, (textCounts.get(str) || 0) + 1);
                    }
                }
            }

            const candidates = [];
            for (const [str, count] of textCounts.entries()) {
                if (count >= 2) {
                    candidates.push(str);
                }
            }

            if (candidates.length > 0 && detectedContainer && detectedList) {
                detectedList.innerHTML = '';
                candidates.slice(0, 4).forEach(phrase => {
                    const badge = document.createElement('span');
                    badge.className = 'preset-badge';
                    badge.textContent = phrase;
                    badge.onclick = () => {
                        watermarkPhraseInput.value = phrase;
                        // Switch to text tab
                        modeTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'text'));
                        tabPanes.forEach(p => p.classList.toggle('hidden', p.id !== 'tab-text'));
                    };
                    detectedList.appendChild(badge);
                });
                detectedContainer.classList.remove('hidden');
            }
        } catch (e) {
            console.warn('Text scan error:', e);
        }
    }

    // Interactive Drag to Draw Eraser Box
    canvasContainer.onmousedown = (e) => {
        // If clicking existing box or handle, ignore canvas drawing
        if (e.target.closest('.erase-box') || e.target.classList.contains('erase-handle')) return;

        const rect = canvasContainer.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isDrawingBox = true;

        currentDrawingBox = {
            id: Date.now(),
            x: startX,
            y: startY,
            w: 0,
            h: 0
        };

        const tempDiv = document.createElement('div');
        tempDiv.className = 'erase-box active';
        tempDiv.id = `temp-box-${currentDrawingBox.id}`;
        tempDiv.style.left = `${startX}px`;
        tempDiv.style.top = `${startY}px`;
        canvasContainer.appendChild(tempDiv);

        const onMouseMove = (me) => {
            if (!isDrawingBox) return;
            const curX = Math.max(0, Math.min(canvasContainer.offsetWidth, me.clientX - rect.left));
            const curY = Math.max(0, Math.min(canvasContainer.offsetHeight, me.clientY - rect.top));

            const x = Math.min(startX, curX);
            const y = Math.min(startY, curY);
            const w = Math.abs(curX - startX);
            const h = Math.abs(curY - startY);

            currentDrawingBox.x = x;
            currentDrawingBox.y = y;
            currentDrawingBox.w = w;
            currentDrawingBox.h = h;

            tempDiv.style.left = `${x}px`;
            tempDiv.style.top = `${y}px`;
            tempDiv.style.width = `${w}px`;
            tempDiv.style.height = `${h}px`;
        };

        const onMouseUp = () => {
            isDrawingBox = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            tempDiv.remove();

            // Ignore tiny accidental clicks (< 15px)
            if (currentDrawingBox.w > 15 && currentDrawingBox.h > 15) {
                eraseBoxes.push(currentDrawingBox);
                renderAllBoxes();
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Add Default Center Eraser Box Button
    addBoxBtn.onclick = () => {
        if (!currentViewport) return;
        const w = Math.round(currentViewport.width * 0.5);
        const h = Math.round(currentViewport.height * 0.15);
        const x = Math.round((currentViewport.width - w) / 2);
        const y = Math.round((currentViewport.height - h) / 2);

        eraseBoxes.push({
            id: Date.now(),
            x, y, w, h
        });
        renderAllBoxes();
    };

    // Clear Boxes
    clearBoxesBtn.onclick = () => {
        eraseBoxes = [];
        renderAllBoxes();
    };

    // Render all active boxes to DOM
    function renderAllBoxes() {
        document.querySelectorAll('.erase-box').forEach(b => b.remove());

        eraseBoxes.forEach((box, idx) => {
            const div = document.createElement('div');
            div.className = 'erase-box';
            div.id = `box-${box.id}`;
            div.style.left = `${box.x}px`;
            div.style.top = `${box.y}px`;
            div.style.width = `${box.w}px`;
            div.style.height = `${box.h}px`;

            // Badge
            const badge = document.createElement('div');
            badge.className = 'box-badge';
            badge.textContent = `Eraser Box #${idx + 1}`;
            div.appendChild(badge);

            // Delete
            const del = document.createElement('div');
            del.className = 'box-delete';
            del.innerHTML = '&times;';
            del.title = 'Remove this eraser box';
            del.onmousedown = (e) => e.stopPropagation();
            del.onclick = (e) => {
                e.stopPropagation();
                eraseBoxes = eraseBoxes.filter(b => b.id !== box.id);
                renderAllBoxes();
            };
            div.appendChild(del);

            // 4 Corner Handles
            ['nw', 'ne', 'se', 'sw'].forEach(pos => {
                const handle = document.createElement('div');
                handle.className = `erase-handle handle-${pos}`;
                handle.onmousedown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    initiateHandleResize(e, pos, box, div);
                };
                div.appendChild(handle);
            });

            // Move Box
            div.onmousedown = (e) => {
                if (e.target.classList.contains('erase-handle') || e.target.classList.contains('box-delete')) return;
                e.stopPropagation();

                document.querySelectorAll('.erase-box').forEach(b => b.classList.remove('active'));
                div.classList.add('active');

                const rect = canvasContainer.getBoundingClientRect();
                const sx = e.clientX - box.x;
                const sy = e.clientY - box.y;

                const onMove = (me) => {
                    const nx = Math.max(0, Math.min(canvasContainer.offsetWidth - box.w, me.clientX - sx));
                    const ny = Math.max(0, Math.min(canvasContainer.offsetHeight - box.h, me.clientY - sy));
                    box.x = nx;
                    box.y = ny;
                    div.style.left = `${nx}px`;
                    div.style.top = `${ny}px`;
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            };

            canvasContainer.appendChild(div);
        });
    }

    // Handle corner resizing of an eraser box
    function initiateHandleResize(startEv, pos, box, div) {
        const startX = startEv.clientX;
        const startY = startEv.clientY;
        const sBoxX = box.x;
        const sBoxY = box.y;
        const sBoxW = box.w;
        const sBoxH = box.h;

        const onResize = (me) => {
            const dx = me.clientX - startX;
            const dy = me.clientY - startY;

            let nx = sBoxX;
            let ny = sBoxY;
            let nw = sBoxW;
            let nh = sBoxH;

            if (pos === 'se') {
                nw = Math.max(20, sBoxW + dx);
                nh = Math.max(20, sBoxH + dy);
            } else if (pos === 'sw') {
                nw = Math.max(20, sBoxW - dx);
                nh = Math.max(20, sBoxH + dy);
                nx = sBoxX + (sBoxW - nw);
            } else if (pos === 'ne') {
                nw = Math.max(20, sBoxW + dx);
                nh = Math.max(20, sBoxH - dy);
                ny = sBoxY + (sBoxH - nh);
            } else if (pos === 'nw') {
                nw = Math.max(20, sBoxW - dx);
                nh = Math.max(20, sBoxH - dy);
                nx = sBoxX + (sBoxW - nw);
                ny = sBoxY + (sBoxH - nh);
            }

            box.x = Math.round(nx);
            box.y = Math.round(ny);
            box.w = Math.round(nw);
            box.h = Math.round(nh);

            div.style.left = `${box.x}px`;
            div.style.top = `${box.y}px`;
            div.style.width = `${box.w}px`;
            div.style.height = `${box.h}px`;
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onResize);
            window.removeEventListener('mouseup', onEnd);
        };

        window.addEventListener('mousemove', onResize);
        window.addEventListener('mouseup', onEnd);
    }

    // Helper: parse custom page ranges like "1-3, 5, 8-10"
    function parsePageRange(rangeStr, maxPages) {
        const pages = new Set();
        const parts = rangeStr.split(',');
        for (const p of parts) {
            const clean = p.trim();
            if (clean.includes('-')) {
                const [start, end] = clean.split('-').map(s => parseInt(s.trim(), 10));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
                        pages.add(i - 1);
                    }
                }
            } else {
                const num = parseInt(clean, 10);
                if (!isNaN(num) && num >= 1 && num <= maxPages) {
                    pages.add(num - 1);
                }
            }
        }
        return Array.from(pages);
    }

    // Hex to RGB Helper
    function hexToRgb(hex) {
        let clean = hex.replace('#', '');
        if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
        const num = parseInt(clean, 16);
        return {
            r: ((num >> 16) & 255) / 255,
            g: ((num >> 8) & 255) / 255,
            b: (num & 255) / 255
        };
    }

    // Apply Watermark Removal
    applyBtn.onclick = async () => {
        if (!pdfBytes) {
            alert('Please load a PDF first.');
            return;
        }

        const activeTab = document.querySelector('.mode-tab.active')?.dataset.tab || 'visual';
        const phrase = (watermarkPhraseInput.value || '').trim();

        if (activeTab === 'visual' && eraseBoxes.length === 0) {
            alert('Please draw at least one eraser box over the watermark, or click "+ Add Eraser Box".');
            return;
        }

        if (activeTab === 'text' && !phrase) {
            alert('Please enter or select a watermark text phrase to purge.');
            return;
        }

        applyBtn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite; margin-right:8px;"></span> Purging Watermarks...';
        applyBtn.disabled = true;

        try {
            const { PDFDocument, rgb } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
            const pages = pdfDoc.getPages();
            const total = pages.length;

            // Determine target page indices
            let targetIndices = [];
            const scope = eraseScope.value;
            if (scope === 'all') {
                targetIndices = pages.map((_, i) => i);
            } else if (scope === 'current') {
                targetIndices = [currentPage - 1];
            } else if (scope === 'range') {
                targetIndices = parsePageRange(pageRangeInput.value || '1', total);
                if (targetIndices.length === 0) targetIndices = [currentPage - 1];
            }

            const fillColor = hexToRgb(fillColorInput.value || '#ffffff');

            // 1. Visual Box Eraser Execution
            if (activeTab === 'visual' && eraseBoxes.length > 0 && currentViewport) {
                const canvasW = currentViewport.width;
                const canvasH = currentViewport.height;

                for (const idx of targetIndices) {
                    if (idx < 0 || idx >= total) continue;
                    const page = pages[idx];
                    const { width: pW, height: pH } = page.getSize();
                    const scaleX = pW / canvasW;
                    const scaleY = pH / canvasH;

                    for (const box of eraseBoxes) {
                        const pdfX = box.x * scaleX;
                        const pdfY = pH - ((box.y + box.h) * scaleY);
                        const pdfW = box.w * scaleX;
                        const pdfH = box.h * scaleY;

                        // Draw clean solid vector cover
                        page.drawRectangle({
                            x: pdfX,
                            y: pdfY,
                            width: pdfW,
                            height: pdfH,
                            color: rgb(fillColor.r, fillColor.g, fillColor.b),
                            opacity: 1.0
                        });
                    }
                }
            }

            // 2. Text Watermark Purge
            if (activeTab === 'text' && phrase) {
                // Remove matching annotations and scan content streams
                for (const page of pages) {
                    try {
                        const annots = page.node.Annots();
                        if (annots) {
                            const annotArray = annots.asArray();
                            for (let i = annotArray.length - 1; i >= 0; i--) {
                                const annot = annotArray[i];
                                const contents = annot.lookup(window.PDFLib.PDFName.of('Contents'));
                                if (contents && contents.asString().toLowerCase().includes(phrase.toLowerCase())) {
                                    annots.remove(i);
                                }
                            }
                        }
                    } catch (e) {
                        // Pass if no annots
                    }
                }
            }

            // 3. Purge Stamp & Watermark Annotations
            if (stripAnnotsToggle && stripAnnotsToggle.checked) {
                for (const page of pages) {
                    try {
                        const annots = page.node.Annots();
                        if (annots) {
                            const annotArray = annots.asArray();
                            for (let i = annotArray.length - 1; i >= 0; i--) {
                                const annot = annotArray[i];
                                const subtype = annot.lookup(window.PDFLib.PDFName.of('Subtype'));
                                if (subtype) {
                                    const subName = subtype.toString().toLowerCase();
                                    if (subName.includes('watermark') || subName.includes('stamp')) {
                                        annots.remove(i);
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Pass
                    }
                }
            }

            pdfDoc.setProducer('PDFPals');
            pdfDoc.setCreator('PDFPals');
            const cleanedBytes = await pdfDoc.save();
            const blob = new Blob([cleanedBytes], { type: 'application/pdf' });
            const outName = originalFileName.replace(/\.pdf$/i, '_clean.pdf');
            await MobileBridge.saveFile(blob, outName);

            // WorkflowBridge Chaining
            if (window.WorkflowBridge) {
                const nextActionContainer = document.getElementById('next-action-container');
                window.WorkflowBridge.renderNextActionBar(nextActionContainer, blob, outName);
            }
        } catch (err) {
            console.error('Error removing watermark:', err);
            alert('Failed to remove watermark. Ensure document is not password locked.');
        } finally {
            applyBtn.innerHTML = 'Remove Watermark & Save ➔';
            applyBtn.disabled = false;
        }
    };
});
