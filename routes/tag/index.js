const express = require('express');
const TagModel = require('./../../models/tag');
const router = express.Router();
const tilsObject = require('./../../helpers/tilsObject');

// Rendering tags and showing all tags a user has used
router.get('/tags',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const tags = TagModel.getUserTagsSorted(req.user.id);
      res.render('tags', { tags: tags, user: req.user });
    } catch (err) { next(err); }
  });

router.get('/:tag',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      // Since #s can't be used in URLs, we need to reintroduce them here
      const request_tag = '#' + req.params.tag;

      const rows = TagModel.findTilsByTag(req.user.id, request_tag);
      const tils = tilsObject(rows);

      const related_tags = TagModel.getRelatedTags(req.user.id, request_tag).filter(tag => tag !== request_tag);

      if (tils[1].length > 0) {
        const perPage = 10;
        const totalPages = Math.ceil(tils[1].length / perPage);
        const page = Math.min(totalPages, Math.max(1, parseInt(req.query.page, 10) || 1));
        const pagedKeys = tils[1].slice((page - 1) * perPage, page * perPage);
        res.render('tag', { tag: request_tag, tils_objects: tils[0], tils_keys: pagedKeys, related_tags: related_tags, user: req.user, page: page, totalPages: totalPages });
      } else {
        res.redirect('/');
      }
    } catch (err) { next(err); }
  });


module.exports = router;
