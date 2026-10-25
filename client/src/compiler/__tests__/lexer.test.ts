import { describe, expect, it } from 'vitest';
import { Lexer } from '../lexer';
import { TokenType } from '../token';

describe('lexer', () => {
  it('tokenizes keywords, punctuation, and numbers', () => {
    const tokens = new Lexer('rect "e1" { x: -12.5; }').tokenize();
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.KEYWORD_RECT,
      TokenType.STRING_LITERAL,
      TokenType.L_BRACE,
      TokenType.IDENTIFIER,
      TokenType.COLON,
      TokenType.NUMBER_LITERAL,
      TokenType.SEMICOLON,
      TokenType.R_BRACE,
      TokenType.EOF,
    ]);
    expect(tokens[5].lexeme).toBe('-12.5');
  });

  it('decodes escapes inside strings', () => {
    const tokens = new Lexer('"a\\nb\\"c\\\\d"').tokenize();
    expect(tokens[0].lexeme.slice(1, -1)).toBe('a\nb"c\\d');
  });

  it('preserves real newlines inside strings', () => {
    const tokens = new Lexer('"line one\nline two"').tokenize();
    expect(tokens[0].type).toBe(TokenType.STRING_LITERAL);
    expect(tokens[0].lexeme).toContain('line one\nline two');
  });

  it('skips line and block comments', () => {
    const tokens = new Lexer('// comment\nrect /* block */ "e1" {}').tokenize();
    expect(tokens.map((token) => token.type).slice(0, 3)).toEqual([
      TokenType.KEYWORD_RECT,
      TokenType.STRING_LITERAL,
      TokenType.L_BRACE,
    ]);
  });

  it('emits UNKNOWN for unexpected characters', () => {
    const tokens = new Lexer('@').tokenize();
    expect(tokens[0].type).toBe(TokenType.UNKNOWN);
  });
});
