const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const fileNameDisplay = document.getElementById('file-name');
const docTypeBadge = document.getElementById('doc-type-badge');
const changeDocBtn = document.getElementById('change-doc-btn');
const saveMetaBtn = document.getElementById('save-meta-btn');
const defaultAuthorBtn = document.getElementById('default-author-btn');

// Action Toolbar Elements
const copyMetaBtn = document.getElementById('copy-meta-btn');
const copyFeedback = document.getElementById('copy-feedback');
const openImportBtn = document.getElementById('open-import-btn');
const presetSelect = document.getElementById('preset-select');
const wipeMetaBtn = document.getElementById('wipe-meta-btn');

// Import Modal Elements
const importModal = document.getElementById('import-modal');
const importTextarea = document.getElementById('import-textarea');
const cancelImportBtn = document.getElementById('cancel-import-btn');
const applyImportBtn = document.getElementById('apply-import-btn');

// Inspector Elements
const inspectorToggle = document.getElementById('inspector-toggle');
const inspectorBody = document.getElementById('inspector-body');
const inspectorArrow = document.getElementById('inspector-arrow');
const specSize = document.getElementById('spec-size');
const specPages = document.getElementById('spec-pages');
const specPagesLabel = document.getElementById('spec-pages-label');
const specExtra1 = document.getElementById('spec-extra1');
const specExtra1Label = document.getElementById('spec-extra1-label');
const specFormat = document.getElementById('spec-format');

// Batch Queue Elements
const batchQueueContainer = document.getElementById('batch-queue-container');
const batchCount = document.getElementById('batch-count');
const batchList = document.getElementById('batch-list');

// Common Form Fields
const metaProducer = document.getElementById('meta-producer');
const metaTitle = document.getElementById('meta-title');
const metaAuthor = document.getElementById('meta-author');
const metaDescription = document.getElementById('meta-description'); // Formerly Subject
const metaKeywords = document.getElementById('meta-keywords');
const metaCopyright = document.getElementById('meta-copyright');
const metaCopyrightStatus = document.getElementById('meta-copyright-status');
const metaRightsUrl = document.getElementById('meta-rights-url');
const metaCreationDate = document.getElementById('meta-creation-date');
const metaModDate = document.getElementById('meta-mod-date');

// Office Specific Fields (Word, Excel, PowerPoint)
const officeFields = document.getElementById('office-fields');
const metaCompany = document.getElementById('meta-company');
const metaManager = document.getElementById('meta-manager');
const metaLastModifiedBy = document.getElementById('meta-last-modified-by');

// Application State
let loadedDocuments = []; // Array of { file, name, size, type: 'pdf'|'docx'|'xlsx'|'pptx', buffer, zip?, pdfDoc? }

// --- Helper Functions ---
const pad = n => n.toString().padStart(2, '0');

