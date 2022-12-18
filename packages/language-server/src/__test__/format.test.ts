import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleDocumentFormatting } from '../MessageHandler'
import { TextEdit, DocumentFormattingParams } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertFormat(fixturePath: string): void {
  const document: TextDocument = getTextDocument(fixturePath, true)
  const params: DocumentFormattingParams = {
    textDocument: document,
    options: {
      tabSize: 2,
      insertSpaces: true,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const formatResult: TextEdit[] = handleDocumentFormatting(params, document, async () => {})

  assert.ok(formatResult.length !== 0)
}

suite('Format', () => {
  const fixturePath = './formatting/autoFormat.prisma'

  test('Format should do something', () => {
    assertFormat(fixturePath)
  })
})
