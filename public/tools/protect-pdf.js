import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.querySelector('.browse-btn');
    const workspace = document.getElementById('workspace');
    const batchWorkspace = document.getElementById('batch-workspace');
    const previewGrid = document.getElementById('pdf-preview');
    const pipelineNext = document.getElementById('pipeline-next-container');

    // Single elements
    const passwordInput = document.getElementById('password-input');
    const confirmPassword = document.getElementById('confirm-password');
    const togglePassword = document.getElementById('toggle-password');
    const toggleConfirm = document.getElementById('toggle-confirm');
    const applyBtn = document.getElementById('apply-protection');
    const changePdfBtn = document.getElementById('change-pdf-btn');

    // Batch elements
    const batchTitle = document.getElementById('batch-title');
    const batchList = document.getElementById('batch-list');
    const batchAddBtn = document.getElementById('batch-add-btn');
    const batchResetBtn = document.getElementById('batch-reset-btn');
    const batchPassInput = document.getElementById('batch-password-input');
    const batchConfirmPass = document.getElementById('batch-confirm-password');
    const batchTogglePass = document.getElementById('batch-toggle-password');
    const batchToggleConfirm = document.getElementById('batch-toggle-confirm');
    const batchApplyBtn = document.getElementById('batch-apply-btn');

    let singleFile = null;
    let singleBytes = null;
    let batchFiles = []; // Array of { file, name, size, bytes }

    function formatBytes(bytes, decimals = 1) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    const initToggle = (btn, input) => {
        if (!btn || !input) return;
        btn.onclick = () => {
            const isPass = input.type === 'password';
            input.type = isPass ? 'text' : 'password';
            btn.innerText = isPass ? '🔒' : '👁️';
            btn.style.opacity = isPass ? '1' : '0.6';
        };
    };

    initToggle(togglePassword, passwordInput);
    initToggle(toggleConfirm, confirmPassword);
    initToggle(batchTogglePass, batchPassInput);
    initToggle(batchToggleConfirm, batchConfirmPass);

    browseBtn.addEventListener('click', () => fileInput.click());

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
    dropZone.ondragleave = () => dropZone.classList.remove('active');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        if (dropped.length > 0) handleIncomingFiles(dropped);
    };

    fileInput.onchange = (e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > 0) handleIncomingFiles(selected);
    };

    if (window.WorkflowBridge) {
        window.WorkflowBridge.checkIncomingPipeline((incomingFile) => {
            handleIncomingFiles([incomingFile]);
        });
    }

    function handleIncomingFiles(files) {
        if (pipelineNext) pipelineNext.innerHTML = '';

        if (files.length === 1 && batchFiles.length === 0) {
            handleSingleFile(files[0]);
        } else {
            handleBatchFiles(files);
        }
    }

    async function handleSingleFile(file) {
        singleFile = file;
        const buffer = await file.arrayBuffer();
        singleBytes = new Uint8Array(buffer);

        dropZone.classList.add('hidden');
        batchWorkspace.classList.add('hidden');
        workspace.classList.remove('hidden');
        renderThumbnail();
    }

    async function renderThumbnail() {
        previewGrid.innerHTML = 'Rendering preview...';
        try {
            const loadingTask = pdfjsLib.getDocument({ data: singleBytes.slice(0) });
            const pdf = await loadingTask.promise;

            previewGrid.innerHTML = '';
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.6 });

            const card = document.createElement('div');
            card.className = 'thumbnail-card';

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport }).promise;

            card.appendChild(canvas);
            previewGrid.appendChild(card);

            const info = document.createElement('p');
            info.style.marginTop = '1.2rem';
            info.style.fontWeight = '600';
            info.innerText = `${singleFile.name} (${pdf.numPages} Page${pdf.numPages === 1 ? '' : 's'})`;
            previewGrid.appendChild(info);
        } catch (err) {
            console.error(err);
            previewGrid.innerHTML = '<p>PDF Loaded. Ready to encrypt.</p>';
        }
    }

    changePdfBtn.onclick = () => {
        singleFile = null;
        singleBytes = null;
        previewGrid.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        batchWorkspace.classList.add('hidden');
        fileInput.value = '';
        passwordInput.value = '';
        confirmPassword.value = '';
        if (pipelineNext) pipelineNext.innerHTML = '';
    };

    applyBtn.onclick = async () => {
        const pass = passwordInput.value;
        const confirm = confirmPassword.value;

        if (!pass) return alert("Please enter a password.");
        if (pass !== confirm) return alert("Passwords do not match!");

        applyBtn.innerText = "Encrypting...";
        applyBtn.disabled = true;

        try {
            const encryptedBytes = await window.PDFEncryptLite.encryptPDF(singleBytes.slice(0), pass, pass);
            const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
            const outName = singleFile.name.replace(/\.pdf$/i, '_protected.pdf');

            if (window.MobileBridge) {
                await window.MobileBridge.saveFile(blob, outName);
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = outName;
                link.click();
            }

            alert("PDF Protected Successfully! It will now require the password to open.");

            if (window.WorkflowBridge && pipelineNext) {
                window.WorkflowBridge.renderNextActionBar({
                    container: pipelineNext,
                    pdfBytes: encryptedBytes,
                    fileName: outName
                });
            }
        } catch (err) {
            console.error(err);
            alert("Error encrypting PDF: " + err.message);
        } finally {
            applyBtn.innerText = "Protect Document ➔";
            applyBtn.disabled = false;
        }
    };

    // Batch Functions
    async function handleBatchFiles(files) {
        dropZone.classList.add('hidden');
        workspace.classList.add('hidden');
        batchWorkspace.classList.remove('hidden');

        for (const file of files) {
            try {
                const buffer = await file.arrayBuffer();
                batchFiles.push({
                    file,
                    name: file.name,
                    size: file.size,
                    bytes: new Uint8Array(buffer)
                });
            } catch (err) {
                console.warn('Batch read err:', file.name, err);
            }
        }

        renderBatchUI();
    }

    function renderBatchUI() {
        batchTitle.textContent = `Batch Protection (${batchFiles.length} files)`;
        batchList.innerHTML = '';

        batchFiles.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'batch-item';

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.8rem; min-width:0; flex:1;">
                    <span style="font-size:1.3rem;">📄</span>
                    <div style="min-width:0;">
                        <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                        <div style="font-size:0.8rem; opacity:0.6;">${formatBytes(item.size)}</div>
                    </div>
                </div>
                <button type="button" class="btn secondary outline small remove-b-btn" style="border-radius:8px; color:#ef4444;" title="Remove">✕</button>
            `;

            div.querySelector('.remove-b-btn').onclick = () => {
                batchFiles.splice(idx, 1);
                if (batchFiles.length === 0) batchReset();
                else renderBatchUI();
            };

            batchList.appendChild(div);
        });
    }

    batchAddBtn.onclick = () => fileInput.click();

    function batchReset() {
        batchFiles = [];
        batchList.innerHTML = '';
        dropZone.classList.remove('hidden');
        batchWorkspace.classList.add('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
        batchPassInput.value = '';
        batchConfirmPass.value = '';
        if (pipelineNext) pipelineNext.innerHTML = '';
    }

    batchResetBtn.onclick = batchReset;

    batchApplyBtn.onclick = async () => {
        const pass = batchPassInput.value;
        const confirm = batchConfirmPass.value;

        if (!pass) return alert("Please enter a password.");
        if (pass !== confirm) return alert("Passwords do not match!");
        if (batchFiles.length === 0) return alert("No documents in batch queue.");

        batchApplyBtn.innerText = "Encrypting Batch...";
        batchApplyBtn.disabled = true;

        try {
            if (!window.JSZip) throw new Error("JSZip not loaded");
            const zip = new window.JSZip();

            for (let i = 0; i < batchFiles.length; i++) {
                const item = batchFiles[i];
                batchApplyBtn.innerText = `Encrypting [${i + 1}/${batchFiles.length}]...`;

                const encryptedBytes = await window.PDFEncryptLite.encryptPDF(item.bytes.slice(0), pass, pass);
                const outName = item.name.replace(/\.pdf$/i, '_protected.pdf');
                zip.file(outName, encryptedBytes);
            }

            batchApplyBtn.innerText = "Creating ZIP...";
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            if (window.MobileBridge) {
                await window.MobileBridge.saveFile(zipBlob, 'protected_documents.zip');
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(zipBlob);
                a.download = 'protected_documents.zip';
                a.click();
            }

            alert(`Successfully encrypted ${batchFiles.length} files!`);
        } catch (err) {
            console.error(err);
            alert("Error encrypting batch: " + err.message);
        } finally {
            batchApplyBtn.innerText = "Protect All & Download ZIP ➔";
            batchApplyBtn.disabled = false;
        }
    };
});
