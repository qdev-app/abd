// Validates the ClientHello parser against a REAL handshake: a Node tls client
// sends an actual ClientHello (with SNI + ALPN); a net server peeks the bytes
// and we parse them. Run: node packages/cli/test/tls.mjs
import net from 'node:net';
import tls from 'node:tls';
import { fingerprint } from '../dist/tls/clienthello.js';

let fail = 0;
const asrt = (c, m) => {
  if (!c) {
    console.error('  ✗ FAIL: ' + m);
    fail++;
  }
};

const server = net.createServer((socket) => {
  socket.once('readable', () => {
    const buf = socket.read();
    try {
      const fp = fingerprint(buf);
      console.log('  JA3 :', fp.ja3.slice(0, 70) + '…');
      console.log('  JA3 hash:', fp.ja3Hash);
      console.log('  JA4 :', fp.ja4);
      console.log('  SNI :', fp.hello.sni, '| ALPN:', fp.hello.alpn.join(','), '| ciphers:', fp.hello.ciphers.length);

      asrt(fp.hello.sni === 'abd.test', 'SNI should be parsed');
      asrt(fp.hello.alpn.includes('h2'), 'ALPN should include h2');
      asrt(fp.hello.ciphers.length > 0, 'ciphers should be parsed');
      asrt(/^t\d\d[di]\d\d\d\d..\_[0-9a-f]{12}_[0-9a-f]{12}$/.test(fp.ja4), 'JA4 should match the expected shape');
      asrt(/^[0-9a-f]{32}$/.test(fp.ja3Hash), 'JA3 hash should be an md5 hex');
    } catch (e) {
      console.error('  ✗ parse error:', e.message);
      fail++;
    }
    socket.destroy();
    server.close();
    console.log(fail === 0 ? '\nALL ASSERTIONS PASSED ✓' : `\n${fail} FAILED ✗`);
    process.exit(fail === 0 ? 0 : 1);
  });
});

server.listen(0, () => {
  const port = server.address().port;
  const sock = tls.connect(
    { port, host: '127.0.0.1', servername: 'abd.test', ALPNProtocols: ['h2', 'http/1.1'], rejectUnauthorized: false },
    () => sock.destroy(),
  );
  sock.on('error', () => {}); // handshake won't complete (no server cert); we only need the ClientHello
});

setTimeout(() => {
  console.error('timeout — no ClientHello captured');
  process.exit(1);
}, 4000);
