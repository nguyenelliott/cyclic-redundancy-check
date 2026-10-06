/**
 * CRC-32 core implementation.
 *
 * Polynomial: 0xEDB88320 (reflected form of the IEEE 802.3 polynomial
 * 0x04C11DB7). The reflected form is used so that we process bytes
 * least-significant-bit-first, which matches how most network and file
 * formats (ZIP, PNG, Ethernet) define CRC-32. We pre-compute a
 * 256-entry table at module load so the per-byte cost is a single
 * lookup and a couple of bitwise operations.
 */

/**
 * Pre-computed CRC-32 lookup table (reflected IEEE polynomial).
 * Lazily built on first use to keep module evaluation cheap.
 * @type {number[]|null}
 */
let table = null;

function buildTable() {
  const t = new Array(256);
  for (let i = 0; i < 256; i++) {
    // Start with the byte value in the low bits.
    let c = i;
    for (let j = 0; j < 8; j++) {
      // Reflect: if LSB is set, shift right and XOR in the polynomial.
      if (c & 1) {
        c = (c >>> 1) ^ 0xedb88320;
      } else {
        c = c >>> 1;
      }
    }
    t[i] = c >>> 0;
  }
  return t;
}

function getTable() {
  if (table === null) {
    table = buildTable();
  }
  return table;
}

/**
 * Convert a string to UTF-8 bytes.
 *
 * TextEncoder is the standard-library way to do this and handles
 * multi-byte sequences correctly. We expose this as a small helper
 * rather than a public API surface so callers stay focused on buffers.
 */
function utf8Bytes(str) {
  return new TextEncoder().encode(str);
}

/**
 * Compute a CRC-32 checksum over the given data.
 *
 * The seed XOR with 0xFFFFFFFF up front and the final XOR back are
 * both part of the canonical CRC-32 framing used by PNG, ZIP, and
 * Ethernet — without them the checksum of an empty buffer would be
 * zero, which collides with a buffer of zero bytes of equal length.
 *
 * @param {Uint8Array} data - The bytes to checksum.
 * @returns {number} The CRC-32 checksum as an unsigned 32-bit integer.
 */
export function crc32(data) {
  const t = getTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    // XOR the incoming byte into the low 8 bits, then table-lookup.
    // The table was built reflected, so this advances the CRC one byte
    // at a time with no per-byte loop over bits.
    const idx = (crc ^ data[i]) & 0xff;
    crc = (crc >>> 8) ^ t[idx];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Incremental CRC-32 accumulator.
 *
 * Useful when data arrives in chunks (e.g. streamed reads) and you
 * want the checksum at the end without buffering everything. The
 * internal state is the working CRC including the initial seed XOR;
 * `value()` applies the final XOR and returns the unsigned result.
 */
export class Crc32 {
  /**
   * @param {number} [seed] - Optional seed; defaults to the same
   *   0xFFFFFFFF initial value used by crc32.
   */
  constructor(seed = 0xffffffff) {
    /** @type {number} */
    this._crc = seed >>> 0;
    /** @type {number} */
    this._length = 0;
  }

  /**
   * Append bytes to the running checksum.
   * @param {Uint8Array} data
   * @returns {this} for chaining.
   */
  update(data) {
    const t = getTable();
    for (let i = 0; i < data.length; i++) {
      const idx = (this._crc ^ data[i]) & 0xff;
      this._crc = (this._crc >>> 8) ^ t[idx];
    }
    this._length += data.length;
    return this;
  }

  /**
   * @returns {number} The unsigned CRC-32 of all data passed to update().
   */
  value() {
    return (this._crc ^ 0xffffffff) >>> 0;
  }

  /**
   * @returns {number} Total bytes processed so far.
   */
  get length() {
    return this._length;
  }
}

// Export the utf8 helper too — tests and callers will need a consistent
// way to turn strings into bytes that matches what the checksum expects.
export { utf8Bytes };
