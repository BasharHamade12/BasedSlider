export enum TokenType {
  KEYWORD_SLIDE = 'SLIDE',
  KEYWORD_BACKGROUND = 'BACKGROUND',
  KEYWORD_RECT = 'RECT',
  KEYWORD_TEXT = 'TEXT',
  KEYWORD_LATEX = 'LATEX',
  KEYWORD_PEN = 'PEN',
  KEYWORD_CODE = 'CODE',

  L_BRACE = '{',
  R_BRACE = '}',
  L_BRACKET = '[',
  R_BRACKET = ']',
  SEMICOLON = ';',
  COLON = ':',
  COMMA = ',',

  STRING_LITERAL = 'STRING_LITERAL',
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  BOOLEAN_LITERAL = 'BOOLEAN_LITERAL',

  IDENTIFIER = 'IDENTIFIER',

  EOF = 'EOF',
  UNKNOWN = 'UNKNOWN',
}

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
  column: number;
}
