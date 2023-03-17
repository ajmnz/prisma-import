import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  CodeActionParams,
  CodeAction,
  Diagnostic,
  DiagnosticSeverity,
  CodeActionKind,
  Range,
} from 'vscode-languageserver'
import levenshtein from 'js-levenshtein'
import { convertDocumentTextToTrimmedLineArray, getAllRelationNames } from './util'
import prismaFmt from '@prisma/prisma-fmt-wasm'

function getInsertRange(document: TextDocument): Range {
  // to insert text into a document create a range where start === end.
  const start = { line: document.lineCount, character: 0 }
  return { start, end: start }
}

/**
 * Given a name and a list of symbols whose names are *not* equal to the name, return a spelling suggestion if there is one that is close enough.
 * Names less than length 3 only check for case-insensitive equality, not levenshtein distance.
 *
 * If there is a candidate that's the same except for case, return that.
 * If there is a candidate that's within one edit of the name, return that.
 * Otherwise, return the candidate with the smallest Levenshtein distance,
 *    except for candidates:
 *      * With no name
 *      * Whose meaning doesn't match the `meaning` parameter.
 *      * Whose length differs from the target name by more than 0.34 of the length of the name.
 *      * Whose levenshtein distance is more than 0.4 of the length of the name
 *        (0.4 allows 1 substitution/transposition for every 5 characters,
 *         and 1 insertion/deletion at 3 characters)
 */
function getSpellingSuggestions(name: string, possibleSuggestions: string[]): string | undefined {
  const maximumLengthDifference = Math.min(2, Math.floor(name.length * 0.34))
  let bestDistance = Math.floor(name.length * 0.4) + 1 // If the best result isn't better than this, don't bother.
  let bestCandidate: string | undefined
  let justCheckExactMatches = false
  const nameLowerCase = name.toLowerCase()
  for (const candidate of possibleSuggestions) {
    if (!(Math.abs(candidate.length - nameLowerCase.length) <= maximumLengthDifference)) {
      continue
    }
    const candidateNameLowerCase = candidate.toLowerCase()
    if (candidateNameLowerCase === nameLowerCase) {
      return candidate
    }
    if (justCheckExactMatches) {
      continue
    }
    if (candidate.length < 3) {
      // Don't bother, user would have noticed a 2-character name having an extra character
      continue
    }
    // Only care about a result better than the best so far.
    const distance = levenshtein(nameLowerCase, candidateNameLowerCase)
    if (distance > bestDistance) {
      continue
    }
    if (distance < 3) {
      justCheckExactMatches = true
      bestCandidate = candidate
    } else {
      bestDistance = distance
      bestCandidate = candidate
    }
  }
  return bestCandidate
}

function removeTypeModifiers(hasTypeModifierArray: boolean, hasTypeModifierOptional: boolean, input: string): string {
  if (hasTypeModifierArray) return input.replace('[]', '')
  if (hasTypeModifierOptional) return input.replace('?', '')
  return input
}

function addTypeModifiers(hasTypeModifierArray: boolean, hasTypeModifierOptional: boolean, suggestion: string): string {
  if (hasTypeModifierArray) return `${suggestion}[]`
  if (hasTypeModifierOptional) return `${suggestion}?`
  return suggestion
}

export function quickFix(textDocument: TextDocument, params: CodeActionParams): CodeAction[] {
  const diagnostics: Diagnostic[] = params.context.diagnostics

  if (!diagnostics || diagnostics.length === 0) {
    return []
  }

  // get code actions from prisma-fmt
  const actionDataFromPrismaFmt: string = prismaFmt.code_actions(textDocument.getText(), JSON.stringify(params))
  // For debugging
  // console.log({ actionDataFromPrismaFmt })

  const codeActions: CodeAction[] = JSON.parse(actionDataFromPrismaFmt) as CodeAction[]

  // Add code actions from typescript side
  for (const diag of diagnostics) {
    if (
      diag.severity === DiagnosticSeverity.Error &&
      diag.message.startsWith('Type') &&
      diag.message.includes('is neither a built-in type, nor refers to another model, custom type, or enum.')
    ) {
      let diagText = textDocument.getText(diag.range)
      const hasTypeModifierArray: boolean = diagText.endsWith('[]')
      const hasTypeModifierOptional: boolean = diagText.endsWith('?')
      diagText = removeTypeModifiers(hasTypeModifierArray, hasTypeModifierOptional, diagText)
      const lines: string[] = convertDocumentTextToTrimmedLineArray(textDocument)
      const spellingSuggestion = getSpellingSuggestions(diagText, getAllRelationNames(lines))
      if (spellingSuggestion) {
        codeActions.push({
          title: `Change spelling to '${spellingSuggestion}'`,
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [params.textDocument.uri]: [
                {
                  range: diag.range,
                  newText: addTypeModifiers(hasTypeModifierArray, hasTypeModifierOptional, spellingSuggestion),
                },
              ],
            },
          },
        })
      }
      codeActions.push({
        title: `Create new model '${diagText}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: getInsertRange(textDocument),
                newText: `\nmodel ${diagText} {\n\n}\n`,
              },
            ],
          },
        },
      })
      codeActions.push({
        title: `Create new enum '${diagText}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: getInsertRange(textDocument),
                newText: `\nenum ${diagText} {\n\n}\n`,
              },
            ],
          },
        },
      })
    } else if (
      diag.severity === DiagnosticSeverity.Warning &&
      diag.message.includes("property has been renamed to 'previewFeatures'")
    ) {
      codeActions.push({
        title: "Rename property to 'previewFeatures'",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: diag.range,
                newText: 'previewFeatures',
              },
            ],
          },
        },
      })
    } else if (
      diag.severity === DiagnosticSeverity.Error &&
      diag.message.includes('It does not start with any known Prisma schema keyword.')
    ) {
      const diagText = textDocument.getText(diag.range).split(/\s/)
      if (diagText.length !== 0) {
        const spellingSuggestion = getSpellingSuggestions(diagText[0], [
          'model',
          'enum',
          'datasource',
          'generator',
          'import',
          'extend',
        ])
        if (spellingSuggestion) {
          codeActions.push({
            title: `Change spelling to '${spellingSuggestion}'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diag],
            edit: {
              changes: {
                [params.textDocument.uri]: [
                  {
                    range: {
                      start: diag.range.start,
                      end: {
                        line: diag.range.start.line,
                        character: diagText[0].length,
                      },
                    }, // the red squiggly lines start at the beginning of the blog and end at the end of the line, include e.g. 'mode nameOfBlock {' but
                    // we only want to replace e.g. 'mode' with 'model', not delete the whole line
                    newText: spellingSuggestion,
                  },
                ],
              },
            },
          })
        }
      }
    }
  }

  return codeActions
}
