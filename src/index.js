'use strict';

/**
 * @module portmap
 * @description Scan and map listening ports with service identification.
 *   Uses platform-appropriate system calls (netstat on win32, ss/netstat on Linux/macOS).
 * @author idirdev
 */

const { execSync } = require('child_process');
const net = require('net');
const os = require('os');

/**
 * Map of well-known TCP port numbers to their conventional service names.
 * @type {Object.<number, string>}
 */
const WELL_KNOWN_PORTS = {
  20: 'FTP-Data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  68: 'DHCP',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  389: 'LDAP',
  443: 'HTTPS',
  445: 'SMB',
  465: 'SMTPS',
  514: 'Syslog',
  587: 'SMTP-Submission',
  993: 'IMAPS',
  995: 'POP3S',
  1433: 'MSSQL',
  1521: 'Oracle-DB',
  2181: 'ZooKeeper',
  2375: 'Docker',
  2376: 'Docker-TLS',
  3000: 'Node.js',
  3306: 'MySQL',
  4200: 'Angular-Dev',
  5000: 'Flask',
  5432: 'PostgreSQL',
  5672: 'RabbitMQ',
  6379: 'Redis',
  6443: 'Kubernetes-API',
  8080: 'HTTP-Alt',
  8443: 'HTTPS-Alt',
  8888: 'Jupyter',
  9090: 'Prometheus',
  9200: 'Elasticsearch',
  9300: 'Elasticsearch-Transport',
  15672: 'RabbitMQ-Management',
  27017: 'MongoDB',
  27018: 'MongoDB',
  50070: 'Hadoop-HDFS',
};

/**
 * Identify the conventional service name for a port number.
 *
 * @param {number} port - TCP port number.
 * @returns {string|null} Service name string, or null if not in the well-known map.
 */
function identifyService(port) {
  return WELL_KNOWN_PORTS[port] || null;
}

/**
 * Parse the system's current list of listening TCP ports.
 * Uses `netstat -ano` on Windows and `ss -tlnp` / `netstat -tlnp` on Unix.
 *
 * @returns {{ port: number, pid: number|null, address: string }[]}
 *   Array of port descriptors for all currently listening sockets.
 */
function getListeningPorts() {
  const platform = os.platform();

  try {
    if (platform === 'win32') {
      const out = execSync('netstat -ano', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      return out
        .split('\n')
        .filter((line) => line.includes('LISTENING'))
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const address = parts[1] || '';
          const port = parseInt(address.split(':').pop(), 10);
          const pid = parseInt(parts[parts.length - 1], 10);
          return { port, pid: pid > 0 ? pid : null, address };
        })
        .filter((r) => r.port > 0 && !isNaN(r.port));
    } else {
      // Try ss first (more modern)
      let out = '';
      try {
        out = execSync('ss -tlnp', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        });

        return out
          .split('\n')
          .slice(1)
          .filter(Boolean)
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            const address = parts[3] || '';
            const port = parseInt(address.split(':').pop(), 10);
            const pidMatch = line.match(/pid=(\d+)/);
            return {
              port,
              pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
              address,
            };
          })
          .filter((r) => r.port > 0 && !isNaN(r.port));
      } catch {
        // Fall back to netstat
        out = execSync('netstat -tlnp 2>/dev/null || netstat -tln', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        });

        return out
          .split('\n')
          .slice(2)
          .filter(Boolean)
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            const address = parts[3] || '';
            const port = parseInt(address.split(':').pop(), 10);
            return { port, pid: null, address };
          })
          .filter((r) => r.port > 0 && !isNaN(r.port));
      }
    }
  } catch {
    return [];
  }
}

/**
 * Probe a single TCP port on the given host by attempting a socket connection.
 *
 * @param {number} port            - Port number to probe.
 * @param {string} [host='127.0.0.1'] - Target host.
 * @param {number} [timeout=800]   - Connection timeout in milliseconds.
 * @returns {Promise<{ port: number, open: boolean }>}
 */
function portInfo(port, host, timeout) {
  host = host || '127.0.0.1';
  timeout = timeout || 800;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    function done(open) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, open });
    }

    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Scan a range of TCP ports and return those that accept connections.
 *
 * @param {number} start           - First port in the range.
 * @param {number} end             - Last port in the range (inclusive).
 * @param {string} [host='127.0.0.1'] - Target host.
 * @param {number} [timeout=800]   - Per-port connection timeout in milliseconds.
 * @returns {Promise<{ port: number, open: boolean, service: string|null }[]>}
 *   Array of results for all open ports in the range.
 */
async function scanRange(start, end, host, timeout) {
  host = host || '127.0.0.1';
  timeout = timeout || 800;

  const probes = [];
  for (let port = start; port <= end; port++) {
    probes.push(portInfo(port, host, timeout));
  }

  const results = await Promise.all(probes);
  return results
    .filter((r) => r.open)
    .map((r) => ({ port: r.port, open: true, service: identifyService(r.port) }));
}

/**
 * Build a human-readable summary string from an array of port scan results.
 *
 * @param {{ port: number, open?: boolean, service?: string|null }[]} ports
 *   Array of port result objects.
 * @returns {string} Formatted multi-line summary.
 */
function summary(ports) {
  if (!ports || !ports.length) {
    return 'No open ports found.';
  }

  const lines = ['Open ports (' + ports.length + '):'];
  ports.forEach((r) => {
    const svc = r.service || identifyService(r.port);
    lines.push('  ' + r.port + (svc ? '  [' + svc + ']' : ''));
  });
  return lines.join('\n');
}

module.exports = {
  WELL_KNOWN_PORTS,
  identifyService,
  getListeningPorts,
  portInfo,
  scanRange,
  summary,
};
