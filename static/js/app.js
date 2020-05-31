// Register SW
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
    .register('/sw.js')
    // Returns a promise
    .then(function() {
        console.log('[SW] Registered');
    });
}


// Markdown Support
var converter = new showdown.Converter(),
md_elements = document.getElementsByClassName('md');
for (let mde of md_elements) {
    mde.innerHTML = converter.makeHtml(mde.textContent);
};


// Search
var searchtype = document.getElementsByName('searchtype')[0];
var search = document.getElementsByName('search')[0];
if (searchtype) {
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