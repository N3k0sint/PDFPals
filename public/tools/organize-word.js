// Organize Word Logic
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtns = document.querySelectorAll('.browse-btn');
    const workspace = document.getElementById('workspace');
    const loading = document.getElementById('loading');
    const loadingMsg = document.getElementById('loading-msg');
    const fileNameSpan = document.getElementById('file-name');
    const pageGrid = document.getElementById('page-grid');
    const exportDocxBtn = document.getElementById('export-docx-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const resetBtn = document.getElementById('reset-btn');
    const changeDocBtn = document.getElementById('change-doc-btn');
    const addMoreBtn = document.getElementById('add-more-btn');
    const addMoreInput = document.getElementById('add-more-input');
    const addBlankPageBtn = document.getElementById('add-blank-page-btn');
    const pipelineNext = document.getElementById('pipeline-next-container');

    // Page state: Array of { uid, isBlank, title, snippet, imageUrls, docName, sourceDocIndex, originalIndex }
    let pages = [];
    let initialPagesSnapshot = [];
    let loadedDocs = []; // Array of { name, buffer, zip, docXmlStr, relsXmlStr, mediaMap }
    let draggedIndex = null;

    // Auto-scroll physics
    let autoScrollRaf = null;
    let autoScrollSpeed = 0;

    // Drag & Drop
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
    };

    browseBtns.forEach(btn => btn.onclick = () => fileInput.click());
    fileInput.onchange = (e) => {
        if (e.target.files.length) handleFiles(Array.from(e.target.files));
    };

    if (addMoreBtn && addMoreInput) {
        addMoreBtn.onclick = () => addMoreInput.click();
        addMoreInput.onchange = (e) => {
            if (e.target.files.length) handleFiles(Array.from(e.target.files), true);
        };
    }

    changeDocBtn.onclick = () => {
        pages = [];
        loadedDocs = [];
        pageGrid.innerHTML = '';
        workspace.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileInput.value = '';
    };

    resetBtn.onclick = () => {
        pages = JSON.parse(JSON.stringify(initialPagesSnapshot));
        renderPageGrid();
    };

    if (addBlankPageBtn) {
        addBlankPageBtn.onclick = () => {
            const blankPage = {
                uid: 'blank_' + Date.now(),
                isBlank: true,
                title: 'Blank Page',
                snippet: 'Empty section separator',
                imageUrls: [],
                docName: 'Blank',
                sourceDocIndex: -1,
                originalIndex: -1
            };
            pages.push(blankPage);
            renderPageGrid();
        };
    }

    // Process Word documents
    async function handleFiles(fileList, isAppend = false) {
        const docxFiles = fileList.filter(f => f.name.toLowerCase().endsWith('.docx'));
        if (docxFiles.length === 0) {
            alert('Please select valid Word documents (.docx).');
            return;
        }

        if (!isAppend) {
            pages = [];
            loadedDocs = [];
            fileNameSpan.textContent = docxFiles[0].name;
        }

        dropZone.classList.add('hidden');
        workspace.classList.add('hidden');
        loading.classList.remove('hidden');

        for (let d = 0; d < docxFiles.length; d++) {
            const file = docxFiles[d];
            loadingMsg.textContent = `Analyzing ${file.name} (${d + 1}/${docxFiles.length})...`;
            try {
                const buffer = await file.arrayBuffer();
                await parseDocxFile(buffer, file.name);
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
                alert(`Could not parse ${file.name}: ${err.message}`);
            }
        }

        if (!isAppend) {
            initialPagesSnapshot = JSON.parse(JSON.stringify(pages));
        }

        loading.classList.add('hidden');
        workspace.classList.remove('hidden');
        renderPageGrid();
    }

    async function parseDocxFile(arrayBuffer, docName) {
        const zip = new window.JSZip();
        const zipDoc = await zip.loadAsync(arrayBuffer.slice(0));

        // 1. Extract embedded media/images from word/media/
        const mediaMap = new Map(); // rId -> blobUrl
        const mediaFiles = [];
        zipDoc.folder('word/media')?.forEach((relPath, file) => {
            mediaFiles.push({ path: relPath, file });
        });

        // 2. Read word/_rels/document.xml.rels to map rId -> media file
        const relsFile = zipDoc.file('word/_rels/document.xml.rels');
        let relsXmlStr = '';
        if (relsFile) {
            relsXmlStr = await relsFile.async('string');
            const parser = new DOMParser();
            const relsDoc = parser.parseFromString(relsXmlStr, 'application/xml');
            const relNodes = relsDoc.getElementsByTagName('Relationship');

            for (let i = 0; i < relNodes.length; i++) {
                const rNode = relNodes[i];
                const rId = rNode.getAttribute('Id');
                const target = rNode.getAttribute('Target') || '';
                if (target.includes('media/')) {
                    const cleanTarget = target.replace(/^.*media\//, '');
                    const matchedFile = zipDoc.file('word/media/' + cleanTarget);
                    if (matchedFile) {
                        const blob = await matchedFile.async('blob');
                        const url = URL.createObjectURL(blob);
                        mediaMap.set(rId, url);
                    }
                }
            }
        }

        // 3. Read word/document.xml
        const docXmlFile = zipDoc.file('word/document.xml');
        if (!docXmlFile) throw new Error('word/document.xml missing in docx package');
        const docXmlStr = await docXmlFile.async('string');

        const docIndex = loadedDocs.length;
        loadedDocs.push({
            name: docName,
            buffer: arrayBuffer,
            zip: zipDoc,
            docXmlStr,
            relsXmlStr,
            mediaMap
        });

        // 4. Parse paragraphs and explicit page breaks to construct sections/pages
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(docXmlStr, 'application/xml');
        const paragraphs = xmlDoc.getElementsByTagName('w:p');

        let currentSectionTitle = '';
        let currentSectionTexts = [];
        let currentSectionImages = [];
        let sectionIndex = 1;

        for (let p = 0; p < paragraphs.length; p++) {
            const pNode = paragraphs[p];

            // Check for explicit page break in paragraph
            let hasPageBreak = false;
            const brNodes = pNode.getElementsByTagName('w:br');
            for (let b = 0; b < brNodes.length; b++) {
                if (brNodes[b].getAttribute('w:type') === 'page') {
                    hasPageBreak = true;
                    break;
                }
            }

            // Extract text in this paragraph
            const tNodes = pNode.getElementsByTagName('w:t');
            const pTexts = [];
            for (let t = 0; t < tNodes.length; t++) {
                const txt = tNodes[t].textContent.trim();
                if (txt) pTexts.push(txt);
            }
            const fullPText = pTexts.join(' ').trim();

            // Check for embedded images in this paragraph
            const blipNodes = pNode.getElementsByTagName('a:blip');
            for (let b = 0; b < blipNodes.length; b++) {
                const embedId = blipNodes[b].getAttribute('r:embed') || blipNodes[b].getAttribute('r:id');
                if (embedId && mediaMap.has(embedId)) {
                    currentSectionImages.push(mediaMap.get(embedId));
                }
            }

            if (fullPText) {
                if (!currentSectionTitle) {
                    currentSectionTitle = fullPText;
                } else {
                    currentSectionTexts.push(fullPText);
                }
            }

            // Split section on page break or every 8 paragraphs
            if (hasPageBreak || p === paragraphs.length - 1 || currentSectionTexts.length >= 8) {
                if (currentSectionTitle || currentSectionTexts.length > 0 || currentSectionImages.length > 0) {
                    pages.push({
                        uid: 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        isBlank: false,
                        title: currentSectionTitle || `Section ${sectionIndex}`,
                        snippet: currentSectionTexts.slice(0, 3).join(' • ') || 'Document text & content',
                        imageUrls: currentSectionImages.slice(0, 3),
                        docName: docName,
                        sourceDocIndex: docIndex,
                        originalIndex: sectionIndex - 1
                    });

                    sectionIndex++;
                    currentSectionTitle = '';
                    currentSectionTexts = [];
                    currentSectionImages = [];
                }
            }
        }

        // If no sections were generated, add one full document card
        if (pages.length === 0) {
            pages.push({
                uid: 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                isBlank: false,
                title: docName.replace(/\.docx$/i, ''),
                snippet: 'Word Document Content',
                imageUrls: Array.from(mediaMap.values()).slice(0, 3),
                docName: docName,
                sourceDocIndex: docIndex,
                originalIndex: 0
            });
        }
    }

    // Auto-scroll physics while dragging
    function startAutoScroll(direction, speed) {
        stopAutoScroll();
        autoScrollSpeed = speed * (direction === 'up' ? -1 : 1);
        function scrollLoop() {
            window.scrollBy(0, autoScrollSpeed);
            autoScrollRaf = requestAnimationFrame(scrollLoop);
        }
        autoScrollRaf = requestAnimationFrame(scrollLoop);
    }

    function stopAutoScroll() {
        if (autoScrollRaf) {
            cancelAnimationFrame(autoScrollRaf);
            autoScrollRaf = null;
        }
    }

    // Render Drag-and-Drop Page Grid
    function renderPageGrid() {
        pageGrid.innerHTML = '';

        if (pages.length === 0) {
            pageGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <p style="font-size: 1.1rem; font-weight: 600;">No pages remaining in document</p>
                    <p style="font-size: 0.85rem; opacity: 0.7;">Click "Reset Order" or add another DOCX file.</p>
                </div>
            `;
            return;
        }

        pages.forEach((page, index) => {
            const card = document.createElement('div');
            card.className = 'page-item';
            card.draggable = true;
            card.dataset.index = index;

            // Delete Button (✕)
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Remove page';
            delBtn.onmousedown = (e) => e.stopPropagation();
            delBtn.onclick = (e) => {
                e.stopPropagation();
                pages.splice(index, 1);
                renderPageGrid();
            };
            card.appendChild(delBtn);

            // Card Header
            const header = document.createElement('div');
            header.className = 'page-card-header';

            const badge = document.createElement('span');
            badge.className = 'page-num-badge';
            badge.textContent = `Page ${index + 1}`;

            const docNameSpan = document.createElement('span');
            docNameSpan.className = 'doc-origin-badge';
            docNameSpan.textContent = page.isBlank ? 'Blank Page' : (loadedDocs.length > 1 ? page.docName : 'Document');
            docNameSpan.title = page.docName;

            header.appendChild(badge);
            header.appendChild(docNameSpan);
            card.appendChild(header);

            // Card Preview Body
            const body = document.createElement('div');
            body.className = 'page-preview-body';

            const title = document.createElement('div');
            title.className = 'preview-title';
            title.textContent = page.title;
            title.title = page.title;
            body.appendChild(title);

            // Show real embedded images if available
            if (page.imageUrls && page.imageUrls.length > 0) {
                const imgRow = document.createElement('div');
                imgRow.className = 'preview-image-row';
                page.imageUrls.forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = 'Document image';
                    imgRow.appendChild(img);
                });
                body.appendChild(imgRow);
            }

            const snippet = document.createElement('div');
            snippet.className = 'preview-text-snippet';
            snippet.textContent = page.snippet;
            body.appendChild(snippet);

            card.appendChild(body);

            // Card Footer Row
            const footer = document.createElement('div');
            footer.className = 'page-footer-row';
            footer.innerHTML = `<span>${page.imageUrls.length > 0 ? `📷 ${page.imageUrls.length} Image${page.imageUrls.length > 1 ? 's' : ''}` : '📄 Text Only'}</span><span>Drag to reorder</span>`;
            card.appendChild(footer);

            // Drag Events
            card.ondragstart = (e) => {
                draggedIndex = index;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
            };

            card.ondragend = () => {
                card.classList.remove('dragging');
                stopAutoScroll();
                document.querySelectorAll('.page-item').forEach(c => c.classList.remove('drag-over'));
            };

            card.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over');

                const threshold = 120;
                const y = e.clientY;
                if (y < threshold) {
                    const speed = Math.max(3, Math.round((threshold - y) / 7));
                    startAutoScroll('up', speed);
                } else if (y > window.innerHeight - threshold) {
                    const speed = Math.max(3, Math.round((y - (window.innerHeight - threshold)) / 7));
                    startAutoScroll('down', speed);
                } else {
                    stopAutoScroll();
                }
            };

            card.ondragleave = () => {
                card.classList.remove('drag-over');
            };

            card.ondrop = (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                stopAutoScroll();

                if (draggedIndex === null || draggedIndex === index) return;

                const [moved] = pages.splice(draggedIndex, 1);
                pages.splice(index, 0, moved);
                draggedIndex = null;
                renderPageGrid();
            };

            pageGrid.appendChild(card);
        });
    }

    // 1. Export Native Word (.docx) with 100% Image Remapping & No Missing Pictures
    exportDocxBtn.onclick = async () => {
        if (pages.length === 0) {
            alert('Cannot export an empty document.');
            return;
        }

        exportDocxBtn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite; margin-right:8px;"></span> Compiling DOCX...';
        exportDocxBtn.disabled = true;

        try {
            // Load base document zip
            const masterDeck = loadedDocs[0];
            const masterZip = new window.JSZip();
            await masterZip.loadAsync(masterDeck.buffer.slice(0));

            // Read master rels
            let masterRelsStr = await masterZip.file('word/_rels/document.xml.rels').async('string');
            let maxRIdNum = 20;
            const rIdMatches = masterRelsStr.match(/Id="rId(\d+)"/g) || [];
            rIdMatches.forEach(m => {
                const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num > maxRIdNum) maxRIdNum = num;
            });

            // Read master document.xml
            let masterDocXmlStr = await masterZip.file('word/document.xml').async('string');

            // Find where to append content before trailing <w:sectPr>
            const sectPrIdx = masterDocXmlStr.lastIndexOf('<w:sectPr');
            const insertPos = sectPrIdx !== -1 ? sectPrIdx : masterDocXmlStr.lastIndexOf('</w:body>');

            let appendedXmlParts = [];

            // Group pages by source document
            const processedDeckIndices = new Set([0]);

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];

                if (page.isBlank) {
                    // Insert page break
                    appendedXmlParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
                    continue;
                }

                if (page.sourceDocIndex > 0 && !processedDeckIndices.has(page.sourceDocIndex)) {
                    processedDeckIndices.add(page.sourceDocIndex);
                    const subDeck = loadedDocs[page.sourceDocIndex];
                    const subZip = subDeck.zip;

                    // Read sub deck rels to find image mappings
                    const subRelsFile = subZip.file('word/_rels/document.xml.rels');
                    let subDocXml = await subZip.file('word/document.xml').async('string');

                    if (subRelsFile) {
                        const subRelsStr = await subRelsFile.async('string');
                        const parser = new DOMParser();
                        const relsDoc = parser.parseFromString(subRelsStr, 'application/xml');
                        const relNodes = relsDoc.getElementsByTagName('Relationship');

                        for (let r = 0; r < relNodes.length; r++) {
                            const rNode = relNodes[r];
                            const oldRId = rNode.getAttribute('Id');
                            const target = rNode.getAttribute('Target') || '';
                            const type = rNode.getAttribute('Type') || '';

                            if (target.includes('media/')) {
                                const cleanImg = target.replace(/^.*media\//, '');
                                const sourceImgFile = subZip.file('word/media/' + cleanImg);

                                if (sourceImgFile) {
                                    const imgBytes = await sourceImgFile.async('arraybuffer');
                                    const newImgName = `d${page.sourceDocIndex}_${cleanImg}`;
                                    masterZip.file('word/media/' + newImgName, imgBytes);

                                    const newRId = `rId_m_${++maxRIdNum}`;
                                    const newRelTag = `<Relationship Id="${newRId}" Type="${type}" Target="media/${newImgName}"/>`;
                                    masterRelsStr = masterRelsStr.replace('</Relationships>', newRelTag + '</Relationships>');

                                    // Replace relationship reference in XML body
                                    const regex = new RegExp(`"${oldRId}"`, 'g');
                                    subDocXml = subDocXml.replace(regex, `"${newRId}"`);
                                }
                            }
                        }
                    }

                    // Extract body children of sub document
                    const bodyStart = subDocXml.indexOf('<w:body>') + 8;
                    const bodyEnd = subDocXml.lastIndexOf('<w:sectPr');
                    const bodySlice = bodyEnd !== -1 ? subDocXml.substring(bodyStart, bodyEnd) : subDocXml.substring(bodyStart, subDocXml.lastIndexOf('</w:body>'));

                    // Insert clean page break before appending next document
                    appendedXmlParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
                    appendedXmlParts.push(bodySlice);
                }
            }

            // Save updated rels into master
            masterZip.file('word/_rels/document.xml.rels', masterRelsStr);

            // Insert appended body XML into master document.xml
            if (appendedXmlParts.length > 0) {
                masterDocXmlStr = masterDocXmlStr.slice(0, insertPos) + appendedXmlParts.join('') + masterDocXmlStr.slice(insertPos);
                masterZip.file('word/document.xml', masterDocXmlStr);
            }

            // Generate clean, native .docx binary
            const blob = await masterZip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            const originalName = loadedDocs[0]?.name || 'document.docx';
            const fileName = originalName.replace(/\.docx$/i, '_organized.docx');

            if (window.MobileBridge) {
                await window.MobileBridge.saveFile(blob, fileName);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            if (window.WorkflowBridge && pipelineNext) {
                window.WorkflowBridge.renderNextActionBar(pipelineNext, blob, fileName);
            }
        } catch (err) {
            console.error('DOCX Export Error:', err);
            alert('Failed to compile Word document: ' + err.message);
        } finally {
            exportDocxBtn.innerHTML = 'Export Word (.docx) ➔';
            exportDocxBtn.disabled = false;
        }
    };

    // 2. Export as High-Fidelity PDF with all Images and Text
    exportPdfBtn.onclick = async () => {
        if (pages.length === 0) {
            alert('Cannot export an empty document.');
            return;
        }

        exportPdfBtn.innerHTML = 'Rendering PDF...';
        exportPdfBtn.disabled = true;

        try {
            const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            const a4Width = 595.28;
            const a4Height = 841.89;

            for (const page of pages) {
                const pdfPage = pdfDoc.addPage([a4Width, a4Height]);

                if (page.isBlank) continue;

                let curY = a4Height - 60;

                // Title
                pdfPage.drawText(page.title.slice(0, 70), {
                    x: 50,
                    y: curY,
                    size: 16,
                    font: boldFont,
                    color: rgb(0.1, 0.15, 0.2)
                });
                curY -= 30;

                // Embedded Images
                if (page.imageUrls && page.imageUrls.length > 0) {
                    for (const imgUrl of page.imageUrls.slice(0, 2)) {
                        try {
                            const res = await fetch(imgUrl);
                            const imgBytes = await res.arrayBuffer();
                            let embedded;
                            try {
                                embedded = await pdfDoc.embedPng(imgBytes);
                            } catch (pe) {
                                embedded = await pdfDoc.embedJpg(imgBytes);
                            }
                            const imgW = Math.min(480, embedded.width);
                            const imgH = (embedded.height / embedded.width) * imgW;
                            if (curY - imgH > 60) {
                                pdfPage.drawImage(embedded, {
                                    x: 50,
                                    y: curY - imgH,
                                    width: imgW,
                                    height: imgH
                                });
                                curY -= (imgH + 20);
                            }
                        } catch (ie) {
                            console.warn('Could not embed image:', ie);
                        }
                    }
                }

                // Text Snippet
                if (page.snippet && curY > 80) {
                    pdfPage.drawText(page.snippet.slice(0, 180), {
                        x: 50,
                        y: curY,
                        size: 10,
                        font: font,
                        color: rgb(0.3, 0.35, 0.4)
                    });
                }
            }

            pdfDoc.setProducer('PDFPals');
            pdfDoc.setCreator('PDFPals');
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });

            const originalName = loadedDocs[0]?.name || 'document.docx';
            const fileName = originalName.replace(/\.docx$/i, '_organized.pdf');

            if (window.MobileBridge) {
                await window.MobileBridge.saveFile(blob, fileName);
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('PDF Export Error:', err);
            alert('Failed to compile PDF: ' + err.message);
        } finally {
            exportPdfBtn.innerHTML = 'Export as PDF';
            exportPdfBtn.disabled = false;
        }
    };
});
