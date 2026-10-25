import { Lexer } from './lexer';
import { Parser } from './parser';
import { TokenType } from './token';
import { hasErrors, normalizeDoc, validateDoc } from '../model/validate';
import { CompileResult, Diagnostic } from '../model/types';

/**
 * source → tokens → document → normalized → validated.
 * Returns the document only when there are no errors; warnings come along either way.
 */
export function compile(source: string): CompileResult {
  const tokens = new Lexer(source).tokenize();

  const diagnostics: Diagnostic[] = tokens
    .filter((token) => token.type === TokenType.UNKNOWN)
    .map((token) => ({
      severity: 'error' as const,
      phase: 'lex' as const,
      message: `Unexpected character '${token.lexeme}'`,
      line: token.line,
      column: token.column,
    }));

  const parser = new Parser(tokens);
  const parsed = parser.parse();
  diagnostics.push(...parser.errors);

  const normalized = normalizeDoc(parsed);
  diagnostics.push(...normalized.diagnostics);
  diagnostics.push(...validateDoc(normalized.doc));

  const seen = new Set<string>();
  const unique = diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.phase}:${diagnostic.line}:${diagnostic.column}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    doc: hasErrors(unique) ? null : normalized.doc,
    errors: unique,
  };
}
