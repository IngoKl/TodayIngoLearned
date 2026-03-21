function parseHashtags(text) {
    if (typeof text !== 'string') {
        throw new TypeError('A string was expected');
    }

    const tagRegEx = /[#]+[A-Za-z0-9-_äöüÄÖÜß\u00F0-\u02AF]+/g;
    return text.match(tagRegEx);
 }

module.exports = parseHashtags;
