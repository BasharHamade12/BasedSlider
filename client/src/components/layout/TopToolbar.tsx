import { useStore } from '../../store/useStore';
import { Plus, Square, Type, Sigma, Pen, Pencil, Code } from 'lucide-react';

const elementSnippets: Record<string, string> = {
  rect: `\n    rect {\n        x: 10; y: 10;\n        width: 200; height: 100;\n        fill: "#ff0000";\n    }`,
  text: `\n    text {\n        x: 10; y: 10;\n        content: "Hello World";\n        color: "#000000";\n        fontSize: 24;\n    }`,
  latex: `\n    latex {\n        x: 50; y: 50;\n        content: "\\\\sum_{i=1}^n i = \\\\frac{n(n+1)}{2}";\n    }`,
  pen: `\n    pen {\n        color: "#000000";\n        width: 3;\n        points: [\n            {x: 10; y: 20; pressure: 0.5;}\n        ];\n    }`,
  code: `\n    code {\n        x: 50; y: 50;\n        content: "const x = 1;\\nconsole.log(x);";\n        language: "javascript";\n        fontSize: 18;\n    }`,
};

function slideSnippet(slideCount: number): string {
  return `\n\nslide "${slideCount}" {\n    background: "#ffffff";\n\n    \n}`;
}

function findSlideCloser(source: string, slideIndex: number): number {
  const re = /slide\s+"[^"]*"\s*\{/g;
  let match: RegExpExecArray | null;
  let current = 0;

  while ((match = re.exec(source)) !== null) {
    if (current === slideIndex) {
      const bracePos = source.indexOf('{', match.index);
      let depth = 1;
      let pos = bracePos + 1;
      let quote: string | null = null;
      while (depth > 0 && pos < source.length) {
        const ch = source[pos];
        if (quote) {
          if (ch === '\\') {
            pos += 2;
            continue;
          }
          if (ch === quote) quote = null;
          else if (ch === '\n' && quote !== '`') {
            // unterminated " string across lines — treat as closed to stay in sync
            // (lexer supports multiline, but be conservative here)
          }
          pos++;
          continue;
        }
        if (ch === '"' || ch === '`' || (ch === '/' && (source[pos + 1] === '/' || source[pos + 1] === '*'))) {
          if (ch === '/' && source[pos + 1] === '/') {
            while (pos < source.length && source[pos] !== '\n') pos++;
            continue;
          }
          if (ch === '/' && source[pos + 1] === '*') {
            pos += 2;
            while (pos < source.length && !(source[pos] === '*' && source[pos + 1] === '/')) pos++;
            pos += 2;
            continue;
          }
          quote = ch;
          pos++;
          continue;
        }
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        pos++;
      }
      return pos - 1;
    }
    current++;
  }
  return -1;
}

const iconMap: Record<string, React.ReactNode> = {
  slide: <Plus size={16} />,
  rect: <Square size={16} />,
  text: <Type size={16} />,
  latex: <Sigma size={16} />,
  pen: <Pen size={16} />,
  code: <Code size={16} />,
};

const tooltipMap: Record<string, string> = {
  slide: 'New Slide',
  rect: 'Rectangle',
  text: 'Text',
  latex: 'LaTeX',
  pen: 'Pen',
  code: 'Code block',
};

interface ToolbarButtonProps {
  snippetKey: string;
}

function ToolbarButton({ snippetKey }: ToolbarButtonProps) {
  const sourceCode = useStore(s => s.sourceCode);
  const setSourceCode = useStore(s => s.setSourceCode);
  const activeSlideIndex = useStore(s => s.activeSlideIndex);
  const setActiveSlide = useStore(s => s.setActiveSlide);

  const handleClick = () => {
    if (snippetKey === 'slide') {
      const slideCount = (sourceCode.match(/slide\s+"/g) || []).length;
      setSourceCode(sourceCode + slideSnippet(slideCount));
      setActiveSlide(slideCount);
      return;
    }

    const snippet = elementSnippets[snippetKey];
    if (!snippet) return;

    const closer = findSlideCloser(sourceCode, activeSlideIndex);
    if (closer === -1) {
      setSourceCode(sourceCode + snippet);
      return;
    }

    setSourceCode(
      sourceCode.slice(0, closer) + snippet + sourceCode.slice(closer),
    );
  };

  return (
    <button
      onClick={handleClick}
      className="toolbar-icon-btn"
      title={tooltipMap[snippetKey]}
    >
      {iconMap[snippetKey]}
    </button>
  );
}

export function TopToolbar() {
  const isDrawMode = useStore(s => s.isDrawMode);
  const toggleDrawMode = useStore(s => s.toggleDrawMode);

  return (
    <header className="top-toolbar">
      <ToolbarButton snippetKey="slide" />
      <span className="toolbar-separator" />
      <ToolbarButton snippetKey="rect" />
      <ToolbarButton snippetKey="text" />
      <ToolbarButton snippetKey="latex" />
      <ToolbarButton snippetKey="pen" />
      <ToolbarButton snippetKey="code" />
      <div className="toolbar-spacer" />
      <button
        onClick={toggleDrawMode}
        className={`toolbar-icon-btn ${isDrawMode ? 'active' : ''}`}
        title={isDrawMode ? 'Exit Draw Mode' : 'Draw Mode'}
      >
        <Pencil size={16} />
      </button>
    </header>
  );
}
