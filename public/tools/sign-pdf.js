import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

// Standardize worker path for all environments
const workerSrc = new URL('../vendor/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Sign PDF Logic
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const pdfContainer = document.getElementById('pdf-container');
    const signatureModal = document.getElementById('signature-modal');
    const addSignatureBtn = document.getElementById('add-signature-btn');
    const closeModalBtn = document.querySelector('.close-modal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const signerNameInput = document.getElementById('signer-name');
    const signerInitialsInput = document.getElementById('signer-initials');
    const saveSignatureBtn = document.getElementById('save-signature-btn');
    const mySignaturesList = document.getElementById('my-signatures-list');
    const signatureTypePreview = document.getElementById('signature-type-preview');
    const fontList = document.getElementById('font-list');
    const colorBtns = document.querySelectorAll('.color-btn');
    const sigFileInput = document.getElementById('sig-file-input');
    const sigUploadZone = document.getElementById('signature-upload-zone');
    const uploadPrompt = document.getElementById('upload-prompt');
    const uploadPreviewContainer = document.getElementById('upload-preview-container');
    const uploadPreviewImg = document.getElementById('upload-preview-img');
    const uploadChangeBtn = document.getElementById('upload-change-btn');
    const signaturePad = document.getElementById('signature-pad');
    const clearPad = document.getElementById('clear-pad');
    const applyBtn = document.getElementById('apply-signatures');
    const customColorInput = document.getElementById('custom-color');
    const changePdfBtn = document.getElementById('change-pdf-btn');

    let pdfBytes = null;
    let placedElements = [];
    let savedSignatures = [];
    let activeColor = '#000000';
    let activeFont = "'Caveat', cursive";
    let activeMode = 'tab-draw';
    let isDrawing = false;
    let ctx = null;
    let pendingUpload = null;
    let activeSelectedElementId = null;

    if (signaturePad) {
        ctx = signaturePad.getContext('2d');
    }

    const signatureFonts = [
        { name: 'Caveat', family: "'Caveat', cursive" },
        { name: 'Dancing Script', family: "'Dancing Script', cursive" },
        { name: 'Pacifico', family: "'Pacifico', cursive" },
        { name: 'Satisfy', family: "'Satisfy', cursive" },
        { name: 'Marck Script', family: "'Marck Script', cursive" }
    ];

    // Initialize Fonts
    function initFonts() {
        fontList.innerHTML = '';
        signatureFonts.forEach(font => {
            const btn = document.createElement('div');
            btn.className = 'font-option';
            if (font.family === activeFont) btn.classList.add('active');
            btn.style.fontFamily = font.family;
            btn.innerText = signerNameInput.value || 'Signature';
            btn.onclick = () => {
                document.querySelectorAll('.font-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFont = font.family;
                updateTypePreview();
            };
            fontList.appendChild(btn);
        });
    }

    function updateTypePreview() {
        const text = signerNameInput.value || 'Signature';
        signatureTypePreview.style.fontFamily = activeFont;
        signatureTypePreview.style.color = activeColor;
        signatureTypePreview.innerText = text;

        document.querySelectorAll('.font-option').forEach(btn => {
            btn.innerText = text;
        });
    }

    signerNameInput.oninput = updateTypePreview;

    // Modal & Tab Logic
    addSignatureBtn.onclick = () => {
        signatureModal.classList.remove('hidden');
        resizeCanvas();
        initFonts();
    };

    closeModalBtn.onclick = () => signatureModal.classList.add('hidden');

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            const target = btn.dataset.tab;
            document.getElementById(target).classList.remove('hidden');
            activeMode = target;
            if (activeMode === 'tab-draw') resizeCanvas();
        };
    });

    colorBtns.forEach(btn => {
        btn.onclick = () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            colorBtns.forEach(b => b.style.borderColor = 'transparent');
            btn.classList.add('active');
            btn.style.borderColor = '#fff';
            activeColor = btn.dataset.color;
            if (ctx) ctx.strokeStyle = activeColor;
            updateTypePreview();
        };
    });

    if (customColorInput) {
        customColorInput.oninput = (e) => {
            colorBtns.forEach(b => b.classList.remove('active'));
            colorBtns.forEach(b => b.style.borderColor = 'transparent');
            activeColor = e.target.value;
            if (ctx) ctx.strokeStyle = activeColor;
            updateTypePreview();
        };
    }

    // Drawing Canvas Config
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = signaturePad.offsetWidth || 600;
        const height = 200;
        signaturePad.width = width * ratio;
        signaturePad.height = height * ratio;
        signaturePad.style.width = width + 'px';
        signaturePad.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = activeColor;
    }

    signaturePad.addEventListener('mousedown', startDrawing);
    signaturePad.addEventListener('mousemove', draw);
    signaturePad.addEventListener('mouseup', stopDrawing);

    signaturePad.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = signaturePad.getBoundingClientRect();
        startDrawing({ offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top });
        e.preventDefault();
    });
    signaturePad.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const rect = signaturePad.getBoundingClientRect();
        draw({ offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top });
        e.preventDefault();
    });
    signaturePad.addEventListener('touchend', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        ctx.beginPath();
        const x = e.offsetX || (e.clientX - signaturePad.getBoundingClientRect().left);
        const y = e.offsetY || (e.clientY - signaturePad.getBoundingClientRect().top);
        ctx.moveTo(x, y);
    }

    function draw(e) {
        if (!isDrawing) return;
        const x = e.offsetX || (e.clientX - signaturePad.getBoundingClientRect().left);
        const y = e.offsetY || (e.clientY - signaturePad.getBoundingClientRect().top);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    clearPad.onclick = (e) => {
        e.preventDefault();
        ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    };

    // Upload Signature Image Handling
    function handleSignatureImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, WebP, SVG).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (re) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const tCtx = canvas.getContext('2d');
                tCtx.clearRect(0, 0, canvas.width, canvas.height);
                tCtx.drawImage(img, 0, 0);

                const dataUrl = canvas.toDataURL('image/png');
                pendingUpload = {
                    dataUrl,
                    width: canvas.width,
                    height: canvas.height
                };

                // Show preview inside modal
                if (uploadPreviewImg && uploadPreviewContainer && uploadPrompt) {
                    uploadPreviewImg.src = dataUrl;
                    uploadPrompt.classList.add('hidden');
                    uploadPreviewContainer.classList.remove('hidden');
                }
            };
            img.src = re.target.result;
        };
        reader.readAsDataURL(file);
    }

    if (sigUploadZone) {
        sigUploadZone.onclick = (e) => {
            if (e.target === uploadChangeBtn || e.target.closest('#upload-change-btn')) {
                sigFileInput.click();
            } else if (!pendingUpload) {
                sigFileInput.click();
            }
        };

        sigUploadZone.ondragover = (e) => {
            e.preventDefault();
            sigUploadZone.style.borderColor = 'var(--primary)';
            sigUploadZone.style.background = 'rgba(var(--primary-rgb), 0.08)';
        };

        sigUploadZone.ondragleave = () => {
            sigUploadZone.style.borderColor = 'rgba(255,255,255,0.2)';
            sigUploadZone.style.background = 'transparent';
        };

        sigUploadZone.ondrop = (e) => {
            e.preventDefault();
            sigUploadZone.style.borderColor = 'rgba(255,255,255,0.2)';
            sigUploadZone.style.background = 'transparent';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleSignatureImageFile(e.dataTransfer.files[0]);
            }
        };
    }

    if (sigFileInput) {
        sigFileInput.onchange = (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSignatureImageFile(e.target.files[0]);
            }
        };
    }

    if (uploadChangeBtn) {
        uploadChangeBtn.onclick = (e) => {
            e.stopPropagation();
            sigFileInput.click();
        };
    }

    // Save Signature from Modal
    saveSignatureBtn.onclick = () => {
        if (activeMode === 'tab-draw') {
            const dataUrl = signaturePad.toDataURL();
            addSavedSignature(dataUrl, signaturePad.width, signaturePad.height);
        } else if (activeMode === 'tab-type') {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 200;
            const tCtx = canvas.getContext('2d');
            tCtx.clearRect(0, 0, canvas.width, canvas.height);
            tCtx.fillStyle = activeColor;
            tCtx.font = `60px ${activeFont}`;
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            tCtx.fillText(signerNameInput.value || 'Signature', 300, 100);
            addSavedSignature(canvas.toDataURL(), 600, 200);
        } else if (activeMode === 'tab-upload') {
            if (!pendingUpload) {
                alert('Please choose or drop an image first.');
                return;
            }
            addSavedSignature(pendingUpload.dataUrl, pendingUpload.width, pendingUpload.height);
            // Reset upload preview
            pendingUpload = null;
            if (uploadPrompt) uploadPrompt.classList.remove('hidden');
            if (uploadPreviewContainer) uploadPreviewContainer.classList.add('hidden');
            if (sigFileInput) sigFileInput.value = '';
        }
        signatureModal.classList.add('hidden');
    };

    function addSavedSignature(dataUrl, naturalWidth = 300, naturalHeight = 150) {
        const id = Date.now();
        const aspect = (naturalWidth && naturalHeight) ? (naturalWidth / naturalHeight) : 2;
        savedSignatures.push({ id, dataUrl, naturalWidth, naturalHeight, aspect });

        const item = document.createElement('div');
        item.className = 'signature-preview-item';
        item.draggable = true;
        item.dataset.id = id;
        item.dataset.type = 'signature';
        item.title = 'Click to place on PDF or drag & drop';

        const img = new Image();
        img.src = dataUrl;
        img.draggable = false;
        img.style.pointerEvents = 'none';

        const del = document.createElement('button');
        del.className = 'delete-sig-btn';
        del.innerHTML = '&times;';
        del.title = 'Delete credential';
        del.onclick = (e) => {
            e.stopPropagation();
            savedSignatures = savedSignatures.filter(s => s.id !== id);
            item.remove();
        };

        item.appendChild(img);
        item.appendChild(del);

        // Click-to-place support
        item.onclick = (e) => {
            if (e.target === del || e.target.closest('.delete-sig-btn')) return;
            placeAtCurrentViewport('signature', id);
        };

        item.ondragstart = (e) => {
            e.dataTransfer.setData('source-type', 'signature');
            e.dataTransfer.setData('source-id', id);
        };

        mySignaturesList.insertBefore(item, addSignatureBtn);

        // Automatically place on current PDF if workspace is ready
        if (pdfBytes) {
            placeAtCurrentViewport('signature', id);
        }
    }

    // Draggable / Clickable Sidebar Metadata Fields
    function bindDraggableFields() {
        document.querySelectorAll('.draggable-field').forEach(field => {
            field.style.cursor = 'pointer';
            field.title = 'Click to place on PDF or drag & drop';

            field.ondragstart = (e) => {
                e.dataTransfer.setData('source-type', field.dataset.type);
            };

            field.onclick = () => {
                placeAtCurrentViewport(field.dataset.type, null);
            };
        });
    }
    bindDraggableFields();

    // Helper: Find current visible page and place element in center
    function placeAtCurrentViewport(type, sigId) {
        const wrappers = document.querySelectorAll('.page-wrapper');
        if (wrappers.length === 0) return;

        let targetWrapper = wrappers[0];
        const previewPanel = document.querySelector('.preview-panel');
        const scrollMid = previewPanel ? (previewPanel.scrollTop + previewPanel.clientHeight / 2) : 0;

        for (const w of wrappers) {
            const wTop = w.offsetTop;
            const wBottom = wTop + w.offsetHeight;
            if (scrollMid >= wTop && scrollMid <= wBottom) {
                targetWrapper = w;
                break;
            }
        }

        const pageIndex = parseInt(targetWrapper.dataset.pageIndex, 10);
        const centerX = targetWrapper.offsetWidth / 2;
        const centerY = targetWrapper.offsetHeight / 2;
        const viewport = {
            width: targetWrapper.offsetWidth,
            height: targetWrapper.offsetHeight
        };

        placeElement(type, pageIndex, centerX, centerY, viewport, sigId);
    }

    // PDF Loading & Drop Zone
    dropZone.onclick = (e) => {
        if (e.target.tagName !== 'LABEL') {
            fileInput.click();
        }
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
    dropZone.ondragleave = () => dropZone.classList.remove('active');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') handleFile(file);
    };

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    };

    if (changePdfBtn) {
        changePdfBtn.onclick = () => {
            pdfBytes = null;
            placedElements = [];
            pdfContainer.innerHTML = '';
            workspace.classList.add('hidden');
            dropZone.classList.remove('hidden');
            fileInput.value = '';
        };
    }

    async function handleFile(file) {
        const buffer = await file.arrayBuffer();
        pdfBytes = new Uint8Array(buffer);
        dropZone.classList.add('hidden');
        workspace.classList.remove('hidden');
        requestAnimationFrame(() => renderPDF());
    }

    if (window.WorkflowBridge) {
        window.WorkflowBridge.checkIncomingPipeline(handleFile);
    }

    // Render PDF Pages
    async function renderPDF() {
        if (!pdfBytes) return;
        pdfContainer.innerHTML = '<div class="spinner-container" style="display:flex; flex-direction:column; align-items:center; gap:1rem;"><span class="spinner" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-top-color:var(--primary-color); border-radius:50%; animation: spin 1s linear infinite;"></span><p style="opacity:0.6;">Rendering PDF...</p></div>';
        try {
            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
            const pdf = await loadingTask.promise;
            pdfContainer.innerHTML = '';
            const containerWidth = pdfContainer.parentElement.clientWidth - 40;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const stdViewport = page.getViewport({ scale: 1.0 });
                const fitScale = Math.min(1.5, Math.max(0.5, containerWidth / stdViewport.width));
                const viewport = page.getViewport({ scale: fitScale });

                const wrapper = document.createElement('div');
                wrapper.className = 'page-wrapper';
                wrapper.dataset.pageIndex = i - 1;
                wrapper.style.width = `${viewport.width}px`;
                wrapper.style.height = `${viewport.height}px`;

                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

                const overlay = document.createElement('div');
                overlay.className = 'signature-overlay';

                overlay.ondragover = (e) => e.preventDefault();
                overlay.ondrop = (e) => {
                    e.preventDefault();
                    const rect = overlay.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    const type = e.dataTransfer.getData('source-type');
                    const sigId = e.dataTransfer.getData('source-id');

                    placeElement(type, i - 1, x, y, viewport, sigId);
                };

                // Deselect fields when clicking background
                overlay.onclick = (e) => {
                    if (e.target === overlay) {
                        deselectAllFields();
                    }
                };

                wrapper.appendChild(canvas);
                wrapper.appendChild(overlay);
                pdfContainer.appendChild(wrapper);
            }
        } catch (err) {
            console.error(err);
            pdfContainer.innerHTML = 'Error rendering PDF.';
        }
    }

    function deselectAllFields() {
        activeSelectedElementId = null;
        document.querySelectorAll('.placed-field').forEach(f => {
            f.classList.remove('selected');
            const tb = f.querySelector('.field-toolbar');
            if (tb) tb.classList.add('hidden');
        });
    }

    function placeElement(type, pageIndex, x, y, viewport, sigId) {
        if (!type) return;

        let content = '';
        let width = 160;
        let height = 50;
        let aspectRatio = 160 / 50;

        if (type === 'signature') {
            const sig = savedSignatures.find(s => s.id == sigId);
            if (!sig) return;
            content = sig.dataUrl;
            aspectRatio = sig.aspect || (sig.naturalWidth && sig.naturalHeight ? sig.naturalWidth / sig.naturalHeight : 2);
            
            // Smart proportional sizing
            const maxW = 200;
            const maxH = 100;
            if (aspectRatio >= 1) {
                width = maxW;
                height = Math.round(width / aspectRatio);
                if (height > maxH) {
                    height = maxH;
                    width = Math.round(height * aspectRatio);
                }
            } else {
                height = maxH;
                width = Math.round(height * aspectRatio);
            }
        } else if (type === 'name') {
            content = signerNameInput.value || 'Authorized Name';
            width = 170; height = 44;
            aspectRatio = 170 / 44;
        } else if (type === 'date') {
            content = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            width = 130; height = 36;
            aspectRatio = 130 / 36;
        } else if (type === 'initials') {
            content = signerInitialsInput.value || 'JD';
            width = 70; height = 40;
            aspectRatio = 70 / 40;
        }

        const id = Date.now();
        const element = {
            id,
            type,
            content,
            pageIndex,
            x: Math.max(10, Math.round(x - (width / 2))),
            y: Math.max(10, Math.round(y - (height / 2))),
            width,
            height,
            initialWidth: width,
            initialHeight: height,
            vWidth: viewport.width,
            vHeight: viewport.height,
            color: activeColor,
            font: activeFont,
            aspectRatio
        };

        placedElements.push(element);
        renderPlacedElement(element);
    }

    function renderPlacedElement(el) {
        const wrapper = document.querySelector(`.page-wrapper[data-page-index="${el.pageIndex}"]`);
        if (!wrapper) return;

        const div = document.createElement('div');
        div.className = `placed-field ${el.type}-obj selected`;
        div.id = `el-${el.id}`;
        div.style.left = `${el.x}px`;
        div.style.top = `${el.y}px`;
        div.style.width = `${el.width}px`;
        div.style.height = `${el.height}px`;

        // Content
        if (el.type === 'signature') {
            const img = new Image();
            img.src = el.content;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.draggable = false;
            img.style.pointerEvents = 'none';
            div.appendChild(img);
        } else {
            div.innerText = el.content;
            div.style.fontSize = `${Math.round(el.height * 0.48)}px`;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.color = el.color;
            div.style.fontFamily = el.type === 'initials' ? el.font : 'inherit';
            div.style.fontWeight = 'bold';
        }

        // Delete button (✕)
        const del = document.createElement('div');
        del.className = 'field-delete';
        del.innerHTML = '&times;';
        del.title = 'Remove';
        del.onmousedown = (e) => e.stopPropagation();
        del.onclick = (e) => {
            e.stopPropagation();
            placedElements = placedElements.filter(ev => ev.id !== el.id);
            div.remove();
        };
        div.appendChild(del);

        // Floating Quick Sizing Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'field-toolbar';
        toolbar.onmousedown = (e) => e.stopPropagation();

        const btnDec = document.createElement('button');
        btnDec.className = 'tb-btn';
        btnDec.innerHTML = '&minus;';
        btnDec.title = 'Shrink size (-15%)';
        btnDec.onclick = (e) => {
            e.stopPropagation();
            scaleElement(el, div, 0.85);
        };

        const sizeLabel = document.createElement('span');
        sizeLabel.className = 'tb-label';
        sizeLabel.textContent = '100%';

        const btnInc = document.createElement('button');
        btnInc.className = 'tb-btn';
        btnInc.innerHTML = '&plus;';
        btnInc.title = 'Enlarge size (+15%)';
        btnInc.onclick = (e) => {
            e.stopPropagation();
            scaleElement(el, div, 1.15);
        };

        const divider = document.createElement('div');
        divider.className = 'tb-divider';

        const btnDel = document.createElement('button');
        btnDel.className = 'tb-btn';
        btnDel.innerHTML = '🗑️';
        btnDel.title = 'Delete element';
        btnDel.style.fontSize = '12px';
        btnDel.onclick = (e) => {
            e.stopPropagation();
            placedElements = placedElements.filter(ev => ev.id !== el.id);
            div.remove();
        };

        toolbar.appendChild(btnDec);
        toolbar.appendChild(sizeLabel);
        toolbar.appendChild(btnInc);
        toolbar.appendChild(divider);
        toolbar.appendChild(btnDel);
        div.appendChild(toolbar);

        // 4 Corner Resize Handles
        const handles = ['se', 'sw', 'ne', 'nw'];
        handles.forEach(pos => {
            const h = document.createElement('div');
            h.className = `resize-handle ${pos}`;
            h.dataset.pos = pos;
            div.appendChild(h);

            // Direct Handle Dragging Logic
            h.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                initiateResize(e, pos, el, div, sizeLabel);
            };

            h.ontouchstart = (e) => {
                if (e.touches.length === 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    initiateResize(e.touches[0], pos, el, div, sizeLabel);
                }
            };
        });

        wrapper.appendChild(div);
        deselectAllFields();
        div.classList.add('selected');
        activeSelectedElementId = el.id;

        // Selection & Dragging Movement
        div.onmousedown = (e) => {
            if (e.target.classList.contains('resize-handle') || e.target.closest('.field-toolbar') || e.target.classList.contains('field-delete')) {
                return;
            }

            deselectAllFields();
            div.classList.add('selected');
            const tb = div.querySelector('.field-toolbar');
            if (tb) tb.classList.remove('hidden');
            activeSelectedElementId = el.id;

            let sx = e.clientX - div.offsetLeft;
            let sy = e.clientY - div.offsetTop;
            document.body.style.cursor = 'grabbing';
            div.style.zIndex = '1000';

            const onMouseMove = (me) => {
                const newX = Math.max(0, Math.min(wrapper.offsetWidth - el.width, me.clientX - sx));
                const newY = Math.max(0, Math.min(wrapper.offsetHeight - el.height, me.clientY - sy));
                el.x = newX;
                el.y = newY;
                div.style.left = `${newX}px`;
                div.style.top = `${newY}px`;
            };

            const onMouseUp = () => {
                document.body.style.cursor = '';
                div.style.zIndex = '20';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };
    }

    function scaleElement(el, div, factor) {
        const minW = 35;
        const maxW = 500;
        const newW = Math.max(minW, Math.min(maxW, Math.round(el.width * factor)));
        const newH = Math.max(15, Math.round(newW / el.aspectRatio));

        el.width = newW;
        el.height = newH;
        div.style.width = `${newW}px`;
        div.style.height = `${newH}px`;

        if (el.type !== 'signature') {
            div.style.fontSize = `${Math.round(newH * 0.48)}px`;
        }

        const sizeLabel = div.querySelector('.tb-label');
        if (sizeLabel) {
            const pct = Math.round((newW / el.initialWidth) * 100);
            sizeLabel.textContent = `${pct}%`;
        }
    }

    function initiateResize(startEvent, pos, el, div, sizeLabel) {
        const startX = startEvent.clientX;
        const startY = startEvent.clientY;
        const startW = el.width;
        const startH = el.height;
        const startLeft = el.x;
        const startTop = el.y;
        document.body.style.cursor = pos.includes('se') || pos.includes('nw') ? 'nwse-resize' : 'nesw-resize';

        const onResizeMove = (me) => {
            const clientX = me.clientX !== undefined ? me.clientX : (me.touches ? me.touches[0].clientX : startX);
            const clientY = me.clientY !== undefined ? me.clientY : (me.touches ? me.touches[0].clientY : startY);
            const dx = clientX - startX;
            const dy = clientY - startY;

            let newW = startW;
            let newH = startH;
            let newX = startLeft;
            let newY = startTop;

            if (pos === 'se') {
                newW = Math.max(35, startW + dx);
                newH = el.type === 'signature' ? (newW / el.aspectRatio) : Math.max(15, startH + dy);
            } else if (pos === 'sw') {
                newW = Math.max(35, startW - dx);
                newH = el.type === 'signature' ? (newW / el.aspectRatio) : Math.max(15, startH + dy);
                newX = startLeft + (startW - newW);
            } else if (pos === 'ne') {
                newW = Math.max(35, startW + dx);
                newH = el.type === 'signature' ? (newW / el.aspectRatio) : Math.max(15, startH - dy);
                newY = startTop + (startH - newH);
            } else if (pos === 'nw') {
                newW = Math.max(35, startW - dx);
                newH = el.type === 'signature' ? (newW / el.aspectRatio) : Math.max(15, startH - dy);
                newX = startLeft + (startW - newW);
                newY = startTop + (startH - newH);
            }

            el.width = Math.round(newW);
            el.height = Math.round(newH);
            el.x = Math.round(newX);
            el.y = Math.round(newY);

            div.style.width = `${el.width}px`;
            div.style.height = `${el.height}px`;
            div.style.left = `${el.x}px`;
            div.style.top = `${el.y}px`;

            if (el.type !== 'signature') {
                div.style.fontSize = `${Math.round(el.height * 0.48)}px`;
            }

            if (sizeLabel) {
                const pct = Math.round((el.width / el.initialWidth) * 100);
                sizeLabel.textContent = `${pct}%`;
            }
        };

        const onResizeEnd = () => {
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', onResizeMove);
            window.removeEventListener('mouseup', onResizeEnd);
            window.removeEventListener('touchmove', onResizeMove);
            window.removeEventListener('touchend', onResizeEnd);
        };

        window.addEventListener('mousemove', onResizeMove);
        window.addEventListener('mouseup', onResizeEnd);
        window.addEventListener('touchmove', onResizeMove, { passive: true });
        window.addEventListener('touchend', onResizeEnd);
    }

    // Apply & Save to PDF
    applyBtn.onclick = async () => {
        if (!pdfBytes) {
            alert('No PDF loaded.');
            return;
        }
        if (placedElements.length === 0) {
            alert('Please place at least one signature or identity credential on the PDF.');
            return;
        }

        applyBtn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite; margin-right:8px;"></span> Burning In Signatures...';
        applyBtn.disabled = true;

        try {
            const { PDFDocument } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(pdfBytes.slice(0));
            const pages = pdfDoc.getPages();

            for (const el of placedElements) {
                const page = pages[el.pageIndex];
                const { width, height } = page.getSize();
                const scaleX = width / el.vWidth;
                const scaleY = height / el.vHeight;
                const pdfX = el.x * scaleX;
                const pdfY = height - ((el.y + el.height) * scaleY);

                // High-res canvas rendering loop
                const renderCanvas = document.createElement('canvas');
                const renderScale = 4;
                renderCanvas.width = Math.max(10, el.width * renderScale);
                renderCanvas.height = Math.max(10, el.height * renderScale);
                const rCtx = renderCanvas.getContext('2d');

                if (el.type === 'signature') {
                    const img = await new Promise((res) => {
                        const i = new Image();
                        i.onload = () => res(i);
                        i.onerror = () => res(i);
                        i.src = el.content;
                    });

                    rCtx.drawImage(img, 0, 0, renderCanvas.width, renderCanvas.height);
                } else {
                    rCtx.fillStyle = el.color;
                    const font = el.type === 'initials' ? el.font : 'Inter, sans-serif';
                    rCtx.font = `bold ${renderCanvas.height * 0.55}px ${font}`;
                    rCtx.textAlign = 'center';
                    rCtx.textBaseline = 'middle';
                    rCtx.fillText(el.content, renderCanvas.width / 2, renderCanvas.height / 2);
                }

                const imgData = renderCanvas.toDataURL('image/png');
                const embeddedImage = await pdfDoc.embedPng(imgData);

                page.drawImage(embeddedImage, {
                    x: pdfX,
                    y: pdfY,
                    width: el.width * scaleX,
                    height: el.height * scaleY,
                });
            }

            // Flatten Document (Burn in Signature)
            const flattenToggle = document.getElementById('flatten-signature-toggle');
            if (flattenToggle && flattenToggle.checked) {
                try {
                    const form = pdfDoc.getForm();
                    form.flatten();
                } catch (e) {
                    // Ignore if no AcroForm in document
                }
            }

            pdfDoc.setProducer('PDFPals');
            pdfDoc.setCreator('PDFPals');
            const signedBytes = await pdfDoc.save();
            const blob = new Blob([signedBytes], { type: 'application/pdf' });
            await MobileBridge.saveFile(blob, 'signed_by_pdfpals.pdf');

            // Render WorkflowBridge Next Action chaining bar
            if (window.WorkflowBridge) {
                const nextActionContainer = document.getElementById('next-action-container');
                window.WorkflowBridge.renderNextActionBar(nextActionContainer, blob, 'signed_by_pdfpals.pdf');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving PDF.');
        } finally {
            applyBtn.innerText = 'Authorize & Download ➔';
            applyBtn.disabled = false;
        }
    };
});
