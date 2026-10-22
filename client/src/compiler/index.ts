import { Lexer } from './lexer';
import { Parser } from './parser';
import { interpret } from './interpreter';
import { CompilerError, ProgramNode } from './ast';
import { Slide } from '../store/presentation.types';
import { Token } from './token';

export interface CompileResult {
  slides: Slide[];
  errors: CompilerError[];
}

export function compile(source: string): CompileResult {
  const errors: CompilerError[] = [];

  // Phase 1: Lex
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  const lexErrors = tokens
    .filter((t) => t.type === 'UNKNOWN')
    .map((t) => ({
      line: t.line,
      column: t.column,
      message: `Unexpected character '${t.lexeme}'`,
      severity: 'error' as const,
      phase: 'lex' as const,
    }));
  errors.push(...lexErrors);

  if (errors.length > 0) return { slides: [], errors };

  // Phase 2: Parse
  const parser = new Parser(tokens);
  let ast: ProgramNode;
  try {
    ast = parser.parse();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Parse error';
    let lastToken: Token | undefined;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].type !== 'EOF') { lastToken = tokens[i]; break; }
    }
    lastToken ??= tokens[0];
    errors.push({
      line: lastToken?.line ?? 1,
      column: lastToken?.column ?? 1,
      message: msg,
      severity: 'error',
      phase: 'parse',
    });
    return { slides: [], errors };
  }

  if (parser.errors.length > 0) {
    errors.push(...parser.errors);
    return { slides: [], errors };
  }

  // Phase 3: Interpret (AST → Slides)
  const slides = interpret(ast);

  return { slides, errors };
}
