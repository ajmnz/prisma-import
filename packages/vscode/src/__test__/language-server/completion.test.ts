import vscode, { CompletionList } from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from '../helper'

/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-misused-promises */

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: CompletionList,
  isActivated: boolean,
  triggerCharacter?: string,
): Promise<void> {
  if (!isActivated) {
    await activate(docUri)
  }

  const actualCompletions: vscode.CompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position,
    triggerCharacter,
  )) as vscode.CompletionList

  assert.deepStrictEqual(
    actualCompletions.isIncomplete,
    expectedCompletionList.isIncomplete,
    `Line ${position.line} - Character ${position.character}
Expected isIncomplete to be '${expectedCompletionList.isIncomplete}' but got '${actualCompletions.isIncomplete}'
expected:
${JSON.stringify(expectedCompletionList, undefined, 2)}
but got (actual):
${JSON.stringify(actualCompletions, undefined, 2)}`,
  )

  assert.deepStrictEqual(
    actualCompletions.items.map((items) => items.label),
    expectedCompletionList.items.map((items) => items.label),
    `Line ${position.line} - Character ${position.character}
mapped items => item.label`,
  )

  assert.deepStrictEqual(
    actualCompletions.items.map((item) => item.kind),
    expectedCompletionList.items.map((item) => item.kind),
    `Line ${position.line} - Character ${position.character}
mapped items => item.kind`,
  )

  assert.deepStrictEqual(
    actualCompletions.items.length,
    expectedCompletionList.items.length,
    `Line ${position.line} - Character ${position.character}
Expected ${expectedCompletionList.items.length} suggestions and got ${actualCompletions.items.length}: ${JSON.stringify(
      actualCompletions.items,
      undefined,
      2,
    )}`, // TODO only 1 value is output here :(
  )

  assert.deepStrictEqual(
    actualCompletions.items.length,
    expectedCompletionList.items.length,
    `Line ${position.line} - Character ${position.character}
items.length`,
  )
}

const emptyDocUri = getDocUri('completions/empty.prisma')

suite('Completions', () => {
  test('Diagnoses block type suggestions for empty file', async () => {
    await testCompletion(
      emptyDocUri,
      new vscode.Position(0, 0),
      new vscode.CompletionList(
        [
          { label: 'datasource', kind: vscode.CompletionItemKind.Class },
          { label: 'enum', kind: vscode.CompletionItemKind.Class },
          { label: 'generator', kind: vscode.CompletionItemKind.Class },
          { label: 'model', kind: vscode.CompletionItemKind.Class },
        ],
        false,
      ),
      false,
    )
  })
})
