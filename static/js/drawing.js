// drawing.js - Lightweight HTML5 canvas drawing tool (Bootstrap modal)

function openDrawingCanvas(options = {}) {
  // Remove existing modal if any
  const existing = document.getElementById('drawing-modal');
  if (existing) existing.remove();

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
          <input type="color" id="draw-color" value="#000000" title="Color">
          <label class="ms-2 me-1" style="font-size:0.85rem;">Size</label>
          <input type="range" id="draw-size" min="1" max="20" value="3" style="width:100px;">
          <button type="button" class="btn btn-sm btn-outline-danger ms-auto" id="draw-clear">Clear</button>
        </div>
        <div class="modal-body">
          <canvas id="drawing-canvas" width="750" height="450" style="width:100%;background:#fff;"></canvas>
        </div>
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

  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Tool selection
  const toolButtons = modal.querySelectorAll('[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
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

  // Clear
  document.getElementById('draw-clear').addEventListener('click', () => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  // Save
  document.getElementById('draw-save').addEventListener('click', () => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'drawing.png', { type: 'image/png' });
      if (typeof options.onSave === 'function') {
        await options.onSave(file, blob);
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
