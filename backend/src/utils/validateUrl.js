/**
 * Returns { valid: true, url } on success.
 * Returns { valid: false, message } on failure.
 */
function validateUrl(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { valid: false, message: 'URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { valid: false, message: 'Invalid URL format. Example: https://example.com' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, message: 'URL must use http or https protocol.' };
  }

  if (!parsed.hostname || parsed.hostname.length < 2) {
    return { valid: false, message: 'URL must include a valid hostname.' };
  }

  return { valid: true, url: parsed.href };
}

module.exports = validateUrl;
