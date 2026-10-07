# crc32

Compute CRC-32 (IEEE 802.3, reflected polynomial `0xEDB88320`) checksums over `Uint8Array` byte buffers. ESM-only, zero dependencies.

```js
import { crc32, Crc32, utf8Bytes } from './src/index.js';

const bytes = utf8Bytes('123456789');
console.log(crc32(bytes).toString(16)); // 'cbf43926'

// Incremental, for streamed data:
const acc = new Crc32();
acc.update(bytes.subarray(0, 4));
acc.update(bytes.subarray(4));
console.log(acc.value().toString(16)); // 'cbf43926'
```

## Why

The need was a small, dependency-free CRC-32 for data-integrity checks in an environment with no network access and no package installation. The trade-off: we implement only the IEEE 802.3 reflected variant (the one used by PNG, ZIP, and Ethernet) rather than a general CRC toolkit. If you need CRC-16, CRC-64, or alternate polynomials, this is not the library for them.

The 256-entry lookup table is built once on first use, so the first call pays a small one-time cost and every subsequent byte costs a single table lookup plus a shift and an XOR. We chose this over the bitwise-only form because integrity checks usually run over buffers larger than a handful of bytes.

## Edge cases worth knowing

- The CRC is defined over bytes, not characters. `utf8Bytes` exists so string inputs have a stable, canonical encoding; passing your own `Uint8Array` of differently-encoded bytes will yield a different checksum. This is correct behaviour for a byte-level CRC, but it is the spot where surprises happen.
- The checksum of an empty buffer is `0`, by design (it is the finalised form of the seed XOR). The checksum of a buffer of zero bytes of equal length is also `0` — CRC-32 is not a hash; it cannot distinguish length from content.
- Results are always unsigned 32-bit integers. Values with the top bit set are returned as positive numbers (e.g. `0xD202EF8D`, not a negative two's-complement).

## Exports

- `crc32(data: Uint8Array): number` — one-shot checksum.
- `Crc32` — incremental accumulator; methods `update(data: Uint8Array): this`, `value(): number`, and read-only property `length: number`.
- `utf8Bytes(str: string): Uint8Array` — helper that encodes a string as UTF-8 bytes.
