import { App, Modal, TFile, Notice } from 'obsidian';
import {
  Annotation,
  ArrowAnnotation,
  EditorState,
  MosaicAnnotation,
  Point,
  PRESET_COLORS,
  RectAnnotation,
  TextAnnotation,
  ToolType,
  createInitialState,
  generateId,
} from './types';
import { HistoryManager } from './history';
import { Renderer } from './renderer';

const DEFAULT_FONT_SIZE = 24;
const MOSAIC_BLOCK_SIZE = 12;

export class ImageEditorModal extends Modal {
  private state: EditorState;
  private history: HistoryManager;
  private renderer!: Renderer;
  private canvas!: HTMLCanvasElement;
  private image: HTMLImageElement;
  private sourceFile: TFile | null;
  private insertMode: 'replace' | 'new';
  private onSaveCallback: ((file: TFile) => void) | null;

  private toolbarEl!: HTMLElement;
  private textInputEl: HTMLInputElement | null = null;
  private isCommittingText = false;
  private toolButtons: Map<string, HTMLElement> = new Map();
  private colorButtons: Map<string, HTMLElement> = new Map();
  private undoBtn!: HTMLElement;
  private redoBtn!: HTMLElement;

  // Drag state for modal movement
  private modalDragOffset: Point | null = null;
  // Store annotation state at drag start for move history
  private moveStartState: Annotation | null = null;

  constructor(
    app: App,
    image: HTMLImageElement,
    sourceFile: TFile | null,
    insertMode: 'replace' | 'new' = 'replace',
    onSave?: (file: TFile) => void,
  ) {
    super(app);
    this.image = image;
    this.sourceFile = sourceFile;
    this.insertMode = insertMode;
    this.onSaveCallback = onSave ?? null;
    this.state = createInitialState();
    this.history = new HistoryManager();
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass('image-annotator-modal');
    contentEl.empty();

    // Make modal larger
    modalEl.style.width = '90vw';
    modalEl.style.maxWidth = '1400px';
    modalEl.style.height = '85vh';
    modalEl.style.maxHeight = '900px';

    this.buildToolbar(contentEl);
    this.buildCanvas(contentEl);
    this.setupKeyboardShortcuts();

    // Initial render
    requestAnimationFrame(() => this.render());
  }

  onClose(): void {
    this.removeTextInput();
  }

  // --- UI Building ---

  private buildToolbar(container: HTMLElement): void {
    this.toolbarEl = container.createDiv({ cls: 'ia-toolbar' });

    // Tool buttons
    const toolGroup = this.toolbarEl.createDiv({ cls: 'ia-tool-group' });
    this.addToolButton(toolGroup, 'rect', 'Rectangle', '▭');
    this.addToolButton(toolGroup, 'arrow', 'Arrow', '→');
    this.addToolButton(toolGroup, 'text', 'Text', 'T');
    this.addToolButton(toolGroup, 'mosaic', 'Mosaic', '▦');

    // Separator
    this.toolbarEl.createDiv({ cls: 'ia-separator' });

    // Color buttons
    const colorGroup = this.toolbarEl.createDiv({ cls: 'ia-color-group' });
    for (const color of PRESET_COLORS) {
      this.addColorButton(colorGroup, color);
    }

    // Separator
    this.toolbarEl.createDiv({ cls: 'ia-separator' });

    // Action buttons
    const actionGroup = this.toolbarEl.createDiv({ cls: 'ia-action-group' });
    this.undoBtn = this.addActionButton(actionGroup, 'Undo', '↩', () =>
      this.handleUndo(),
    );
    this.redoBtn = this.addActionButton(actionGroup, 'Redo', '↪', () =>
      this.handleRedo(),
    );

    this.toolbarEl.createDiv({ cls: 'ia-separator' });

    const saveGroup = this.toolbarEl.createDiv({ cls: 'ia-action-group' });
    this.addActionButton(saveGroup, 'Save', '💾', () => this.handleSave());

    this.updateToolbarState();
  }

  private addToolButton(
    parent: HTMLElement,
    tool: ToolType,
    title: string,
    icon: string,
  ): void {
    const btn = parent.createEl('button', {
      cls: 'ia-btn ia-tool-btn',
      text: icon,
      attr: { title, 'aria-label': title },
    });
    btn.addEventListener('click', () => {
      this.state.activeTool = tool;
      this.state.selectedId = null;
      this.updateToolbarState();
      this.render();
    });
    this.toolButtons.set(tool, btn);
  }

