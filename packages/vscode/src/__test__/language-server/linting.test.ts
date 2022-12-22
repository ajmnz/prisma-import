import * as vscode from 'vscode'
import * as assert from 'assert'
import { getDocUri, activate, toRange } from '../helper'

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]): Promise<void> {
  await activate(docUri)

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri)

  assert.strictEqual(actualDiagnostics.length, expectedDiagnostics.length)

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i]
    assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message)
    assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range)
    assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity)
  })
}

suite('Should get linting', () => {
  const docUri = getDocUri('linting/missingArgument.prisma')

  test('Diagnoses missing argument', async () => {
    await testDiagnostics(docUri, [
      {
        message: 'Argument "provider" is missing in data source block "db".',
        range: toRange(0, 0, 2, 1),
        severity: vscode.DiagnosticSeverity.Error,
        source: '',
      },
    ])
  })
})
