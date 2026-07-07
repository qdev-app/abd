import { createHash } from 'node:crypto';

/**
 * Minimal TLS ClientHello parser + JA3/JA4 fingerprints.
 *
 * The TLS ClientHello is chosen by the browser's network stack, not by page
 * JavaScript, so it can't be spoofed from the web the way a User-Agent can. Two
 * browsers on the same engine share it (Zen == Firefox here too), but it's a
 * strong, JS-proof signal for engine/brand and for catching headless bots and
 * UA liars. JA4 (FoxIO) sorts the cipher/extension lists so it survives the
 * randomised ordering modern browsers use; JA3 is kept for compatibility.
 */
export interface ClientHello {
  tlsVersion: number; // negotiated-intent version (from supported_versions, else legacy)
  legacyVersion: number;
  ciphers: number[];
  extensions: number[];
  curves: number[];
  pointFormats: number[];
  sigAlgs: number[];
  alpn: string[];
  sni: string | null;
}

export interface TlsFingerprint {
  ja3: string;
  ja3Hash: string;
  ja4: string;
  hello: ClientHello;
}

const isGrease = (v: number): boolean => (v >> 8) === (v & 0xff) && (v & 0x0f) === 0x0a;

export function parseClientHello(buf: Buffer): ClientHello {
  // TLS record: type(1)=0x16, version(2), length(2)
  if (buf.length < 5 || buf[0] !== 0x16) throw new Error('not a TLS handshake record');
  let p = 5;
  // Handshake: type(1)=0x01 client_hello, length(3)
  if (buf[p] !== 0x01) throw new Error('not a ClientHello');
  p += 4;
  const legacyVersion = buf.readUInt16BE(p);
  p += 2;
  p += 32; // random
  const sidLen = buf[p]!;
  p += 1 + sidLen;

  const cipherLen = buf.readUInt16BE(p);
  p += 2;
  const ciphers: number[] = [];
  for (let i = 0; i < cipherLen; i += 2) ciphers.push(buf.readUInt16BE(p + i));
  p += cipherLen;

  const compLen = buf[p]!;
  p += 1 + compLen;

  const extensions: number[] = [];
  const curves: number[] = [];
  const pointFormats: number[] = [];
  const sigAlgs: number[] = [];
  const alpn: string[] = [];
  let sni: string | null = null;

  if (p + 2 <= buf.length) {
    const extTotal = buf.readUInt16BE(p);
    p += 2;
    const end = Math.min(p + extTotal, buf.length);
    while (p + 4 <= end) {
      const type = buf.readUInt16BE(p);
      const len = buf.readUInt16BE(p + 2);
      const dataStart = p + 4;
      const data = buf.subarray(dataStart, Math.min(dataStart + len, buf.length));
      extensions.push(type);

      switch (type) {
        case 0x0000: // server_name
          sni = parseSni(data);
          break;
        case 0x000a: // supported_groups
          for (let i = 2; i + 2 <= data.length; i += 2) curves.push(data.readUInt16BE(i));
          break;
        case 0x000b: // ec_point_formats
          for (let i = 1; i < data.length; i++) pointFormats.push(data[i]!);
          break;
        case 0x000d: // signature_algorithms
          for (let i = 2; i + 2 <= data.length; i += 2) sigAlgs.push(data.readUInt16BE(i));
          break;
        case 0x0010: // ALPN
          parseAlpn(data, alpn);
          break;
      }
      p = dataStart + len;
    }
  }

  const tlsVersion = highestSupportedVersion(buf, extensions, legacyVersion);
  return { tlsVersion, legacyVersion, ciphers, extensions, curves, pointFormats, sigAlgs, alpn, sni };
}

function parseSni(data: Buffer): string | null {
  try {
    // list(2) + type(1) + nameLen(2) + name
    if (data.length < 5) return null;
    const nameLen = data.readUInt16BE(3);
    return data.subarray(5, 5 + nameLen).toString('utf8') || null;
  } catch {
    return null;
  }
}

function parseAlpn(data: Buffer, out: string[]): void {
  try {
    let i = 2; // skip list length
    while (i < data.length) {
      const l = data[i]!;
      out.push(data.subarray(i + 1, i + 1 + l).toString('ascii'));
      i += 1 + l;
    }
  } catch {
    /* ignore */
  }
}

function highestSupportedVersion(buf: Buffer, extTypes: number[], legacy: number): number {
  // Re-scan for supported_versions (0x2b) to get the true intended version.
  if (!extTypes.includes(0x002b)) return legacy;
  // Find it by walking extensions again from the record.
  let p = 5 + 4 + 2 + 32;
  p += 1 + buf[p]!; // session id
  p += 2 + buf.readUInt16BE(p); // ciphers
  p += 1 + buf[p]!; // compression
  const extTotal = buf.readUInt16BE(p);
  p += 2;
  const end = Math.min(p + extTotal, buf.length);
  while (p + 4 <= end) {
    const type = buf.readUInt16BE(p);
    const len = buf.readUInt16BE(p + 2);
    const data = buf.subarray(p + 4, p + 4 + len);
    if (type === 0x002b) {
      let best = legacy;
      for (let i = 1; i + 2 <= data.length; i += 2) {
        const v = data.readUInt16BE(i);
        if (!isGrease(v) && v > best) best = v;
      }
      return best;
    }
    p += 4 + len;
  }
  return legacy;
}

export function fingerprint(buf: Buffer): TlsFingerprint {
  const hello = parseClientHello(buf);
  const ja3 = buildJa3(hello);
  const ja4 = buildJa4(hello);
  return { ja3, ja3Hash: md5(ja3), ja4, hello };
}

function buildJa3(h: ClientHello): string {
  const ciphers = h.ciphers.filter((c) => !isGrease(c));
  const exts = h.extensions.filter((e) => !isGrease(e));
  const curves = h.curves.filter((c) => !isGrease(c));
  return [h.legacyVersion, ciphers.join('-'), exts.join('-'), curves.join('-'), h.pointFormats.join('-')].join(',');
}

function buildJa4(h: ClientHello): string {
  const verMap: Record<number, string> = { 0x0304: '13', 0x0303: '12', 0x0302: '11', 0x0301: '10' };
  const ver = verMap[h.tlsVersion] ?? '00';
  const sni = h.sni ? 'd' : 'i';

  const ciphers = h.ciphers.filter((c) => !isGrease(c));
  const exts = h.extensions.filter((e) => !isGrease(e));
  const cc = pad2(ciphers.length);
  const ec = pad2(exts.length);
  const alpnVal = h.alpn[0];
  const alpn = alpnVal ? alpnVal[0]! + alpnVal[alpnVal.length - 1]! : '00';

  const ja4a = `t${ver}${sni}${cc}${ec}${alpn}`;

  const hex4 = (n: number) => n.toString(16).padStart(4, '0');
  const cipherStr = ciphers.map(hex4).sort().join(',');
  const ja4b = sha256(cipherStr).slice(0, 12);

  // JA4_c: extensions sorted, excluding SNI(0000) and ALPN(0010); then sig algs in ORDER.
  const extForHash = exts.filter((e) => e !== 0x0000 && e !== 0x0010).map(hex4).sort();
  const sig = h.sigAlgs.filter((s) => !isGrease(s)).map(hex4);
  const cInput = sig.length ? `${extForHash.join(',')}_${sig.join(',')}` : extForHash.join(',');
  const ja4c = sha256(cInput).slice(0, 12);

  return `${ja4a}_${ja4b}_${ja4c}`;
}

const pad2 = (n: number) => Math.min(n, 99).toString().padStart(2, '0');
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
