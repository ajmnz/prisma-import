import { CodeAction } from 'vscode-languageserver'
import { prismaFmt } from '../wasm'
import { handleFormatPanic, handleWasmError } from './util'

export default function codeActions(
  schema: string,
  params: string,
  onError?: (errorMessage: string) => void,
): CodeAction[] {
  try {
    if (process.env.FORCE_PANIC_PRISMA_FMT) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaFmt.debug_panic()
      })
    }

    const result = prismaFmt.code_actions(schema, params)

    return JSON.parse(result) as CodeAction[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'code_actions', onError)

    return []
  }
}
