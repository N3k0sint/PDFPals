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

        // Update all font previews
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
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before scale
        ctx.scale(ratio, ratio);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = activeColor;
    }

    signaturePad.addEventListener('mousedown', startDrawing);
    signaturePad.addEventListener('mousemove', draw);
    signaturePad.addEventListener('mouseup', stopDrawing);

    // Touch Support
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

    // File Handling (Upload Zone)
    dropZone.onclick = (e) => {
        // Only trigger click if the event didn't come from the label's default behavior
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

    // Modal & Tab Logic

    // Save Signature
    saveSignatureBtn.onclick = () => {
        if (activeMode === 'tab-draw') {
            addSavedSignature(signaturePad.toDataURL());
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
            addSavedSignature(canvas.toDataURL());
        }
        signatureModal.classList.add('hidden');
    };

    // Change PDF / Reset
    if (changePdfBtn) {
        changePdfBtn.onclick = () => {
            pdfBytes = null;
            placedElements = [];
            pdfContainer.innerHTML = '';
            workspace.classList.add('hidden');
            dropZone.classList.remove('hidden');
            fileInput.value = ''; // Reset file input
        };
    }

    function addSavedSignature(dataUrl) {
        const id = Date.now();
        savedSignatures.push({ id, dataUrl });

        const item = document.createElement('div');
        item.className = 'signature-preview-item';
        item.draggable = true;
        item.dataset.id = id;
        item.dataset.type = 'signature';

        const img = new Image();
        img.src = dataUrl;

        const del = document.createElement('button');
        del.className = 'delete-sig-btn';
        del.innerHTML = '&times;';
        del.onclick = (e) => {
            e.stopPropagation();
            savedSignatures = savedSignatures.filter(s => s.id !== id);
            item.remove();
        };

        item.appendChild(img);
        item.appendChild(del);

        item.ondragstart = (e) => {
            e.dataTransfer.setData('source-type', 'signature');
            e.dataTransfer.setData('source-id', id);
        };

        mySignaturesList.insertBefore(item, addSignatureBtn);
    }

    // Sidebar Draggable Fields
    function bindDraggableFields() {
        document.querySelectorAll('.draggable-field').forEach(field => {
            field.ondragstart = (e) => {
                e.dataTransfer.setData('source-type', field.dataset.type);
            };
        });
    }
    bindDraggableFields();

    // Workspace Drop & Place
    async function renderPDF() {
        if (!pdfBytes) return;
        pdfContainer.innerHTML = '<div class="spinner-container" style="display:flex; flex-direction:column; align-items:center; gap:1rem;"><span class="spinner" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.1); border-top-color:var(--primary-color); border-radius:50%; animation: spin 1s linear infinite;"></span><p style="opacity:0.6;">Rendering PDF...</p></div>';
        try {
            // Standardize loading with cloned buffer
            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
            const pdf = await loadingTask.promise;
            pdfContainer.innerHTML = '';
            const containerWidth = pdfContainer.parentElement.clientWidth - 40;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const stdViewport = page.getViewport({ scale: 1.0 });
                const fitScale = containerWidth / stdViewport.width;
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

                // Mobile "Tap-to-Place" Support
                overlay.onclick = (e) => {
                    if (window.innerWidth > 1024) return; // Only for mobile/tablet behavior
                    
                    // Find active selection or just use current initials/name if none
                    const selectedField = document.querySelector('.draggable-field.active');
                    const type = selectedField ? selectedField.dataset.type : 'initials';
                    
                    const rect = overlay.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // For signatures, we need a saved one. If none, do nothing.
                    if (type === 'signature' && savedSignatures.length === 0) return;
                    const sigId = type === 'signature' ? savedSignatures[savedSignatures.length - 1].id : null;

                    placeElement(type, i - 1, x, y, viewport, sigId);
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

    function placeElement(type, pageIndex, x, y, viewport, sigId) {
        let content = '';
        let width = 150;
        let height = 50;

        if (type === 'signature') {
            const sig = savedSignatures.find(s => s.id == sigId);
            if (!sig) return;
            content = sig.dataUrl;
            width = 150; height = 75;
        } else if (type === 'name') {
            content = signerNameInput.value || 'Full Name';
        } else if (type === 'date') {
            content = new Date().toLocaleDateString();
        } else if (type === 'initials') {
            content = signerInitialsInput.value || 'Initials';
            width = 60; height = 40;
        }

        const id = Date.now();
        const element = {
            id, type, content, pageIndex,
            x: x - (width / 2),
            y: y - (height / 2),
            width, height,
            vWidth: viewport.width,
            vHeight: viewport.height,
            color: activeColor, // Capture current color
            font: activeFont,   // Capture current font
            aspectRatio: width / height // Store base aspect ratio
        };

        placedElements.push(element);
        renderPlacedElement(element);
    }

    function renderPlacedElement(el) {
        const wrapper = document.querySelector(`.page-wrapper[data-page-index="${el.pageIndex}"]`);
        const div = document.createElement('div');
        div.className = `placed-field ${el.type}-obj`;
        div.id = `el-${el.id}`;
        div.style.left = `${el.x}px`;
        div.style.top = `${el.y}px`;
        div.style.width = `${el.width}px`;
        div.style.height = `${el.height}px`;

        if (el.type === 'signature') {
            const img = new Image();
            img.src = el.content;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain'; // Prevent squishing in UI
            div.appendChild(img);
        } else {
            div.innerText = el.content;
            div.style.fontSize = `${el.height * 0.5}px`;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.color = el.color; // Use stored color
            div.style.fontFamily = el.type === 'initials' ? el.font : 'inherit'; // Use stored font
        }

        const del = document.createElement('div');
        del.className = 'field-delete';
        del.innerHTML = '&times;';
        del.title = "Remove";
        del.onclick = (e) => {
            e.stopPropagation();
            placedElements = placedElements.filter(ev => ev.id !== el.id);
            div.remove();
        };

        // Prevent dragging when clicking the delete button or resize handle
        del.onmousedown = (e) => e.stopPropagation();

        div.appendChild(del);

        const resizer = document.createElement('div');
        resizer.className = 'resize-handle';
        resizer.onmousedown = (e) => e.stopPropagation();
        div.appendChild(resizer);

        wrapper.appendChild(div);

        // Draggable inside PDF
        let isMov = false;
        let isRes = false;
        let sx, sy, sw, sh;

        div.onmousedown = (e) => {
            if (e.target.className === 'resize-handle') {
                isRes = true;
                sx = e.clientX;
                sy = e.clientY;
                sw = div.offsetWidth;
                sh = div.offsetHeight;
                e.preventDefault();
                e.stopPropagation();
            } else {
                isMov = true;
                sx = e.clientX - div.offsetLeft;
                sy = e.clientY - div.offsetTop;
                document.body.style.cursor = 'grabbing';
                div.style.zIndex = '10000';
                div.style.pointerEvents = 'none'; // Allow drop/drag through
                e.stopPropagation();
            }

            const onMouseMove = (me) => {
                if (isRes) {
                    const dx = me.clientX - sx;
                    const dy = me.clientY - sy;
                    
                    if (el.type === 'signature') {
                        // Maintain aspect ratio for signatures
                        const newWidth = Math.max(40, sw + dx);
                        el.width = newWidth;
                        el.height = newWidth / el.aspectRatio;
                    } else {
                        el.width = Math.max(40, sw + dx);
                        el.height = Math.max(20, sh + dy);
                    }

                    div.style.width = `${el.width}px`;
                    div.style.height = `${el.height}px`;
                    if (el.type !== 'signature') {
                        div.style.fontSize = `${el.height * 0.5}px`;
                    }
                } else if (isMov) {
                    el.x = me.clientX - sx;
                    el.y = me.clientY - sy;
                    div.style.left = `${el.x}px`;
                    div.style.top = `${el.y}px`;
                }
            };

            const onMouseUp = () => {
                isMov = false;
                isRes = false;
                document.body.style.cursor = '';
                div.style.zIndex = '20';
                div.style.pointerEvents = 'auto';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };
    }

    // Signature Creation Upload
    sigUploadZone.onclick = () => sigFileInput.click();
    sigFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const tCtx = canvas.getContext('2d');
                    tCtx.clearRect(0, 0, canvas.width, canvas.height);
                    tCtx.drawImage(img, 0, 0);
                    addSavedSignature(canvas.toDataURL());
                };
                img.src = re.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    async function handleFile(file) {
        const buffer = await file.arrayBuffer();
        pdfBytes = new Uint8Array(buffer);
        dropZone.classList.add('hidden');
        workspace.classList.remove('hidden');
        // Ensure DOM has updated layout before rendering
        requestAnimationFrame(() => renderPDF());
    }

    // Apply & Save
    applyBtn.onclick = async () => {
        if (!pdfBytes) {
            alert("No PDF loaded.");
            return;
        }
        if (placedElements.length === 0) {
            alert("Please place at least one element on the PDF.");
            return;
        }

        applyBtn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite; margin-right:8px;"></span> Hardening PDF...';
        applyBtn.disabled = true;

        try {
            const { PDFDocument, rgb } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(pdfBytes.slice(0));
            const pages = pdfDoc.getPages();

            for (const el of placedElements) {
                const page = pages[el.pageIndex];
                const { width, height } = page.getSize();
                const scaleX = width / el.vWidth;
                const scaleY = height / el.vHeight;
                const pdfX = el.x * scaleX;
                const pdfY = height - ((el.y + el.height) * scaleY);

                // Unified Rendering Loop: All elements are rendered to high-res canvas first
                const renderCanvas = document.createElement('canvas');
                const renderScale = 4; // High-res multiplier
                renderCanvas.width = el.width * renderScale;
                renderCanvas.height = el.height * renderScale;
                const rCtx = renderCanvas.getContext('2d');

                if (el.type === 'signature') {
                    const img = await new Promise((res) => {
                        const i = new Image();
                        i.onload = () => res(i);
                        i.src = el.content;
                    });
                    
                    // Fit image to high-res canvas while maintaining aspect ratio
                    const imgRatio = img.width / img.height;
                    const canvasRatio = renderCanvas.width / renderCanvas.height;
                    let drawW, drawH, drawX, drawY;

                    if (imgRatio > canvasRatio) {
                        drawW = renderCanvas.width;
                        drawH = drawW / imgRatio;
                        drawX = 0;
                        drawY = (renderCanvas.height - drawH) / 2;
                    } else {
                        drawH = renderCanvas.height;
                        drawW = drawH * imgRatio;
                        drawX = (renderCanvas.width - drawW) / 2;
                        drawY = 0;
                    }

                    rCtx.drawImage(img, drawX, drawY, drawW, drawH);
                } else {
                    // Use captured styles (color/font)
                    rCtx.fillStyle = el.color;
                    const font = el.type === 'initials' ? el.font : 'Inter, sans-serif';
                    rCtx.font = `bold ${renderCanvas.height * 0.6}px ${font}`;
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

            pdfDoc.setProducer('PDFPals');
            pdfDoc.setCreator('PDFPals');
            const signedBytes = await pdfDoc.save();
            const blob = new Blob([signedBytes], { type: 'application/pdf' });
            await MobileBridge.saveFile(blob, 'signed_by_pdfpals.pdf');
        } catch (err) {
            console.error(err);
            alert("Error saving PDF.");
        } finally {
            applyBtn.innerText = "Sign & Download ➔";
            applyBtn.disabled = false;
        }
    };
});
