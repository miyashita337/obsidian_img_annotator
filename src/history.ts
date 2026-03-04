import { Annotation } from './types';

export interface HistoryAction {
  type: 'add' | 'remove' | 'move';
  annotation: Annotation;
  previousState?: Annotation; // for move: store previous position
}

export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];

  push(action: HistoryAction): void {
    this.undoStack.push(action);
    this.redoStack = [];
  }

  undo(annotations: Annotation[]): Annotation[] | null {
    const action = this.undoStack.pop();
    if (!action) return null;

    this.redoStack.push(action);

    switch (action.type) {
      case 'add':
        return annotations.filter((a) => a.id !== action.annotation.id);
      case 'remove':
        return [...annotations, action.annotation];
      case 'move':
        if (action.previousState) {
          return annotations.map((a) =>
            a.id === action.annotation.id ? action.previousState! : a,
          );
        }
        return annotations;
    }
  }

  redo(annotations: Annotation[]): Annotation[] | null {
    const action = this.redoStack.pop();
    if (!action) return null;

    this.undoStack.push(action);

    switch (action.type) {
      case 'add':
        return [...annotations, action.annotation];
      case 'remove':
        return annotations.filter((a) => a.id !== action.annotation.id);
      case 'move':
        return annotations.map((a) =>
          a.id === action.annotation.id ? action.annotation : a,
        );
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
