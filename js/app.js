(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const dropzone = $('dropzone');
  const fileInput = $('fileInput');
  const fileListEl = $('fileList');
  const summaryEl = $('summary');
  const actionsEl = $('actions');
  const processBtn = $('processBtn');
  const clearBtn = $('clearBtn');
  const progressEl = $('progress');
  const progressFill = $('progressFill');
  const progressLabel = $('progressLabel');
  const statusEl = $('status');

  let files = [];

  /* ── Helpers ── */

  function ext(name) {
    const i = name.lastIndexOf('.');
    return i !== -1 ? name.substring(i).toLowerCase() : '.png';
  }

  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function shuffle(n) {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function readDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Read failed'));
      r.readAsDataURL(file);
    });
  }

  function readBuf(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Read failed'));
      r.readAsArrayBuffer(file);
    });
  }

  /* ── Metadata stripping: canvas ── */

  function stripCanvas(file) {
    return new Promise(async (res, rej) => {
      try {
        const url = await readDataURL(file);
        const img = new Image();
        const t = setTimeout(() => rej(new Error('timeout')), 15000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            const e = ext(file.name);
            let mime = 'image/png', q;
            if (e === '.jpg' || e === '.jpeg') { mime = 'image/jpeg'; q = 0.95; }
            else if (e === '.webp') { mime = 'image/webp'; q = 0.95; }
            c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), mime, q);
          } catch (err) { rej(err); }
        };
        img.onerror = () => { clearTimeout(t); rej(new Error('decode')); };
        img.src = url;
      } catch (err) { rej(err); }
    });
  }

  /* ── Metadata stripping: JPEG byte-level ── */

  function stripJpeg(buf) {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return buf;
    const parts = [new Uint8Array(buf, 0, 2)];
    let off = 2;
    const skip = new Set([0xffe1, 0xffe2, 0xffec, 0xffed, 0xffee, 0xfffe]);
    while (off < v.byteLength - 1) {
      const m = v.getUint16(off);
      if (m === 0xffda) { parts.push(new Uint8Array(buf, off)); break; }
      if ((m & 0xff00) !== 0xff00) break;
      const len = v.getUint16(off + 2);
      if (!skip.has(m)) parts.push(new Uint8Array(buf, off, len + 2));
      off += len + 2;
    }
    const total = parts.reduce((s, p) => s + p.byteLength, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.byteLength; }
    return out.buffer;
  }

  /* ── Metadata stripping: PNG chunk-level ── */

  function stripPng(buf) {
    const v = new DataView(buf);
    if (v.byteLength < 8 || v.getUint32(0) !== 0x89504e47) return buf;
    const keep = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'sBIT', 'bKGD', 'pHYs']);
    const parts = [new Uint8Array(buf, 0, 8)];
    let off = 8;
    while (off + 8 <= v.byteLength) {
      const len = v.getUint32(off);
      const type = String.fromCharCode(...new Uint8Array(buf, off + 4, 4));
      const sz = 12 + len;
      if (off + sz > v.byteLength) break;
      if (keep.has(type)) parts.push(new Uint8Array(buf, off, sz));
      off += sz;
      if (type === 'IEND') break;
    }
    const total = parts.reduce((s, p) => s + p.byteLength, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.byteLength; }
    return out.buffer;
  }

  /* ── Process single file (3 fallback layers) ── */

  async function processFile(file) {
    const e = ext(file.name);
    try {
      const blob = await stripCanvas(file);
      return { data: blob, ext: ['.gif', '.bmp', '.tiff', '.tif'].includes(e) ? '.png' : e };
    } catch (_) {}
    try {
      const buf = await readBuf(file);
      if (e === '.jpg' || e === '.jpeg') return { data: stripJpeg(buf), ext: e };
      if (e === '.png') return { data: stripPng(buf), ext: e };
      return { data: buf, ext: e };
    } catch (_) {}
    return { data: file, ext: e };
  }

  /* ── UI ── */

  function render() {
    if (!files.length) {
      fileListEl.innerHTML = '';
      summaryEl.innerHTML = '';
      actionsEl.classList.add('hidden');
      return;
    }
    const nums = shuffle(files.length);
    const pad = Math.max(String(files.length).length, 3);
    files.forEach((f, i) => { f.newName = String(nums[i]).padStart(pad, '0') + ext(f.file.name); });

    let h = '<div class="file-list">';
    files.forEach((f, i) => {
      h += '<div class="file-item" style="animation-delay:' + Math.min(i * 15, 300) + 'ms">' +
        '<span class="name" title="' + f.file.name + '">' + f.file.name + '</span>' +
        '<span class="arrow">→</span>' +
        '<span class="new-name">' + f.newName + '</span>' +
        '<span class="size">' + fmtSize(f.file.size) + '</span>' +
        '<button class="rm" data-i="' + i + '">✕</button></div>';
    });
    h += '</div>';
    fileListEl.innerHTML = h;
    fileListEl.querySelectorAll('.rm').forEach((b) =>
      b.addEventListener('click', () => { files.splice(+b.dataset.i, 1); render(); })
    );

    const total = files.reduce((s, f) => s + f.file.size, 0);
    summaryEl.innerHTML = '<div class="summary"><span><b>' + files.length + '</b> image' +
      (files.length !== 1 ? 's' : '') + '</span><span>' + fmtSize(total) + '</span></div>';
    actionsEl.classList.remove('hidden');
  }

  function addFiles(list) {
    for (const f of list) {
      if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(f.name))
        files.push({ file: f, newName: '' });
    }
    render();
    statusEl.textContent = '';
    statusEl.className = 'status';
  }

  /* ── Events ── */

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
  clearBtn.addEventListener('click', () => { files = []; render(); statusEl.textContent = ''; statusEl.className = 'status'; });

  processBtn.addEventListener('click', async () => {
    if (!files.length) return;
    processBtn.disabled = true;
    progressEl.classList.remove('hidden');
    statusEl.textContent = '';
    statusEl.className = 'status';

    const zip = new JSZip();
    let done = 0;

    for (const f of files) {
      progressLabel.textContent = 'Processing: ' + f.file.name;
      progressFill.style.width = ((done / files.length) * 100) + '%';

      const result = await processFile(f.file);
      let name = f.newName;
      if (result.ext !== ext(f.file.name)) name = name.replace(/\.[^.]+$/, result.ext);
      zip.file(name, result.data);
      done++;
      await new Promise((r) => setTimeout(r, 0));
    }

    progressLabel.textContent = 'Generating ZIP…';
    try {
      const blob = await zip.generateAsync({ type: 'blob' }, (m) => { progressFill.style.width = m.percent.toFixed(0) + '%'; });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'images_paged.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      statusEl.textContent = 'Done — ' + done + ' image' + (done !== 1 ? 's' : '') + ' processed.';
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.className = 'status warn';
    }

    progressEl.classList.add('hidden');
    progressFill.style.width = '0';
    processBtn.disabled = false;
  });
})();
