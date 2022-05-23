// Register SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
    .register('/sw.js')
    // Returns a promise
    .then(function() {
        console.log('[SW] Registered');
    });
}


function AddILink(iLink, mde) {
    fetch('/json/findid/' + iLink)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      console.log(data);
      if (data.id) {
        mde.innerHTML = mde.innerHTML.replace('[[' + iLink + ']]', '<a href="/view/' + data['id'] + '">' + iLink + '</a>');
      } else {
        mde.innerHTML = mde.innerHTML.replace('[[' + iLink + ']]', '<a href="/add?title=' + iLink + '">' + iLink + '</a>');
      }
      
    });
}


// Markdown Support, Tag Highlighting, Internal Links
var converter = new showdown.Converter(),
mdElements = document.getElementsByClassName('md');
for (let mde of mdElements) {
    // Markdown
    mde.innerHTML = converter.makeHtml(mde.textContent);

    // Tags
    var tagRegEx = /\B(\#([a-zA-Z]+\b)(?!;))/ig;
    mde.innerHTML = mde.innerHTML.replace(tagRegEx, '<a class="tag" href="/tag/$2">$1</a>');

    // Internal Links
    var iLinkRegEx = /\[\[(.*?)\]\]/ig;
    var iLinks = mde.innerHTML.matchAll(iLinkRegEx);

    Array.from(iLinks).forEach(function(iLink) {
      AddILink(iLink[1], mde)
    });
};


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
    var md = document.getElementById("description");
    
    var sStart = md.selectionStart;
    var sEnd = md.selectionEnd;
    var text = md.value;
    var selectedText = text.substring(sStart, sEnd);

    if (add_only == true) {
      var replacedText = text.substring(0, sStart) + md_to_add + text.substring(sEnd, text.length);
    } else {
      if (prefix_only == true) {
        var replacedText = text.substring(0, sStart) + md_to_add + selectedText + text.substring(sEnd, text.length);
      } else {
        var replacedText = text.substring(0, sStart) + md_to_add + selectedText + md_to_add + text.substring(sEnd, text.length);
      }
    }
    
    md.value = replacedText;

}


// Search
var searchtype = document.getElementsByName('searchtype')[0];
var search = document.getElementsByName('search')[0];
if (searchtype != null) {
  searchtype.addEventListener('change', function() {
      if (searchtype.value == 'date') {
        search.type = 'date';
      }
      else if (searchtype.value == 'tag') {

        search.type = 'text';

        var tags = []
        fetch('/json/tags')
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          tags = data;
        });
        
        var tag_complete = new autoComplete({
          selector: 'input[name="search"]',
          minChars: 1,
          source: function(term, suggest){
            term = term.toLowerCase();
        
            var choices = tags["tags"];
            var matches = [];
            for (i=0; i<choices.length; i++)
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

// Dark Mode

const dm_options = {
  right: 'unset',
  left: '32px',
  label: '🌓',
}

function addDarkmodeWidget() {
  new Darkmode(dm_options).showWidget();
}
window.addEventListener('load', addDarkmodeWidget);
