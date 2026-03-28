import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const workspace = document.getElementById('workspace');
    const passwordInput = document.getElementById('password-input');
    const togglePassword = document.getElementById('toggle-password');
    const applyBtn = document.getElementById('apply-unlock');
    const changePdfBtn = document.getElementById('change-pdf-btn');

    let pdfBytes = null;
    let fileName = '';

    // Password Toggle
    togglePassword.onclick = () => {
        const isPass = passwordInput.type === 'password';
        passwordInput.type = isPass ? 'text' : 'password';
        togglePassword.innerText = isPass ? '🔒' : '👁️';
        togglePassword.style.opacity = isPass ? '1' : '0.6';
    };

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
    }

    applyBtn.onclick = async () => {
        const pass = passwordInput.value;

        applyBtn.innerText = "Unlocking...";
        applyBtn.disabled = true;

        try {
            // Use our custom decryption engine to bypass standard library limitations
            const unlockedBytes = await window.PDFEncryptLite.decryptPDF(pdfBytes.slice(0), pass);

            const blob = new Blob([unlockedBytes], { type: 'application/pdf' });
            const downloadFileName = `${fileName}_unlocked.pdf`;
            await MobileBridge.saveFile(blob, downloadFileName);

            alert("PDF Unlocked Successfully!");
        } catch (err) {
            console.error(err);
            alert(err.message || "Error unlocking PDF. Ensure the password is correct.");
        } finally {
            applyBtn.innerText = "Unlock & Download ➔";
            applyBtn.disabled = false;
        }
    };

    if (changePdfBtn) {
        changePdfBtn.onclick = () => {
            pdfBytes = null;
            dropZone.classList.remove('hidden');
            workspace.classList.add('hidden');
            fileInput.value = '';
            passwordInput.value = '';
        };
    }
});
