import {
  Annotation,
  ArrowAnnotation,
  MosaicAnnotation,
  Point,
  RectAnnotation,
  TextAnnotation,
} from './types';

const LINE_WIDTH = 3;
const ARROW_HEAD_LENGTH = 16;
const ARROW_HEAD_ANGLE = Math.PI / 6;
const SELECTION_PADDING = 4;
const HIT_TOLERANCE = 8;
const DEFAULT_FONT_SIZE = 24;
const MOSAIC_BLOCK_SIZE = 12;

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private canvas: HTMLCanvasElement,
  ) {}

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawImage(img: HTMLImageElement): void {
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
  }

  drawAnnotations(annotations: Annotation[], selectedId: string | null): void {
    for (const ann of annotations) {
      switch (ann.type) {
        case 'rect':
          this.drawRect(ann);
          break;
        case 'arrow':
          this.drawArrow(ann);
          break;
        case 'text':
          this.drawText(ann);
          break;
        case 'mosaic':
          this.drawMosaic(ann);
          break;
      }
      if (ann.id === selectedId) {
        this.drawSelectionHighlight(ann);
      }
    }
  }

  drawPreview(
    type: 'rect' | 'arrow' | 'mosaic',
    start: Point,
    current: Point,
    color: string,
  ): void {
    this.ctx.save();
    this.ctx.globalAlpha = 0.6;
    switch (type) {
      case 'rect':
        this.drawRectShape(
          start.x,
          start.y,
          current.x - start.x,
          current.y - start.y,
          color,
        );
        break;
      case 'arrow':
        this.drawArrowShape(start.x, start.y, current.x, current.y, color);
        break;
      case 'mosaic':
        this.drawMosaicPreviewRect(start, current);
        break;
    }
    this.ctx.restore();
  }

  // --- Shape drawing ---

  private drawRect(ann: RectAnnotation): void {
    this.drawRectShape(ann.x, ann.y, ann.width, ann.height, ann.color);
  }

  private drawRectShape(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = LINE_WIDTH;
    this.ctx.lineJoin = 'miter';
    this.ctx.strokeRect(x, y, w, h);
  }

  private drawArrow(ann: ArrowAnnotation): void {
    this.drawArrowShape(ann.startX, ann.startY, ann.endX, ann.endY, ann.color);
  }

  private drawArrowShape(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    color: string,
  ): void {
    const angle = Math.atan2(ey - sy, ex - sx);

    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = LINE_WIDTH;
    this.ctx.lineCap = 'round';

    // Line
    this.ctx.beginPath();
    this.ctx.moveTo(sx, sy);
    this.ctx.lineTo(ex, ey);
    this.ctx.stroke();

    // Arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(ex, ey);
    this.ctx.lineTo(
      ex - ARROW_HEAD_LENGTH * Math.cos(angle - ARROW_HEAD_ANGLE),
      ey - ARROW_HEAD_LENGTH * Math.sin(angle - ARROW_HEAD_ANGLE),
    );
    this.ctx.lineTo(
      ex - ARROW_HEAD_LENGTH * Math.cos(angle + ARROW_HEAD_ANGLE),
      ey - ARROW_HEAD_LENGTH * Math.sin(angle + ARROW_HEAD_ANGLE),
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawText(ann: TextAnnotation): void {
    const fontSize = ann.fontSize || DEFAULT_FONT_SIZE;
    this.ctx.font = `bold ${fontSize}px sans-serif`;
    this.ctx.fillStyle = ann.color;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(ann.content, ann.x, ann.y);
  }

  drawMosaic(ann: MosaicAnnotation): void {
    const blockSize = ann.blockSize || MOSAIC_BLOCK_SIZE;
    const x = Math.min(ann.x, ann.x + ann.width);
    const y = Math.min(ann.y, ann.y + ann.height);
    const w = Math.abs(ann.width);
    const h = Math.abs(ann.height);

    if (w === 0 || h === 0) return;

    const imageData = this.ctx.getImageData(x, y, w, h);
    const data = imageData.data;

    for (let by = 0; by < h; by += blockSize) {
      for (let bx = 0; bx < w; bx += blockSize) {
        const bw = Math.min(blockSize, w - bx);
        const bh = Math.min(blockSize, h - by);
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let py = by; py < by + bh; py++) {
          for (let px = bx; px < bx + bw; px++) {
            const i = (py * w + px) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        for (let py = by; py < by + bh; py++) {
          for (let px = bx; px < bx + bw; px++) {
            const i = (py * w + px) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
          }
        }
      }
    }

    this.ctx.putImageData(imageData, x, y);
  }

  private drawMosaicPreviewRect(start: Point, current: Point): void {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);

    this.ctx.strokeStyle = '#888888';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.setLineDash([]);
  }

  private drawSelectionHighlight(ann: Annotation): void {
    const bounds = this.getBounds(ann);
    if (!bounds) return;

    this.ctx.strokeStyle = '#00AAFF';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([6, 3]);
    this.ctx.strokeRect(
      bounds.x - SELECTION_PADDING,
      bounds.y - SELECTION_PADDING,
      bounds.w + SELECTION_PADDING * 2,
      bounds.h + SELECTION_PADDING * 2,
    );
    this.ctx.setLineDash([]);
  }

  // --- Hit testing ---

  hitTest(annotations: Annotation[], point: Point): Annotation | null {
    // Reverse order: top-most first
    for (let i = annotations.length - 1; i >= 0; i--) {
      if (this.isPointInAnnotation(annotations[i], point)) {
        return annotations[i];
      }
    }
    return null;
  }

  private isPointInAnnotation(ann: Annotation, p: Point): boolean {
    switch (ann.type) {
      case 'rect':
        return this.isPointNearRect(ann, p);
      case 'arrow':
        return this.isPointNearLine(ann, p);
      case 'text':
        return this.isPointInTextBounds(ann, p);
      case 'mosaic':
        return this.isPointInMosaicBounds(ann, p);
    }
  }

  private isPointNearRect(ann: RectAnnotation, p: Point): boolean {
    const { x, y, width, height } = ann;
    const x2 = x + width;
    const y2 = y + height;
    const minX = Math.min(x, x2);
    const maxX = Math.max(x, x2);
    const minY = Math.min(y, y2);
    const maxY = Math.max(y, y2);

    const nearLeft =
      Math.abs(p.x - minX) < HIT_TOLERANCE &&
      p.y >= minY - HIT_TOLERANCE &&
      p.y <= maxY + HIT_TOLERANCE;
    const nearRight =
      Math.abs(p.x - maxX) < HIT_TOLERANCE &&
      p.y >= minY - HIT_TOLERANCE &&
      p.y <= maxY + HIT_TOLERANCE;
    const nearTop =
      Math.abs(p.y - minY) < HIT_TOLERANCE &&
      p.x >= minX - HIT_TOLERANCE &&
      p.x <= maxX + HIT_TOLERANCE;
    const nearBottom =
      Math.abs(p.y - maxY) < HIT_TOLERANCE &&
      p.x >= minX - HIT_TOLERANCE &&
      p.x <= maxX + HIT_TOLERANCE;

    return nearLeft || nearRight || nearTop || nearBottom;
  }

  private isPointNearLine(ann: ArrowAnnotation, p: Point): boolean {
    const { startX, startY, endX, endY } = ann;
    const dx = endX - startX;
    const dy = endY - startY;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;

    let t = ((p.x - startX) * dx + (p.y - startY) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = startX + t * dx;
    const closestY = startY + t * dy;
    const dist = Math.sqrt(
      (p.x - closestX) ** 2 + (p.y - closestY) ** 2,
    );

    return dist < HIT_TOLERANCE;
  }

  private isPointInTextBounds(ann: TextAnnotation, p: Point): boolean {
    const fontSize = ann.fontSize || DEFAULT_FONT_SIZE;
    this.ctx.font = `bold ${fontSize}px sans-serif`;
    const metrics = this.ctx.measureText(ann.content);
    const w = metrics.width;
    const h = fontSize * 1.2;

    return (
      p.x >= ann.x - HIT_TOLERANCE &&
      p.x <= ann.x + w + HIT_TOLERANCE &&
      p.y >= ann.y - HIT_TOLERANCE &&
      p.y <= ann.y + h + HIT_TOLERANCE
    );
  }

  private isPointInMosaicBounds(ann: MosaicAnnotation, p: Point): boolean {
    const minX = Math.min(ann.x, ann.x + ann.width);
    const maxX = Math.max(ann.x, ann.x + ann.width);
    const minY = Math.min(ann.y, ann.y + ann.height);
    const maxY = Math.max(ann.y, ann.y + ann.height);

    return (
      p.x >= minX - HIT_TOLERANCE &&
      p.x <= maxX + HIT_TOLERANCE &&
      p.y >= minY - HIT_TOLERANCE &&
      p.y <= maxY + HIT_TOLERANCE
    );
  }

  private getBounds(
    ann: Annotation,
  ): { x: number; y: number; w: number; h: number } | null {
    switch (ann.type) {
      case 'rect':
      case 'mosaic': {
        const a = ann as RectAnnotation | MosaicAnnotation;
        const x = Math.min(a.x, a.x + a.width);
        const y = Math.min(a.y, a.y + a.height);
        return { x, y, w: Math.abs(a.width), h: Math.abs(a.height) };
      }
      case 'arrow': {
        const a = ann as ArrowAnnotation;
        const x = Math.min(a.startX, a.endX);
        const y = Math.min(a.startY, a.endY);
        return {
          x,
          y,
          w: Math.abs(a.endX - a.startX),
          h: Math.abs(a.endY - a.startY),
        };
      }
      case 'text': {
        const a = ann as TextAnnotation;
        const fontSize = a.fontSize || DEFAULT_FONT_SIZE;
        this.ctx.font = `bold ${fontSize}px sans-serif`;
        const metrics = this.ctx.measureText(a.content);
        return { x: a.x, y: a.y, w: metrics.width, h: fontSize * 1.2 };
      }
    }
  }
}
