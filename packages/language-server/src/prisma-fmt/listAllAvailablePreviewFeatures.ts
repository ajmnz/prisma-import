import { prismaFmt } from '../wasm'
import { handleFormatPanic, handleWasmError } from './util'

export default function listAllAvailablePreviewFeatures(onError?: (errorMessage: string) => void): string[] {
  console.log('running preview_features() from prisma-fmt')
  try {
    if (process.env.FORCE_PANIC_PRISMA_FMT_LOCAL) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaFmt.debug_panic()
      })
    }

    const result = prismaFmt.preview_features()
    return JSON.parse(result) as string[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'preview_features', onError)

    return []
  }
}
