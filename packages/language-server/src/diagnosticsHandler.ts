import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver/node'
import { getBlockAtPosition } from './util'

export function createDiagnosticsForIgnore(lines: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  lines.map((currElement, index) => {
    if (currElement.includes('@@ignore')) {
      const block = getBlockAtPosition(index, lines)
      if (block) {
        diagnostics.push({
          range: { start: block.range.start, end: block.range.end },
          message:
            '@@ignore: When using Prisma Migrate, this model will be kept in sync with the database schema, however, it will not be exposed in Prisma Client.',
          tags: [DiagnosticTag.Unnecessary],
          severity: DiagnosticSeverity.Hint,
          code: '@@ignore documentation',
          codeDescription: {
            href: 'https://pris.ly/d/schema-reference#ignore-1',
          },
        })
      }
    } else if (currElement.includes('@ignore')) {
      diagnostics.push({
        range: {
          start: { line: index, character: 0 },
          end: { line: index, character: Number.MAX_VALUE },
        },
        message:
          '@ignore: When using Prisma Migrate, this field will be kept in sync with the database schema, however, it will not be exposed in Prisma Client.',
        tags: [DiagnosticTag.Unnecessary],
        severity: DiagnosticSeverity.Hint,
        code: '@ignore documentation',
        codeDescription: {
          href: 'https://pris.ly/d/schema-reference#ignore',
        },
      })
    }
  })

  return diagnostics
}
