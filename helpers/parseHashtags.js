function parseHashtags(text) {
    if (typeof text !== 'string') {
        throw new TypeError('A string was expected');
    }
    
    var tagRegEx = /[#]+[A-Za-z0-9-_]+/g;
    return text.match(tagRegEx);
 }

module.exports = parseHashtags;