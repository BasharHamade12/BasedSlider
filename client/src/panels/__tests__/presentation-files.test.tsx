import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TopToolbar } from '../TopToolbar';
import { createDemoDeck } from '../../samples/demoDeck';
import { serializeDoc } from '../../model/serialize';
import { useDocStore, useUiStore } from '../../model/store';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  const doc = createDemoDeck();
  useDocStore.getState().setDoc(doc, 'test reset', { history: false });
  useDocStore.setState({ doc, past: [], future: [] });
  useUiStore.setState({
    activeSlideIndex: 0,
    selectedIds: [],
    compilerErrors: [],
    presenting: false,
    presentFrom: 0,
  });
});

describe('presentation script files', () => {
  it('imports a script, replaces the deck, and starts presenting at slide one', async () => {
    const source = serializeDoc(createDemoDeck());
    const file = new File([source], 'imported.slide', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(source) });
    const { container } = render(<TopToolbar />);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".slide,.txt,text/plain"]',
    );

    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(useUiStore.getState().presenting).toBe(true);
      expect(useUiStore.getState().presentFrom).toBe(0);
      expect(useDocStore.getState().doc.slides.map((slide) => slide.name)).toEqual(
        createDemoDeck().slides.map((slide) => slide.name),
      );
    });
  });

  it('exports the serialized script from the consolidated Export menu', async () => {
    const doc = useDocStore.getState().doc;
    const expectedScript = serializeDoc(doc);
    let exportedBlob: Blob | undefined;
    const ActualURL = URL;
    class MockURL extends ActualURL {
      static createObjectURL = vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return 'blob:presentation';
      });
      static revokeObjectURL = vi.fn();
    }
    vi.stubGlobal('URL', MockURL);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<TopToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Presentation script/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PDF/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /Presentation script/ }));

    expect(exportedBlob).toBeInstanceOf(Blob);
    expect(await exportedBlob!.text()).toBe(expectedScript);
    expect(MockURL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(MockURL.revokeObjectURL).toHaveBeenCalledWith('blob:presentation');
  });

  it('starts the PDF export flow from the Export menu', () => {
    render(<TopToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /PDF/ }));

    expect(useUiStore.getState().pdfPrinting).toBe(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows feedback when an invalid presentation file fails to open', async () => {
    const { container } = render(<TopToolbar />);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".slide,.txt,text/plain"]',
    );
    const badFile = new File(['not a script'], 'broken.slide', { type: 'text/plain' });
    Object.defineProperty(badFile, 'text', { value: vi.fn().mockResolvedValue('not a script') });

    fireEvent.change(input!, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Couldn't open/);
    });
    expect(useUiStore.getState().presenting).toBe(false);
  });
});