  private addColorButton(parent: HTMLElement, color: string): void {
    const btn = parent.createEl('button', {
      cls: 'ia-btn ia-color-btn',
      attr: { title: color, 'aria-label': `Color ${color}` },
    });
    btn.style.backgroundColor = color;
    if (color === '#FFFFFF') {
      btn.style.border = '1px solid var(--background-modifier-border)';
    }
    btn.addEventListener('click', () => {
      this.state.activeColor = color;
      this.updateToolbarState();
    });
    this.colorButtons.set(color, btn);
  }

  private addActionButton(
    parent: HTMLElement,
    title: string,
    icon: string,
    onClick: () => void,
  ): HTMLElement {
    const btn = parent.createEl('button', {
      cls: 'ia-btn ia-action-btn',
      text: icon,
      attr: { title, 'aria-label': title },
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private updateToolbarState(): void {
    // Update tool buttons
    for (const [tool, btn] of this.toolButtons) {
      btn.toggleClass('ia-active', tool === this.state.activeTool);
    }
    // Update color buttons
    for (const [color, btn] of this.colorButtons) {
      btn.toggleClass('ia-active', color === this.state.activeColor);
    }
    // Update undo/redo
    this.undoBtn?.toggleClass('ia-disabled', !this.history.canUndo());
    this.redoBtn?.toggleClass('ia-disabled', !this.history.canRedo());
  }

  private buildCanvas(container: HTMLElement): void {
    const canvasContainer = container.createDiv({ cls: 'ia-canvas-container' });

    this.canvas = canvasContainer.createEl('canvas', { cls: 'ia-canvas' });
    this.canvas.width = this.image.naturalWidth;
    this.canvas.height = this.image.naturalHeight;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      new Notice('Failed to get canvas context');
      this.close();
      return;
    }

    this.renderer = new Renderer(ctx, this.canvas);
    this.setupCanvasEvents();
  }

  // --- Canvas Events ---

  private setupCanvasEvents(): void {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
  }

  private getCanvasPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }

  private onMouseDown(e: MouseEvent): void {
    const point = this.getCanvasPoint(e);
    this.removeTextInput();

    if (this.state.activeTool === 'text') {
      this.showTextInput(point);
      return;
    }

    // Check if clicking on existing annotation for selection/move
    if (this.state.activeTool !== 'mosaic') {
      const hit = this.renderer.hitTest(this.state.annotations, point);
      if (hit) {
        this.state.selectedId = hit.id;
        this.state.isMoving = true;
        this.state.moveOffset = {
          x: point.x - this.getAnnotationOrigin(hit).x,
          y: point.y - this.getAnnotationOrigin(hit).y,
        };
        // Save annotation state before move for undo
        this.moveStartState = { ...hit } as Annotation;
        this.updateToolbarState();
        this.render();
        return;
      }
    }

    // Deselect
    this.state.selectedId = null;

    // Start drawing
    if (
      this.state.activeTool === 'rect' ||
      this.state.activeTool === 'arrow' ||
      this.state.activeTool === 'mosaic'
    ) {
      this.state.isDragging = true;
      this.state.dragStart = point;
      this.state.dragCurrent = point;
    }

    this.render();
  }

  private onMouseMove(e: MouseEvent): void {
    const point = this.getCanvasPoint(e);

    if (this.state.isMoving && this.state.selectedId && this.state.moveOffset) {
      this.moveAnnotation(
        this.state.selectedId,
        point.x - this.state.moveOffset.x,
        point.y - this.state.moveOffset.y,
      );
      this.render();
      return;
    }

    if (this.state.isDragging && this.state.dragStart) {
      this.state.dragCurrent = point;
      this.render();
    }
  }

  private onMouseUp(_e: MouseEvent): void {
    if (
      this.state.isMoving &&
      this.state.selectedId &&
      this.state.moveOffset
    ) {
      // Record move in history (once per drag)
      const movedAnn = this.state.annotations.find(
        (a) => a.id === this.state.selectedId,
      );
      if (movedAnn && this.moveStartState) {
        this.history.push({
          type: 'move',
          annotation: { ...movedAnn } as Annotation,
          previousState: this.moveStartState,
        });
        this.updateToolbarState();
      }
      this.moveStartState = null;
      this.state.isMoving = false;
      this.state.moveOffset = null;
      return;
    }

    if (
      this.state.isDragging &&
      this.state.dragStart &&
      this.state.dragCurrent
    ) {
      const start = this.state.dragStart;
      const end = this.state.dragCurrent;

      // Minimum drag distance
      const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      if (dist > 3) {
        this.commitDrawing(start, end);
      }

      this.state.isDragging = false;
      this.state.dragStart = null;
      this.state.dragCurrent = null;
      this.render();
    }
  }

  private commitDrawing(start: Point, end: Point): void {
    let annotation: Annotation;

    switch (this.state.activeTool) {
      case 'rect':
        annotation = {
          id: generateId(),
          type: 'rect',
          color: this.state.activeColor,
          x: start.x,
          y: start.y,
          width: end.x - start.x,
          height: end.y - start.y,
        } as RectAnnotation;
        break;

      case 'arrow':
        annotation = {
          id: generateId(),
          type: 'arrow',
          color: this.state.activeColor,
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
        } as ArrowAnnotation;
        break;

      case 'mosaic':
        annotation = {
          id: generateId(),
          type: 'mosaic',
          color: '',
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
          blockSize: MOSAIC_BLOCK_SIZE,
        } as MosaicAnnotation;
        break;

      default:
        return;
    }

    this.state.annotations.push(annotation);
    this.history.push({ type: 'add', annotation });
    this.updateToolbarState();
  }

  // --- Text Input ---

  private showTextInput(point: Point): void {
    this.removeTextInput();

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;

    const container = this.canvas.parentElement;
    if (!container) return;

    this.textInputEl = document.createElement('input');
    this.textInputEl.type = 'text';
    this.textInputEl.className = 'ia-text-input';
    this.textInputEl.style.left = `${point.x * scaleX}px`;
    this.textInputEl.style.top = `${point.y * scaleY}px`;
    this.textInputEl.style.color = this.state.activeColor;
    this.textInputEl.style.fontSize = `${DEFAULT_FONT_SIZE * scaleY}px`;
    this.textInputEl.placeholder = 'Type text...';

    const commitText = () => {
      if (this.isCommittingText) return;
      this.isCommittingText = true;
      const text = this.textInputEl?.value.trim();
      if (text) {
        const annotation: TextAnnotation = {
          id: generateId(),
          type: 'text',
          color: this.state.activeColor,
          x: point.x,
          y: point.y,
          content: text,
          fontSize: DEFAULT_FONT_SIZE,
        };
        this.state.annotations.push(annotation);
        this.history.push({ type: 'add', annotation });
        this.updateToolbarState();
        this.render();
      }
      this.removeTextInput();
      this.isCommittingText = false;
    };

    this.textInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitText();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        this.removeTextInput();
      }
    });

    this.textInputEl.addEventListener('blur', commitText);
    container.appendChild(this.textInputEl);

    requestAnimationFrame(() => this.textInputEl?.focus());
  }

  private removeTextInput(): void {
    if (this.textInputEl) {
      this.textInputEl.remove();
      this.textInputEl = null;
    }
  }

  // --- Object operations ---

  private getAnnotationOrigin(ann: Annotation): Point {
    switch (ann.type) {
      case 'rect':
      case 'mosaic':
        return { x: (ann as RectAnnotation).x, y: (ann as RectAnnotation).y };
      case 'arrow':
        return {
          x: (ann as ArrowAnnotation).startX,
          y: (ann as ArrowAnnotation).startY,
        };
      case 'text':
        return { x: (ann as TextAnnotation).x, y: (ann as TextAnnotation).y };
    }
  }

  private moveAnnotation(id: string, newX: number, newY: number): void {
    const idx = this.state.annotations.findIndex((a) => a.id === id);
    if (idx === -1) return;

    const ann = this.state.annotations[idx];
    const prev = { ...ann } as Annotation;

    switch (ann.type) {
      case 'rect':
      case 'mosaic': {
        const a = ann as RectAnnotation | MosaicAnnotation;
        (this.state.annotations[idx] as RectAnnotation | MosaicAnnotation) = {
          ...a,
          x: newX,
          y: newY,
        };
        break;
      }
      case 'arrow': {
        const a = ann as ArrowAnnotation;
        const dx = newX - a.startX;
        const dy = newY - a.startY;
        (this.state.annotations[idx] as ArrowAnnotation) = {
          ...a,
          startX: a.startX + dx,
          startY: a.startY + dy,
          endX: a.endX + dx,
          endY: a.endY + dy,
        };
        break;
      }
      case 'text': {
        (this.state.annotations[idx] as TextAnnotation) = {
          ...(ann as TextAnnotation),
          x: newX,
          y: newY,
        };
        break;
      }
    }

    // Move history is recorded in onMouseUp when drag completes
  }

  private deleteSelected(): void {
    if (!this.state.selectedId) return;

    const ann = this.state.annotations.find(
      (a) => a.id === this.state.selectedId,
    );
    if (!ann) return;

    this.state.annotations = this.state.annotations.filter(
      (a) => a.id !== this.state.selectedId,
    );
    this.history.push({ type: 'remove', annotation: ann });
    this.state.selectedId = null;
    this.updateToolbarState();
    this.render();
  }

  // --- Undo/Redo ---

  private handleUndo(): void {
    const result = this.history.undo(this.state.annotations);
    if (result) {
      this.state.annotations = result;
      this.state.selectedId = null;
      this.updateToolbarState();
      this.render();
    }
  }

  private handleRedo(): void {
    const result = this.history.redo(this.state.annotations);
    if (result) {
      this.state.annotations = result;
      this.state.selectedId = null;
      this.updateToolbarState();
      this.render();
    }
  }

  // --- Keyboard Shortcuts ---

  private setupKeyboardShortcuts(): void {
    this.scope.register([], 'r', () => {
      this.state.activeTool = 'rect';
      this.updateToolbarState();
      return false;
    });
    this.scope.register([], 'a', () => {
      this.state.activeTool = 'arrow';
      this.updateToolbarState();
      return false;
    });
    this.scope.register([], 't', () => {
      if (!this.textInputEl) {
        this.state.activeTool = 'text';
        this.updateToolbarState();
      }
      return false;
    });
    this.scope.register([], 'm', () => {
      this.state.activeTool = 'mosaic';
      this.updateToolbarState();
      return false;
    });
    this.scope.register(['Mod'], 'z', () => {
      this.handleUndo();
      return false;
    });
    this.scope.register(['Mod', 'Shift'], 'z', () => {
      this.handleRedo();
      return false;
    });
    this.scope.register(['Mod'], 's', () => {
      this.handleSave();
      return false;
    });
    this.scope.register([], 'Delete', () => {
      this.deleteSelected();
      return false;
    });
    this.scope.register([], 'Backspace', () => {
      this.deleteSelected();
      return false;
    });
    this.scope.register([], 'Escape', () => {
      if (this.state.selectedId) {
        this.state.selectedId = null;
        this.render();
      } else {
        this.close();
      }
      return false;
    });
  }

  // --- Rendering ---

  private render(): void {
    this.renderer.clear();
    this.renderer.drawImage(this.image);

    // Draw mosaic annotations first (they modify pixels directly)
    const mosaics = this.state.annotations.filter(
      (a) => a.type === 'mosaic',
    ) as MosaicAnnotation[];
    for (const m of mosaics) {
      this.renderer.drawMosaic(m);
    }

    // Draw other annotations
    this.renderer.drawAnnotations(
      this.state.annotations.filter((a) => a.type !== 'mosaic'),
      this.state.selectedId,
    );

    // Draw preview if dragging
    if (
      this.state.isDragging &&
      this.state.dragStart &&
      this.state.dragCurrent
    ) {
      const tool = this.state.activeTool;
      if (tool === 'rect' || tool === 'arrow' || tool === 'mosaic') {
        this.renderer.drawPreview(
          tool,
          this.state.dragStart,
          this.state.dragCurrent,
          this.state.activeColor,
        );
      }
    }
  }

  // --- Save ---

  private async handleSave(): Promise<void> {
    // Render final composite
    this.state.selectedId = null;
    this.render();

    try {
      const blob = await this.canvasToBlob();
      if (!blob) {
        new Notice('Failed to export image');
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();

      if (this.sourceFile && this.insertMode === 'replace') {
        // Overwrite existing file
        await this.app.vault.modifyBinary(
          this.sourceFile,
          arrayBuffer,
        );
        new Notice(`Saved: ${this.sourceFile.name}`);
        if (this.onSaveCallback) this.onSaveCallback(this.sourceFile);
      } else {
        // Create new file
        const fileName = `annotated-${Date.now()}.png`;
        const folder =
          this.app.fileManager.getNewFileParent('')?.path ?? '';
        const filePath = folder ? `${folder}/${fileName}` : fileName;
        const newFile = await this.app.vault.createBinary(
          filePath,
          arrayBuffer,
        );
        new Notice(`Created: ${newFile.name}`);
        if (this.onSaveCallback) this.onSaveCallback(newFile);
      }

      // Clear state and close
      this.history.clear();
      this.close();
    } catch (err) {
      new Notice(`Save failed: ${err}`);
      console.error('Image Annotator save error:', err);
    }
  }

  private canvasToBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob(
        (blob) => resolve(blob),
        'image/png',
      );
    });
  }
}
