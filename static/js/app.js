// Register SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
    .register('/sw.js')
    // Returns a promise
    .then(function() {
        console.log('[SW] Registered');
    });
}


function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function AddILink(iLink, mde) {
    return fetch('/json/findid/' + encodeURIComponent(iLink))
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const safe = escapeHtml(iLink);
      if (data.id) {
        mde.innerHTML = mde.innerHTML.replace('[[' + iLink + ']]', '<a href="/til/view/' + data['id'] + '">' + safe + '</a>');
      } else {
        mde.innerHTML = mde.innerHTML.replace('[[' + iLink + ']]', '<a href="/til/add?title=' + encodeURIComponent(iLink) + '">' + safe + '</a>');
      }
    });
}

function autoLinkTitles(element, titles) {
    // Exclude current TIL's title to avoid self-linking
    const card = element.closest('.card-body');
    const cardTitle = card ? card.querySelector('.card-title') : null;
    const currentTitle = cardTitle ? cardTitle.textContent.trim().toLowerCase() : '';

    // Sort longest first so longer titles match before shorter substrings
    const sortedTitles = titles
        .filter(t => t.title.length >= 3 && t.title.toLowerCase() !== currentTitle)
        .sort((a, b) => b.title.length - a.title.length);

    if (!sortedTitles.length) return;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (const node of textNodes) {
        if (node.parentElement.closest('a')) continue;

        for (const {id, title} of sortedTitles) {
            const regex = new RegExp('\\b' + escapeRegExp(title) + '\\b', 'i');
            const match = node.textContent.match(regex);
            if (match) {
                // Split text node around the match and insert a link
                node.splitText(match.index + match[0].length);
                const matchNode = node.splitText(match.index);
                const link = document.createElement('a');
                link.href = '/til/view/' + id;
                link.textContent = matchNode.textContent;
                matchNode.parentNode.replaceChild(link, matchNode);
                break; // one match per text node to avoid index issues
            }
        }
    }
}


// Markdown Support, Tag Highlighting, Internal Links, Auto-linking
const converter = new showdown.Converter(),
mdElements = document.getElementsByClassName('md');

// Fetch titles once for auto-linking
const titlesPromise = fetch('/json/titles')
    .then(r => r.json())
    .then(data => data.titles || [])
    .catch(() => []);

for (let mde of mdElements) {
    // Markdown
    mde.innerHTML = converter.makeHtml(mde.textContent);

    // Tags
    const tagRegEx = /\B([#]+([A-Za-z0-9-_äöüÄÖÜß\u00F0-\u02AF]+))/ig;
    mde.innerHTML = mde.innerHTML.replace(tagRegEx, '<a class="tag" href="/tag/$2">$1</a>');

    // Internal Links, then auto-link titles after they resolve
    const iLinkRegEx = /\[\[(.*?)\]\]/ig;
    const iLinks = Array.from(mde.innerHTML.matchAll(iLinkRegEx));
    const linkPromises = iLinks.map(iLink => AddILink(iLink[1], mde));

    const currentMde = mde;
    Promise.all(linkPromises)
        .then(() => titlesPromise)
        .then(titles => autoLinkTitles(currentMde, titles))
        .catch(() => {});
};

// Syntax highlighting for code blocks
if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}


// Markdown Editor
editTil = document.getElementById("md-bold");
if (editTil != null) {
  document.getElementById("md-bold").addEventListener("click", mdBold);
  document.getElementById("md-italics").addEventListener("click", mdItalics);
  document.getElementById("md-link").addEventListener("click", mdLink);
  document.getElementById("md-ilink").addEventListener("click", mdILink);
  document.getElementById("md-tag").addEventListener("click", mdTag);
}

function mdBold() {
  addMd('**');
}

function mdItalics() {
  addMd('*');
}

function mdLink() {
  addMd('[Title](https://)', add_only=true);
}

function mdILink() {
  addMd('[[ ]]', add_only=true);
}

function mdTag() {
  addMd('#', prefix_only=true);
}

function addMd(md_to_add, prefix_only, add_only) {
    const md = document.getElementById("description");

    const sStart = md.selectionStart;
    const sEnd = md.selectionEnd;
    const text = md.value;
    const selectedText = text.substring(sStart, sEnd);

    let replacedText;
    if (add_only == true) {
      replacedText = text.substring(0, sStart) + md_to_add + text.substring(sEnd, text.length);
    } else {
      if (prefix_only == true) {
        replacedText = text.substring(0, sStart) + md_to_add + selectedText + text.substring(sEnd, text.length);
      } else {
        replacedText = text.substring(0, sStart) + md_to_add + selectedText + md_to_add + text.substring(sEnd, text.length);
      }
    }

    md.value = replacedText;

}


// Image Upload Support
const imageUploadBtn = document.getElementById('md-image');
const imageFileInput = document.getElementById('image-upload');
const drawBtn = document.getElementById('md-draw');
const imageGallery = document.getElementById('image-gallery');

if (imageUploadBtn) {
  imageUploadBtn.addEventListener('click', () => imageFileInput.click());

  imageFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadImage(file);
    imageFileInput.value = '';
  });

  if (drawBtn) {
    drawBtn.addEventListener('click', () => openDrawingCanvas());
  }

  // Drag-and-drop on textarea
  const descTextarea = document.getElementById('description');
  descTextarea.addEventListener('dragover', (e) => { e.preventDefault(); });
  descTextarea.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await uploadImage(file);
    }
  });

  // Paste from clipboard
  descTextarea.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        await uploadImage(file);
        break;
      }
    }
  });
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const gallery = document.getElementById('image-gallery');
  const tilId = gallery ? gallery.dataset.tilId : null;
  if (tilId) formData.append('til_id', tilId);

  const res = await fetch('/til/upload-image', { method: 'POST', body: formData });
  const data = await res.json();

  if (data.markdown) {
    const md = document.getElementById('description');
    const pos = md.selectionStart;
    const before = md.value.substring(0, pos);
    const after = md.value.substring(pos);
    md.value = before + '\n' + data.markdown + '\n' + after;

    addImageToGallery(data.id, data.filename);
  }
}

