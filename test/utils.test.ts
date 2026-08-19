import { describe, it, expect } from 'vitest';
import { computeAvgTempFromPowers, sampleMagneticField } from '../src/utils';

describe('utils', () => {
  it('computeAvgTempFromPowers returns zero for empty', () => {
    expect(computeAvgTempFromPowers([])).toBe(0);
  });

  it('computeAvgTempFromPowers sums correctly', () => {
    expect(computeAvgTempFromPowers([1, 2, 3])).toBe(30);
  });

  it('sampleMagneticField returns samples length', () => {
    const data = sampleMagneticField(10, [[0,0,0]], [1], 12);
    expect(data.length).toBe(12);
    // values should be finite numbers
    expect(data.every((v) => Number.isFinite(v))).toBe(true);
  });
});
