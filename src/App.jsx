

import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const PDF_URL = '/maersk-report.pdf'; // <- use this path exactly per your environment
const PHRASE_3 = 'Gain on sale of non-current assets, etc., net 25 208'; // substring to search for [3] - exact line
const PHRASE_1 = 'EBITDA of USD 2.3 bn'; // substring to search for [1] - page 3
const PHRASE_2 = 'Ocean revenue increased by 2.4%'; // substring to search for [2] - page 5 specific
const SCALE = 1.15;

export default function App() {
  const viewerRef = useRef(null);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const pageTextBoxesRef = useRef({}); // pageNumber -> [{str,left,top,width,height,pageNumber}]

  useEffect(() => {
    // Load pdfjs from CDN to keep the component self-contained (no bundler config needed for worker)
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.min.js';
    script.onload = () => setPdfjsLoaded(true);
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!pdfjsLoaded) return;
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) return;
    // configure worker
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js';
    }

    (async function loadAndRender() {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: PDF_URL });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        const viewer = viewerRef.current;
        viewer.innerHTML = '';

        // offscreen canvas to measure text widths
        const measureCanvas = document.createElement('canvas');
        const mctx = measureCanvas.getContext('2d');

        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale: SCALE });

          const pageContainer = document.createElement('div');
          pageContainer.className = 'pageContainer';
          pageContainer.dataset.pageNumber = p;
          pageContainer.style.width = viewport.width + 'px';
          pageContainer.style.height = viewport.height + 'px';

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = viewport.width + 'px';
          canvas.style.height = viewport.height + 'px';
          pageContainer.appendChild(canvas);

          const textLayerDiv = document.createElement('div');
          textLayerDiv.className = 'textLayer';
          textLayerDiv.style.width = viewport.width + 'px';
          textLayerDiv.style.height = viewport.height + 'px';
          pageContainer.appendChild(textLayerDiv);

          viewer.appendChild(pageContainer);

          // render page to canvas
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          // get textContent and compute boxes
          const textContent = await page.getTextContent();
          pageTextBoxesRef.current[p] = [];

          textContent.items.forEach(item => {
            // transform to viewport coordinates
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const x = tx[4];
            const y = tx[5];
            const fontHeight = Math.hypot(tx[1], tx[0]);
            const fontSizePx = fontHeight;
            mctx.font = `${fontSizePx}px sans-serif`;
            const metrics = mctx.measureText(item.str || '');
            const textWidth = metrics.width;
            const left = x;
            const top = y - fontHeight;
            const width = textWidth;
            const height = fontHeight;
            pageTextBoxesRef.current[p].push({ str: item.str || '', left, top, width, height, pageNumber: p });

            // Optionally create invisible selectable span for access (comment out if not needed)
            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.position = 'absolute';
            span.style.left = left + 'px';
            span.style.top = top + 'px';
            span.style.fontSize = fontSizePx + 'px';
            span.style.opacity = '0';
            span.style.whiteSpace = 'pre';
            textLayerDiv.appendChild(span);
          });
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        const viewer = viewerRef.current;
        if (viewer) viewer.innerText = 'Failed to load PDF — check path and CORS.';
      }
    })();

  }, [pdfjsLoaded]);

  // Utility: clear highlights
  function clearHighlights() {
    document.querySelectorAll('.highlight').forEach(h => h.remove());
    document.querySelectorAll('.yellow-highlight').forEach(h => h.remove());
  }

  // Utility: create highlight on a page
  function createHighlight(pageNumber, rect) {
    const pageContainer = document.querySelector(`.pageContainer[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return;
    const h = document.createElement('div');
    h.className = 'highlight';
    h.style.left = rect.left + 'px';
    h.style.top = rect.top + 'px';
    h.style.width = rect.width + 'px';
    h.style.height = rect.height + 'px';
    pageContainer.appendChild(h);
  }

  // Search algorithm: scan page text boxes and try to match phrase across adjacent boxes
  function findPhrase(phrase, referenceNumber) {
    const lower = phrase.toLowerCase();
    const pages = pageTextBoxesRef.current;
    
    // Try multiple variations of the phrase based on reference
    let variations = [];
    let pageFilter = null;
    
    if (referenceNumber === 1) {
      variations = [
        'ebitda of usd 2.3 bn',
        'ebitda of usd 2.3bn',
        'ebitda usd 2.3 bn',
        'ebitda 2.3 bn',
        'ebitda of 2.3 bn'
      ];
      
    } else if (referenceNumber === 2) {
      pageFilter = [5]; // Only search page 5 for reference [2]
      variations = [
        'ocean revenue increased by 2.4%',
        'revenue increased by 2.4%',
        'ocean revenue increased by 2.4',
        'increased by 2.4%',
        'revenue by 2.8%',
        'usd 359m to usd 13.1bn',
        'stemming from growth in all segments',
        'logistics & services delivered',
        'terminals contributed with an increase of 20%',
        'managed by maersk and transported by maersk'
      ];
    } else if (referenceNumber === 3) {
      pageFilter = [15]; // Only search page 15 for reference [3]
      variations = [
        'gain on sale of non-current assets, etc., net 25 208',
        'gain on sale of non-current assets etc net 25 208',
        'gain on sale of non-current assets, etc., net25 208',
        'gain on sale of non-current assets etc net25 208',
        'gain on sale of non-current assets, etc., net 25',
        'assets, etc., net 25 208 80 215 222',
        'etc., net 25 208 80 215 222',
        'net 25 208 80 215 222',
        '25 208 80 215 222'
      ];
    } else {
      variations = [phrase.toLowerCase()];
    }
    
    // Determine which pages to search
    const pagesToSearch = pageFilter ? pageFilter : Object.keys(pages).map(p => parseInt(p));
    
    for (const pageNum of pagesToSearch) {
      const pKey = pageNum.toString();
      if (!pages[pKey]) continue;
      
      const boxes = pages[pKey];
      for (let i = 0; i < boxes.length; i++) {
        let concat = '';
        const windowBoxes = [];
        for (let j = i; j < Math.min(i + 15, boxes.length); j++) {
          concat += boxes[j].str;
          windowBoxes.push(boxes[j]);
          
          // Check if we've accumulated enough text
          if (concat.length >= 15) {
            const concatLower = concat.toLowerCase().replace(/\s+/g, ' ').trim();
            
            // Try each variation
            for (const variation of variations) {
              if (concatLower.includes(variation)) {
                // bounding rect
                let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
                windowBoxes.forEach(b => {
                  minLeft = Math.min(minLeft, b.left);
                  minTop = Math.min(minTop, b.top);
                  maxRight = Math.max(maxRight, b.left + b.width);
                  maxBottom = Math.max(maxBottom, b.top + b.height);
                });
                return { page: parseInt(pKey, 10), rect: { left: minLeft, top: minTop, width: maxRight - minLeft, height: maxBottom - minTop } };
              }
            }
            
            // If we've checked enough text and no match, break
            if (concat.length > 120) break;
          }
        }
      }
    }
    return null;
  }

  // click handler for [1]
  function onRef1Click() {
    clearHighlights();
    
    // Debug: log page 3 text content to console
    const pages = pageTextBoxesRef.current;
    if (pages[3]) {
      const page3Text = pages[3].map(box => box.str).join('');
      console.log('Page 3 text content:', page3Text);
      console.log('Looking for variations of EBITDA of USD 2.3 bn...');
    }
    
    const found = findPhrase(PHRASE_1, 1);
    if (!found) {
      alert('Phrase not found. The text may be formatted differently or located on a different page.');
      return;
    }
    console.log('[1] Found on page:', found.page, 'at coordinates:', found.rect);
    createYellowHighlight(found.page, found.rect);
    const pageEl = document.querySelector(`.pageContainer[data-page-number="${found.page}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // click handler for [2]
  function onRef2Click() {
    clearHighlights();
    
    // Debug: log page 5 text content to console
    const pages = pageTextBoxesRef.current;
    if (pages[5]) {
      const page5Text = pages[5].map(box => box.str).join('');
      console.log('Page 5 text content:', page5Text);
      console.log('Looking for variations of "Ocean revenue increased by 2.4%"...');
    }
    
    const found = findPhrase(PHRASE_2, 2);
    if (!found) {
      alert('Phrase not found. The text may be formatted differently or located on a different page.');
      return;
    }
    console.log('[2] Found on page:', found.page, 'at coordinates:', found.rect);
    createYellowHighlight(found.page, found.rect);
    const pageEl = document.querySelector(`.pageContainer[data-page-number="${found.page}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // click handler for [3] - highlight complete table row
  function onRef3Click() {
    clearHighlights();
    
    const found = findCompleteTableRow('Gain on sale of non-current assets', 15);
    if (!found) {
      alert('Table row "Gain on sale of non-current assets, etc., net" not found on page 15');
      return;
    }
    
    console.log('[3] Found complete table row on page:', found.page, 'at coordinates:', found.rect);
    createYellowHighlight(found.page, found.rect);
    const pageEl = document.querySelector(`.pageContainer[data-page-number="${found.page}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Simple yellow highlight for specific phrase
  function highlightGainOnSale() {
    clearHighlights();
    
    const pages = pageTextBoxesRef.current;
    if (pages[15]) {
      const page15Text = pages[15].map(box => box.str).join('');
      console.log('Page 15 text content:', page15Text);
      console.log('Looking for "Gain on sale of non-current assets, etc., net"...');
    }
    
    // Simple search for the exact phrase
    const phrase = 'Gain on sale of non-current assets, etc., net';
    const found = findSimplePhrase(phrase, 15);
    if (!found) {
      alert('Phrase not found. The text may be formatted differently.');
      return;
    }
    console.log('Found "Gain on sale..." on page:', found.page, 'at coordinates:', found.rect);
    createYellowHighlight(found.page, found.rect);
    const pageEl = document.querySelector(`.pageContainer[data-page-number="${found.page}"]`);
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Find complete table row for highlighting
  function findCompleteTableRow(startPhrase, pageNumber) {
    const pages = pageTextBoxesRef.current;
    const pKey = pageNumber.toString();
    
    if (!pages[pKey]) return null;
    
    const boxes = pages[pKey];
    const lowerStartPhrase = startPhrase.toLowerCase();
    
    console.log('Searching for table row starting with:', startPhrase, 'on page:', pageNumber);
    
    // Find the starting phrase first
    for (let i = 0; i < boxes.length; i++) {
      let concat = '';
      const startBoxes = [];
      
      // Look for the starting phrase
      for (let j = i; j < Math.min(i + 8, boxes.length); j++) {
        concat += boxes[j].str + ' ';
        startBoxes.push(boxes[j]);
        
        const concatLower = concat.toLowerCase().replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim();
        
        if (concatLower.includes(lowerStartPhrase)) {
          console.log('Found start of table row:', concatLower.substring(0, 50) + '...');
          
          // Now extend to include the entire row (numbers in same horizontal line)
          const baseY = startBoxes[0].top;
          const tolerance = 5; // pixels tolerance for same row
          
          let minLeft = Infinity, maxRight = -Infinity;
          let minTop = Infinity, maxBottom = -Infinity;
          
          // Include all boxes in the same horizontal line
          for (let k = 0; k < boxes.length; k++) {
            const box = boxes[k];
            if (Math.abs(box.top - baseY) <= tolerance) {
              minLeft = Math.min(minLeft, box.left);
              maxRight = Math.max(maxRight, box.left + box.width);
              minTop = Math.min(minTop, box.top);
              maxBottom = Math.max(maxBottom, box.top + box.height);
            }
          }
          
          return {
            page: pageNumber,
            rect: {
              left: minLeft,
              top: minTop,
              width: maxRight - minLeft,
              height: maxBottom - minTop
            }
          };
        }
      }
    }
    
    console.log('Table row not found on page', pageNumber);
    return null;
  }
  function findSimplePhrase(phrase, pageNumber) {
    const pages = pageTextBoxesRef.current;
    const pKey = pageNumber.toString();
    
    if (!pages[pKey]) return null;
    
    const boxes = pages[pKey];
    const lowerPhrase = phrase.toLowerCase().replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim();
    
    console.log('Searching for phrase:', lowerPhrase, 'on page:', pageNumber);
    
    for (let i = 0; i < boxes.length; i++) {
      let concat = '';
      const windowBoxes = [];
      
      // Look at a larger window to catch the phrase
      for (let j = i; j < Math.min(i + 15, boxes.length); j++) {
        concat += boxes[j].str + ' ';
        windowBoxes.push(boxes[j]);
        
        const concatLower = concat.toLowerCase().replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim();
        
        // Check if our phrase is in the current window
        if (concatLower.includes(lowerPhrase)) {
          console.log('Found phrase in window:', concatLower.substring(0, 100) + '...');
          
          // Calculate tight bounding box around just the relevant text
          let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          
          // Use only the boxes that likely contain our phrase
          const relevantBoxes = windowBoxes.slice(0, Math.min(8, windowBoxes.length));
          relevantBoxes.forEach(b => {
            minLeft = Math.min(minLeft, b.left);
            minTop = Math.min(minTop, b.top);
            maxRight = Math.max(maxRight, b.left + b.width);
            maxBottom = Math.max(maxBottom, b.top + b.height);
          });
          
          return { 
            page: pageNumber, 
            rect: { 
              left: minLeft, 
              top: minTop, 
              width: maxRight - minLeft, 
              height: maxBottom - minTop 
            } 
          };
        }
        
        // If concat gets too long, break to avoid excessive searching
        if (concat.length > 200) break;
      }
    }
    
    console.log('Phrase not found on page', pageNumber);
    return null;
  }

  // Create yellow highlight
  function createYellowHighlight(pageNumber, rect) {
    const pageContainer = document.querySelector(`.pageContainer[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return;
    
    const h = document.createElement('div');
    h.className = 'yellow-highlight';
    h.style.left = rect.left + 'px';
    h.style.top = rect.top + 'px';
    h.style.width = rect.width + 'px';
    h.style.height = rect.height + 'px';
    h.style.position = 'absolute';
    h.style.backgroundColor = 'rgba(255, 235, 59, 0.6)';
    h.style.border = '1px solid rgba(255, 193, 7, 0.8)';
    h.style.borderRadius = '3px';
    h.style.pointerEvents = 'none';
    h.style.zIndex = '10';
    
    pageContainer.appendChild(h);
  }

  return (
    <div className="app-root">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="user-info">
            <h1 className="app-title">PDF Highlight Analysis Tool</h1>
            <div className="user-details">
              <h2 className="user-name">Shaik Nagur Meeravali</h2>
              <p className="user-email">nagurmeeravali_shaik@srmap.edu.in</p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          <div className="pdf-section">
            <div className="pdf-viewer">
              <div ref={viewerRef} id="pdfViewer" />
            </div>
          </div>

          <div className="analysis-section">
            <h3>Analysis</h3>
            <p className="summary">
              No extraordinary or one-off items affecting EBITDA were reported in Maersk's Q2 2025 results.
            </p>
            <p className="description">
              The report explicitly notes that EBITDA improvements stemmed from operational performance—
              including volume growth, cost control, and margin improvement across Ocean, Logistics &
              Services, and Terminals segments <span onClick={onRef1Click} className="ref-link">[1]</span><span onClick={onRef2Click} className="ref-link">[2]</span>. Gains or losses from asset sales, which could qualify as
              extraordinary items, are shown separately under EBIT and not included in EBITDA. The gain on
              sale of non-current assets was USD 25 m in Q2 2025, significantly lower than USD 208 m in Q2
              2024, but these affect EBIT, not EBITDA <span onClick={onRef3Click} className="ref-link">[3]</span>. Hence, Q2 2025 EBITDA reflects core operating
              activities without one-off extraordinary adjustments.
            </p>

            <h4>Findings</h4>
            <div className="findings">
              <div className="finding-item">
                <strong>Page 3 — Highlights Q2 2025</strong>
                <p>
                  EBITDA increase (USD 2.3 bn vs USD 2.1 bn prior year) attributed to operational improvements; no
                  mention of extraordinary or one-off items. <span onClick={onRef1Click} className="ref-link">[1]</span>
                </p>
              </div>
              
              <div className="finding-item">
                <strong>Page 5 — Review Q2 2025</strong>
                <p>
                  EBITDA rise driven by higher revenue and cost control across all segments; no extraordinary gains
                  or losses included. <span onClick={onRef2Click} className="ref-link">[2]</span>
                </p>
              </div>
              
              <div className="finding-item">
                <strong>Page 15 — Condensed Income Statement</strong>
                <p>
                  Gain on sale of non-current assets USD 25 m (vs USD 208 m prior year) reported separately below
                  EBITDA; therefore, not part of EBITDA. <span onClick={onRef3Click} className="ref-link">[3]</span>
                </p>
              </div>
            </div>

            <h4>Supporting Evidence</h4>
            <div className="evidence">
              <div className="evidence-item">
                <p><strong><span onClick={onRef1Click} className="ref-link">[1]</span></strong> A.P. Moller – Maersk Q2 2025 Interim Report (7 Aug 2025) — Page 3</p>
                <blockquote>
                  "Maersk's results continued to improve year-on-year ... EBITDA of USD 2.3 bn (USD 2.1 bn) ...
                  driven by volume and other revenue growth in Ocean, margin improvements in Logistics &
                  Services and significant top line growth in Terminals."
                </blockquote>
              </div>
              
              <div className="evidence-item">
                <p><strong><span onClick={onRef2Click} className="ref-link">[2]</span></strong> A.P. Moller – Maersk Q2 2025 Interim Report (7 Aug 2025) — Page 5</p>
                <blockquote>
                  "EBITDA increased to USD 2.3 bn (USD 2.1 bn) ... driven by higher revenue and cost management
                  ... Ocean's EBITDA ... slightly increased by USD 36 m ... Logistics & Services contributed
                  significantly with a USD 71 m increase ... Terminals' EBITDA increased by USD 50 m."
                </blockquote>
              </div>
              
              <div className="evidence-item">
                <p><strong><span onClick={onRef3Click} className="ref-link">[3]</span></strong> A.P. Moller – Maersk Q2 2025 Interim Report (7 Aug 2025) — Page 15</p>
                <blockquote>
                  "Gain on sale of non-current assets, etc., net 25 (208) ... Profit before depreciation, amortisation
                  and impairment losses, etc. (EBITDA) 2,298"
                </blockquote>
              </div>
            </div>

            <div className="pdf-info">
              <strong>PDF path:</strong>
              <div className="pdf-path">{PDF_URL}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}