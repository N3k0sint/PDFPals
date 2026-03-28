
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const loading = document.getElementById('loading');
const imageGrid = document.getElementById('image-grid');
const imgCountSpan = document.getElementById('img-count');
const totalSizeSpan = document.getElementById('total-size');
const fileNameDisplay = document.getElementById('file-name');
const downloadZipBtn = document.getElementById('download-zip-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');

let pdfBytes = null;
let currentFileName = '';
let extractedAssets = []; // { data, name, type, size, blobUrl }

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
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        pdfBytes = new Uint8Array(e.target.result);
        extractImages();
    };
    reader.readAsArrayBuffer(file);
}

async function extractImages() {
    loading.classList.remove('hidden');
    dropZone.classList.add('hidden');
    imageGrid.innerHTML = '';
    extractedAssets = [];
    
    try {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        let imgIndex = 1;
        let totalBytes = 0;

        // Iterate through all indirect objects to find images
        const enumerateIndir = pdfDoc.context.enumerateIndirectObjects();
        
        for (const [ref, obj] of enumerateIndir) {
            // Check if object is a stream and has Subtype: Image
            if (!(obj instanceof window.PDFLib.PDFStream)) continue;
            
            const dict = obj.dict;
            const subtype = dict.get(window.PDFLib.PDFName.of('Subtype'));
            if (subtype?.toString() !== '/Image') continue;

            const width = dict.get(window.PDFLib.PDFName.of('Width'));
            const height = dict.get(window.PDFLib.PDFName.of('Height'));
            const filter = dict.get(window.PDFLib.PDFName.of('Filter'));

            let extension = 'png';
            let type = 'image/png';

            // Detect format based on Filter
            if (filter) {
                const filterStr = filter.toString();
                if (filterStr.includes('DCTDecode')) {
                    extension = 'jpg';
                    type = 'image/jpeg';
                }
            }

            try {
                const data = obj.getContents();
                const blob = new Blob([data], { type });
                const blobUrl = URL.createObjectURL(blob);
                const name = `image_${imgIndex}.${extension}`;
                
                extractedAssets.push({
                    data,
                    name,
                    type,
                    size: data.length,
                    blobUrl,
                    width: width?.toString() || '?',
                    height: height?.toString() || '?'
                });

                totalBytes += data.length;
                imgIndex++;
                
                // Add to UI immediately
                renderImageCard(extractedAssets[extractedAssets.length - 1]);
            } catch (e) {
                console.warn("Failed to extract one image object:", e);
            }
        }

        imgCountSpan.textContent = extractedAssets.length;
        totalSizeSpan.textContent = formatBytes(totalBytes);

        if (extractedAssets.length === 0) {
            imageGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; opacity: 0.5;">No embedded images found in this PDF.</p>';
        }

        workspace.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        alert("Error ripping images. The PDF might be encrypted or corrupted.");
        resetUI();
    } finally {
        loading.classList.add('hidden');
    }
}

function renderImageCard(asset) {
    const card = document.createElement('div');
    card.className = 'img-card';
    card.style.animation = 'fadeIn 0.5s ease backwards';
    
    card.innerHTML = `
        <img src="${asset.blobUrl}" class="img-preview" loading="lazy">
        <div class="img-info">
            <span class="img-dimensions">${asset.width} × ${asset.height}</span>
            <span style="font-weight: 500;">${formatBytes(asset.size)}</span>
            <button class="download-single" title="Download Asset">📥</button>
        </div>
    `;

    card.querySelector('.download-single').onclick = async (e) => {
        e.stopPropagation();
        const response = await fetch(asset.blobUrl);
        const blob = await response.blob();
        await MobileBridge.saveFile(blob, asset.name);
    };

    imageGrid.appendChild(card);
}

downloadZipBtn.onclick = async () => {
    if (extractedAssets.length === 0) return;
    
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'Zipping...';
    
    const zip = new JSZip();
    extractedAssets.forEach(asset => {
        zip.file(asset.name, asset.data);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const fileName = currentFileName.replace('.pdf', '_images.zip');
    await MobileBridge.saveFile(content, fileName);
    
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = 'Download All as ZIP (High-Res)';
};

changePdfBtn.onclick = () => resetUI();

function resetUI() {
    pdfBytes = null;
    currentFileName = '';
    extractedAssets.forEach(a => URL.revokeObjectURL(a.blobUrl));
    extractedAssets = [];
    imageGrid.innerHTML = '';
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
