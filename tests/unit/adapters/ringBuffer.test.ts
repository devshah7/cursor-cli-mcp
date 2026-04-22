import { describe, expect, it } from 'vitest';
import {
  RingBuffer,
  stripIncompleteTrailingUtf8,
} from '../../../src/adapters/agentCli/ringBuffer.js';

describe('RingBuffer', () => {
  it('append within capacity → full content string', () => {
    const r = new RingBuffer(64);
    const buf = Buffer.from('hello');
    r.append(buf);
    expect(r.toString()).toBe('hello');
    expect(r.truncated).toBe(false);
  });

  it('append beyond capacity drops oldest bytes and sets truncated', () => {
    const r = new RingBuffer(5);
    r.append(Buffer.from('aaaaa'));
    r.append(Buffer.from('bb'));
    expect(r.truncated).toBe(true);
    expect(r.rawBytes().equals(Buffer.from('aaabb'))).toBe(true);
  });

  it('multiple appends within capacity concatenate', () => {
    const r = new RingBuffer(100);
    r.append(Buffer.from('a'));
    r.append(Buffer.from('b'));
    expect(r.toString()).toBe('ab');
  });

  it('empty buffer → empty string', () => {
    const r = new RingBuffer(10);
    expect(r.toString()).toBe('');
  });

  it('capacity 0 truncates immediately on any append', () => {
    const r = new RingBuffer(0);
    r.append(Buffer.from('x'));
    expect(r.truncated).toBe(true);
    expect(r.toString()).toBe('');
  });

  it('large single chunk retains tail up to capacity', () => {
    const r = new RingBuffer(4);
    r.append(Buffer.from('abcdef'));
    expect(r.truncated).toBe(true);
    expect(r.rawBytes().equals(Buffer.from('cdef'))).toBe(true);
  });

  it('UTF-8 boundary via stripIncompleteTrailingUtf8 helper', () => {
    expect(stripIncompleteTrailingUtf8(Buffer.from([0xe2, 0x82])).length).toBe(0);
    expect(stripIncompleteTrailingUtf8(Buffer.from([0xe2, 0x82, 0xac])).toString('utf8')).toBe('€');
  });

  it('two independent buffers do not share state', () => {
    const a = new RingBuffer(10);
    const b = new RingBuffer(10);
    a.append(Buffer.from('x'));
    b.append(Buffer.from('y'));
    expect(a.toString()).toBe('x');
    expect(b.toString()).toBe('y');
  });
});

describe('stripIncompleteTrailingUtf8', () => {
  it('trims invalid tail using fatal decoder loop', () => {
    const bad = Buffer.from([0xff, 0xff]);
    expect(stripIncompleteTrailingUtf8(bad).length).toBe(0);
  });
});
