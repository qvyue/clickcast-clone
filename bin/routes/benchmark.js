/**
 * Benchmark Routes
 * HTTP endpoints to trigger and query Remotion concurrency benchmarks.
 *
 * GET /api/benchmark        — Start a benchmark (async, returns immediately)
 * GET /api/benchmark/results — Get latest benchmark results
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { runBenchmark } = require('../benchmark-concurrency');

const router = express.Router();

let benchmarkRunning = false;
let benchmarkError = null;

/**
 * Trigger a benchmark run.
 * Only one benchmark can run at a time.
 */
router.get('/', (req, res) => {
  if (benchmarkRunning) {
    return res.json({ status: 'running', message: 'Benchmark already in progress' });
  }

  benchmarkRunning = true;
  benchmarkError = null;

  const domain = req.query.domain || 'clickcast.tech';
  const ratio = req.query.ratio || 'landscape';

  // Run async — return immediately
  runBenchmark({ domain, ratio })
    .then(() => {
      benchmarkRunning = false;
      console.log('[benchmark] Completed successfully');
    })
    .catch((err) => {
      benchmarkRunning = false;
      benchmarkError = err.message;
      console.error('[benchmark] Failed:', err.message);
    });

  res.json({ status: 'started', message: `Benchmark running (domain=${domain}, ratio=${ratio})` });
});

/**
 * Get the latest benchmark results.
 */
router.get('/results', (req, res) => {
  if (benchmarkRunning) {
    return res.json({ status: 'running' });
  }

  const reportPath = path.join(__dirname, '../../benchmark-results.json');
  if (!fs.existsSync(reportPath)) {
    return res.json({ status: 'none', error: benchmarkError || 'No benchmark results yet' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    res.json({ status: 'completed', ...data });
  } catch (e) {
    res.json({ status: 'error', error: e.message });
  }
});

module.exports = router;
