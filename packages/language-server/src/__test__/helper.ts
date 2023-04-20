import * as fs from 'fs'
import { Position, TextDocument } from 'vscode-languageserver-textdocument'
import path from 'path'
import { pathToFileURL } from 'url'

export const CURSOR_CHARACTER = '|'

export function getFileUrl(testFilePath: string) {
  const absolutePath = path.join(__dirname, '../../../test/fixtures', testFilePath)
  return pathToFileURL(absolutePath).toString()
}

export function getTextDocument(testFilePath: string, toFileUrl = false): TextDocument {
  const absolutePath = path.join(__dirname, '../../../test/fixtures', testFilePath)
  const content: string = fs.readFileSync(absolutePath, 'utf8')
  return TextDocument.create(toFileUrl ? getFileUrl(testFilePath) : testFilePath, 'prisma', 1, content)
}

export const findCursorPosition = (input: string): Position => {
  const lines = input.split('\n')

  let foundCursorCharacter = -1
  const foundLinePosition = lines.findIndex((line) => {
    const cursorPosition = line.indexOf(CURSOR_CHARACTER)
    if (cursorPosition !== -1) {
      foundCursorCharacter = cursorPosition
      return true
    }
  })

  if (foundLinePosition >= 0 && foundCursorCharacter >= 0) {
    return { line: foundLinePosition, character: foundCursorCharacter }
  }

  throw new Error(
    'Each test must include the `|` pipe character to signal where the cursor should be when executing the test.',
  )
}
