import { TextDocument } from 'vscode-languageserver-textdocument'
import { quickFix } from '../codeActionProvider'
import {
  CodeAction,
  DiagnosticSeverity,
  CodeActionParams,
  CodeActionKind,
  Range,
  Diagnostic,
} from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertQuickFix(expected: CodeAction[], fixturePath: string, range: Range, diagnostics: Diagnostic[]): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const params: CodeActionParams = {
    textDocument: {
      // prisma-fmt expects a URI starting with file:///, if not it will return nothing ([])
      uri: `file:///${document.uri.substring(2)}`,
    },
    context: {
      diagnostics,
    },
    range,
  }

  const quickFixResult: CodeAction[] = quickFix(document, params)

  assert.ok(quickFixResult.length !== 0, "Expected a quick fix, but didn't get one")
  assert.deepStrictEqual(quickFixResult, expected)
}

function createDiagnosticErrorUnknownType(unknownType: string, range: Range): Diagnostic {
  return {
    message:
      'Type "' + unknownType + '" is neither a built-in type, nor refers to another model, custom type, or enum.',
    severity: DiagnosticSeverity.Error,
    range: range,
  }
}

suite('Quick Fixes', () => {
  suite('from TS', () => {
    const fixturePath = './codeActions/quickFixes.prisma'
    const expectedPath = `file:///${fixturePath.substring(2)}`

    const rangeNewModel: Range = {
      start: { line: 16, character: 9 },
      end: { line: 16, character: 17 },
    }
    const rangeNewEnum: Range = {
      start: { line: 24, character: 6 },
      end: { line: 24, character: 13 },
    }
    const rangePorst: Range = {
      start: { line: 31, character: 15 },
      end: { line: 31, character: 9 },
    }
    const rangeEdit: Range = {
      start: { line: 35, character: 0 },
      end: { line: 35, character: 0 },
    }

    const diagnosticsNewModel: Diagnostic[] = [createDiagnosticErrorUnknownType('NewModel', rangeNewModel)]
    const diagnosticsNewEnum: Diagnostic[] = [createDiagnosticErrorUnknownType('NewEnum', rangeNewEnum)]
    const diagnosticsPorst: Diagnostic[] = [createDiagnosticErrorUnknownType('Porst', rangePorst)]

    test('Model/enum creations', () => {
      assertQuickFix(
        [
          {
            title: "Create new model 'NewModel'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsNewModel,
            edit: {
              changes: {
                [expectedPath]: [
                  {
                    range: rangeEdit,
                    newText: '\nmodel NewModel {\n\n}\n',
                  },
                ],
              },
            },
          },
          {
            title: "Create new enum 'NewModel'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsNewModel,
            edit: {
              changes: {
                [expectedPath]: [
                  {
                    range: rangeEdit,
                    newText: '\nenum NewModel {\n\n}\n',
                  },
                ],
              },
            },
          },
        ],
        fixturePath,
        rangeNewModel,
        diagnosticsNewModel,
      ),
        assertQuickFix(
          [
            {
              title: "Create new model 'NewEnum'",
              kind: CodeActionKind.QuickFix,
              diagnostics: diagnosticsNewEnum,
              edit: {
                changes: {
                  [expectedPath]: [
                    {
                      range: rangeEdit,
                      newText: '\nmodel NewEnum {\n\n}\n',
                    },
                  ],
                },
              },
            },
            {
              title: "Create new enum 'NewEnum'",
              kind: CodeActionKind.QuickFix,
              diagnostics: diagnosticsNewEnum,
              edit: {
                changes: {
                  [expectedPath]: [
                    {
                      range: rangeEdit,
                      newText: '\nenum NewEnum {\n\n}\n',
                    },
                  ],
                },
              },
            },
          ],
          fixturePath,
          rangeNewEnum,
          diagnosticsNewEnum,
        )
    })

    test('Spelling suggestions and model/enum creations', () => {
      assertQuickFix(
        [
          {
            title: "Change spelling to 'Post'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsPorst,
            edit: {
              changes: {
                [expectedPath]: [
                  {
                    range: rangePorst,
                    newText: 'Post?',
                  },
                ],
              },
            },
          },
          {
            title: "Create new model 'Porst'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsPorst,
            edit: {
              changes: {
                [expectedPath]: [
                  {
                    range: rangeEdit,
                    newText: '\nmodel Porst {\n\n}\n',
                  },
                ],
              },
            },
          },
          {
            title: "Create new enum 'Porst'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsPorst,
            edit: {
              changes: {
                [expectedPath]: [
                  {
                    range: rangeEdit,
                    newText: '\nenum Porst {\n\n}\n',
                  },
                ],
              },
            },
          },
        ],
        fixturePath,
        rangePorst,
        diagnosticsPorst,
      )
    })
  })

  suite('from prisma-fmt', () => {
    const fixturePath = './codeActions/one_to_many_referenced_side_misses_unique_single_field.prisma'
    const expectedPath = `file:///${fixturePath.substring(2)}`

    test('@relation referenced side missing @unique', () => {
      const diagnostics: Diagnostic[] = [
        {
          range: {
            start: { line: 14, character: 2 },
            end: { line: 15, character: 0 },
          },
          message:
            'Error parsing attribute "@relation": The argument `references` must refer to a unique criteria in the related model. Consider adding an `@unique` attribute to the field `field` in the model `A`.',
          severity: DiagnosticSeverity.Error,
        },
      ]

      let character = 11

      if (process.platform === 'win32') {
        character = 12
      }

      assertQuickFix(
        [
          {
            title: 'Make referenced field(s) unique',
            kind: CodeActionKind.QuickFix,
            diagnostics: [
              {
                range: {
                  start: {
                    line: 14,
                    character: 2,
                  },
                  end: {
                    line: 15,
                    character: 0,
                  },
                },
                severity: 1,
                message:
                  'Error parsing attribute "@relation": The argument `references` must refer to a unique criteria in the related model. Consider adding an `@unique` attribute to the field `field` in the model `A`.',
              },
            ],
            edit: {
              changes: {
                [expectedPath]: [
                  {
                    range: {
                      start: { line: 7, character: character },
                      end: { line: 7, character: character },
                    },
                    newText: ' @unique',
                  },
                ],
              },
            },
          },
        ],
        fixturePath,
        {
          start: { line: 14, character: 48 },
          end: { line: 14, character: 48 },
        },

        diagnostics,
      )
    })
  })
})
