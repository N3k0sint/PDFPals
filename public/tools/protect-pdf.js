import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const previewGrid = document.getElementById('pdf-preview');
    const passwordInput = document.getElementById('password-input');
    const confirmPassword = document.getElementById('confirm-password');
    const togglePassword = document.getElementById('toggle-password');
    const toggleConfirm = document.getElementById('toggle-confirm');
    const applyBtn = document.getElementById('apply-protection');
    const changePdfBtn = document.getElementById('change-pdf-btn');

    let pdfBytes = null;
    let fileName = '';

    // Password Toggle Logic
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

    // File Handling
    dropZone.onclick = () => fileInput.click();
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

    async function handleFile(file) {
        fileName = file.name.replace('.pdf', '');
        const buffer = await file.arrayBuffer();
        pdfBytes = new Uint8Array(buffer);

        dropZone.classList.add('hidden');
        workspace.classList.remove('hidden');
        renderThumbnail();
    }

    async function renderThumbnail() {
        previewGrid.innerHTML = 'Rendering preview...';
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';
            const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
            const pdf = await loadingTask.promise;

            previewGrid.innerHTML = '';
            // Render only first page as thumbnail
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 0.5 });

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
            info.style.marginTop = '1rem';
            info.style.textAlign = 'center';
            info.innerText = `${pdf.numPages} Pages - Ready to protect`;
            previewGrid.appendChild(info);

        } catch (err) {
            console.error(err);
            previewGrid.innerHTML = 'Error rendering preview.';
        }
    }

    if (changePdfBtn) {
        changePdfBtn.onclick = () => {
            pdfBytes = null;
            previewGrid.innerHTML = '';
            dropZone.classList.remove('hidden');
            workspace.classList.add('hidden');
            fileInput.value = '';
            passwordInput.value = '';
            confirmPassword.value = '';
        };
    }

    applyBtn.onclick = async () => {
        const pass = passwordInput.value;
        const confirm = confirmPassword.value;

        if (!pass) return alert("Please enter a password.");
        if (pass !== confirm) return alert("Passwords do not match!");

        applyBtn.innerText = "Encrypting...";
        applyBtn.disabled = true;

        try {
            // Use our custom ultra-lightweight encryption engine
            const encryptedBytes = await window.PDFEncryptLite.encryptPDF(pdfBytes.slice(0), pass, pass);

            const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${fileName}_protected.pdf`;
            link.click();

            alert("PDF Protected Successfully! Try opening it—it will now ask for a password.");
        } catch (err) {
            console.error(err);
            alert("Error encrypting PDF. Encryption might not be supported in this environment library build.");
        } finally {
            applyBtn.innerText = "Protect PDF ➔";
            applyBtn.disabled = false;
        }
    };
});
