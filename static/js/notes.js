// notes.js - Sticky notes board interactivity

(function () {
  const board = document.getElementById('notes-board');
  if (!board) return;

  var maxZ = 0;
  var isTouch = window.matchMedia('(pointer: coarse)').matches;

  // Compute max z-index from existing notes
  board.querySelectorAll('.sticky-note').forEach(function (note) {
    var z = parseInt(note.style.zIndex) || 0;
    if (z > maxZ) maxZ = z;
  });

  // =============================================
  // Desktop: instant drag from header via pointer events (unchanged behavior)
  // Touch:   long-press (300ms) anywhere on note to pick up, then drag
  //          Normal swipes always scroll the board
  // =============================================

  if (!isTouch) {
    // --- Desktop drag (pointer events, header only) ---
    var dragTarget = null;
    var dragStartX = 0, dragStartY = 0;
    var dragInitialLeft = 0, dragInitialTop = 0;
    var hasDragged = false;

    board.addEventListener('pointerdown', function (e) {
      var note = e.target.closest('.sticky-note');
      if (!note) return;
      if (!e.target.closest('.sticky-note-header') || e.target.closest('.sticky-note-actions')) return;

      dragTarget = note;
      hasDragged = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragInitialLeft = parseInt(note.style.left) || 0;
      dragInitialTop = parseInt(note.style.top) || 0;

      maxZ++;
      note.style.zIndex = maxZ;
      note.setPointerCapture(e.pointerId);
      note.classList.add('dragging');
      e.preventDefault();
    });

    board.addEventListener('pointermove', function (e) {
      if (!dragTarget) return;
      hasDragged = true;
      dragTarget.style.left = Math.max(0, dragInitialLeft + (e.clientX - dragStartX)) + 'px';
      dragTarget.style.top = Math.max(0, dragInitialTop + (e.clientY - dragStartY)) + 'px';
      e.preventDefault();
    });

    board.addEventListener('pointerup', function (e) {
      if (!dragTarget) return;
      if (hasDragged) savePosition(dragTarget);
      dragTarget.classList.remove('dragging');
      dragTarget = null;
    });

  } else {
    // --- Touch drag: long-press to pick up, then move ---
    var holdTimer = null;
    var touchNote = null;      // note being held
    var dragActive = false;    // true once long-press fires and we're dragging
    var touchId = null;        // tracked touch identifier
    var startX = 0, startY = 0;
    var noteInitialLeft = 0, noteInitialTop = 0;
    var HOLD_MS = 300;
    var MOVE_CANCEL = 10;      // px of movement that cancels the hold

    board.addEventListener('touchstart', function (e) {
      if (dragActive) return;
      var touch = e.touches[0];
      var note = document.elementFromPoint(touch.clientX, touch.clientY);
      note = note ? note.closest('.sticky-note') : null;
      if (!note) return;
      // Don't start hold on action buttons
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target && target.closest('.sticky-note-actions')) return;

      touchNote = note;
      touchId = touch.identifier;
      startX = touch.clientX;
      startY = touch.clientY;
      noteInitialLeft = parseInt(note.style.left) || 0;
      noteInitialTop = parseInt(note.style.top) || 0;

      // Start hold timer — if finger stays still for HOLD_MS, activate drag
      holdTimer = setTimeout(function () {
        dragActive = true;
        maxZ++;
        touchNote.style.zIndex = maxZ;
        touchNote.classList.add('drag-ready', 'dragging');
        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(30);
      }, HOLD_MS);

      // Don't preventDefault here — allow scroll to start naturally
    }, { passive: true });

    board.addEventListener('touchmove', function (e) {
      if (!touchNote) return;

      var touch = getTouch(e, touchId);
      if (!touch) return;

      if (!dragActive) {
        // Still in hold-wait phase: cancel if finger moved too much
        var dx = touch.clientX - startX;
        var dy = touch.clientY - startY;
        if (dx * dx + dy * dy > MOVE_CANCEL * MOVE_CANCEL) {
          cancelHold();
          // Let the browser handle this as a scroll
        }
        return;
      }

      // Drag is active — move the note, prevent scroll
      e.preventDefault();
      touchNote.style.left = Math.max(0, noteInitialLeft + (touch.clientX - startX)) + 'px';
      touchNote.style.top = Math.max(0, noteInitialTop + (touch.clientY - startY)) + 'px';
    }, { passive: false });

    board.addEventListener('touchend', function (e) {
      if (!touchNote) return;
      var touch = getTouch(e, touchId);
      // touchend puts changed touches in changedTouches
      if (!touch) touch = getChangedTouch(e, touchId);
      if (!touch && e.touches.length === 0) {
        // All fingers lifted
      }

      if (dragActive) {
        savePosition(touchNote);
      }
      cleanup();
    }, { passive: true });

    board.addEventListener('touchcancel', function () {
      cleanup();
    }, { passive: true });

    function cancelHold() {
      clearTimeout(holdTimer);
      holdTimer = null;
      touchNote = null;
      touchId = null;
    }

    function cleanup() {
      clearTimeout(holdTimer);
      holdTimer = null;
      if (touchNote) {
        touchNote.classList.remove('drag-ready', 'dragging');
      }
      touchNote = null;
      touchId = null;
      dragActive = false;
    }

    function getTouch(e, id) {
      for (var i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === id) return e.touches[i];
      }
      return null;
    }

    function getChangedTouch(e, id) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === id) return e.changedTouches[i];
      }
      return null;
    }
  }

  // --- Save position to server ---

  function savePosition(note) {
    var noteId = note.dataset.noteId;
    var posX = parseInt(note.style.left);
    var posY = parseInt(note.style.top);

    fetch('/notes/' + noteId + '/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pos_x: posX, pos_y: posY, z_index: maxZ })
    });
  }

  // --- Sort / Arrange Notes in Grid ---

  document.getElementById('sort-notes').addEventListener('click', function () {
    var notes = Array.from(board.querySelectorAll('.sticky-note'));
    if (notes.length === 0) return;

    // Sort by title alphabetically
    notes.sort(function (a, b) {
      return (a.dataset.noteTitle || '').localeCompare(b.dataset.noteTitle || '');
    });

    var gap = 20;
    var x = gap;
    var y = gap;
    var rowHeight = 0;
    var boardWidth = board.clientWidth;

    notes.forEach(function (note) {
      var w = note.offsetWidth;
      var h = note.offsetHeight;

      // Wrap to next row if note doesn't fit
      if (x + w + gap > boardWidth && x > gap) {
        x = gap;
        y += rowHeight + gap;
        rowHeight = 0;
      }

      note.style.left = x + 'px';
      note.style.top = y + 'px';
      savePosition(note);

      x += w + gap;
      if (h > rowHeight) rowHeight = h;
    });
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
