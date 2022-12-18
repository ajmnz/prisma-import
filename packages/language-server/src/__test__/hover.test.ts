import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import { handleHoverRequest } from '../MessageHandler'
import { Hover } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertHover(position: Position, expected: Hover, fixturePath: string): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const params = {
    textDocument: document,
    position: position,
  }
  const hoverResult: Hover | undefined = handleHoverRequest(document, params)

  assert.ok(hoverResult !== undefined)
  assert.deepStrictEqual(hoverResult.contents, expected.contents)
  assert.deepStrictEqual(hoverResult.range, expected.range)
}

suite('Hover of /// documentation comments', () => {
  const fixturePath = './hover_postgresql.prisma'

  test('Model', () => {
    assertHover(
      {
        character: 10,
        line: 23,
      },
      {
        contents: 'Post including an author and content.',
      },
      fixturePath,
    )
  })
  test('Enum', () => {
    assertHover(
      {
        character: 17,
        line: 24,
      },
      {
        contents: 'This is an enum specifying the UserName.',
      },
      fixturePath,
    )
  })
})
