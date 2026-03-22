// notes.js - Sticky notes board interactivity

(function () {
  const board = document.getElementById('notes-board');
  if (!board) return;

  let dragTarget = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let maxZ = 0;
  let hasDragged = false;

  // Compute max z-index from existing notes
  board.querySelectorAll('.sticky-note').forEach(note => {
    const z = parseInt(note.style.zIndex) || 0;
    if (z > maxZ) maxZ = z;
  });

  // --- Drag and Drop via Pointer Events ---

  board.addEventListener('pointerdown', function (e) {
    const note = e.target.closest('.sticky-note');
    if (!note) return;

    // Only drag from the header (not action buttons or body)
    if (!e.target.closest('.sticky-note-header') || e.target.closest('.sticky-note-actions')) return;

    dragTarget = note;
    hasDragged = false;
    const rect = note.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Bring to front
    maxZ++;
    note.style.zIndex = maxZ;

    note.setPointerCapture(e.pointerId);
    note.classList.add('dragging');
    e.preventDefault();
  });

  board.addEventListener('pointermove', function (e) {
    if (!dragTarget) return;

    hasDragged = true;
    const boardRect = board.getBoundingClientRect();
    const newX = e.clientX - boardRect.left - dragOffsetX + board.scrollLeft;
    const newY = e.clientY - boardRect.top - dragOffsetY + board.scrollTop;

    dragTarget.style.left = Math.max(0, newX) + 'px';
    dragTarget.style.top = Math.max(0, newY) + 'px';
    e.preventDefault();
  });

  board.addEventListener('pointerup', function (e) {
    if (!dragTarget) return;

    if (hasDragged) {
      // Save position to server
      const noteId = dragTarget.dataset.noteId;
      const posX = parseInt(dragTarget.style.left);
      const posY = parseInt(dragTarget.style.top);

      fetch('/notes/' + noteId + '/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_x: posX, pos_y: posY, z_index: maxZ })
      });
    }

    dragTarget.classList.remove('dragging');
    dragTarget = null;
  });

  // --- Add Text Note ---

  document.getElementById('add-text-note').addEventListener('click', function () {
    fetch('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'title=New+Note&body=&color=%23fff9c4'
    }).then(function () {
      window.location.reload();
    });
  });

  // --- Add Drawing Note ---

  document.getElementById('add-drawing-note').addEventListener('click', function () {
    openDrawingCanvas({
      onSave: async function (file) {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/notes/drawing', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          window.location.reload();
        }
      }
    });
  });

  // --- Note Actions (Edit, Delete, Convert to TIL) ---

  board.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const note = btn.closest('.sticky-note');
    const noteId = note.dataset.noteId;
    const action = btn.dataset.action;

    if (action === 'edit') {
      openEditModal(note);
    } else if (action === 'delete') {
      if (confirm('Delete this note?')) {
        window.location.href = '/notes/' + noteId + '/delete';
      }
    } else if (action === 'to-til') {
      openToTilModal(noteId);
    }
  });

  // --- Edit Modal ---

  var editModal = new bootstrap.Modal(document.getElementById('edit-note-modal'));
  var selectedColor = '#fff9c4';

  // Color picker buttons
  document.querySelectorAll('.note-color-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedColor = btn.dataset.color;
      document.querySelectorAll('.note-color-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  function openEditModal(note) {
    document.getElementById('edit-note-id').value = note.dataset.noteId;
    document.getElementById('edit-note-title').value = note.dataset.noteTitle;
    document.getElementById('edit-note-body').value = note.dataset.noteBody;
    selectedColor = note.dataset.noteColor;

    // Show/hide body field for drawing notes
    var bodyGroup = document.getElementById('edit-note-body-group');
    if (note.dataset.noteType === 'drawing') {
      bodyGroup.style.display = 'none';
    } else {
      bodyGroup.style.display = '';
    }

    // Highlight current color
    document.querySelectorAll('.note-color-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.color === selectedColor);
    });

    editModal.show();
  }

  document.getElementById('edit-note-save').addEventListener('click', function () {
    var noteId = document.getElementById('edit-note-id').value;
    var title = document.getElementById('edit-note-title').value;
    var body = document.getElementById('edit-note-body').value;

    fetch('/notes/' + noteId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, body: body, color: selectedColor })
    }).then(function () {
      editModal.hide();
      window.location.reload();
    });
  });

  // --- Convert to TIL Modal ---

  var toTilModal = new bootstrap.Modal(document.getElementById('to-til-modal'));

  function openToTilModal(noteId) {
    document.getElementById('to-til-form').action = '/notes/' + noteId + '/to-til';
    toTilModal.show();
  }
})();
