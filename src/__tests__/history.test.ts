import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../history';
import { Annotation, RectAnnotation } from '../types';

function makeRect(id: string, x = 0, y = 0): RectAnnotation {
  return { id, type: 'rect', color: '#FF0000', x, y, width: 100, height: 50 };
}

describe('HistoryManager', () => {
  let history: HistoryManager;

  beforeEach(() => {
    history = new HistoryManager();
  });

  it('starts with empty stacks', () => {
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('can undo an add action', () => {
    const rect = makeRect('r1');
    history.push({ type: 'add', annotation: rect });

    expect(history.canUndo()).toBe(true);
    const result = history.undo([rect]);
    expect(result).toEqual([]);
  });

  it('can redo after undo', () => {
    const rect = makeRect('r1');
    history.push({ type: 'add', annotation: rect });

    history.undo([rect]);
    expect(history.canRedo()).toBe(true);

    const result = history.redo([]);
    expect(result).toEqual([rect]);
  });

  it('clears redo stack on new push', () => {
    const r1 = makeRect('r1');
    const r2 = makeRect('r2');
    history.push({ type: 'add', annotation: r1 });
    history.undo([r1]);

    expect(history.canRedo()).toBe(true);
    history.push({ type: 'add', annotation: r2 });
    expect(history.canRedo()).toBe(false);
  });

  it('can undo a remove action (restores annotation)', () => {
    const rect = makeRect('r1');
    history.push({ type: 'remove', annotation: rect });

    const result = history.undo([]);
    expect(result).toEqual([rect]);
  });

  it('can undo a move action', () => {
    const original = makeRect('r1', 0, 0);
    const moved = makeRect('r1', 50, 50);
    history.push({ type: 'move', annotation: moved, previousState: original });

    const result = history.undo([moved]);
    expect(result).toEqual([original]);
  });

  it('handles multiple undo/redo', () => {
    const r1 = makeRect('r1');
    const r2 = makeRect('r2');

    history.push({ type: 'add', annotation: r1 });
    history.push({ type: 'add', annotation: r2 });

    // Undo r2
    let anns: Annotation[] = [r1, r2];
    const after1 = history.undo(anns);
    expect(after1).toEqual([r1]);

    // Undo r1
    const after2 = history.undo(after1!);
    expect(after2).toEqual([]);

    // Redo r1
    const after3 = history.redo(after2!);
    expect(after3).toEqual([r1]);
  });

  it('returns null when nothing to undo/redo', () => {
    expect(history.undo([])).toBeNull();
    expect(history.redo([])).toBeNull();
  });

  it('clear resets all stacks', () => {
    history.push({ type: 'add', annotation: makeRect('r1') });
    history.clear();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
