'use strict';

/**
 * @file portmap.test.js
 * @description Tests for portmap: WELL_KNOWN_PORTS, identifyService, scanRange, portInfo, summary.
 * @author idirdev
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const {
  WELL_KNOWN_PORTS,
  identifyService,
  getListeningPorts,
  portInfo,
  scanRange,
  summary,
} = require('../src/index');

/** Port we deliberately open for testing */
const TEST_PORT = 47521;

/** @type {net.Server} */
let server;

before(async () => {
  await new Promise((resolve, reject) => {
    server = net.createServer();
    server.once('error', reject);
    server.once('listening', resolve);
    server.listen(TEST_PORT, '127.0.0.1');
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('portmap', () => {
  // -- WELL_KNOWN_PORTS -----------------------------------------------------

  it('WELL_KNOWN_PORTS is an object with 20+ entries', () => {
    assert.equal(typeof WELL_KNOWN_PORTS, 'object');
    assert.ok(Object.keys(WELL_KNOWN_PORTS).length >= 20);
  });

  it('WELL_KNOWN_PORTS contains standard web ports', () => {
    assert.equal(WELL_KNOWN_PORTS[80], 'HTTP');
    assert.equal(WELL_KNOWN_PORTS[443], 'HTTPS');
    assert.equal(WELL_KNOWN_PORTS[22], 'SSH');
  });

  it('WELL_KNOWN_PORTS contains common database ports', () => {
    assert.equal(WELL_KNOWN_PORTS[5432], 'PostgreSQL');
    assert.equal(WELL_KNOWN_PORTS[3306], 'MySQL');
    assert.equal(WELL_KNOWN_PORTS[6379], 'Redis');
    assert.equal(WELL_KNOWN_PORTS[27017], 'MongoDB');
  });

  // -- identifyService ------------------------------------------------------

  it('identifyService returns correct name for HTTP (80)', () => {
    assert.equal(identifyService(80), 'HTTP');
  });

  it('identifyService returns correct name for HTTPS (443)', () => {
    assert.equal(identifyService(443), 'HTTPS');
  });

  it('identifyService returns correct name for PostgreSQL (5432)', () => {
    assert.equal(identifyService(5432), 'PostgreSQL');
  });

  it('identifyService returns null for an unknown port', () => {
    assert.equal(identifyService(47521), null);
  });

  it('identifyService returns null for port 0', () => {
    assert.equal(identifyService(0), null);
  });

  // -- portInfo -------------------------------------------------------------

  it('portInfo resolves open:true for our test server', async () => {
    const result = await portInfo(TEST_PORT, '127.0.0.1', 1000);
    assert.equal(result.open, true);
    assert.equal(result.port, TEST_PORT);
  });

  it('portInfo resolves open:false for a closed port', async () => {
    const result = await portInfo(47599, '127.0.0.1', 500);
    assert.equal(result.open, false);
  });

  // -- scanRange ------------------------------------------------------------

  it('scanRange finds the test server port', async () => {
    const results = await scanRange(TEST_PORT, TEST_PORT, '127.0.0.1', 1000);
    assert.equal(results.length, 1);
    assert.equal(results[0].port, TEST_PORT);
    assert.equal(results[0].open, true);
  });

  it('scanRange returns empty array for all-closed range', async () => {
    const results = await scanRange(47590, 47595, '127.0.0.1', 300);
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });

  // -- getListeningPorts ----------------------------------------------------

  it('getListeningPorts returns an array', () => {
    const ports = getListeningPorts();
    assert.ok(Array.isArray(ports));
  });

  // -- summary --------------------------------------------------------------

  it('summary returns "No open ports found." for empty array', () => {
    assert.equal(summary([]), 'No open ports found.');
  });

  it('summary includes port numbers in output', () => {
    const text = summary([{ port: 80, service: 'HTTP' }, { port: 443, service: 'HTTPS' }]);
    assert.ok(text.includes('80'));
    assert.ok(text.includes('443'));
  });

  it('summary includes service names when available', () => {
    const text = summary([{ port: 80, service: 'HTTP' }]);
    assert.ok(text.includes('HTTP'));
  });
});
