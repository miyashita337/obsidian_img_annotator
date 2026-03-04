export interface Point {
  x: number;
  y: number;
}

export type ToolType = 'rect' | 'arrow' | 'text' | 'mosaic' | 'select';

export const PRESET_COLORS = [
  '#FF0000', // Red
  '#0066FF', // Blue
  '#00CC00', // Green
  '#FFCC00', // Yellow
  '#FFFFFF', // White
  '#000000', // Black
] as const;

export type PresetColor = (typeof PRESET_COLORS)[number];

export interface BaseAnnotation {
  id: string;
  type: ToolType;
  color: string;
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  content: string;
  fontSize: number;
}

export interface MosaicAnnotation extends BaseAnnotation {
  type: 'mosaic';
  x: number;
  y: number;
  width: number;
  height: number;
  blockSize: number;
}

export type Annotation = RectAnnotation | ArrowAnnotation | TextAnnotation | MosaicAnnotation;

export interface EditorState {
  activeTool: ToolType;
  activeColor: string;
  annotations: Annotation[];
  selectedId: string | null;
  isDragging: boolean;
  dragStart: Point | null;
  dragCurrent: Point | null;
  isMoving: boolean;
  moveOffset: Point | null;
}

export function createInitialState(): EditorState {
  return {
    activeTool: 'rect',
    activeColor: PRESET_COLORS[0],
    annotations: [],
    selectedId: null,
    isDragging: false,
    dragStart: null,
    dragCurrent: null,
    isMoving: false,
    moveOffset: null,
  };
}

let _idCounter = 0;
export function generateId(): string {
  return `ann_${Date.now()}_${_idCounter++}`;
}
