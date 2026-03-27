// notes.js - Sticky notes board interactivity

(function () {
  var board = document.getElementById('notes-board');
  if (!board) return;

  // CSRF token from meta tag
  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

  var currentBoardId = board.dataset.boardId || '';
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
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
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

  // --- Helper: build a sticky-note DOM element and append to board ---

  function buildNoteElement(data) {
    var note = document.createElement('div');
    note.className = 'sticky-note';
    note.dataset.noteId = data.id;
    note.dataset.noteType = data.type || 'text';
    note.dataset.noteTitle = data.title || '';
    note.dataset.noteBody = data.body || '';
    note.dataset.noteColor = data.color;
    note.dataset.noteBoard = data.board_id || '';
    note.style.left = data.pos_x + 'px';
    note.style.top = data.pos_y + 'px';
    note.style.width = (data.width || 200) + 'px';
    note.style.height = (data.height || 180) + 'px';
    note.style.backgroundColor = data.color;
    maxZ++;
    note.style.zIndex = maxZ;

    // Text color for contrast
    var lum = luminance(data.color);
    note.style.color = lum < 0.5 ? '#f0f0f0' : '#222';

    note.innerHTML =
      '<div class="sticky-note-header">' +
        '<span class="sticky-note-grip">&#x2817;</span>' +
        '<span class="sticky-note-title">' + escapeHtml(data.title || '') + '</span>' +
        '<div class="sticky-note-actions">' +
          '<button class="btn btn-sm sticky-note-btn" data-action="edit" title="Edit"><i class="fas fa-pen fa-xs"></i></button>' +
          '<button class="btn btn-sm sticky-note-btn" data-action="to-til" title="Convert to TIL"><i class="fas fa-graduation-cap fa-xs"></i></button>' +
          '<button class="btn btn-sm sticky-note-btn" data-action="delete" title="Delete"><i class="fas fa-trash fa-xs"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="sticky-note-body">' +
        (data.type === 'drawing' && data.image_id
          ? '<img src="/image/' + data.image_id + '" alt="Drawing" class="sticky-note-drawing">'
          : '<p class="sticky-note-text">' + escapeHtml(data.body || '') + '</p>') +
      '</div>';

    board.appendChild(note);
    return note;
  }

  function luminance(hex) {
    var r = parseInt(hex.slice(1,3),16)/255;
    var g = parseInt(hex.slice(3,5),16)/255;
    var b = parseInt(hex.slice(5,7),16)/255;
    return 0.299*r + 0.587*g + 0.114*b;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Add Text Note (creates note, adds to DOM, opens edit modal) ---

  document.getElementById('add-text-note').addEventListener('click', function () {
    var color = (typeof defaultNoteColor !== 'undefined' ? defaultNoteColor : '#fffffc');

    fetch('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ title: 'New Note', body: '', color: color, board_id: currentBoardId || null })
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success) return;
        var count = board.querySelectorAll('.sticky-note').length;
        var offset = (count % 10) * 30;
        var noteEl = buildNoteElement({
          id: data.id,
          type: 'text',
          title: 'New Note',
          body: '',
          color: color,
          board_id: currentBoardId || '',
          pos_x: 50 + offset,
          pos_y: 50 + offset,
          width: 200,
          height: 180
        });
        openEditModal(noteEl);
      });
  });

  // --- Add Drawing Note ---

  document.getElementById('add-drawing-note').addEventListener('click', function () {
    openDrawingCanvas({
      showNoteColor: true,
      noteColors: typeof window.noteColorList !== 'undefined' ? window.noteColorList : null,
      onSave: async function (file, blob, noteColor) {
        const formData = new FormData();
        formData.append('image', file);
        if (currentBoardId) {
          formData.append('board_id', currentBoardId);
        }
        if (noteColor) {
          formData.append('color', noteColor);
        }

        const res = await fetch('/notes/drawing', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: formData
        });
        const data = await res.json();

        if (data.success) {
          var count = board.querySelectorAll('.sticky-note').length;
          var offset = (count % 10) * 30;
          buildNoteElement({
            id: data.id,
            type: 'drawing',
            title: 'Drawing',
            body: '',
            color: noteColor || (typeof defaultNoteColor !== 'undefined' ? defaultNoteColor : '#fffffc'),
            board_id: currentBoardId || '',
            image_id: data.image_id,
            pos_x: 50 + offset,
            pos_y: 50 + offset,
            width: 200,
            height: 180
          });
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
        // Submit via POST form for CSRF
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = '/notes/' + noteId + '/delete';
        var csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = '_csrf';
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);
        document.body.appendChild(form);
        form.submit();
      }
    } else if (action === 'to-til') {
      openToTilModal(noteId);
    }
  });

  // --- Edit Modal ---

  var editModal = new bootstrap.Modal(document.getElementById('edit-note-modal'));
  var selectedColor = '#fffffc';

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

    // Set current board in dropdown
    var boardSelect = document.getElementById('edit-note-board');
    if (boardSelect) {
      boardSelect.value = note.dataset.noteBoard || '';
    }

    editModal.show();
  }

  document.getElementById('edit-note-save').addEventListener('click', function () {
    var noteId = document.getElementById('edit-note-id').value;
    var title = document.getElementById('edit-note-title').value;
    var body = document.getElementById('edit-note-body').value;
    var newBoardId = document.getElementById('edit-note-board').value;

    // Save content and color
    var savePromise = fetch('/notes/' + noteId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ title: title, body: body, color: selectedColor })
    });

    // Move board if changed
    var note = document.querySelector('[data-note-id="' + noteId + '"]');
    var oldBoardId = note ? (note.dataset.noteBoard || '') : '';

    if (newBoardId !== oldBoardId) {
      savePromise = savePromise.then(function () {
        return fetch('/notes/' + noteId + '/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ board_id: newBoardId || null })
        });
      });
    }

    savePromise.then(function () {
      editModal.hide();
      window.location.reload();
    });
  });

  // --- Delete Empty Notes ---

  var deleteEmptyBtn = document.getElementById('delete-empty-notes');
  if (deleteEmptyBtn) {
    deleteEmptyBtn.addEventListener('click', function () {
      if (!confirm('Delete all notes with empty body and default title?')) return;

      fetch('/notes/delete-empty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ board_id: currentBoardId || null })
      }).then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success && data.deleted > 0) {
            // Remove empty notes from DOM
            data.ids.forEach(function (id) {
              var el = board.querySelector('[data-note-id="' + id + '"]');
              if (el) el.remove();
            });
          }
        });
    });
  }

  // --- Convert to TIL Modal ---

  var toTilModal = new bootstrap.Modal(document.getElementById('to-til-modal'));

  function openToTilModal(noteId) {
    document.getElementById('to-til-form').action = '/notes/' + noteId + '/to-til';
    toTilModal.show();
  }
})();