function formatDateForInput(date) {
    if (!date || isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Quick Button to Set Author to "PDFPals"
if (defaultAuthorBtn) {
    defaultAuthorBtn.addEventListener('click', () => {
        metaAuthor.value = 'PDFPals';
        metaAuthor.focus();
    });
}

// Collapsible Inspector Toggle
if (inspectorToggle) {
    inspectorToggle.addEventListener('click', () => {
        const isHidden = inspectorBody.classList.toggle('hidden');
        inspectorArrow.textContent = isHidden ? '▶' : '▼';
    });
}

// --- File Selection & Drag-and-Drop ---
if (browseBtn) {
    browseBtn.addEventListener('click', () => fileInput.click());
}

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
    if (!files || files.length === 0) return;

    loading.classList.remove('hidden');
    dropZone.classList.add('hidden');
    loadingText.textContent = 'Inspecting document metadata...';

    loadedDocuments = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const lowerName = file.name.toLowerCase();
            let type = null;

            if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
                type = 'pdf';
            } else if (lowerName.endsWith('.docx') || file.type.includes('wordprocessingml')) {
                type = 'docx';
            } else if (lowerName.endsWith('.xlsx') || file.type.includes('spreadsheetml')) {
                type = 'xlsx';
            } else if (lowerName.endsWith('.pptx') || file.type.includes('presentationml')) {
                type = 'pptx';
            }

            if (!type) {
                continue; // Skip unsupported formats
            }

            const buffer = await file.arrayBuffer();
            loadedDocuments.push({
                file,
                name: file.name,
                size: file.size,
                type,
                buffer
            });
        }

        if (loadedDocuments.length === 0) {
            alert('Please select valid PDF, Word (.docx), Excel (.xlsx), or PowerPoint (.pptx) documents.');
            resetUI();
            return;
        }

        // Setup UI for primary document and batch queue
        const primaryDoc = loadedDocuments[0];
        fileNameDisplay.textContent = primaryDoc.name;

        if (loadedDocuments.length > 1) {
            // Batch Mode
            batchQueueContainer.classList.remove('hidden');
            batchCount.textContent = loadedDocuments.length;
            batchList.innerHTML = '';
            loadedDocuments.forEach((doc, idx) => {
                const item = document.createElement('div');
                item.className = 'batch-file-item';
                const icon = doc.type === 'pdf' ? '📄' : doc.type === 'docx' ? '📘' : doc.type === 'xlsx' ? '📗' : '📙';
                item.innerHTML = `<span>${icon} <b>${doc.name}</b></span> <span style="opacity: 0.6; font-size: 0.75rem;">${formatFileSize(doc.size)}</span>`;
                batchList.appendChild(item);
            });
            saveMetaBtn.textContent = `Apply to All & Download ZIP (${loadedDocuments.length} files) ➔`;
        } else {
            batchQueueContainer.classList.add('hidden');
            saveMetaBtn.textContent = 'Apply & Download ➔';
        }

        // Load metadata from the primary document
        await loadDocumentMetadata(primaryDoc);

        workspace.classList.remove('hidden');
    } catch (err) {
        console.error("Error reading documents:", err);
        alert("Failed to load documents: " + (err.message || "Unknown error"));
        resetUI();
    } finally {
        loading.classList.add('hidden');
    }
}

// --- Load Metadata Based on Type ---
async function loadDocumentMetadata(doc) {
    specSize.textContent = formatFileSize(doc.size);

    if (doc.type === 'pdf') {
        docTypeBadge.textContent = '📄 PDF Document';
        specFormat.textContent = 'PDF';
        specPagesLabel.textContent = 'Pages';
        specExtra1Label.textContent = 'Security';
        specExtra1.textContent = 'Unencrypted';
        officeFields.classList.add('hidden');

        await loadPdfMetadata(doc);
    } else {
        // Office Formats (Word, Excel, PowerPoint)
        const badgeMap = {
            docx: '📘 Word Document (.docx)',
            xlsx: '📗 Excel Spreadsheet (.xlsx)',
            pptx: '📙 PowerPoint Presentation (.pptx)'
        };
        const formatMap = { docx: 'Word (.docx)', xlsx: 'Excel (.xlsx)', pptx: 'PowerPoint (.pptx)' };

        docTypeBadge.textContent = badgeMap[doc.type] || '📑 Office Document';
        specFormat.textContent = formatMap[doc.type] || 'Office OpenXML';
        officeFields.classList.remove('hidden');

        await loadOpenXmlMetadata(doc);
    }
}

