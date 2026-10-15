import { describe, expect, it } from 'vitest';
import { exampleModel, normalizeModel } from '@/lib/beam-model';

describe('beam model geometry (not a structural solver)', () => {
  it('provides bounded examples with supports and loads', () => {
    for (const name of ['simple', 'cantilever', 'uniform']) {
      const model = exampleModel(name);
      expect(model.elements.length).toBeGreaterThan(1);
      expect(normalizeModel(model)).toEqual(model);
    }
  });
  it('constrains distributed loads when beam length shrinks', () => {
    const model = normalizeModel({ ...exampleModel(), length: 0.5 });
    for (const element of model.elements) {
      expect(element.position).toBeGreaterThanOrEqual(0);
      expect(element.position).toBeLessThanOrEqual(model.length);
      if (element.kind === 'distributed') {
        expect(element.length).toBeGreaterThanOrEqual(0.1);
        expect(element.position + (element.length ?? 0)).toBeLessThanOrEqual(model.length);
      }
    }
  });
  it('allows beam lengths greater than the original 100 m UI limit', () => {
    const model = normalizeModel({ ...exampleModel(), length: 250 });
    expect(model.length).toBe(250);
    for (const element of model.elements) expect(element.position).toBeLessThanOrEqual(250);
  });
});