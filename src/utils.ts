export function computeAvgTempFromPowers(powers: number[]): number {
  if (!powers || powers.length === 0) return 0;
  const sum = powers.reduce((s, v) => s + v, 0);
  return sum * 5;
}

export function sampleMagneticField(coreRadius: number, heatingPositions: Array<[number, number, number]>, heatingPowers: number[], samples = 60) {
  const data: number[] = [];
  for (let i = 0; i < samples; i++) {
    const ang = (i / samples) * Math.PI * 2;
    const x = coreRadius * Math.cos(ang);
    const y = coreRadius * Math.sin(ang);
    let B = 0.01;
    for (let h = 0; h < heatingPositions.length; h++) {
      const hp = heatingPositions[h];
      const dx = x - hp[0];
      const dy = 0 - hp[1];
      const dz = y - hp[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      B += (heatingPowers[h] || 0) / (1 + d2);
    }
    data.push(B * 10);
  }
  return data;
}