// --- PDF Metadata Parsing ---
async function loadPdfMetadata(doc) {
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(doc.buffer, { ignoreEncryption: true });
    doc.pdfDoc = pdfDoc;

    specPages.textContent = pdfDoc.getPageCount();

    metaTitle.value = pdfDoc.getTitle() || '';
    metaAuthor.value = pdfDoc.getAuthor() || '';
    metaDescription.value = pdfDoc.getSubject() || ''; // Map Subject to Description

    const kw = pdfDoc.getKeywords();
    metaKeywords.value = kw ? (Array.isArray(kw) ? kw.join(', ') : kw) : '';

    const cDate = pdfDoc.getCreationDate();
    metaCreationDate.value = cDate ? formatDateForInput(cDate) : '';

    const mDate = pdfDoc.getModificationDate();
    metaModDate.value = mDate ? formatDateForInput(mDate) : '';

    // Default Copyright
    metaCopyright.value = `© ${new Date().getFullYear()} PDFPals. All Rights Reserved.`;
    metaCopyrightStatus.value = 'Copyrighted';
    metaRightsUrl.value = '';
}

// --- OpenXML (Word, Excel, PowerPoint) Parsing ---
async function loadOpenXmlMetadata(doc) {
    if (typeof JSZip === 'undefined') {
        throw new Error("JSZip library not found.");
    }

    const zip = await JSZip.loadAsync(doc.buffer);
    doc.zip = zip;

    // 1. Read docProps/core.xml (Dublin Core)
    const coreFile = zip.file('docProps/core.xml');
    if (coreFile) {
        const coreXml = await coreFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(coreXml, 'application/xml');

        metaTitle.value = getXmlText(xmlDoc, 'dc:title');
        const authorVal = getXmlText(xmlDoc, 'dc:creator');
        metaAuthor.value = authorVal || '';

        // Description takes dc:description or dc:subject
        const desc = getXmlText(xmlDoc, 'dc:description') || getXmlText(xmlDoc, 'dc:subject');
        metaDescription.value = desc;

        metaKeywords.value = getXmlText(xmlDoc, 'cp:keywords');
        metaLastModifiedBy.value = getXmlText(xmlDoc, 'cp:lastModifiedBy') || '';

        const rights = getXmlText(xmlDoc, 'dc:rights');
        metaCopyright.value = rights || `© ${new Date().getFullYear()} PDFPals. All Rights Reserved.`;
        metaCopyrightStatus.value = getXmlText(xmlDoc, 'cp:category') || 'Copyrighted';

        const createdStr = getXmlText(xmlDoc, 'dcterms:created');
        if (createdStr) {
            const d = new Date(createdStr);
            if (!isNaN(d.getTime())) metaCreationDate.value = formatDateForInput(d);
        }

        const modStr = getXmlText(xmlDoc, 'dcterms:modified');
        if (modStr) {
            const d = new Date(modStr);
            if (!isNaN(d.getTime())) metaModDate.value = formatDateForInput(d);
        }
    } else {
        metaAuthor.value = '';
        metaLastModifiedBy.value = '';
        metaCopyright.value = `© ${new Date().getFullYear()} PDFPals. All Rights Reserved.`;
    }

    // 2. Read docProps/app.xml (Extended properties: Application, Company, Manager, Stats)
    const appFile = zip.file('docProps/app.xml');
    if (appFile) {
        const appXml = await appFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(appXml, 'application/xml');

        metaCompany.value = getXmlText(xmlDoc, 'Company');
        metaManager.value = getXmlText(xmlDoc, 'Manager');

        if (doc.type === 'docx') {
            specPagesLabel.textContent = 'Pages';
            specPages.textContent = getXmlText(xmlDoc, 'Pages') || '1';
            specExtra1Label.textContent = 'Words';
            specExtra1.textContent = Number(getXmlText(xmlDoc, 'Words') || '0').toLocaleString();
        } else if (doc.type === 'xlsx') {
            specPagesLabel.textContent = 'Sheets';
            // Count sheets from app.xml or fallback
            const sheets = xmlDoc.getElementsByTagName('vt:lpstr').length || 1;
            specPages.textContent = sheets;
            specExtra1Label.textContent = 'App';
            specExtra1.textContent = 'Excel';
        } else if (doc.type === 'pptx') {
            specPagesLabel.textContent = 'Slides';
            specPages.textContent = getXmlText(xmlDoc, 'Slides') || '1';
            specExtra1Label.textContent = 'Words';
            specExtra1.textContent = Number(getXmlText(xmlDoc, 'Words') || '0').toLocaleString();
        }
    } else {
        metaCompany.value = '';
        metaManager.value = '';
        specPages.textContent = '1';
        specExtra1.textContent = '-';
    }
}

