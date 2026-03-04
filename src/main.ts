import {
  Plugin,
  MarkdownView,
  MarkdownFileInfo,
  TFile,
  Notice,
  Editor,
  Menu,
} from 'obsidian';
import { ImageEditorModal } from './editor-modal';

export default class ImageAnnotatorPlugin extends Plugin {
  async onload(): Promise<void> {
    // Command: Open annotator with clipboard image
    this.addCommand({
      id: 'open-annotator-clipboard',
      name: 'Open Image Annotator (from clipboard)',
      callback: () => this.openFromClipboard(),
    });

    // Command: Annotate image at cursor
    this.addCommand({
      id: 'annotate-image-at-cursor',
      name: 'Annotate image at cursor',
      editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
        if (ctx instanceof MarkdownView) {
          this.openFromCursor(editor, ctx);
        }
      },
    });

    // Context menu on images in reading mode
    this.registerEvent(
      (this.app.workspace as any).on('file-menu', (menu: Menu, file: TFile) => {
        if (file && isImageFile(file)) {
          menu.addItem((item) => {
            item
              .setTitle('Annotate image')
              .setIcon('pencil')
              .onClick(() => this.openEditorForFile(file));
          });
        }
      }),
    );

    // Context menu on image elements in editing/preview mode
    this.registerDomEvent(document, 'contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'IMG' &&
        target.closest('.markdown-reading-view, .markdown-preview-view, .cm-editor')
      ) {
        const src = (target as HTMLImageElement).getAttribute('src');
        if (!src) return;

        const menu = new Menu();
        menu.addItem((item) => {
          item
            .setTitle('Annotate image')
            .setIcon('pencil')
            .onClick(() => this.openFromImgElement(target as HTMLImageElement));
        });
        menu.showAtMouseEvent(e);
      }
    });
  }

  onunload(): void {
    // Plugin base class automatically cleans up registerEvent/registerDomEvent
  }

  // --- Open from clipboard ---

  private async openFromClipboard(): Promise<void> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const img = await this.loadImageFromBlob(blob);
          this.openEditor(img, null, 'new');
          return;
        }
      }
      new Notice('No image found in clipboard');
    } catch (err) {
      new Notice('Failed to read clipboard. Try copying an image first.');
      console.error('Clipboard read error:', err);
    }
  }

  // --- Open from cursor position ---

  private openFromCursor(editor: Editor, view: MarkdownView): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Match ![[filename.png]] or ![alt](filename.png)
    const wikiMatch = line.match(/!\[\[([^\]]+\.(png|jpg|jpeg|gif|bmp|webp))\]\]/i);
    const mdMatch = line.match(/!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|bmp|webp))\)/i);

    const imagePath = wikiMatch?.[1] ?? mdMatch?.[2];

    if (!imagePath) {
      new Notice('No image link found at cursor position');
      return;
    }

    const file = this.app.metadataCache.getFirstLinkpathDest(
      imagePath,
      view.file?.path ?? '',
    );

    if (!file || !(file instanceof TFile)) {
      new Notice(`Image file not found: ${imagePath}`);
      return;
    }

    this.openEditorForFile(file);
  }

  // --- Open from img element (context menu) ---

  private async openFromImgElement(imgEl: HTMLImageElement): Promise<void> {
    // Try to resolve the vault file from the img src
    const src = imgEl.getAttribute('src') ?? '';

    // Obsidian uses app:// protocol for vault files
    if (src.startsWith('app://')) {
      const url = new URL(src);
      const pathParts = url.pathname.split('/');
      const fileName = decodeURIComponent(pathParts[pathParts.length - 1]);

      // Try exact vault path first
      const directFile = this.app.vault.getAbstractFileByPath(fileName);
      if (directFile instanceof TFile) {
        this.openEditorForFile(directFile);
        return;
      }

      // Fallback: search by filename across vault
      const allFiles = this.app.vault.getFiles();
      const match = allFiles.find((f) => f.name === fileName);
      if (match) {
        this.openEditorForFile(match);
        return;
      }
    }

    // Fallback: load from the img element directly
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imgEl.src;
    });
    this.openEditor(img, null, 'new');
  }

  // --- Open editor for a vault file ---

  private async openEditorForFile(file: TFile): Promise<void> {
    try {
      const data = await this.app.vault.readBinary(file);
      const blob = new Blob([data], { type: `image/${file.extension}` });
      const img = await this.loadImageFromBlob(blob);

      this.openEditor(img, file, 'replace', (savedFile) => {
        // Trigger a refresh of the active view to show updated image
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          // Force refresh by toggling the view mode briefly
          // This ensures Obsidian reloads the image
          view.previewMode?.rerender(true);
        }
      });
    } catch (err) {
      new Notice(`Failed to load image: ${err}`);
      console.error('Image load error:', err);
    }
  }

  private openEditor(
    img: HTMLImageElement,
    file: TFile | null,
    mode: 'replace' | 'new',
    onSave?: (file: TFile) => void,
  ): void {
    new ImageEditorModal(this.app, img, file, mode, onSave).open();
  }

  private loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }
}

function isImageFile(file: TFile): boolean {
  const ext = file.extension.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext);
}
