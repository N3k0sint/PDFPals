
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const loading = document.getElementById('loading');
const fileNameDisplay = document.getElementById('file-name');
const changePdfBtn = document.getElementById('change-pdf-btn');
const saveMetaBtn = document.getElementById('save-meta-btn');

// Form Fields
const metaTitle = document.getElementById('meta-title');
const metaAuthor = document.getElementById('meta-author');
const metaSubject = document.getElementById('meta-subject');
const metaKeywords = document.getElementById('meta-keywords');
const metaCreationDate = document.getElementById('meta-creation-date');
const metaModDate = document.getElementById('meta-mod-date');

let pdfBytes = null;
let currentFileName = '';

// --- File Handling ---
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

async function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
    }

    currentFileName = file.name;
    fileNameDisplay.textContent = currentFileName;
    
    loading.classList.remove('hidden');
    dropZone.classList.add('hidden');

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            pdfBytes = new Uint8Array(e.target.result);
            await loadMetadata();
        };
        reader.readAsArrayBuffer(file);
    } catch (err) {
        alert("Failed to read file.");
        resetUI();
    }
}

async function loadMetadata() {
    try {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        
        // Populate form
        metaTitle.value = pdfDoc.getTitle() || '';
        metaAuthor.value = pdfDoc.getAuthor() || '';
        metaSubject.value = pdfDoc.getSubject() || '';
        metaKeywords.value = pdfDoc.getKeywords() || '';

        const pad = n => n.toString().padStart(2, '0');
        const cDate = pdfDoc.getCreationDate();
        if (cDate) {
            metaCreationDate.value = `${cDate.getFullYear()}-${pad(cDate.getMonth() + 1)}-${pad(cDate.getDate())}T${pad(cDate.getHours())}:${pad(cDate.getMinutes())}`;
        }

        const mDate = pdfDoc.getModificationDate();
        if (mDate) {
            metaModDate.value = `${mDate.getFullYear()}-${pad(mDate.getMonth() + 1)}-${pad(mDate.getDate())}T${pad(mDate.getHours())}:${pad(mDate.getMinutes())}`;
        }

        workspace.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        alert("Error reading metadata. The PDF might be corrupted.");
        resetUI();
    } finally {
        loading.classList.add('hidden');
    }
}

saveMetaBtn.onclick = async () => {
    if (!pdfBytes) return;

    saveMetaBtn.disabled = true;
    saveMetaBtn.textContent = 'Saving...';
    loading.classList.remove('hidden');

    try {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        
        // Apply Metadata
        pdfDoc.setTitle(metaTitle.value);
        pdfDoc.setAuthor(metaAuthor.value);
        pdfDoc.setSubject(metaSubject.value);
        pdfDoc.setKeywords(metaKeywords.value.split(',').map(s => s.trim()).filter(s => s));
        
        if (metaCreationDate.value) {
            pdfDoc.setCreationDate(new Date(metaCreationDate.value));
        }
        if (metaModDate.value) {
            pdfDoc.setModificationDate(new Date(metaModDate.value));
        }

        // Branding (Automatic)
        pdfDoc.setCreator('PDFPals');
        pdfDoc.setProducer('PDFPals');

        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        
        if (typeof MobileBridge !== 'undefined') {
            await MobileBridge.saveFile(blob, currentFileName);
        }

        alert("Metadata updated successfully!");
    } catch (err) {
        console.error(err);
        alert("Error saving metadata: " + err.message);
    } finally {
        saveMetaBtn.disabled = false;
        saveMetaBtn.textContent = 'Apply & Download ➔';
        loading.classList.add('hidden');
    }
};

changePdfBtn.onclick = () => resetUI();

function resetUI() {
    pdfBytes = null;
    currentFileName = '';
    metaTitle.value = '';
    metaAuthor.value = '';
    metaSubject.value = '';
    metaKeywords.value = '';
    metaCreationDate.value = '';
    metaModDate.value = '';
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
}
