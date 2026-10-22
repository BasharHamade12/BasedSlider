import { Token, TokenType } from './token';

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      const ch = this.peek();

      if (ch === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
        continue;
      }

      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      if (ch === '/' && this.peekNext() === '/') {
        this.skipLineComment();
        continue;
      }

      if (ch === '/' && this.peekNext() === '*') {
        this.skipBlockComment();
        continue;
      }

      if (ch === '{') { tokens.push(this.makeToken(TokenType.L_BRACE)); this.advance(); continue; }
      if (ch === '}') { tokens.push(this.makeToken(TokenType.R_BRACE)); this.advance(); continue; }
      if (ch === '[') { tokens.push(this.makeToken(TokenType.L_BRACKET)); this.advance(); continue; }
      if (ch === ']') { tokens.push(this.makeToken(TokenType.R_BRACKET)); this.advance(); continue; }
      if (ch === ';') { tokens.push(this.makeToken(TokenType.SEMICOLON)); this.advance(); continue; }
      if (ch === ':') { tokens.push(this.makeToken(TokenType.COLON)); this.advance(); continue; }
      if (ch === ',') { tokens.push(this.makeToken(TokenType.COMMA)); this.advance(); continue; }

      if (ch === '"' || ch === '`') {
        tokens.push(this.readString());
        continue;
      }

      if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peekNext()))) {
        tokens.push(this.readNumber());
        continue;
      }

      if (this.isAlpha(ch) || ch === '_') {
        tokens.push(this.readIdentifierOrKeyword());
        continue;
      }

      tokens.push(this.makeToken(TokenType.UNKNOWN));
      this.advance();
    }

    tokens.push(this.makeToken(TokenType.EOF));
    return tokens;
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private peek(): string {
    return this.source[this.pos] ?? '\0';
  }

  private peekNext(): string {
    return this.source[this.pos + 1] ?? '\0';
  }

  private makeToken(type: TokenType, lexeme?: string, column?: number): Token {
    return {
      type,
      lexeme: lexeme ?? type,
      line: this.line,
      column: column ?? this.column,
    };
  }

  private readString(): Token {
    const startCol = this.column;
    const startLine = this.line;
    const quote = this.peek();
    this.advance(); // consume opening quote
    let content = '';
    while (this.pos < this.source.length && this.peek() !== quote) {
      const ch = this.peek();
      if (ch === '\0') break;
      if (ch === '\\') {
        this.advance(); // consume backslash
        const esc = this.peek();
        if (esc === '\0') break;
        switch (esc) {
          case 'n': content += '\n'; break;
          case 't': content += '\t'; break;
          case 'r': content += '\r'; break;
          case 'b': content += '\b'; break;
          case 'f': content += '\f'; break;
          case 'v': content += '\v'; break;
          case '0': content += '\0'; break;
          case '\\': content += '\\'; break;
          case '"': content += '"'; break;
          case "'": content += "'"; break;
          case '`': content += '`'; break;
          case '\n':
            // line continuation: backslash + real newline => newline
            content += '\n';
            this.line++;
            this.column = 1;
            this.advance();
            continue;
          default:
            // unknown escape: keep literal char (backwards compatible)
            content += esc;
            break;
        }
        this.advance();
        continue;
      }
      if (ch === '\n') {
        // real newline inside string => preserved as newline (multiline support)
        content += '\n';
        this.line++;
        this.column = 1;
        this.pos++;
        continue;
      }
      content += ch;
      this.advance();
    }
    // consume closing quote if present
    if (this.peek() === quote) this.advance();
    return {
      type: TokenType.STRING_LITERAL,
      lexeme: `${quote}${content}${quote}`,
      line: startLine,
      column: startCol,
    };
  }

  private readNumber(): Token {
    const startCol = this.column;
    let num = '';
    if (this.peek() === '-') {
      num += '-';
      this.advance();
    }
    while (this.isDigit(this.peek())) {
      num += this.peek();
      this.advance();
    }
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      num += '.';
      this.advance();
      while (this.isDigit(this.peek())) {
        num += this.peek();
        this.advance();
      }
    }
    return {
      type: TokenType.NUMBER_LITERAL,
      lexeme: num,
      line: this.line,
      column: startCol,
    };
  }

  private readIdentifierOrKeyword(): Token {
    const startCol = this.column;
    let word = '';
    while (this.isAlphaNum(this.peek()) || this.peek() === '_') {
      word += this.peek();
      this.advance();
    }
    const keywordMap: Record<string, TokenType> = {
      slide: TokenType.KEYWORD_SLIDE,
      background: TokenType.KEYWORD_BACKGROUND,
      rect: TokenType.KEYWORD_RECT,
      text: TokenType.KEYWORD_TEXT,
      latex: TokenType.KEYWORD_LATEX,
      pen: TokenType.KEYWORD_PEN,
      code: TokenType.KEYWORD_CODE,
      true: TokenType.BOOLEAN_LITERAL,
      false: TokenType.BOOLEAN_LITERAL,
    };
    const type = keywordMap[word] ?? TokenType.IDENTIFIER;
    return { type, lexeme: word, line: this.line, column: startCol };
  }

  private skipLineComment(): void {
    while (this.pos < this.source.length && this.peek() !== '\n') {
      this.advance();
    }
  }

  private skipBlockComment(): void {
    this.advance();
    this.advance();
    while (this.pos < this.source.length) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        return;
      }
      if (this.peek() === '\n') { this.line++; this.column = 1; }
      this.advance();
    }
  }

  private isDigit(ch: string): boolean { return ch >= '0' && ch <= '9'; }
  private isAlpha(ch: string): boolean { return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'); }
  private isAlphaNum(ch: string): boolean { return this.isDigit(ch) || this.isAlpha(ch); }
}