// --- XML Utilities ---
function getXmlText(xmlDoc, tagName) {
    if (!xmlDoc) return '';
    let el = xmlDoc.getElementsByTagName(tagName)[0];
    if (!el && tagName.includes(':')) {
        const local = tagName.split(':')[1];
        const elements = xmlDoc.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].localName === local) {
                el = elements[i];
                break;
            }
        }
    }
    return el ? (el.textContent || '').trim() : '';
}

function updateOrAddNode(xmlDoc, parent, tagName, value, attributes = {}) {
    let el = parent.getElementsByTagName(tagName)[0];
    if (!el && tagName.includes(':')) {
        const local = tagName.split(':')[1];
        const elements = parent.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].localName === local) {
                el = elements[i];
                break;
            }
        }
    }

    if (!el) {
        el = xmlDoc.createElement(tagName);
        parent.appendChild(el);
    }

    el.textContent = value;
    for (const [k, v] of Object.entries(attributes)) {
        el.setAttribute(k, v);
    }
    return el;
}

function removeXmlNode(parent, tagName) {
    if (!parent) return;
    let el = parent.getElementsByTagName(tagName)[0];
    if (!el && tagName.includes(':')) {
        const local = tagName.split(':')[1];
        const elements = parent.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].localName === local) {
                el = elements[i];
                break;
            }
        }
    }
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

// --- Copy Metadata to Clipboard ---
copyMetaBtn.addEventListener('click', async () => {
    const lines = [
        '=== Document Metadata ===',
        `Title: ${metaTitle.value.trim()}`,
        `Author: ${metaAuthor.value.trim() || 'N/A'}`,
        `Description: ${metaDescription.value.trim()}`,
        `Keywords: ${metaKeywords.value.trim()}`,
        `Copyright Notice: ${metaCopyright.value.trim()}`,
        `Copyright Status: ${metaCopyrightStatus.value}`,
        `License URL: ${metaRightsUrl.value.trim()}`,
        `Company: ${metaCompany.value.trim()}`,
        `Manager: ${metaManager.value.trim()}`,
        `Last Modified By: ${metaLastModifiedBy.value.trim() || 'N/A'}`,
        `Creation Date: ${metaCreationDate.value || 'N/A'}`,
        `Modification Date: ${metaModDate.value || 'N/A'}`,
        `Software / Producer: PDFPals`
    ];
    const textToCopy = lines.join('\n');

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
        } else {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = textToCopy;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }

        copyFeedback.classList.add('show');
        setTimeout(() => copyFeedback.classList.remove('show'), 2000);
    } catch (err) {
        console.error('Clipboard copy failed:', err);
        alert('Could not copy metadata automatically. Here is the text:\n\n' + textToCopy);
    }
});

// --- Import / Paste Metadata Modal ---
openImportBtn.addEventListener('click', () => {
    importTextarea.value = '';
    importModal.classList.remove('hidden');
});

cancelImportBtn.addEventListener('click', () => {
    importModal.classList.add('hidden');
});

