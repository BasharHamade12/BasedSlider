import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LeftPanel } from '../LeftPanel';
import { createDemoDeck } from '../../samples/demoDeck';
import { useDocStore, useUiStore } from '../../model/store';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <pre data-testid="code-editor">{value}</pre>,
}));

beforeEach(() => {
  const doc = createDemoDeck();
  useDocStore.getState().setDoc(doc, 'test reset', { history: false });
  useDocStore.setState({ doc, past: [], future: [] });
  useUiStore.setState({
    leftTab: 'code',
    leftCollapsed: false,
    sourceOrigin: 'gui',
    sourceCode: 'slide "One" {}',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

function openHelp() {
  render(<LeftPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Open script reference' }));
  return screen.getByRole('dialog');
}

function entryFor(dialog: HTMLElement, title: string): HTMLElement {
  const entry = within(dialog).getByRole('heading', { name: title, level: 4 }).closest('article');
  expect(entry).not.toBeNull();
  return entry as HTMLElement;
}

describe('script reference', () => {
  it('opens from the code panel and documents every element type', () => {
    const dialog = openHelp();

    expect(within(dialog).getByRole('heading', { name: 'Script reference' })).toBeInTheDocument();
    for (const title of [
      'The slide block',
      'Slide transition',
      'Every element',
      'Shapes',
      'Text',
      'Math (LaTeX)',
      'Code block',
      'Image',
      'Chart',
      'HTML embed',
      'Ink (pen)',
      'Connector',
      'Animate an element',
      'How values are written',
    ]) {
      expect(within(dialog).getByRole('heading', { name: title, level: 4 })).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/Ids connect things/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Every property ends with a semicolon/)).toBeInTheDocument();
  });

  it('lists every shape keyword the parser accepts', () => {
    const dialog = openHelp();
    const shapes = entryFor(dialog, 'Shapes');

    for (const keyword of [
      'rect',
      'ellipse',
      'triangle',
      'line',
      'polygon',
      'star',
      'arrow',
      'chevron',
      'parallelogram',
      'trapezoid',
      'speech',
    ]) {
      expect(within(shapes).getByText(keyword)).toBeInTheDocument();
    }
  });

  it('lists the full property set for each element', () => {
    const dialog = openHelp();

    const cases: Array<[string, string[]]> = [
      ['Shapes', ['fill', 'stroke', 'strokeWidth', 'dash', 'radius', 'shadow { }', 'text { }']],
      ['Text', ['content', 'fontFamily', 'fontSize', 'fontWeight', 'italic', 'underline', 'align', 'lineHeight', 'letterSpacing', 'color', 'autofit', 'math']],
      ['Math (LaTeX)', ['content', 'displayMode', 'fontSize', 'color']],
      ['Code block', ['content', 'language', 'theme', 'fontSize', 'lineNumbers', 'color', 'background']],
      ['Image', ['src', 'fit', 'radius']],
      ['Chart', ['kind', 'title', 'fn', 'a', 'b', 'c', 'domain', 'values', 'axisColor', 'gridColor', 'accentColor', 'titleColor']],
      ['HTML embed', ['src', 'content', 'radius']],
      ['Ink (pen)', ['color', 'width', 'smoothing', 'mode', 'points']],
      ['Connector', ['from', 'to', 'routing', 'startArrow', 'endArrow', 'arrowSize', 'width', 'dash', 'color', 'label']],
      ['Animate an element', ['effect', 'trigger', 'duration', 'delay', 'easing', 'direction', 'repeat', 'id']],
      ['The slide block', ['id', 'background', 'backgroundImage', 'width', 'height', 'notes', 'transition { }']],
    ];

    for (const [title, properties] of cases) {
      const entry = entryFor(dialog, title);
      for (const property of properties) {
        expect(
          within(entry).getByRole('rowheader', { name: property }),
        ).toBeInTheDocument();
      }
    }
  });

  it('names the shared keys each element also accepts', () => {
    const dialog = openHelp();

    const text = entryFor(dialog, 'Text');
    expect(within(text).getByText(/Also accepts/)).toBeInTheDocument();
    expect(within(text).getByText('rotation')).toBeInTheDocument();
    expect(within(text).getByText('animate { }')).toBeInTheDocument();

    // A connector has no box of its own, so it must not claim geometry.
    const connector = entryFor(dialog, 'Connector');
    expect(within(connector).queryByText('x')).not.toBeInTheDocument();
    expect(within(connector).getByText('name')).toBeInTheDocument();
  });

  it('finds an entry by property name and highlights the matching rows', () => {
    const dialog = openHelp();
    const search = within(dialog).getByRole('searchbox', { name: 'Search script commands' });

    fireEvent.change(search, { target: { value: 'arrowSize' } });

    expect(within(dialog).getByRole('heading', { name: 'Connector', level: 4 })).toBeInTheDocument();
    expect(within(dialog).queryByRole('heading', { name: 'Text', level: 4 })).not.toBeInTheDocument();
    const row = within(dialog).getByRole('rowheader', { name: 'arrowSize' }).closest('tr');
    expect(row).toHaveClass('is-match');
  });

  it('filters commands as the user searches', () => {
    const dialog = openHelp();
    const search = within(dialog).getByRole('searchbox', { name: 'Search script commands' });

    fireEvent.change(search, { target: { value: 'arrow' } });

    expect(within(dialog).getByRole('heading', { name: 'Connector', level: 4 })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('heading', { name: 'Math (LaTeX)', level: 4 }),
    ).not.toBeInTheDocument();
  });

  it('explains an empty search instead of showing a blank panel', () => {
    const dialog = openHelp();
    const search = within(dialog).getByRole('searchbox', { name: 'Search script commands' });

    fireEvent.change(search, { target: { value: 'zzzz' } });

    expect(within(dialog).getByText(/No commands match/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Try a broader word/)).toBeInTheDocument();
  });

  it('closes with Escape and returns focus to the help button', () => {
    render(<LeftPanel />);
    const trigger = screen.getByRole('button', { name: 'Open script reference' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps Tab focus inside the reference', () => {
    const dialog = openHelp();
    const buttons = within(dialog).getAllByRole('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    expect(last).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(within(dialog).getByRole('button', { name: 'Close help' })).toHaveFocus();
  });

  it('copies a snippet so it can be pasted into the script', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const dialog = openHelp();
    const entry = entryFor(dialog, 'Text');

    fireEvent.click(within(entry).getByRole('button', { name: /Copy/ }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('content: "First line'));
    });
    await waitFor(() => {
      expect(within(entry).getByRole('button', { name: /Copied/ })).toBeInTheDocument();
    });
  });
});
