import net from 'node:net';
import tls from 'node:tls';
import { Duplex } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprint, type TlsFingerprint } from './tls/clienthello.js';

export interface TlsOptions {
  port: number;
  once: boolean;
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => c('1', s);
const dim = (s: string) => c('2', s);
const cyan = (s: string) => c('36', s);
const green = (s: string) => c('32', s);

/**
 * TLS/JA4 fingerprint server. Peeks the raw ClientHello from each connection,
 * computes JA3/JA4, then terminates TLS normally so the browser still loads a
 * page. The fingerprint comes from the network stack, so it can't be spoofed by
 * page JavaScript — great for catching headless bots and UA liars. (It won't
 * separate same-engine forks: Zen and Firefox share Gecko's TLS stack.)
 */
export async function tlsServe(opts: TlsOptions): Promise<void> {
  if ((process.versions as { bun?: string }).bun) {
    throw new Error(
      'abd tls needs the Node.js runtime — bun\'s server-side TLS wrapping is incomplete.\n' +
        '  Run it under node instead:  node packages/cli/dist/index.js tls\n' +
        '  (or via the published CLI:   npx @abd/cli tls). The `bun run tls` script does this for you.',
    );
  }
  const { key, cert } = ensureCert();

  const server = net.createServer((socket) => {
    socket.once('data', (first: Buffer) => {
      let fp: TlsFingerprint | null = null;
      try {
        fp = fingerprint(first);
      } catch {
        /* not a parseable ClientHello */
      }
      // TLS reads at the socket-handle level, so unshifting the peeked bytes
      // wouldn't reach the handshake engine. Instead bridge the raw socket
      // through a plain Duplex (which TLS reads at the JS-stream level) and
      // replay every byte — starting with the ClientHello we just captured.
      const bridge = new Duplex({
        read() {},
        write(chunk, _enc, cb) {
          socket.write(chunk, cb);
        },
      });
      bridge.push(first);
      socket.on('data', (d) => bridge.push(d));
      socket.on('end', () => bridge.push(null));
      socket.on('close', () => bridge.destroy());
      bridge.on('error', () => {});

      const tlsSocket = new tls.TLSSocket(bridge, { isServer: true, key, cert });
      tlsSocket.on('error', () => tlsSocket.destroy());

      tlsSocket.once('data', () => {
        const body = pageHtml(fp);
        tlsSocket.end(
          `HTTP/1.1 200 OK\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: ${Buffer.byteLength(
            body,
          )}\r\nconnection: close\r\n\r\n${body}`,
        );
        if (fp) report(fp);
        else process.stdout.write(`\n  ${dim('connection was not a parseable ClientHello')}\n`);
        if (opts.once && fp) {
          server.close();
          setTimeout(() => process.exit(0), 100);
        }
      });
    });
  });

  await new Promise<void>((r) => server.listen(opts.port, r));
  process.stderr.write(
    `\n  abd tls listening at ${bold(`https://localhost:${opts.port}/`)}\n` +
      `  → Open it in a browser (accept the self-signed cert warning) or run:\n` +
      `      curl -k https://localhost:${opts.port}/\n` +
      `  → The TLS/JA4 fingerprint prints here. ${dim('Ctrl-C to stop.')}\n\n`,
  );
}

function report(fp: TlsFingerprint): void {
  process.stdout.write(
    `\n  ${green('✓')} TLS ClientHello captured\n` +
      `  ${dim('JA4')}       ${bold(cyan(fp.ja4))}\n` +
      `  ${dim('JA3 hash')}  ${fp.ja3Hash}\n` +
      `  ${dim('TLS')}       ${tlsName(fp.hello.tlsVersion)}  ${dim(`· ${fp.hello.ciphers.length} ciphers · ${fp.hello.extensions.length} extensions`)}\n` +
      `  ${dim('ALPN')}      ${fp.hello.alpn.join(', ') || '—'}${fp.hello.sni ? `   ${dim('SNI')} ${fp.hello.sni}` : ''}\n` +
      `  ${dim('Look up the JA4 in a database (e.g. ja4db.com) to map it to a client.')}\n\n`,
  );
}

function tlsName(v: number): string {
  return { 0x0304: 'TLS 1.3', 0x0303: 'TLS 1.2', 0x0302: 'TLS 1.1', 0x0301: 'TLS 1.0' }[v] ?? `0x${v.toString(16)}`;
}

/** Generate (once) a throwaway self-signed cert via openssl into a gitignored dir. */
function ensureCert(): { key: Buffer; cert: Buffer } {
  const dir = resolve(process.cwd(), '.abd-tls');
  const keyPath = resolve(dir, 'key.pem');
  const certPath = resolve(dir, 'cert.pem');
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    mkdirSync(dir, { recursive: true });
    try {
      execFileSync(
        'openssl',
        ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '365', '-nodes', '-subj', '/CN=localhost'],
        { stdio: 'ignore' },
      );
    } catch {
      throw new Error('could not generate a dev certificate — is `openssl` installed and on PATH?');
    }
  }
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

function pageHtml(fp: TlsFingerprint | null): string {
  const rows = fp
    ? `<table>
        <tr><td>JA4</td><td><b>${fp.ja4}</b></td></tr>
        <tr><td>JA3 hash</td><td>${fp.ja3Hash}</td></tr>
        <tr><td>TLS</td><td>${tlsName(fp.hello.tlsVersion)}</td></tr>
        <tr><td>ALPN</td><td>${fp.hello.alpn.join(', ') || '—'}</td></tr>
        <tr><td>Ciphers</td><td>${fp.hello.ciphers.length}</td></tr>
       </table>`
    : '<p>Could not parse a ClientHello from this connection.</p>';
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>abd · TLS fingerprint</title>
<style>body{font:15px/1.6 ui-sans-serif,system-ui,sans-serif;max-width:600px;margin:8vh auto;padding:0 20px}
td{padding:6px 10px;border-bottom:1px solid #8883}td:first-child{opacity:.6}</style>
<h1>Your TLS fingerprint</h1>${rows}
<p style="opacity:.6">This is derived from your browser's TLS ClientHello — page JavaScript cannot change it. It also prints in the terminal running <code>abd tls</code>.</p>`;
}