applyImportBtn.addEventListener('click', () => {
    const raw = importTextarea.value.trim();
    if (!raw) {
        importModal.classList.add('hidden');
        return;
    }

    // Try parsing as JSON first
    let parsed = false;
    try {
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null) {
            if (data.title) metaTitle.value = data.title;
            if (data.author) metaAuthor.value = data.author;
            if (data.description || data.subject) metaDescription.value = data.description || data.subject;
            if (data.keywords) metaKeywords.value = Array.isArray(data.keywords) ? data.keywords.join(', ') : data.keywords;
            if (data.copyright) metaCopyright.value = data.copyright;
            if (data.company) metaCompany.value = data.company;
            if (data.manager) metaManager.value = data.manager;
            parsed = true;
        }
    } catch (_) {}

    // Key-value parsing fallback (e.g. "Title: Sample Title")
    if (!parsed) {
        const lines = raw.split('\n');
        for (const line of lines) {
            const splitIdx = line.indexOf(':');
            if (splitIdx !== -1) {
                const key = line.slice(0, splitIdx).trim().toLowerCase();
                const val = line.slice(splitIdx + 1).trim();

                if (key.includes('title')) metaTitle.value = val;
                else if (key.includes('author') || key.includes('creator')) metaAuthor.value = val;
                else if (key.includes('description') || key.includes('subject')) metaDescription.value = val;
                else if (key.includes('keyword') || key.includes('tag')) metaKeywords.value = val;
                else if (key.includes('copyright')) metaCopyright.value = val;
                else if (key.includes('company')) metaCompany.value = val;
                else if (key.includes('manager')) metaManager.value = val;
            }
        }
    }

    importModal.classList.add('hidden');
    alert('Metadata applied successfully to fields!');
});

// --- Wipe All Metadata (Privacy Anonymizer) ---
wipeMetaBtn.addEventListener('click', () => {
    if (!confirm("Are you sure you want to wipe all metadata? This will sanitize author names, descriptions, company tags, and timestamps for total privacy.")) {
        return;
    }

    metaTitle.value = '';
    metaAuthor.value = '';
    metaDescription.value = '';
    metaKeywords.value = '';
    metaCopyright.value = '';
    metaCopyrightStatus.value = '';
    metaRightsUrl.value = '';
    metaCompany.value = '';
    metaManager.value = '';
    metaLastModifiedBy.value = '';
    metaCreationDate.value = '';
    metaModDate.value = '';

    alert("All personal metadata fields wiped! Click 'Apply & Download' to save the anonymized document.");
});

// --- Presets & Saved Templates ---
presetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;

    if (val === 'pdfpals') {
        metaAuthor.value = 'PDFPals';
        metaCompany.value = 'PDFPals Inc.';
        metaCopyright.value = `© ${new Date().getFullYear()} PDFPals. All Rights Reserved.`;
        metaCopyrightStatus.value = 'Copyrighted';
        metaLastModifiedBy.value = 'PDFPals';
    } else if (val === 'clear') {
        wipeMetaBtn.click();
    } else if (val === 'save_custom') {
        const name = prompt("Enter a name for this metadata template (e.g. My Agency Profile):");
        if (name && name.trim()) {
            const template = {
                author: metaAuthor.value,
                description: metaDescription.value,
                company: metaCompany.value,
                copyright: metaCopyright.value,
                keywords: metaKeywords.value
            };
            localStorage.setItem('pdfpals_preset_' + name.trim(), JSON.stringify(template));
            loadSavedPresets();
            alert(`Preset "${name.trim()}" saved to browser!`);
        }
    } else if (val.startsWith('custom:')) {
        const key = val.replace('custom:', '');
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const t = JSON.parse(saved);
                if (t.author) metaAuthor.value = t.author;
                if (t.description) metaDescription.value = t.description;
                if (t.company) metaCompany.value = t.company;
                if (t.copyright) metaCopyright.value = t.copyright;
                if (t.keywords) metaKeywords.value = t.keywords;
            } catch (_) {}
        }
    }

    e.target.value = '';
});

