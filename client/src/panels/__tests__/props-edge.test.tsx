import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import {
  NumberField,
  ColorField,
  TextField,
  Segmented,
  SmallButton,
} from '../../panels/controls';

afterEach(cleanup);

describe('property panel controls', () => {
  it('clamps a number field to its bounds on commit', () => {
    let value = 0;
    render(<NumberField label="N" value={value} onChange={(v) => (value = v)} min={0} max={10} />);
    const input = screen.getByLabelText('N');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);
    expect(value).toBe(10);
  });

  it('restores the control value when typed input is not finite', () => {
    let value = 4;
    render(<NumberField label="N" value={value} onChange={(v) => (value = v)} />);
    const input = screen.getByLabelText('N');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(value).toBe(4);
  });

  it('accepts a linear-gradient value in a color field', () => {
    let value = '#ffffff';
    render(<ColorField label="C" value={value} onChange={(v) => (value = v)} />);
    const textInput = screen.getByRole('textbox');
    fireEvent.change(textInput, { target: { value: 'linear-gradient(90deg, red, blue)' } });
    fireEvent.blur(textInput);
    expect(value).toBe('linear-gradient(90deg, red, blue)');
  });

  it('commits a text field on blur', () => {
    let value = 'old';
    render(<TextField label="T" value={value} onChange={(v) => (value = v)} />);
    const input = screen.getByRole('textbox', { name: 'T' });
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.blur(input);
    expect(value).toBe('new');
  });

  it('Escape restores the text field value without committing the edit', () => {
    let value = 'old';
    render(<TextField label="T" value={value} onChange={(v) => (value = v)} />);
    const input = screen.getByRole('textbox', { name: 'T' });
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(value).toBe('old');
    fireEvent.blur(input);
    expect(value).toBe('old');
  });

  it('Escape cancels an uncommitted color edit', () => {
    let value = '#ffffff';
    render(<ColorField label="C" value={value} onChange={(v) => (value = v)} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not a color' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(value).toBe('#ffffff');
  });

  it('highlights the active segmented option', () => {
    let value: 'a' | 'b' = 'b';
    render(
      <Segmented
        label="Mode"
        value={value}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={(v) => (value = v)}
      />,
    );
    const b = screen.getByRole('button', { name: 'B' });
    expect(b.classList.contains('active')).toBe(true);
  });

  it('calls the small button handler on click', () => {
    const handler = vi.fn();
    render(<SmallButton onClick={handler} title="go">Go</SmallButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
