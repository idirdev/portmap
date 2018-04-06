#!/usr/bin/env node
'use strict';

/**
 * @file cli.js
 * @description CLI for portmap — scan and map listening ports with service identification.
 * @author idirdev
 * @usage portmap [--range 1-1024] [--json] [--service-only]
 */

const m = require('../src/index');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'Usage: portmap [options]',
    '',
    'Options:',
    '  --range <start-end>   Probe a port range (e.g. 1-1024). Default: show listening ports.',
    '  --service-only        Only show ports that match a known service.',
    '  --json                Output results as JSON.',
    '  -h, --help            Show this help message.',
  ].join('\n'));
  process.exit(0);
}

/** @param {string} flag @returns {string|undefined} */
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const json = args.includes('--json');
const serviceOnly = args.includes('--service-only');
const rangeArg = getArg('--range');

function applyFilters(ports) {
  if (serviceOnly) {
    return ports.filter((r) => m.identifyService(r.port));
  }
  return ports;
}

if (rangeArg) {
  const parts = rangeArg.split('-').map(Number);
  const start = parts[0];
  const end = parts[1];

  if (isNaN(start) || isNaN(end) || start > end) {
    console.error('Error: invalid --range value, expected format start-end (e.g. 1-1024)');
    process.exit(1);
  }

  m.scanRange(start, end)
    .then((open) => {
      const results = applyFilters(open);
      if (json) {
        console.log(JSON.stringify({ range: rangeArg, ports: results }));
      } else {
        console.log(m.summary(results));
      }
    })
    .catch((err) => {
      console.error('Error: ' + err.message);
      process.exit(1);
    });
} else {
  const listening = m.getListeningPorts();
  const annotated = listening.map((r) => ({
    port: r.port,
    pid: r.pid,
    address: r.address,
    service: m.identifyService(r.port),
  }));
  const results = serviceOnly ? annotated.filter((r) => r.service) : annotated;

  if (json) {
    console.log(JSON.stringify({ listeningPorts: results }));
  } else if (!results.length) {
    console.log('No listening ports found.');
  } else {
    console.log('Listening ports (' + results.length + '):');
    results.forEach((r) => {
      const svc = r.service ? '  [' + r.service + ']' : '';
      const pidStr = r.pid ? '  PID ' + r.pid : '';
      console.log('  :' + r.port + svc + pidStr);
    });
  }
}
