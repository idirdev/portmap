# portmap

> **[EN]** A CLI tool to map and identify listening ports on your system, scan remote hosts for open ports, and resolve well-known port numbers to service names.
> **[FR]** Un outil CLI pour cartographier et identifier les ports en écoute sur votre système, scanner des hôtes distants et résoudre les numéros de ports en noms de services.

---

## Features / Fonctionnalités

**[EN]**
- List all ports currently listening on the local machine
- Identify well-known services by port number (SSH, HTTP, PostgreSQL, Redis, etc.)
- Scan a remote host for open ports across a specified range
- Concurrent port scanning for fast results
- Cross-platform: works on Linux, macOS, and Windows
- Zero external dependencies

**[FR]**
- Lister tous les ports actuellement en écoute sur la machine locale
- Identifier les services connus par numéro de port (SSH, HTTP, PostgreSQL, Redis, etc.)
- Scanner un hôte distant pour détecter les ports ouverts dans une plage donnée
- Scan concurrent pour des résultats rapides
- Multi-plateforme : Linux, macOS et Windows
- Aucune dépendance externe

---

## Installation

```bash
npm install -g @idirdev/portmap
```

---

## CLI Usage / Utilisation CLI

```bash
# List all listening ports on the local machine
# Lister tous les ports en écoute sur la machine locale
portmap

# Scan localhost ports 1–1024
# Scanner les ports 1–1024 sur localhost
portmap --scan localhost 1-1024

# Scan a remote host
# Scanner un hôte distant
portmap --scan 192.168.1.10 1-9999

# Show help / Afficher l'aide
portmap --help
```

### Example Output / Exemple de sortie

```
$ portmap
Listening ports:
  :22  [SSH]   0.0.0.0:22
  :80  [HTTP]  0.0.0.0:80
  :443 [HTTPS] 0.0.0.0:443
  :3306 [MySQL] 127.0.0.1:3306
  :5432 [PostgreSQL] 127.0.0.1:5432
  :6379 [Redis] 127.0.0.1:6379

$ portmap --scan 192.168.1.10 20-1024
Open ports on 192.168.1.10:
  22 (SSH)
  80 (HTTP)
  443 (HTTPS)
  3306 (MySQL)
```

---

## API (Programmatic) / API (Programmation)

**[EN]** Use portmap as a library in your Node.js project.
**[FR]** Utilisez portmap comme bibliothèque dans votre projet Node.js.

```javascript
const { getListeningPorts, identifyService, scanPort, scanRange, WELL_KNOWN } = require('@idirdev/portmap');

// List all listening ports on the local system
// Lister tous les ports en écoute sur le système local
const ports = getListeningPorts();
ports.forEach(p => {
  const svc = identifyService(p.port);
  console.log(`::${p.port} ${svc || ''}`);
});
// { port: 22, pid: 1234, address: '0.0.0.0:22' }

// Identify a service by port number
// Identifier un service par numéro de port
console.log(identifyService(5432)); // 'PostgreSQL'
console.log(identifyService(9999)); // null

// Check a single port on a remote host
// Vérifier un seul port sur un hôte distant
const result = await scanPort('192.168.1.10', 80, 1000);
console.log(result); // { port: 80, open: true }

// Scan a range of ports concurrently
// Scanner une plage de ports en parallèle
const open = await scanRange('192.168.1.10', 1, 1024, 500);
console.log(open); // [{ port: 22, open: true }, { port: 80, open: true }]

// Built-in well-known port map
// Table des services bien connus intégrée
console.log(WELL_KNOWN[6379]); // 'Redis'
```

### API Reference

| Function | Parameters | Returns |
|----------|-----------|---------|
| `getListeningPorts()` | — | `Array<{port, pid, address}>` |
| `identifyService(port)` | port number | `string \| null` |
| `scanPort(host, port, timeout?)` | host, port, ms | `Promise<{port, open}>` |
| `scanRange(host, start, end, timeout?)` | host, start, end, ms | `Promise<Array<{port, open}>>` |

---

## License

MIT - idirdev
