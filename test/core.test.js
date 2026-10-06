import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { crc32, Crc32, utf8Bytes } from '../src/index.js';

// Known CRC-32 vectors for the IEEE polynomial (0x04C11DB7, reflected
// 0xEDB88320). These are the same values produced by zlib's crc32(),
// PNG's IDAT checksums, and zip's stored CRC, so they make good
// cross-implementation anchors.

test('crc32 of empty buffer is 0', () => {
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('crc32 of single zero byte is 0xD202EF8D', () => {
  assert.equal(crc32(new Uint8Array([0])), 0xd202ef8d);
});

// "123456789" is the standard CRC-32 check string; the expected
// value 0xCBF43926 is documented widely and matches zlib.
test('crc32 of ASCII "123456789" is 0xCBF43926', () => {
  const bytes = utf8Bytes('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

test('crc32 of "The quick brown fox..." matches known value', () => {
  // Reference value verified against an independent implementation
  // of CRC-32 (IEEE, reflected, seeded and finalised).
  const bytes = utf8Bytes('The quick brown fox jumps over the lazy dog');
  assert.equal(crc32(bytes), 0x414fa339);
});

test('crc32 returns unsigned 32-bit values (no sign bit set)', () => {
  // Pick bytes whose checksum has the top bit set; verify the result
  // is still a positive number (>>>0 in the implementation).
  const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
  const result = crc32(bytes);
  assert.equal(result, (crc32(bytes)) >>> 0);
  assert.ok(result >= 0, 'result must be non-negative');
  assert.ok(result <= 0xffffffff, 'result must fit in 32 bits');
});

test('crc32 of different inputs differs (basic distinctness)', () => {
  const a = crc32(utf8Bytes('hello'));
  const b = crc32(utf8Bytes('world'));
  assert.notEqual(a, b);
});

test('crc32 is deterministic — same input yields same output', () => {
  const input = utf8Bytes('deterministic input');
  assert.equal(crc32(input), crc32(input.slice()));
});

test('Crc32 incremental matches crc32 one-shot', () => {
  const data = utf8Bytes('incremental checksum test data');
  const acc = new Crc32();
  acc.update(data.subarray(0, 5));
  acc.update(data.subarray(5, 10));
  acc.update(data.subarray(10));
  assert.equal(acc.value(), crc32(data));
});

test('Crc32 with empty updates equals crc32 of concatenated data', () => {
  const data = utf8Bytes('abc');
  const acc = new Crc32();
  acc.update(new Uint8Array(0));
  acc.update(data.subarray(0, 1));
  acc.update(new Uint8Array(0));
  acc.update(data.subarray(1));
  assert.equal(acc.value(), crc32(data));
});

test('Crc32 length tracks total bytes fed in', () => {
  const acc = new Crc32();
  assert.equal(acc.length, 0);
  acc.update(new Uint8Array(3));
  assert.equal(acc.length, 3);
  acc.update(new Uint8Array(4));
  assert.equal(acc.length, 7);
});

test('Crc32 update returns the instance for chaining', () => {
  const acc = new Crc32();
  assert.equal(acc.update(new Uint8Array(1)), acc);
});

test('crc32 handles multi-byte UTF-8 input correctly', () => {
  // "héllo" contains a two-byte UTF-8 sequence for é.
  // The CRC is defined over bytes, so the checksum reflects the
  // specific UTF-8 encoding, not the code points.
  const bytes = utf8Bytes('héllo');
  assert.equal(bytes.length, 6); // h, é-2bytes, l, l, o
  // Verify the checksum is stable and non-zero.
  const result = crc32(bytes);
  assert.ok(result !== 0);
  assert.equal(result, crc32(bytes.slice()));
});

test('crc32 of a large-ish buffer matches incremental computation', () => {
  // Build a 4096-byte buffer with a repeatable but non-trivial pattern.
  const n = 4096;
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = (i * 31 + 7) & 0xff;
  }
  const acc = new Crc32();
  // Feed it in odd-sized chunks.
  let off = 0;
  while (off < n) {
    const step = off % 2 === 0 ? 7 : 13;
    const end = Math.min(off + step, n);
    acc.update(buf.subarray(off, end));
    off = end;
  }
  assert.equal(acc.value(), crc32(buf));
});
