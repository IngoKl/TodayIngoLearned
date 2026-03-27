// drawing.js - Lightweight HTML5 canvas drawing tool (Bootstrap modal)

function openDrawingCanvas(options = {}) {
  // Remove existing modal if any
  const existing = document.getElementById('drawing-modal');
  if (existing) existing.remove();

  // Get pen color presets from page data attribute (set by server)
  const penColorsEl = document.getElementById('pen-colors-data');
  const penColors = penColorsEl ? penColorsEl.dataset.colors.split(',') : ['#4ecdc4', '#ffc145', '#fffbff', '#364652', '#ca1551'];

  // Build color preset buttons HTML
  const presetBtns = penColors.map((c, i) =>
    `<button type="button" class="draw-color-preset${i === 0 ? ' active' : ''}" data-color="${c}" style="background:${c};" title="${c}"></button>`
  ).join('');

  // Note color picker (optional — for choosing the sticky note background color)
  const showNoteColor = options.showNoteColor || false;
  const noteColors = options.noteColors || penColors;
  const noteColorBtns = noteColors.map((c, i) =>
    `<button type="button" class="note-color-picker-btn${i === 0 ? ' active' : ''}" data-color="${c}" style="background:${c};" title="${c}"></button>`
  ).join('');
  let selectedNoteColor = noteColors[0];

  // Create modal HTML
  const modal = document.createElement('div');
  modal.id = 'drawing-modal';
  modal.className = 'modal fade';
  modal.tabIndex = -1;
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Draw</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div id="drawing-toolbar">
          <button type="button" class="btn btn-sm btn-outline-secondary active" data-tool="pen">Pen</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-tool="eraser">Eraser</button>
          <span class="draw-color-presets">${presetBtns}</span>
          <input type="color" id="draw-color" value="${penColors[0]}" title="Custom color">
          <label class="ms-2 me-1" style="font-size:0.85rem;">Size</label>
          <input type="range" id="draw-size" min="1" max="20" value="3" style="width:100px;">
          <button type="button" class="btn btn-sm btn-outline-danger ms-auto" id="draw-clear">Clear</button>
        </div>
        <div class="modal-body">
          <canvas id="drawing-canvas" width="750" height="450" style="width:100%;"></canvas>
        </div>
        ${options.showNoteColor ? `
        <div class="px-3 pb-2">
          <label class="form-label mb-1" style="font-size:0.85rem;">Note Color</label>
          <div class="d-flex gap-2 flex-wrap" id="draw-note-colors">${noteColorBtns}</div>
        </div>` : ''}
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="draw-save">Save & Insert</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();

  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let currentTool = 'pen';

  // Transparent background - no fill

  // Tool selection
  const toolButtons = modal.querySelectorAll('[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });

  // Color preset selection
  const colorPresets = modal.querySelectorAll('.draw-color-preset');
  colorPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      colorPresets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('draw-color').value = btn.dataset.color;
    });
  });

  // Sync custom color picker with presets
  document.getElementById('draw-color').addEventListener('input', () => {
    colorPresets.forEach(b => b.classList.remove('active'));
  });

  // Note color picker buttons (for sticky note background)
  const noteColorPickerBtns = modal.querySelectorAll('.note-color-picker-btn');
  noteColorPickerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      noteColorPickerBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedNoteColor = btn.dataset.color;
    });
  });

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const color = document.getElementById('draw-color').value;
    const size = document.getElementById('draw-size').value;

    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Mouse events
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  // Touch events
  canvas.addEventListener('touchstart', startDraw);
  canvas.addEventListener('touchmove', draw);
  canvas.addEventListener('touchend', stopDraw);
  canvas.addEventListener('touchcancel', stopDraw);

  // Clear - now clears to transparent
  document.getElementById('draw-clear').addEventListener('click', () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Save
  document.getElementById('draw-save').addEventListener('click', () => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
      if (typeof options.onSave === 'function') {
        await options.onSave(file, blob, selectedNoteColor);
      } else {
        await uploadImage(file);
      }
      bsModal.hide();
    }, 'image/png');
  });

  // Cleanup on close
  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
  });
}
