import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import { handleDefinitionRequest } from '../MessageHandler'
import { LocationLink, Range } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertJumpToDefinition(position: Position, expectedRange: Range, fixturePath: string): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const params = {
    textDocument: document,
    position: position,
  }
  const defResult: LocationLink[] | undefined = handleDefinitionRequest(document, params)

  assert.ok(defResult !== undefined)
  assert.deepStrictEqual(defResult[0].targetRange, expectedRange)
}

suite('Jump-to-Definition', () => {
  const fixturePathSqlite = './correct_sqlite.prisma'
  const fixturePathMongodb = './correct_mongodb.prisma'

  test('SQLite: from attribute to model', () => {
    assertJumpToDefinition(
      {
        line: 11,
        character: 16,
      },
      {
        start: {
          line: 26,
          character: 0,
        },
        end: {
          line: 31,
          character: 1,
        },
      },
      fixturePathSqlite,
    )
    assertJumpToDefinition(
      {
        line: 14,
        character: 14,
      },
      {
        start: {
          line: 18,
          character: 0,
        },
        end: {
          line: 24,
          character: 1,
        },
      },
      fixturePathSqlite,
    )
    assertJumpToDefinition(
      {
        line: 22,
        character: 9,
      },
      {
        start: {
          line: 9,
          character: 0,
        },
        end: {
          line: 16,
          character: 1,
        },
      },
      fixturePathSqlite,
    )
  })

  test('MongoDB: from attribute to type', () => {
    assertJumpToDefinition(
      {
        line: 12,
        character: 11,
      },
      {
        start: {
          line: 15,
          character: 0,
        },
        end: {
          line: 19,
          character: 1,
        },
      },
      fixturePathMongodb,
    )
  })
})
