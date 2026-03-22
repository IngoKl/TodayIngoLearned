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
