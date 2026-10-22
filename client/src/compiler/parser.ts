import { Token, TokenType } from './token';
import {
  ProgramNode,
  SlideNode,
  ElementNode,
  RectNode,
  TextNode,
  LatexNode,
  PenNode,
  CodeNode,
  PointNode,
  CompilerError,
} from './ast';

export class Parser {
  private pos = 0;
  errors: CompilerError[] = [];

  constructor(private tokens: Token[]) {}

  parse(): ProgramNode {
    const slides: SlideNode[] = [];
    while (this.peek().type !== TokenType.EOF) {
      slides.push(this.parseSlide());
    }
    return slides;
  }

  // ─── Slide ───

  private parseSlide(): SlideNode {
    const start = this.peek();
    this.expect(TokenType.KEYWORD_SLIDE);
    const nameToken = this.expect(TokenType.STRING_LITERAL);
    const name = nameToken.lexeme.slice(1, -1);
    this.expect(TokenType.L_BRACE);

    let background = '#ffffff';
    const elements: ElementNode[] = [];

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) {
        this.error('Unclosed slide block', this.peek());
        break;
      }
      if (this.peek().type === TokenType.KEYWORD_BACKGROUND) {
        this.advance();
        this.expect(TokenType.COLON);
        const bgToken = this.expect(TokenType.STRING_LITERAL);
        background = bgToken.lexeme.slice(1, -1);
        this.expect(TokenType.SEMICOLON);
      } else {
        const el = this.tryParseElement();
        if (el) elements.push(el);
      }
    }

    this.expect(TokenType.R_BRACE);
    return {
      type: 'slide',
      name,
      background,
      elements,
      position: { line: start.line, column: start.column },
    };
  }

  // ─── Element ───

  private parseElement(keywordToken: Token): ElementNode {
    switch (keywordToken.type) {
      case TokenType.KEYWORD_RECT:
        return this.parseRect();
      case TokenType.KEYWORD_TEXT:
        return this.parseText();
      case TokenType.KEYWORD_LATEX:
        return this.parseLatex();
      case TokenType.KEYWORD_PEN:
        return this.parsePen();
      case TokenType.KEYWORD_CODE:
        return this.parseCode();
      default:
        throw new Error('unreachable');
    }
  }

  private tryParseElement(): ElementNode | null {
    const token = this.peek();
    if (
      token.type === TokenType.KEYWORD_RECT ||
      token.type === TokenType.KEYWORD_TEXT ||
      token.type === TokenType.KEYWORD_LATEX ||
      token.type === TokenType.KEYWORD_PEN ||
      token.type === TokenType.KEYWORD_CODE
    ) {
      return this.parseElement(token);
    }
    if (token.type === TokenType.EOF) return null;
    this.error(`Unexpected token '${token.lexeme}', expected element keyword`, token);
    this.advance();
    return null;
  }

  // ─── Rect ───

  private parseRect(): RectNode {
    const start = this.peek();
    this.advance();
    this.expect(TokenType.L_BRACE);

    const props: Record<string, string | number | boolean> = {};

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) {
        this.error('Unclosed rect block', this.peek());
        break;
      }
      const key = this.expect(TokenType.IDENTIFIER).lexeme;
      this.expect(TokenType.COLON);
      const val = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      props[key] = val;
    }

    this.expect(TokenType.R_BRACE);

    return {
      type: 'rect',
      x: numProp(props, 'x', 0),
      y: numProp(props, 'y', 0),
      width: numProp(props, 'width', 100),
      height: numProp(props, 'height', 100),
      fill: strProp(props, 'fill', '#000000'),
      stroke: strProp(props, 'stroke'),
      strokeWidth: numProp(props, 'strokeWidth'),
      rx: numProp(props, 'rx'),
      selected: boolProp(props, 'selected'),
      position: { line: start.line, column: start.column },
    };
  }

  // ─── Text ───

  private parseText(): TextNode {
    const start = this.peek();
    this.advance();
    this.expect(TokenType.L_BRACE);

    const props: Record<string, string | number | boolean> = {};

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) {
        this.error('Unclosed text block', this.peek());
        break;
      }
      const key = this.expect(TokenType.IDENTIFIER).lexeme;
      this.expect(TokenType.COLON);
      const val = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      props[key] = val;
    }

    this.expect(TokenType.R_BRACE);

    return {
      type: 'text',
      x: numProp(props, 'x', 0),
      y: numProp(props, 'y', 0),
      content: strProp(props, 'content', ''),
      fontSize: numProp(props, 'fontSize'),
      fontFamily: strProp(props, 'fontFamily'),
      color: strProp(props, 'color'),
      bold: boolProp(props, 'bold'),
      italic: boolProp(props, 'italic'),
      selected: boolProp(props, 'selected'),
      position: { line: start.line, column: start.column },
    };
  }

  // ─── Latex ───

  private parseLatex(): LatexNode {
    const start = this.peek();
    this.advance();
    this.expect(TokenType.L_BRACE);

    const props: Record<string, string | number | boolean> = {};

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) {
        this.error('Unclosed latex block', this.peek());
        break;
      }
      const key = this.expect(TokenType.IDENTIFIER).lexeme;
      this.expect(TokenType.COLON);
      const val = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      props[key] = val;
    }

    this.expect(TokenType.R_BRACE);

    return {
      type: 'latex',
      x: numProp(props, 'x', 0),
      y: numProp(props, 'y', 0),
      content: strProp(props, 'content', ''),
      selected: boolProp(props, 'selected'),
      position: { line: start.line, column: start.column },
    };
  }

  // ─── Pen ───

  private parsePen(): PenNode {
    const start = this.peek();
    this.advance();
    this.expect(TokenType.L_BRACE);

    let color = '#000000';
    let width = 3;
    let smoothing = false;
    let points: PointNode[] = [];
    let selected: boolean | undefined;

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) {
        this.error('Unclosed pen block', this.peek());
        break;
      }
      const key = this.expect(TokenType.IDENTIFIER).lexeme;
      this.expect(TokenType.COLON);
      switch (key) {
        case 'color':
          color = strPropFromToken(this.expect(TokenType.STRING_LITERAL));
          break;
        case 'width':
          width = Number(this.expect(TokenType.NUMBER_LITERAL).lexeme);
          break;
        case 'smoothing':
          smoothing = this.peek().lexeme === 'true';
          this.advance();
          break;
        case 'points':
          points = this.parsePoints();
          break;
        case 'selected':
          selected = this.peek().lexeme === 'true';
          this.advance();
          break;
        default:
          this.error(`Unknown pen property '${key}'`, this.peek());
          this.advance();
      }
      this.expect(TokenType.SEMICOLON);
    }

    this.expect(TokenType.R_BRACE);

    return {
      type: 'pen',
      color,
      width,
      smoothing,
      selected,
      points,
      position: { line: start.line, column: start.column },
    };
  }

  private parseCode(): CodeNode {
    const start = this.peek();
    this.advance();
    this.expect(TokenType.L_BRACE);

    const props: Record<string, string | number | boolean> = {};

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) {
        this.error('Unclosed code block', this.peek());
        break;
      }
      const key = this.expect(TokenType.IDENTIFIER).lexeme;
      this.expect(TokenType.COLON);
      const val = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      props[key] = val;
    }

    this.expect(TokenType.R_BRACE);

    return {
      type: 'code',
      x: numProp(props, 'x', 0),
      y: numProp(props, 'y', 0),
      content: strProp(props, 'content', ''),
      language: strProp(props, 'language'),
      fontSize: numProp(props, 'fontSize'),
      color: strProp(props, 'color'),
      background: strProp(props, 'background'),
      selected: boolProp(props, 'selected'),
      position: { line: start.line, column: start.column },
    };
  }

  private parsePoints(): PointNode[] {
    const points: PointNode[] = [];

    if (this.peek().type === TokenType.STRING_LITERAL) {
      return points;
    }

    this.expect(TokenType.L_BRACKET);

    while (this.peek().type !== TokenType.R_BRACKET) {
      if (this.peek().type === TokenType.EOF) break;
      const pt = this.parsePoint();
      points.push(pt);
      if (this.peek().type === TokenType.COMMA) this.advance();
    }

    this.expect(TokenType.R_BRACKET);
    return points;
  }

  private parsePoint(): PointNode {
    this.expect(TokenType.L_BRACE);

    const props: Record<string, number> = {};

    while (this.peek().type !== TokenType.R_BRACE) {
      if (this.peek().type === TokenType.EOF) break;
      const key = this.expect(TokenType.IDENTIFIER).lexeme;
      this.expect(TokenType.COLON);
      const val = Number(this.expect(TokenType.NUMBER_LITERAL).lexeme);
      this.expect(TokenType.SEMICOLON);
      props[key] = val;
    }

    this.expect(TokenType.R_BRACE);

    return {
      x: props['x'] ?? 0,
      y: props['y'] ?? 0,
      pressure: props['pressure'],
      tiltX: props['tiltX'],
      tiltY: props['tiltY'],
    };
  }

  // ─── Helpers ───

  private parseValue(): string | number | boolean {
    const t = this.peek();
    if (t.type === TokenType.STRING_LITERAL) {
      this.advance();
      return t.lexeme.slice(1, -1);
    }
    if (t.type === TokenType.NUMBER_LITERAL) {
      this.advance();
      return Number(t.lexeme);
    }
    if (t.type === TokenType.BOOLEAN_LITERAL) {
      this.advance();
      return t.lexeme === 'true';
    }
    this.error(`Expected value, got '${t.lexeme}'`, t);
    this.advance();
    return '';
  }

  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      this.error(
        `Expected ${type} but got '${t.lexeme}' (${t.type})`,
        t,
      );
    }
    return this.advance();
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t) this.pos++;
    return t ?? this.makeEOFToken();
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? this.makeEOFToken();
  }

  private makeEOFToken(): Token {
    const last = this.tokens[this.tokens.length - 1];
    return { type: TokenType.EOF, lexeme: '', line: last?.line ?? 1, column: (last?.column ?? 0) + 1 };
  }

  private error(message: string, token: Token): void {
    this.errors.push({
      line: token.line,
      column: token.column,
      message,
      severity: 'error',
      phase: 'parse',
    });
  }
}

// ─── Helper functions ───

function numProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback: number,
): number;
function numProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback?: number,
): number | undefined;
function numProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback?: number,
): number | undefined {
  const v = props[key];
  if (v === undefined) return fallback;
  return Number(v);
}

function strProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback: string,
): string;
function strProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback?: string,
): string | undefined;
function strProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback?: string,
): string | undefined {
  const v = props[key];
  if (v === undefined) return fallback;
  return String(v);
}

function boolProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback: boolean,
): boolean;
function boolProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback?: boolean,
): boolean | undefined;
function boolProp(
  props: Record<string, string | number | boolean>,
  key: string,
  fallback?: boolean,
): boolean | undefined {
  const v = props[key];
  if (v === undefined) return fallback;
  return Boolean(v);
}

function strPropFromToken(t: Token): string {
  return t.lexeme.slice(1, -1);
}
