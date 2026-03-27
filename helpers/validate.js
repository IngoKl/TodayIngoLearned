// Input validation helpers for route boundaries.
// Returns { valid: true } or { valid: false, error: 'message' }.

const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 50000;
const MAX_COMMENT_LENGTH = 10000;
const MAX_BOARD_NAME_LENGTH = 100;
const MAX_NOTE_TITLE_LENGTH = 200;
const MAX_NOTE_BODY_LENGTH = 5000;
const MAX_USERNAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 200;

exports.til = function (body) {
  const { title, description, date } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { valid: false, error: 'Title is required' };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or less` };
  }
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Description is required' };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` };
  }
  if (date && isNaN(new Date(date).getTime())) {
    return { valid: false, error: 'Invalid date' };
  }
  return { valid: true };
};

exports.comment = function (body) {
  const { comment } = body;

  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    return { valid: false, error: 'Comment is required' };
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { valid: false, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less` };
  }
  return { valid: true };
};

exports.createUser = function (body) {
  const { username, password } = body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return { valid: false, error: 'Username is required' };
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return { valid: false, error: `Username must be ${MAX_USERNAME_LENGTH} characters or less` };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username may only contain letters, numbers, hyphens, and underscores' };
  }
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be ${MAX_PASSWORD_LENGTH} characters or less` };
  }
  return { valid: true };
};

exports.boardName = function (name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'Board name is required' };
  }
  if (name.length > MAX_BOARD_NAME_LENGTH) {
    return { valid: false, error: `Board name must be ${MAX_BOARD_NAME_LENGTH} characters or less` };
  }
  return { valid: true };
};

exports.note = function (body) {
  const title = body.title || '';
  const noteBody = body.body || '';

  if (title.length > MAX_NOTE_TITLE_LENGTH) {
    return { valid: false, error: `Note title must be ${MAX_NOTE_TITLE_LENGTH} characters or less` };
  }
  if (noteBody.length > MAX_NOTE_BODY_LENGTH) {
    return { valid: false, error: `Note body must be ${MAX_NOTE_BODY_LENGTH} characters or less` };
  }
  return { valid: true };
};

exports.searchType = function (type) {
  return ['title', 'text', 'tag', 'date'].includes(type);
};

exports.studyResult = function (result) {
  return ['easy', 'ok', 'hard', 'mute'].includes(result);
};

exports.colorString = function (str) {
  if (!str || typeof str !== 'string') return false;
  return /^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6})*$/.test(str.trim());
};

exports.positiveInt = function (value) {
  const n = parseInt(value, 10);
  return !isNaN(n) && n > 0 ? n : null;
};
