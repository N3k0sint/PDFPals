import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const controls = document.getElementById('controls');
const convertBtn = document.getElementById('convert-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const loading = document.getElementById('loading');
const statusMessage = document.getElementById('status-message');
const fileNameSpan = document.getElementById('file-name');

let currentFile = null;

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]?.type === 'application/pdf') handleFile(e.dataTransfer.files[0]);
    else alert('Please upload a PDF file.');
});

fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
convertBtn.addEventListener('click', convertToWord);

function handleFile(file) {
    currentFile = file;
    fileNameSpan.textContent = file.name;
    dropZone.classList.add('hidden');
    controls.classList.remove('hidden');
    statusMessage.classList.add('hidden');
}

async function convertToWord() {
    if (!currentFile) return;
    showLoading(true);
    controls.classList.add('hidden');

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;
        const sections = [];

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // 1. Get all items with positioning
            const items = textContent.items.map(item => ({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
                height: item.height || 10
            }));

            // 2. Group into lines (Bucketing)
            // We use a looser tolerance (yDiff < height/2) to catch subscripts or slightly misaligned text
            const lines = [];
            items.forEach(item => {
                const matchLine = lines.find(l => Math.abs(l.y - item.y) < 5); // 5px tolerance
                if (matchLine) {
                    matchLine.items.push(item);
                } else {
                    lines.push({ y: item.y, items: [item] });
                }
            });

            // 3. Sort lines Top -> Bottom
            lines.sort((a, b) => b.y - a.y);

            const docChildren = [];

            lines.forEach(line => {
                // 4. Sort items Left -> Right
                line.items.sort((a, b) => a.x - b.x);

                const runs = [];
                let lastX = -1;

                line.items.forEach(item => {
                    if (lastX !== -1) {
                        const gap = item.x - lastX;
                        // 5. Smart Spacer Detection
                        if (gap > 40) {
                            // Large gap -> likely a column break -> usage Tab
                            runs.push(new docx.TextRun({ text: "\t" }));
                        } else if (gap > 30) {
                            // Medium gap, maybe large space or small column
                            runs.push(new docx.TextRun({ text: "\t" }));
                        } else if (gap > 4) {
                            // Normal word spacing
                            runs.push(new docx.TextRun({ text: " " }));
                        }
                    }
                    runs.push(new docx.TextRun({ text: item.str }));
                    lastX = item.x + item.width; // Update last X to end of *this* item
                });

                // Create paragraph with tab stops for alignment
                docChildren.push(new docx.Paragraph({
                    children: runs,
                    spacing: { after: 0 }, // Minimal spacing for fidelity
                    tabStops: [
                        { type: docx.TabStopType.LEFT, position: 1500 }, // ~1 inch
                        { type: docx.TabStopType.LEFT, position: 3000 }, // ~2 inch
                        { type: docx.TabStopType.LEFT, position: 4500 }, // ~3 inch
                        { type: docx.TabStopType.LEFT, position: 6000 }, // ~4 inch
                        { type: docx.TabStopType.LEFT, position: 7500 }, // ~5 inch
                        { type: docx.TabStopType.LEFT, position: 9000 }, // ~6 inch
                    ]
                }));
            });

            if (i < totalPages) docChildren.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
            sections.push(...docChildren);
        }

        const doc = new docx.Document({ sections: [{ children: sections }] });
        const blob = await docx.Packer.toBlob(doc);
        saveAs(blob, currentFile.name.replace('.pdf', '.docx'));
        statusMessage.textContent = "Conversion Complete!";
        statusMessage.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    } finally {
        showLoading(false);
        controls.classList.remove('hidden');
    }
}

async function saveAs(blob, filename) {
    await MobileBridge.saveFile(blob, filename);
}

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        currentFile = null;
        dropZone.classList.remove('hidden');
        controls.classList.add('hidden');
        statusMessage.classList.add('hidden');
        fileInput.value = '';
    };
}
function showLoading(show) { loading.className = show ? 'loading' : 'loading hidden'; }




browseBtn.addEventListener('click', () => fileInput.click());