function addImageToGallery(id, filename) {
  const gallery = document.getElementById('image-gallery');
  if (!gallery) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'position-relative';
  wrapper.innerHTML = `
    <img src="/image/${id}" alt="${filename}" style="max-width:100px;max-height:75px;object-fit:cover;" class="rounded border">
    <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0"
            style="padding:0 4px;font-size:10px;line-height:1.2;"
            onclick="deleteImage(${id}, this)">x</button>
  `;
  gallery.appendChild(wrapper);
}

async function deleteImage(imageId, btn) {
  if (!confirm('Delete this image?')) return;
  await fetch('/til/delete-image/' + imageId, { headers: { 'Accept': 'application/json' } });
  btn.closest('.position-relative').remove();
}

// Load existing images when editing
if (imageGallery && imageGallery.dataset.tilId) {
  fetch('/json/images/' + imageGallery.dataset.tilId)
    .then(r => r.json())
    .then(data => {
      (data.images || []).forEach(img => addImageToGallery(img.id, img.filename));
    });
}


// Search
const searchtype = document.getElementsByName('searchtype')[0];
const search = document.getElementsByName('search')[0];
if (searchtype != null) {
  searchtype.addEventListener('change', function() {
      if (searchtype.value == 'date') {
        search.type = 'date';
      }
      else if (searchtype.value == 'tag') {

        search.type = 'text';

        let tags = []
        fetch('/json/tags')
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          tags = data;
        });

        const tag_complete = new autoComplete({
          selector: 'input[name="search"]',
          minChars: 1,
          source: function(term, suggest){
            term = term.toLowerCase();

            const choices = tags["tags"];
            const matches = [];
            for (let i=0; i<choices.length; i++)
                if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
            suggest(matches);
        }
        });

      }
      else {
        search.type = 'text';
      }
  });
}


// Dark Mode BS
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const bodyElement = document.body;

let savedTheme = localStorage.getItem('theme');
if (!savedTheme) {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    savedTheme = prefersDarkScheme ? 'dark' : 'light';
    localStorage.setItem('theme', savedTheme);
}

htmlElement.setAttribute('data-bs-theme', savedTheme);
bodyElement.style.backgroundColor = savedTheme === 'light' ? '#f5f5f5' : '#3b4045';

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElement.setAttribute('data-bs-theme', newTheme);
    bodyElement.style.backgroundColor = newTheme === 'light' ? '#f5f5f5' : '#3b4045';
    localStorage.setItem('theme', newTheme);
});
