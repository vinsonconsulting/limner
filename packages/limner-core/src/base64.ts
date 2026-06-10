// Shared base64 <-> bytes codecs (review r5). Cross-runtime: btoa/atob
// are globals in Workers isolates and Node 16+; avoids Node-only
// Buffer.from(b64, 'base64').
//
// Encoding is chunked: the naive one-char-at-a-time loop (previously
// duplicated across four call sites) is quadratic-ish on string
// concatenation and slow on multi-MB images under isolate CPU limits.
// 0x8000 keeps the String.fromCharCode spread well under engine
// argument-count limits.

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