function loadSavedPresets() {
    // Retain default options
    presetSelect.innerHTML = `
        <option value="">⚡ Presets & Templates...</option>
        <option value="pdfpals">🏷️ Apply "PDFPals" Brand</option>
        <option value="clear">🛡️ Privacy Anonymizer</option>
        <option value="save_custom">💾 Save Current as Preset...</option>
    `;

    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('pdfpals_preset_')) {
            const displayName = k.replace('pdfpals_preset_', '');
            const opt = document.createElement('option');
            opt.value = 'custom:' + k;
            opt.textContent = `📁 ${displayName}`;
            presetSelect.appendChild(opt);
        }
    }
}
loadSavedPresets();

// --- Save & Download (Single File & Batch) ---
saveMetaBtn.onclick = async () => {
    if (loadedDocuments.length === 0) return;

    saveMetaBtn.disabled = true;
    saveMetaBtn.textContent = 'Saving...';
    loadingText.textContent = 'Applying metadata updates...';
    loading.classList.remove('hidden');

    try {
        const authorValue = metaAuthor.value.trim();
        const isBatch = loadedDocuments.length > 1;

        if (!isBatch) {
            // Single Document Processing
            const doc = loadedDocuments[0];
            const updatedBlob = await processDocument(doc, authorValue);
            await triggerDownload(updatedBlob, doc.name);
            alert(`Metadata updated successfully for "${doc.name}"!`);
        } else {
            // Multi-Document Batch Processing
            const batchZip = new JSZip();
            for (let i = 0; i < loadedDocuments.length; i++) {
                const doc = loadedDocuments[i];
                loadingText.textContent = `Processing document ${i + 1} of ${loadedDocuments.length}: ${doc.name}...`;
                const updatedBlob = await processDocument(doc, authorValue);
                batchZip.file(doc.name, updatedBlob);
            }

            loadingText.textContent = 'Packaging updated files into ZIP...';
            const zipBlob = await batchZip.generateAsync({ type: 'blob' });
            await triggerDownload(zipBlob, 'PDFPals_Metadata_Batch.zip');
            alert(`All ${loadedDocuments.length} documents updated and saved as a ZIP archive!`);
        }
    } catch (err) {
        console.error("Error saving metadata:", err);
        alert("Error saving metadata: " + (err.message || "Unknown error"));
    } finally {
        saveMetaBtn.disabled = false;
        saveMetaBtn.textContent = loadedDocuments.length > 1 ? `Apply to All & Download ZIP (${loadedDocuments.length} files) ➔` : 'Apply & Download ➔';
        loading.classList.add('hidden');
    }
};

