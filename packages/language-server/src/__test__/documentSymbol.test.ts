import { DocumentSymbol, SymbolKind } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as assert from 'assert'
import { handleDocumentSymbol } from '../MessageHandler'
import { getTextDocument } from './helper'

function assertSymbols(fixturePath: string, expected: DocumentSymbol[]) {
  const document: TextDocument = getTextDocument(fixturePath)
  const actual = handleDocumentSymbol({ textDocument: document }, document)
  assert.deepStrictEqual(actual, expected)
}

suite('DocumentSymbol', () => {
  test('hover_postgresql.prisma', () => {
    assertSymbols('./hover_postgresql.prisma', [
      {
        kind: SymbolKind.Struct,
        name: 'db',
        range: {
          end: {
            character: 1,
            line: 3,
          },
          start: {
            character: 0,
            line: 0,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 0,
          },
          start: {
            character: 11,
            line: 0,
          },
        },
      },
      {
        kind: SymbolKind.Function,
        name: 'client',
        range: {
          end: {
            character: 1,
            line: 7,
          },
          start: {
            character: 0,
            line: 5,
          },
        },
        selectionRange: {
          end: {
            character: 16,
            line: 5,
          },
          start: {
            character: 10,
            line: 5,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'Post',
        range: {
          end: {
            character: 1,
            line: 16,
          },
          start: {
            character: 0,
            line: 10,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 10,
          },
          start: {
            character: 6,
            line: 10,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'User',
        range: {
          end: {
            character: 1,
            line: 26,
          },
          start: {
            character: 0,
            line: 19,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 19,
          },
          start: {
            character: 6,
            line: 19,
          },
        },
      },
      {
        kind: SymbolKind.Enum,
        name: 'UserName',
        range: {
          end: {
            character: 1,
            line: 32,
          },
          start: {
            character: 0,
            line: 29,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 29,
          },
          start: {
            character: 5,
            line: 29,
          },
        },
      },
      {
        kind: SymbolKind.Enum,
        name: 'Test',
        range: {
          end: {
            character: 1,
            line: 38,
          },
          start: {
            character: 0,
            line: 35,
          },
        },
        selectionRange: {
          end: {
            character: 9,
            line: 35,
          },
          start: {
            character: 5,
            line: 35,
          },
        },
      },
    ])
  })

  test('hover_mongodb.prisma', () => {
    assertSymbols('./hover_mongodb.prisma', [
      {
        kind: SymbolKind.Function,
        name: 'client',
        range: {
          end: {
            character: 1,
            line: 2,
          },
          start: {
            character: 0,
            line: 0,
          },
        },
        selectionRange: {
          end: {
            character: 16,
            line: 0,
          },
          start: {
            character: 10,
            line: 0,
          },
        },
      },
      {
        kind: SymbolKind.Struct,
        name: 'db',
        range: {
          end: {
            character: 1,
            line: 7,
          },
          start: {
            character: 0,
            line: 4,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 4,
          },
          start: {
            character: 11,
            line: 4,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'Post',
        range: {
          end: {
            character: 1,
            line: 15,
          },
          start: {
            character: 0,
            line: 9,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 9,
          },
          start: {
            character: 6,
            line: 9,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'User',
        range: {
          end: {
            character: 1,
            line: 24,
          },
          start: {
            character: 0,
            line: 17,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 17,
          },
          start: {
            character: 6,
            line: 17,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'EmbedHolder',
        range: {
          end: {
            character: 1,
            line: 35,
          },
          start: {
            character: 0,
            line: 26,
          },
        },
        selectionRange: {
          end: {
            character: 17,
            line: 26,
          },
          start: {
            character: 6,
            line: 26,
          },
        },
      },
      {
        kind: SymbolKind.Interface,
        name: 'Embed',
        range: {
          end: {
            character: 1,
            line: 44,
          },
          start: {
            character: 0,
            line: 37,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 37,
          },
          start: {
            character: 5,
            line: 37,
          },
        },
      },
      {
        kind: SymbolKind.Interface,
        name: 'EmbedEmbed',
        range: {
          end: {
            character: 1,
            line: 49,
          },
          start: {
            character: 0,
            line: 46,
          },
        },
        selectionRange: {
          end: {
            character: 15,
            line: 46,
          },
          start: {
            character: 5,
            line: 46,
          },
        },
      },
    ])
  })
})
