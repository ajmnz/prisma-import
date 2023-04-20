import { CodeActionParams, CompletionParams, DocumentFormattingParams } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  handleCodeActions,
  handleCompletionRequest,
  handleDiagnosticsRequest,
  handleDocumentFormatting,
} from '../MessageHandler'
import { CURSOR_CHARACTER, findCursorPosition, getTextDocument } from './helper'

import * as assert from 'assert'

suite('Artificial Panics', () => {
  const OLD_ENV = { ...process.env }

  test('code actions', () => {
    const fixturePath = './artificial-panic/schema.prisma'
    const document = getTextDocument(fixturePath)

    const params: CodeActionParams = {
      textDocument: document,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      context: {
        diagnostics: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            message: 'dx msg',
          },
        ],
      },
    }

    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    let calledCount = 0
    let calledArg: undefined | unknown = undefined

    // No official mock implementation in mocha
    // -> DIY mock for onError
    const onError = (arg: unknown) => {
      calledCount += 1
      calledArg = arg
    }

    try {
      const _codeActions = handleCodeActions(params, document, onError)

      assert.fail("This shouldn't happen!")
    } catch (e) {
      assert.ok(calledArg)
      assert.strictEqual(calledCount, 1)
    } finally {
      process.env = { ...OLD_ENV }
    }
  })

  test('formatter', () => {
    const fixturePath = './artificial-panic/schema.prisma'
    const document = getTextDocument(fixturePath, true)

    const params: DocumentFormattingParams = {
      textDocument: document,
      options: {
        tabSize: 2,
        insertSpaces: true,
      },
    }

    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    let calledCount = 0
    let calledArg: undefined | unknown = undefined

    const onError = (arg: unknown) => {
      calledCount += 1
      calledArg = arg
    }

    try {
      const _formatResult = handleDocumentFormatting(params, document, () => Promise.resolve(), onError)

      assert.fail("This shouldn't happen!")
    } catch (e) {
      console.log(calledArg, calledCount)
      assert.ok(calledArg)
      assert.strictEqual(calledCount, 1)
    } finally {
      process.env = { ...OLD_ENV }
    }
  })

  test('linting', () => {
    const fixturePath = './artificial-panic/schema.prisma'
    const document = getTextDocument(fixturePath, true)

    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    let calledCount = 0
    let calledArg: undefined | unknown = undefined

    const onError = (arg: unknown) => {
      calledCount += 1
      calledArg = arg
    }

    try {
      const _diagnostics = handleDiagnosticsRequest(document, onError)

      assert.fail("This shouldn't happen!")
    } catch (e) {
      assert.ok(calledArg)
      assert.strictEqual(calledCount, 1)
    } finally {
      process.env = { ...OLD_ENV }
    }
  })

  test('preview features', () => {
    const fixturePath = './artificial-panic/schema.prisma'
    let document = getTextDocument(fixturePath)

    const schema = document.getText()

    const position = findCursorPosition(schema)

    document = TextDocument.create(
      './artificial-panic/schema.prisma',
      'prisma',
      1,
      schema.replace(CURSOR_CHARACTER, ''),
    )

    const params: CompletionParams = {
      textDocument: document,
      position,
    }

    process.env.FORCE_PANIC_PRISMA_FMT_LOCAL = '1'

    let calledCount = 0
    let calledArg: undefined | unknown = undefined

    const onError = (arg: unknown) => {
      calledCount += 1
      calledArg = arg
    }

    try {
      const _completions = handleCompletionRequest(params, document, onError)

      assert.fail("This shouldn't happen!")
    } catch (e) {
      assert.ok(calledArg)
      assert.strictEqual(calledCount, 1)
    } finally {
      process.env = { ...OLD_ENV }
    }
  })

  test('native types', () => {
    const fixturePath = './artificial-panic/native-types.prisma'
    let document = getTextDocument(fixturePath)

    const schema = document.getText()

    const position = findCursorPosition(schema)

    document = TextDocument.create(
      './artificial-panic/native-types.prisma',
      'prisma',
      1,
      schema.replace(CURSOR_CHARACTER, ''),
    )

    const params: CompletionParams = {
      textDocument: document,
      position,
    }

    process.env.FORCE_PANIC_PRISMA_FMT_LOCAL = '1'

    let calledCount = 0
    let calledArg: undefined | unknown = undefined

    const onError = (arg: unknown) => {
      calledCount += 1
      calledArg = arg
    }

    try {
      const _completions = handleCompletionRequest(params, document, onError)

      assert.fail("This shouldn't happen!")
    } catch (e) {
      assert.ok(calledArg)
      assert.strictEqual(calledCount, 1)
    } finally {
      process.env = { ...OLD_ENV }
    }
  })

  test('completions', () => {
    const fixturePath = './artificial-panic/schema.prisma'
    const document = getTextDocument(fixturePath)

    const params: CompletionParams = {
      textDocument: document,
      position: { character: 0, line: 0 },
    }

    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    let calledCount = 0
    let calledArg: undefined | unknown = undefined

    const onError = (arg: unknown) => {
      calledCount += 1
      calledArg = arg
    }

    try {
      const _completions = handleCompletionRequest(params, document, onError)

      assert.fail("This shouldn't happen!")
    } catch (e) {
      assert.ok(calledArg)
      assert.strictEqual(calledCount, 1)
    } finally {
      process.env = { ...OLD_ENV }
    }
  })
})
