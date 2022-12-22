import vscode, { Hover } from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from '../helper'

async function testHover(docUri: vscode.Uri, position: vscode.Position, expectedHover: string): Promise<void> {
  const actualHover: Hover[] = (await vscode.commands.executeCommand(
    'vscode.executeHoverProvider',
    docUri,
    position,
  )) as Hover[]

  assert.ok(actualHover.length === 1)
  assert.ok(actualHover[0].contents.length === 1)
  const result = actualHover[0].contents[0] as vscode.MarkdownString
  assert.deepStrictEqual(result.value, expectedHover)
}

suite('Should show /// documentation comments for', () => {
  const docUri = getDocUri('hover/schema.prisma')

  test('model', async () => {
    await activate(docUri)
    await testHover(docUri, new vscode.Position(23, 10), 'Post including an author and content.')
  })
})

// TODO do we still need this?
// TODO uncomment once https://github.com/prisma/prisma/issues/2546 is resolved!
/*
suite('Should show // comments for', () => {
    const docUri = getDocUri('hover.prisma')

    test('model', async() => {
        await testHover(
            docUri,
            new vscode.Position(14, 15),
            'Documentation for this model.')
    })
    test('enum', async () => {
        await testHover(
            docUri, 
            new vscode.Position(25, 9),
            'This is a test enum.'
        )
    })
}) */
