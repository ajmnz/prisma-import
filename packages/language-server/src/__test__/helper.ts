import * as fs from 'fs'
import { TextDocument } from 'vscode-languageserver-textdocument'
import path from 'path'
import { pathToFileURL } from 'url'

export function getTextDocument(testFilePath: string, toFileUrl = false): TextDocument {
  const absolutePath = path.join(__dirname, '../../../test/fixtures', testFilePath)
  const content: string = fs.readFileSync(absolutePath, 'utf8')
  return TextDocument.create(toFileUrl ? pathToFileURL(absolutePath).toString() : testFilePath, 'prisma', 1, content)
}
