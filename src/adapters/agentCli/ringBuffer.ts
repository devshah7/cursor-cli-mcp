/**
 * Fixed-size byte ring buffer. UTF-8 safe toString per ARCHITECTURE § 4.7.
 */
export class RingBuffer {
  private readonly capacity: number;
  private readonly buf: Buffer;
  private start = 0;
  private length = 0;
  truncated = false;

  constructor(maxBytes: number) {
    this.capacity = maxBytes;
    this.buf = Buffer.alloc(maxBytes);
  }

  append(chunk: Buffer): void {
    if (this.capacity === 0) {
      if (chunk.length > 0) {
        this.truncated = true;
      }
      return;
    }

    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i]!;
      if (this.length < this.capacity) {
        this.buf[(this.start + this.length) % this.capacity] = b;
        this.length++;
      } else {
        this.buf[this.start] = b;
        this.start = (this.start + 1) % this.capacity;
        this.truncated = true;
      }
    }
  }

  toString(): string {
    const raw = this.rawBytes();
    const safe = stripIncompleteTrailingUtf8(raw);
    return safe.toString('utf8');
  }

  /** Exposed for tests — ordered bytes without UTF-8 trimming. */
  rawBytes(): Buffer {
    if (this.length === 0 || this.capacity === 0) {
      return Buffer.alloc(0);
    }
    const out = Buffer.alloc(this.length);
    if (this.start + this.length <= this.capacity) {
      this.buf.copy(out, 0, this.start, this.start + this.length);
    } else {
      const first = this.capacity - this.start;
      this.buf.copy(out, 0, this.start, this.capacity);
      this.buf.copy(out, first, 0, this.length - first);
    }
    return out;
  }
}

/** Drop incomplete trailing UTF-8 sequence (no U+FFFD; never throw). */
export function stripIncompleteTrailingUtf8(buf: Buffer): Buffer {
  if (buf.length === 0) {
    return buf;
  }
  let end = buf.length;
  const dec = new TextDecoder('utf-8', { fatal: true });
  while (end > 0) {
    try {
      dec.decode(buf.subarray(0, end));
      return buf.subarray(0, end);
    } catch {
      end--;
    }
  }
  return Buffer.alloc(0);
}
