import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

function fitScale(page, maxWidth){
  const base = page.getViewport({ scale: 1 });
  return Math.min(Math.max(maxWidth / base.width, 0.4), 3);
}

async function renderPageCanvas(page, canvas, maxWidth){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = fitScale(page, maxWidth);
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = viewport.width + 'px';
  canvas.style.height = viewport.height + 'px';
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return viewport;
}

export async function renderPdfViewer(container, bytes, callbacks = {}){
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const total = doc.numPages;
  if(callbacks.onReady) callbacks.onReady(total);

  container.innerHTML = '';
  const scroller = document.createElement('div');
  scroller.className = 'pdf-pages';
  container.appendChild(scroller);

  const slots = [];
  for(let n = 1; n <= total; n++){
    const wrap = document.createElement('div');
    wrap.className = 'pdf-page-wrap';
    wrap.dataset.page = String(n);
    wrap.innerHTML = `
      <div class="pdf-page-placeholder">
        <div class="adm-spinner"></div>
        <span>Halaman ${n}</span>
      </div>
      <canvas class="pdf-page-canvas" hidden></canvas>
      <span class="pdf-page-num">${n} / ${total}</span>`;
    scroller.appendChild(wrap);
    slots.push({ wrap, pageNum: n, rendered: false, rendering: false });
  }

  async function paintSlot(slot){
    if(slot.rendered || slot.rendering) return;
    slot.rendering = true;
    const canvas = slot.wrap.querySelector('.pdf-page-canvas');
    const placeholder = slot.wrap.querySelector('.pdf-page-placeholder');
    try{
      const page = await doc.getPage(slot.pageNum);
      const width = Math.max(scroller.clientWidth - 24, 280);
      await renderPageCanvas(page, canvas, width);
      placeholder.remove();
      canvas.hidden = false;
      slot.rendered = true;
      slot.pageRef = page;
    }catch(err){
      placeholder.innerHTML = `<span>Gagal muat halaman ${slot.pageNum}</span>`;
      console.warn('PDF page render error:', err);
    }finally{
      slot.rendering = false;
    }
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(!entry.isIntersecting) return;
      const slot = slots.find(s => s.wrap === entry.target);
      if(slot) paintSlot(slot);
    });
  }, { root: scroller, rootMargin: '240px 0px', threshold: 0.01 });

  slots.forEach(slot => io.observe(slot.wrap));
  paintSlot(slots[0]);

  let resizeTimer;
  function reflowVisible(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      const width = Math.max(scroller.clientWidth - 24, 280);
      for(const slot of slots){
        if(!slot.rendered || !slot.pageRef) continue;
        const canvas = slot.wrap.querySelector('.pdf-page-canvas');
        await renderPageCanvas(slot.pageRef, canvas, width);
      }
    }, 180);
  }
  window.addEventListener('resize', reflowVisible, { passive: true });
  window.addEventListener('orientationchange', reflowVisible, { passive: true });

  if(callbacks.onScroll){
    scroller.addEventListener('scroll', () => {
      const mid = scroller.scrollTop + scroller.clientHeight * 0.35;
      let current = 1;
      for(const slot of slots){
        if(slot.wrap.offsetTop <= mid) current = slot.pageNum;
      }
      callbacks.onScroll(current, total);
    }, { passive: true });
  }

  return {
    destroy(){
      io.disconnect();
      window.removeEventListener('resize', reflowVisible);
      window.removeEventListener('orientationchange', reflowVisible);
      clearTimeout(resizeTimer);
      doc.destroy();
    }
  };
}
