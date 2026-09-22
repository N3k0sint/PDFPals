import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

const workerSrc = new URL('../vendor/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const dropZoneMain = document.getElementById('drop-zone-main');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.querySelector('.browse-btn');
    const formWorkspace = document.getElementById('form-workspace');
    const documentPanel = document.getElementById('document-scroll-panel');
    const btnSwitchFile = document.getElementById('btn-switch-file');
    const btnSavePdf = document.getElementById('btn-save-pdf');
    const fieldCountDisplay = document.getElementById('field-count-display');
    const fieldsList = document.getElementById('fields-list');
    const noFieldsBox = document.getElementById('no-fields-box');
    const nextActionContainer = document.getElementById('next-action-container');

    let currentPdfFile = null;
    let pdfBytes = null;
    let pdfLibDoc = null;
    let fieldValues = new Map(); // fieldName -> value
    let pageViewports = [];

    // Dropzone setup
    if (browseBtn) browseBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    };

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };

    // Auto-check WorkflowBridge incoming pipeline
    if (window.WorkflowBridge) {
        window.WorkflowBridge.checkIncomingPipeline(handleFile);
    }

    async function handleFile(file) {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            return alert('Please select a valid PDF file.');
        }

        currentPdfFile = file;
        const buffer = await file.arrayBuffer();
        pdfBytes = new Uint8Array(buffer);

        dropZoneMain.classList.add('hidden');
        formWorkspace.classList.remove('hidden');

        renderFormDocument();
    }

    async function renderFormDocument() {
        documentPanel.innerHTML = '<div style="padding: 2rem; color: var(--text-muted);">Loading form fields and pages...</div>';
        fieldsList.innerHTML = '';
        fieldValues.clear();
        pageViewports = [];

        try {
            const { PDFDocument } = window.PDFLib;
            pdfLibDoc = await PDFDocument.load(pdfBytes.slice(0));
            const form = pdfLibDoc.getForm();
            const fields = form.getFields();

            fieldCountDisplay.textContent = `${fields.length} field${fields.length === 1 ? '' : 's'}`;
            if (fields.length === 0) {
                noFieldsBox.classList.remove('hidden');
            } else {
                noFieldsBox.classList.add('hidden');
            }

            // Populate initial field values & sidebar list
            fields.forEach(f => {
                const name = f.getName();
                const type = f.constructor.name;
                let currentVal = '';

                if (type === 'PDFTextField') {
                    currentVal = f.getText() || '';
                } else if (type === 'PDFCheckBox') {
                    currentVal = f.isChecked();
                } else if (type === 'PDFDropdown' || type === 'PDFRadioGroup') {
                    currentVal = f.getSelected() || '';
                }

                fieldValues.set(name, { type, value: currentVal, fieldRef: f });

                const item = document.createElement('div');
                item.className = 'field-list-item';
                item.innerHTML = `
                    <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${name}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted); background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px;">${type.replace('PDF','')}</span>
                `;
                fieldsList.appendChild(item);
            });

            // Render pages with PDF.js
            const pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
            documentPanel.innerHTML = '';

            for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum++) {
                const page = await pdfJsDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                pageViewports.push(viewport);

                const pageWrapper = document.createElement('div');
                pageWrapper.className = 'pdf-page-wrapper';
                pageWrapper.style.width = `${viewport.width}px`;
                pageWrapper.style.height = `${viewport.height}px`;

                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-page-canvas';
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
                pageWrapper.appendChild(canvas);

                // Overlay container for interactive widgets on this page
                const overlay = document.createElement('div');
                overlay.className = 'form-overlay-layer';
                pageWrapper.appendChild(overlay);

                // Query annotations for interactive widget positions
                const annotations = await page.getAnnotations();
                annotations.forEach(anno => {
                    if (anno.subtype === 'Widget' && anno.fieldName) {
                        renderWidgetOnPage(anno, viewport, overlay);
                    }
                });

                documentPanel.appendChild(pageWrapper);
            }

        } catch (err) {
            console.error('Failed to render form document:', err);
            documentPanel.innerHTML = `<div style="padding: 2rem; color: #ef4444;">Error loading form: ${err.message}</div>`;
        }
    }

    function renderWidgetOnPage(anno, viewport, overlay) {
        // PDF rect is [x1, y1, x2, y2] in PDF coordinates (bottom-left origin)
        const rect = viewport.convertToViewportRectangle(anno.rect);
        const minX = Math.min(rect[0], rect[2]);
        const minY = Math.min(rect[1], rect[3]);
        const width = Math.abs(rect[0] - rect[2]);
        const height = Math.abs(rect[1] - rect[3]);

        const fieldData = fieldValues.get(anno.fieldName);
        const fieldType = fieldData ? fieldData.type : 'PDFTextField';

        let widget;

        if (fieldType === 'PDFCheckBox' || anno.checkBox) {
            widget = document.createElement('input');
            widget.type = 'checkbox';
            widget.className = 'form-field-widget checkbox';
            widget.checked = fieldData ? !!fieldData.value : anno.fieldValue === 'Yes';
            widget.onchange = () => {
                if (fieldData) fieldData.value = widget.checked;
            };
        } else if (fieldType === 'PDFDropdown' && anno.options && anno.options.length) {
            widget = document.createElement('select');
            widget.className = 'form-field-widget';
            anno.options.forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt.exportValue || opt.displayValue;
                optEl.textContent = opt.displayValue || opt.exportValue;
                if (fieldData && fieldData.value === optEl.value) optEl.selected = true;
                widget.appendChild(optEl);
            });
            widget.onchange = () => {
                if (fieldData) fieldData.value = widget.value;
            };
        } else {
            widget = document.createElement('input');
            widget.type = 'text';
            widget.className = 'form-field-widget';
            widget.value = fieldData && typeof fieldData.value === 'string' ? fieldData.value : (anno.fieldValue || '');
            widget.placeholder = anno.fieldName || '';
            widget.oninput = () => {
                if (fieldData) fieldData.value = widget.value;
            };
        }

        widget.style.left = `${minX}px`;
        widget.style.top = `${minY}px`;
        widget.style.width = `${Math.max(18, width)}px`;
        widget.style.height = `${Math.max(18, height)}px`;
        widget.title = anno.fieldName;

        overlay.appendChild(widget);
    }

    // Save & Download Action
    btnSavePdf.onclick = async () => {
        if (!pdfLibDoc) return;
        btnSavePdf.disabled = true;
        btnSavePdf.textContent = 'Saving PDF...';

        try {
            const form = pdfLibDoc.getForm();
            const exportMode = document.querySelector('input[name="export-mode"]:checked').value;

            // Apply all modified field values
            fieldValues.forEach((data, name) => {
                try {
                    const field = form.getField(name);
                    if (data.type === 'PDFTextField') {
                        field.setText(data.value || '');
                    } else if (data.type === 'PDFCheckBox') {
                        if (data.value) field.check();
                        else field.uncheck();
                    } else if (data.type === 'PDFDropdown' || data.type === 'PDFRadioGroup') {
                        if (data.value) field.select(data.value);
                    }
                } catch (e) {
                    console.warn(`Could not set field ${name}:`, e);
                }
            });

            // If flatten mode chosen, permanently burn into vector page content
            if (exportMode === 'flatten') {
                form.flatten();
            }

            pdfLibDoc.setProducer('PDFPals Suite');
            pdfLibDoc.setCreator('PDFPals Form Filler & Flatten');

            const savedBytes = await pdfLibDoc.save();
            const blob = new Blob([savedBytes], { type: 'application/pdf' });
            const suffix = exportMode === 'flatten' ? '_flattened.pdf' : '_filled.pdf';
            const finalName = currentPdfFile ? currentPdfFile.name.replace('.pdf', suffix) : 'document_filled.pdf';

            // Save via MobileBridge
            if (window.MobileBridge && typeof window.MobileBridge.saveFile === 'function') {
                await window.MobileBridge.saveFile(blob, finalName, 'application/pdf');
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = finalName;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                }, 1000);
            }

            // Render WorkflowBridge Next Action chaining bar
            if (window.WorkflowBridge) {
                window.WorkflowBridge.renderNextActionBar(nextActionContainer, blob, finalName);
            }

        } catch (err) {
            console.error('Error saving PDF:', err);
            alert('Error saving PDF: ' + err.message);
        } finally {
            btnSavePdf.disabled = false;
            btnSavePdf.textContent = '💾 Save & Download PDF';
        }
    };

    // Reset / Switch File
    btnSwitchFile.onclick = () => {
        currentPdfFile = null;
        pdfBytes = null;
        pdfLibDoc = null;
        fieldValues.clear();
        documentPanel.innerHTML = '';
        fieldsList.innerHTML = '';
        formWorkspace.classList.add('hidden');
        dropZoneMain.classList.remove('hidden');
        fileInput.value = '';
        nextActionContainer.innerHTML = '';
    };
});