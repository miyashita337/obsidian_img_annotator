import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../renderer';
import {
  Annotation,
  ArrowAnnotation,
  MosaicAnnotation,
  RectAnnotation,
  TextAnnotation,
} from '../types';

// --- Canvas mock ---

function createMockContext(): CanvasRenderingContext2D {
  const ctx: any = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(400 * 4), // 20x20 pixels
      width: 20,
      height: 20,
    })),
    putImageData: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 12, // approximate
    })),
    // Properties
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    globalAlpha: 1,
    font: '',
    textBaseline: '',
  };
  return ctx as CanvasRenderingContext2D;
}

function createMockCanvas(
  width = 800,
  height = 600,
): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

// --- Test data ---

function makeRect(
  id = 'r1',
  x = 10,
  y = 20,
  w = 100,
  h = 50,
): RectAnnotation {
  return { id, type: 'rect', color: '#FF0000', x, y, width: w, height: h };
}

function makeArrow(
  id = 'a1',
  sx = 10,
  sy = 20,
  ex = 110,
  ey = 70,
): ArrowAnnotation {
  return {
    id,
    type: 'arrow',
    color: '#0066FF',
    startX: sx,
    startY: sy,
    endX: ex,
    endY: ey,
  };
}

function makeText(id = 't1', x = 50, y = 50, content = 'Hello'): TextAnnotation {
  return { id, type: 'text', color: '#00CC00', x, y, content, fontSize: 24 };
}

function makeMosaic(
  id = 'm1',
  x = 10,
  y = 10,
  w = 20,
  h = 20,
): MosaicAnnotation {
  return {
    id,
    type: 'mosaic',
    color: '',
    x,
    y,
    width: w,
    height: h,
    blockSize: 12,
  };
}

describe('Renderer', () => {
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;
  let renderer: Renderer;

  beforeEach(() => {
    ctx = createMockContext();
    canvas = createMockCanvas();
    renderer = new Renderer(ctx, canvas);
  });

  describe('clear', () => {
    it('clears the entire canvas', () => {
      renderer.clear();
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });
  });

  describe('drawImage', () => {
    it('draws image at full canvas size', () => {
      const img = {} as HTMLImageElement;
      renderer.drawImage(img);
      expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 800, 600);
    });
  });

  describe('drawAnnotations', () => {
    it('draws rect annotations', () => {
      const rect = makeRect();
      renderer.drawAnnotations([rect], null);
      expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 100, 50);
    });

    it('draws arrow annotations', () => {
      const arrow = makeArrow();
      renderer.drawAnnotations([arrow], null);
      // Arrow draws a line + arrowhead
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('draws text annotations', () => {
      const text = makeText();
      renderer.drawAnnotations([text], null);
      expect(ctx.fillText).toHaveBeenCalledWith('Hello', 50, 50);
    });

    it('draws selection highlight when selected', () => {
      const rect = makeRect();
      renderer.drawAnnotations([rect], 'r1');
      // Selection highlight uses setLineDash
      expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
    });

    it('does not draw selection when not selected', () => {
      const rect = makeRect();
      renderer.drawAnnotations([rect], 'other-id');
      // setLineDash only called to reset, not for selection
      expect(ctx.setLineDash).not.toHaveBeenCalledWith([6, 3]);
    });
  });

  describe('drawMosaic', () => {
    it('calls getImageData and putImageData', () => {
      const mosaic = makeMosaic();
      renderer.drawMosaic(mosaic);
      expect(ctx.getImageData).toHaveBeenCalledWith(10, 10, 20, 20);
      expect(ctx.putImageData).toHaveBeenCalled();
    });

    it('handles zero-size mosaic without error', () => {
      const mosaic = makeMosaic('m0', 10, 10, 0, 0);
      renderer.drawMosaic(mosaic);
      expect(ctx.getImageData).not.toHaveBeenCalled();
    });
  });

  describe('drawPreview', () => {
    it('draws rect preview with alpha', () => {
      renderer.drawPreview('rect', { x: 0, y: 0 }, { x: 100, y: 100 }, '#FF0000');
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
      expect(ctx.strokeRect).toHaveBeenCalled();
    });

    it('draws arrow preview', () => {
      renderer.drawPreview('arrow', { x: 0, y: 0 }, { x: 100, y: 100 }, '#0066FF');
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('draws mosaic preview as dashed rect', () => {
      renderer.drawPreview('mosaic', { x: 0, y: 0 }, { x: 50, y: 50 }, '#888');
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
    });
  });

  describe('hitTest', () => {
    it('returns null for empty annotations', () => {
      const result = renderer.hitTest([], { x: 50, y: 50 });
      expect(result).toBeNull();
    });

    it('detects hit on rect edge (left side)', () => {
      const rect = makeRect('r1', 100, 100, 200, 100);
      const result = renderer.hitTest([rect], { x: 100, y: 150 });
      expect(result).toBe(rect);
    });

    it('detects hit on rect edge (top side)', () => {
      const rect = makeRect('r1', 100, 100, 200, 100);
      const result = renderer.hitTest([rect], { x: 200, y: 100 });
      expect(result).toBe(rect);
    });

    it('does not detect hit inside rect (not on edge)', () => {
      const rect = makeRect('r1', 100, 100, 200, 100);
      const result = renderer.hitTest([rect], { x: 200, y: 150 });
      expect(result).toBeNull();
    });

    it('detects hit on arrow line', () => {
      const arrow = makeArrow('a1', 0, 0, 100, 0);
      const result = renderer.hitTest([arrow], { x: 50, y: 2 });
      expect(result).toBe(arrow);
    });

    it('does not detect hit far from arrow', () => {
      const arrow = makeArrow('a1', 0, 0, 100, 0);
      const result = renderer.hitTest([arrow], { x: 50, y: 50 });
      expect(result).toBeNull();
    });

    it('detects hit on text', () => {
      const text = makeText('t1', 50, 50, 'Hello');
      const result = renderer.hitTest([text], { x: 60, y: 60 });
      expect(result).toBe(text);
    });

    it('detects hit on mosaic area', () => {
      const mosaic = makeMosaic('m1', 100, 100, 50, 50);
      const result = renderer.hitTest([mosaic], { x: 125, y: 125 });
      expect(result).toBe(mosaic);
    });

    it('returns top-most (last) annotation on overlap', () => {
      const r1 = makeRect('r1', 100, 100, 200, 100);
      const r2 = makeRect('r2', 100, 100, 200, 100);
      // Both overlap; hitTest on left edge
      const result = renderer.hitTest([r1, r2], { x: 100, y: 150 });
      expect(result).toBe(r2);
    });

    it('handles negative-size rect (dragged backwards)', () => {
      const rect = makeRect('r1', 200, 200, -100, -50);
      // Left edge is at x=100
      const result = renderer.hitTest([rect], { x: 100, y: 175 });
      expect(result).toBe(rect);
    });
  });
});
