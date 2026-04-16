/**
 * Timeline Routes
 * Handles timeline configuration save operations
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateDomain } = require('../utils/state');

const router = express.Router();

/**
 * Save timeline configuration
 * @route POST /api/timeline/:domain
 * @param {string} domain - Website domain (URL parameter)
 * @body {Object} Full timeline.json content
 * @returns {Object} { success: true } on success
 * @returns {Object} { error: string } on error
 * @throws {400} Invalid domain or path traversal attack
 * @throws {500} File write failed
 */
router.post('/:domain', (req, res) => {
  const { domain } = req.params;

  // Validate domain format, prevent illegal characters
  if (!validateDomain(domain)) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  // Build file path
  const timelinePath = path.join(__dirname, '../../websites', domain, 'public', 'timeline.json');

  // Security check: ensure resolved path is still under websites directory
  const resolved = path.resolve(timelinePath);
  if (!resolved.startsWith(path.resolve(path.join(__dirname, '../../websites')))) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  try {
    // Write JSON file with 2-space indentation
    fs.writeFileSync(timelinePath, JSON.stringify(req.body, null, 2));
    console.log(`Timeline saved: ${domain}`);
    res.json({ success: true });
  } catch (e) {
    console.error('Save timeline error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