// Process an individual document (PDF or OpenXML)
async function processDocument(doc, authorValue) {
    if (doc.type === 'pdf') {
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(doc.buffer, { ignoreEncryption: true });

        pdfDoc.setTitle(metaTitle.value.trim());
        if (authorValue) {
            pdfDoc.setAuthor(authorValue);
        } else {
            pdfDoc.setAuthor('');
        }
        pdfDoc.setSubject(metaDescription.value.trim()); // Map Description to Subject

        const kwArray = metaKeywords.value.split(',').map(s => s.trim()).filter(s => s);
        pdfDoc.setKeywords(kwArray);

        if (metaCreationDate.value) {
            pdfDoc.setCreationDate(new Date(metaCreationDate.value));
        }
        if (metaModDate.value) {
            pdfDoc.setModificationDate(new Date(metaModDate.value));
        } else {
            pdfDoc.setModificationDate(new Date());
        }

        // Producer & Creator Branding
        pdfDoc.setCreator('PDFPals');
        pdfDoc.setProducer('PDFPals');

        const outBytes = await pdfDoc.save();
        return new Blob([outBytes], { type: 'application/pdf' });
    } else {
        // Word, Excel, PowerPoint (OpenXML)
        const zip = await JSZip.loadAsync(doc.buffer);

        // 1. Update docProps/core.xml
        let coreXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
</cp:coreProperties>`;
        
        const existingCore = zip.file('docProps/core.xml');
        if (existingCore) {
            coreXmlStr = await existingCore.async('string');
        }

        const parser = new DOMParser();
        const coreDoc = parser.parseFromString(coreXmlStr, 'application/xml');
        const coreRoot = coreDoc.documentElement;

        updateOrAddNode(coreDoc, coreRoot, 'dc:title', metaTitle.value.trim());
        if (authorValue) {
            updateOrAddNode(coreDoc, coreRoot, 'dc:creator', authorValue);
        } else {
            removeXmlNode(coreRoot, 'dc:creator');
        }
        updateOrAddNode(coreDoc, coreRoot, 'dc:description', metaDescription.value.trim());
        updateOrAddNode(coreDoc, coreRoot, 'dc:subject', metaDescription.value.trim());
        updateOrAddNode(coreDoc, coreRoot, 'cp:keywords', metaKeywords.value.trim());
        
        if (metaCopyright.value.trim()) {
            updateOrAddNode(coreDoc, coreRoot, 'dc:rights', metaCopyright.value.trim());
        }
        if (metaCopyrightStatus.value) {
            updateOrAddNode(coreDoc, coreRoot, 'cp:category', metaCopyrightStatus.value);
        }

        const lastModBy = metaLastModifiedBy.value.trim();
        if (lastModBy) {
            updateOrAddNode(coreDoc, coreRoot, 'cp:lastModifiedBy', lastModBy);
        } else {
            removeXmlNode(coreRoot, 'cp:lastModifiedBy');
        }

        const creationIso = metaCreationDate.value ? new Date(metaCreationDate.value).toISOString() : new Date().toISOString();
        updateOrAddNode(coreDoc, coreRoot, 'dcterms:created', creationIso, { 'xsi:type': 'dcterms:W3CDTF' });

        const modIso = metaModDate.value ? new Date(metaModDate.value).toISOString() : new Date().toISOString();
        updateOrAddNode(coreDoc, coreRoot, 'dcterms:modified', modIso, { 'xsi:type': 'dcterms:W3CDTF' });

        const serializer = new XMLSerializer();
        zip.file('docProps/core.xml', serializer.serializeToString(coreDoc));

        // 2. Update docProps/app.xml
        let appXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
</Properties>`;
        
        const existingApp = zip.file('docProps/app.xml');
        if (existingApp) {
            appXmlStr = await existingApp.async('string');
        }

        const appDoc = parser.parseFromString(appXmlStr, 'application/xml');
        const appRoot = appDoc.documentElement;

        updateOrAddNode(appDoc, appRoot, 'Application', 'PDFPals');
        if (metaCompany.value.trim()) {
            updateOrAddNode(appDoc, appRoot, 'Company', metaCompany.value.trim());
        }
        if (metaManager.value.trim()) {
            updateOrAddNode(appDoc, appRoot, 'Manager', metaManager.value.trim());
        }

        zip.file('docProps/app.xml', serializer.serializeToString(appDoc));

        const mimeMap = {
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };

        return await zip.generateAsync({
            type: 'blob',
            mimeType: mimeMap[doc.type] || 'application/octet-stream'
        });
    }
}

async function triggerDownload(blob, fileName) {
    if (typeof MobileBridge !== 'undefined' && MobileBridge.saveFile) {
        await MobileBridge.saveFile(blob, fileName);
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    }
}

changeDocBtn.onclick = () => resetUI();

function resetUI() {
    loadedDocuments = [];

    metaTitle.value = '';
    metaAuthor.value = '';
    metaDescription.value = '';
    metaKeywords.value = '';
    metaCopyright.value = '';
    metaCopyrightStatus.value = '';
    metaRightsUrl.value = '';
    metaCreationDate.value = '';
    metaModDate.value = '';

    metaCompany.value = '';
    metaManager.value = '';
    metaLastModifiedBy.value = '';

    batchQueueContainer.classList.add('hidden');
    batchList.innerHTML = '';
    officeFields.classList.add('hidden');
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
}


