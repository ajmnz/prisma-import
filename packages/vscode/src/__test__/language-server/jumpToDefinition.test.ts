import vscode from 'vscode'
import assert from 'assert'
import { getDocUri, activate, toRange } from '../helper'

async function testJumpToDefinition(
  fixturePathSqlite: vscode.Uri,
  position: vscode.Position,
  expectedLocation: vscode.Location,
): Promise<void> {
  const actualLocation: vscode.LocationLink[] = (await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    fixturePathSqlite,
    position,
  )) as vscode.LocationLink[]

  assert.ok(actualLocation.length === 1)
  assert.deepStrictEqual(actualLocation[0].targetRange, expectedLocation.range)
}

suite('Jump-to-definition', () => {
  const fixturePathSqlite = getDocUri('jump-to-definition/schema.prisma')

  test('SQLite: from attribute to model', async function () {
    await activate(fixturePathSqlite)

    await testJumpToDefinition(
      fixturePathSqlite,
      new vscode.Position(11, 16),
      new vscode.Location(fixturePathSqlite, toRange(26, 0, 31, 1)),
    )
  })
})
