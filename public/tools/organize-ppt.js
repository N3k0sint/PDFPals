// Organize PowerPoint Logic
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const addPptxInput = document.getElementById('add-pptx-input');
    const workspace = document.getElementById('workspace');
    const slideGrid = document.getElementById('slide-grid');
    const slideCountBadge = document.getElementById('slide-count-badge');
    const statTotalSlides = document.getElementById('stat-total-slides');
    const sourceFilesCount = document.getElementById('source-files-count');
    const statPrimaryName = document.getElementById('stat-primary-name');
    const exportFilenameInput = document.getElementById('export-filename');
    const changeFileBtn = document.getElementById('change-file-btn');
    const resetOrderBtn = document.getElementById('reset-order-btn');
    const applyBtn = document.getElementById('apply-btn');

    // Slides State
    // Each item: { uid, originalRId, originalSldId, targetSlidePath, title, snippet, sourceDeckIndex }
    let slides = [];
    let initialSlidesSnapshot = [];
    let loadedDecks = []; // Array of { name, zip, presDoc, relsDoc }
    let draggedSlideUid = null;

    // File Drag & Drop
    dropZone.onclick = (e) => {
        if (e.target.tagName !== 'LABEL') fileInput.click();
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('active'); };
    dropZone.ondragleave = () => dropZone.classList.remove('active');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
    };

    fileInput.onchange = (e) => {
        if (e.target.files.length) handleFiles(Array.from(e.target.files));
    };

    if (addPptxInput) {
        addPptxInput.onchange = (e) => {
            if (e.target.files.length) handleFiles(Array.from(e.target.files), true);
        };
    }

    changeFileBtn.onclick = () => {
        slides = [];
        loadedDecks = [];
        slideGrid.innerHTML = '';
        workspace.classList.add('hidden');
        dropZone.classList.remove('hidden');
        fileInput.value = '';
    };

    resetOrderBtn.onclick = () => {
        slides = JSON.parse(JSON.stringify(initialSlidesSnapshot));
        renderSlideGrid();
    };

    // Load and Parse PPTX files
    async function handleFiles(fileList, isAppend = false) {
        const pptxFiles = fileList.filter(f => f.name.toLowerCase().endsWith('.pptx'));
        if (pptxFiles.length === 0) {
            alert('Please select valid PowerPoint (.pptx) files.');
            return;
        }

        if (!isAppend) {
            slides = [];
            loadedDecks = [];
            dropZone.classList.add('hidden');
            workspace.classList.remove('hidden');
            statPrimaryName.textContent = pptxFiles[0].name;
            exportFilenameInput.value = pptxFiles[0].name.replace(/\.pptx$/i, '_organized.pptx');
        }

        for (const file of pptxFiles) {
            try {
                await loadDeck(file);
            } catch (err) {
                console.error(`Error loading ${file.name}:`, err);
                alert(`Could not parse ${file.name}. It may be encrypted or corrupted.`);
            }
        }

        if (!isAppend) {
            initialSlidesSnapshot = JSON.parse(JSON.stringify(slides));
        }

        updateStats();
        renderSlideGrid();
    }

    async function loadDeck(file) {
        const zip = new window.JSZip();
        const zipData = await zip.loadAsync(file);

        // 1. Read presentation.xml
        const presXmlFile = zipData.file('ppt/presentation.xml');
        if (!presXmlFile) throw new Error('Invalid PPTX: ppt/presentation.xml not found');
        const presXmlStr = await presXmlFile.async('string');

        // 2. Read presentation.xml.rels
        const relsXmlFile = zipData.file('ppt/_rels/presentation.xml.rels');
        if (!relsXmlFile) throw new Error('Invalid PPTX: ppt/_rels/presentation.xml.rels not found');
        const relsXmlStr = await relsXmlFile.async('string');

        // Parse XML DOM
        const parser = new DOMParser();
        const presDoc = parser.parseFromString(presXmlStr, 'application/xml');
        const relsDoc = parser.parseFromString(relsXmlStr, 'application/xml');

        // Build relationship map: rId -> target (e.g. "slides/slide1.xml")
        const relMap = new Map();
        const relEls = relsDoc.getElementsByTagName('Relationship');
        for (let i = 0; i < relEls.length; i++) {
            const el = relEls[i];
            const rId = el.getAttribute('Id');
            const target = el.getAttribute('Target');
            const type = el.getAttribute('Type') || '';
            if (type.includes('slide') && !type.includes('slideMaster')) {
                relMap.set(rId, target);
            }
        }

        const deckIndex = loadedDecks.length;
        loadedDecks.push({
            name: file.name,
            zip: zipData,
            presDoc,
            relsDoc
        });

        // Parse slide IDs in presentation order
        const sldIdEls = presDoc.getElementsByTagName('p:sldId');
        for (let i = 0; i < sldIdEls.length; i++) {
            const sldEl = sldIdEls[i];
            const sldId = sldEl.getAttribute('id');
            const rId = sldEl.getAttribute('r:id') || sldEl.getAttribute('id');
            let targetPath = relMap.get(rId);

            if (!targetPath) {
                targetPath = `slides/slide${i + 1}.xml`;
            }

            const cleanTarget = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
            const fullZipPath = cleanTarget.startsWith('ppt/') ? cleanTarget : `ppt/${cleanTarget}`;
            const slideFile = zipData.file(fullZipPath);

            let title = `Slide ${i + 1}`;
            let snippet = '';

            if (slideFile) {
                const slideXmlStr = await slideFile.async('string');
                const slideDoc = parser.parseFromString(slideXmlStr, 'application/xml');

                // Extract all text runs
                const tEls = slideDoc.getElementsByTagName('a:t');
                const textPieces = [];
                for (let t = 0; t < tEls.length; t++) {
                    const text = tEls[t].textContent.trim();
                    if (text) textPieces.push(text);
                }

                if (textPieces.length > 0) {
                    title = textPieces[0];
                    snippet = textPieces.slice(1, 6).join(' • ');
                }
            }

            slides.push({
                uid: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                originalRId: rId,
                originalSldId: sldId,
                targetSlidePath: fullZipPath,
                title: title.length > 38 ? title.substr(0, 36) + '...' : title,
                snippet: snippet.length > 120 ? snippet.substr(0, 118) + '...' : snippet,
                sourceDeckIndex: deckIndex
            });
        }
    }

    function updateStats() {
        slideCountBadge.textContent = `${slides.length} Slides`;
        statTotalSlides.textContent = slides.length;
        sourceFilesCount.textContent = loadedDecks.length;
    }

    // Render Slide Cards Grid
    function renderSlideGrid() {
        slideGrid.innerHTML = '';

        if (slides.length === 0) {
            slideGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                    <p style="font-size: 1.1rem; font-weight: 600;">All slides have been deleted</p>
                    <p style="font-size: 0.85rem; opacity: 0.7;">Click "Reset" above or add another PPTX file.</p>
                </div>
            `;
            updateStats();
            return;
        }

        slides.forEach((slide, index) => {
            const card = document.createElement('div');
            card.className = 'slide-card';
            card.draggable = true;
            card.dataset.uid = slide.uid;

            // Slide Number Badge
            const badge = document.createElement('div');
            badge.className = 'slide-num-badge';
            badge.textContent = `#${index + 1}`;
            card.appendChild(badge);

            // Delete Button (✕)
            const delBtn = document.createElement('button');
            delBtn.className = 'slide-delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Delete slide';
            delBtn.onmousedown = (e) => e.stopPropagation();
            delBtn.onclick = (e) => {
                e.stopPropagation();
                slides = slides.filter(s => s.uid !== slide.uid);
                renderSlideGrid();
                updateStats();
            };
            card.appendChild(delBtn);

            // Content Area
            const header = document.createElement('div');
            header.className = 'slide-header';

            const title = document.createElement('div');
            title.className = 'slide-title';
            title.textContent = slide.title;
            title.title = slide.title;

            const snippet = document.createElement('div');
            snippet.className = 'slide-body-preview';
            snippet.textContent = slide.snippet || 'No text snippet available';

            header.appendChild(title);
            header.appendChild(snippet);
            card.appendChild(header);

            // Footer Quick Actions Row
            const footer = document.createElement('div');
            footer.className = 'slide-footer-row';

            const deckName = document.createElement('span');
            deckName.textContent = loadedDecks.length > 1 ? loadedDecks[slide.sourceDeckIndex]?.name.slice(0, 15) : 'Standard';
            deckName.style.overflow = 'hidden';
            deckName.style.textOverflow = 'ellipsis';
            deckName.style.maxWidth = '100px';

            const actions = document.createElement('div');
            actions.className = 'slide-quick-actions';

            // Move Left Button
            const moveLeft = document.createElement('button');
            moveLeft.className = 'slide-qa-btn';
            moveLeft.innerHTML = '◀';
            moveLeft.title = 'Move slide backward';
            moveLeft.disabled = index === 0;
            moveLeft.onmousedown = (e) => e.stopPropagation();
            moveLeft.onclick = (e) => {
                e.stopPropagation();
                if (index > 0) {
                    const temp = slides[index - 1];
                    slides[index - 1] = slides[index];
                    slides[index] = temp;
                    renderSlideGrid();
                }
            };

            // Duplicate Button
            const dupBtn = document.createElement('button');
            dupBtn.className = 'slide-qa-btn';
            dupBtn.innerHTML = 'Copy';
            dupBtn.title = 'Duplicate this slide';
            dupBtn.onmousedown = (e) => e.stopPropagation();
            dupBtn.onclick = (e) => {
                e.stopPropagation();
                const duplicate = {
                    ...slide,
                    uid: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
                };
                slides.splice(index + 1, 0, duplicate);
                renderSlideGrid();
                updateStats();
            };

            // Move Right Button
            const moveRight = document.createElement('button');
            moveRight.className = 'slide-qa-btn';
            moveRight.innerHTML = '▶';
            moveRight.title = 'Move slide forward';
            moveRight.disabled = index === slides.length - 1;
            moveRight.onmousedown = (e) => e.stopPropagation();
            moveRight.onclick = (e) => {
                e.stopPropagation();
                if (index < slides.length - 1) {
                    const temp = slides[index + 1];
                    slides[index + 1] = slides[index];
                    slides[index] = temp;
                    renderSlideGrid();
                }
            };

            actions.appendChild(moveLeft);
            actions.appendChild(dupBtn);
            actions.appendChild(moveRight);

            footer.appendChild(deckName);
            footer.appendChild(actions);
            card.appendChild(footer);

            // Drag and Drop Events
            card.ondragstart = (e) => {
                draggedSlideUid = slide.uid;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            };

            card.ondragend = () => {
                card.classList.remove('dragging');
                document.querySelectorAll('.slide-card').forEach(c => c.classList.remove('drag-over'));
            };

            card.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over');
            };

            card.ondragleave = () => {
                card.classList.remove('drag-over');
            };

            card.ondrop = (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (!draggedSlideUid || draggedSlideUid === slide.uid) return;

                const fromIndex = slides.findIndex(s => s.uid === draggedSlideUid);
                const toIndex = slides.findIndex(s => s.uid === slide.uid);
                if (fromIndex >= 0 && toIndex >= 0) {
                    const [moved] = slides.splice(fromIndex, 1);
                    slides.splice(toIndex, 0, moved);
                    renderSlideGrid();
                }
            };

            slideGrid.appendChild(card);
        });

        updateStats();
    }

    // Export Organized PPTX with full multi-deck merge and 16:9 widescreen preservation
    applyBtn.onclick = async () => {
        if (slides.length === 0) {
            alert('Cannot export an empty presentation. Please keep at least one slide.');
            return;
        }

        applyBtn.innerHTML = '<span class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite; margin-right:8px;"></span> Compiling Deck...';
        applyBtn.disabled = true;

        try {
            const primaryDeck = loadedDecks[0];
            const outZip = primaryDeck.zip;

            // 1. Read existing relationships to find highest ID
            let presRelsStr = await outZip.file('ppt/_rels/presentation.xml.rels').async('string');
            let contentTypesStr = await outZip.file('[Content_Types].xml').async('string');
            let presXmlStr = await outZip.file('ppt/presentation.xml').async('string');

            // Find max rId number in primary deck
            let maxRIdNum = 10;
            const rIdMatches = presRelsStr.match(/Id="rId(\d+)"/g) || [];
            rIdMatches.forEach(m => {
                const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num > maxRIdNum) maxRIdNum = num;
            });

            // Find max slide file number in primary deck
            let maxSlideNum = 10;
            const slidePathMatches = presRelsStr.match(/Target="slides\/slide(\d+)\.xml"/g) || [];
            slidePathMatches.forEach(m => {
                const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num > maxSlideNum) maxSlideNum = num;
            });

            // Find max sldId in primary deck to avoid ID collisions
            let maxSldId = 255;
            const sldIdMatches = presXmlStr.match(/<p:sldId[^>]*id="(\d+)"/g) || [];
            sldIdMatches.forEach(m => {
                const num = parseInt(m.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num) && num > maxSldId) maxSldId = num;
            });

            // Get available slide layouts in primary deck
            const availableLayouts = [];
            outZip.folder('ppt/slideLayouts')?.forEach((relPath) => {
                if (relPath.endsWith('.xml')) availableLayouts.push(relPath);
            });
            const defaultLayout = availableLayouts.length > 0 ? availableLayouts[0] : 'slideLayout1.xml';

            // Track assigned rIds for each slide in order
            const finalSldNodes = [];
            const seenPrimaryRIds = new Set();

            for (let idx = 0; idx < slides.length; idx++) {
                const slide = slides[idx];

                if (slide.sourceDeckIndex === 0 && !seenPrimaryRIds.has(slide.originalRId)) {
                    // Native slide from primary deck, keep original rId and original sldId
                    seenPrimaryRIds.add(slide.originalRId);
                    finalSldNodes.push(`<p:sldId id="${slide.originalSldId}" r:id="${slide.originalRId}"/>`);
                } else {
                    // Imported from secondary deck OR duplicated slide: create isolated new slide part
                    const newSlideNum = ++maxSlideNum;
                    const newSldId = ++maxSldId;
                    const newRId = `rId${++maxRIdNum}`;
                    const newSlideZipPath = `ppt/slides/slide${newSlideNum}.xml`;
                    const newRelsZipPath = `ppt/slides/_rels/slide${newSlideNum}.xml.rels`;

                    const sourceDeck = loadedDecks[slide.sourceDeckIndex];
                    const sourceZip = sourceDeck.zip;

                    // Copy slide XML
                    const slideXmlFile = sourceZip.file(slide.targetSlidePath);
                    if (slideXmlFile) {
                        const slideXml = await slideXmlFile.async('string');
                        outZip.file(newSlideZipPath, slideXml);
                    }

                    // Copy slide rels and media
                    const origRelsPath = slide.targetSlidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
                    const relsFile = sourceZip.file(origRelsPath);
                    if (relsFile) {
                        let relsStr = await relsFile.async('string');
                        const parser = new DOMParser();
                        const relsDoc = parser.parseFromString(relsStr, 'application/xml');
                        const relEls = Array.from(relsDoc.getElementsByTagName('Relationship'));

                        for (let r = 0; r < relEls.length; r++) {
                            const rEl = relEls[r];
                            const target = rEl.getAttribute('Target') || '';
                            const type = rEl.getAttribute('Type') || '';

                            // Media assets (images, audio, video)
                            if (target.includes('media/')) {
                                const origMediaName = target.split('/').pop();
                                const sourceMediaZip = sourceZip.file('ppt/media/' + origMediaName);
                                if (sourceMediaZip) {
                                    const newMediaName = `d${slide.sourceDeckIndex}_${origMediaName}`;
                                    const mediaBytes = await sourceMediaZip.async('arraybuffer');
                                    outZip.file('ppt/media/' + newMediaName, mediaBytes);
                                    rEl.setAttribute('Target', '../media/' + newMediaName);
                                }
                            } else if (type.includes('slideLayout')) {
                                const layoutFile = target.split('/').pop();
                                if (!outZip.file('ppt/slideLayouts/' + layoutFile)) {
                                    rEl.setAttribute('Target', '../slideLayouts/' + defaultLayout);
                                }
                            } else if (type.includes('notesSlide') || type.includes('comment') || type.includes('slideSync') || type.includes('tags')) {
                                // Remove non-essential relationships targeting parts not in outZip
                                const targetFile = target.replace(/^\.\.\//, 'ppt/');
                                if (!outZip.file(targetFile)) {
                                    rEl.parentNode.removeChild(rEl);
                                }
                            }
                        }

                        const serializer = new XMLSerializer();
                        const newRelsStr = serializer.serializeToString(relsDoc);
                        outZip.file(newRelsZipPath, newRelsStr);
                    }

                    // Register in presentation.xml.rels
                    const newRelTag = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${newSlideNum}.xml"/>`;
                    presRelsStr = presRelsStr.replace('</Relationships>', newRelTag + '</Relationships>');

                    // Register in [Content_Types].xml
                    const overridePart = `/ppt/slides/slide${newSlideNum}.xml`;
                    if (!contentTypesStr.includes(overridePart)) {
                        const newTypeTag = `<Override PartName="${overridePart}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
                        contentTypesStr = contentTypesStr.replace('</Types>', newTypeTag + '</Types>');
                    }

                    finalSldNodes.push(`<p:sldId id="${newSldId}" r:id="${newRId}"/>`);
                }
            }

            // Save updated rels and Content_Types
            outZip.file('ppt/_rels/presentation.xml.rels', presRelsStr);
            outZip.file('[Content_Types].xml', contentTypesStr);

            // Surgical replacement of p:sldIdLst in presentation.xml
            // Preserves <p:sldSz> (16:9 widescreen or original aspect ratio) and all namespaces untouched
            const sldLstRegex = /<p:sldIdLst[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\s*\/>/;
            if (!sldLstRegex.test(presXmlStr)) {
                throw new Error('Corrupted presentation structure: p:sldIdLst missing.');
            }
            const newSldIdLst = `<p:sldIdLst>${finalSldNodes.join('')}</p:sldIdLst>`;
            presXmlStr = presXmlStr.replace(sldLstRegex, newSldIdLst);
            outZip.file('ppt/presentation.xml', presXmlStr);

            // Generate output PPTX binary
            const blob = await outZip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            const fileName = (exportFilenameInput.value || 'organized_presentation.pptx').trim();
            if (window.MobileBridge && typeof window.MobileBridge.saveFile === 'function') {
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

            // WorkflowBridge Chaining
            if (window.WorkflowBridge) {
                const nextActionContainer = document.getElementById('next-action-container');
                window.WorkflowBridge.renderNextActionBar(nextActionContainer, blob, fileName);
            }
        } catch (err) {
            console.error('Error exporting PPTX:', err);
            alert('Failed to export presentation: ' + err.message);
        } finally {
            applyBtn.innerHTML = 'Export Organized PPTX ➔';
            applyBtn.disabled = false;
        }
    };
});
