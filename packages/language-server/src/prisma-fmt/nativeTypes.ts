import { prismaFmt } from '../wasm'
import { handleFormatPanic, handleWasmError } from './util'
import { fileURLToPath } from 'url'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getAllSchemas } from '../imports'

export interface NativeTypeConstructors {
  name: string
  _number_of_args: number
  _number_of_optional_args: number
  prisma_types: string[]
}

export default function nativeTypeConstructors(
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): NativeTypeConstructors[] {
  let text = document.getText()
  const datasourceSchema = getAllSchemas().find((s) => s.blocks.some((b) => b.type === 'datasource'))
  if (datasourceSchema && datasourceSchema.path !== fileURLToPath(document.uri)) {
    const dataSourceBlock = datasourceSchema?.blocks.find((b) => b.type === 'datasource')
    if (dataSourceBlock) {
      text += '\n'
      text += datasourceSchema.document.getText(dataSourceBlock.range)
    }
  }

  try {
    if (process.env.FORCE_PANIC_PRISMA_FMT_LOCAL) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaFmt.debug_panic()
      })
    }

    const result = prismaFmt.native_types(text)
    return JSON.parse(result) as NativeTypeConstructors[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'native_types', onError)

    return []
  }
}
