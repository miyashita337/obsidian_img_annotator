import { describe, it, expect } from 'vitest';
import { createInitialState, generateId, PRESET_COLORS } from '../types';

describe('types', () => {
  describe('PRESET_COLORS', () => {
    it('has 6 colors', () => {
      expect(PRESET_COLORS).toHaveLength(6);
    });

    it('includes red, blue, green, yellow, white, black', () => {
      expect(PRESET_COLORS).toContain('#FF0000');
      expect(PRESET_COLORS).toContain('#0066FF');
      expect(PRESET_COLORS).toContain('#00CC00');
      expect(PRESET_COLORS).toContain('#FFCC00');
      expect(PRESET_COLORS).toContain('#FFFFFF');
      expect(PRESET_COLORS).toContain('#000000');
    });
  });

  describe('createInitialState', () => {
    it('returns default state', () => {
      const state = createInitialState();
      expect(state.activeTool).toBe('rect');
      expect(state.activeColor).toBe('#FF0000');
      expect(state.annotations).toEqual([]);
      expect(state.selectedId).toBeNull();
      expect(state.isDragging).toBe(false);
    });
  });

  describe('generateId', () => {
    it('returns unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('starts with ann_ prefix', () => {
      expect(generateId()).toMatch(/^ann_/);
    });
  });
});
