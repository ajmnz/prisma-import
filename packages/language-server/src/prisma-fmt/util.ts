import { getWasmError, isWasmPanic, WasmPanic } from '../panic'

/**
 * Imports
 */
const packageJson = require('../../../package.json') // eslint-disable-line

/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

/**
 * Lookup version
 */
export function getVersion(): string {
  if (!packageJson || !packageJson.prisma || !packageJson.prisma.enginesVersion) {
    return 'latest'
  }
  return packageJson.prisma.enginesVersion
}

/**
 * Gets Engines Version from package.json, dependencies, `@prisma/prisma-fmt-wasm`
 * @returns Something like `2.26.0-23.9b816b3aa13cc270074f172f30d6eda8a8ce867d`
 */
export function getEnginesVersion(): string {
  return packageJson.dependencies['@prisma/prisma-fmt-wasm']
}

/**
 * Gets CLI Version from package.json, prisma, cliVersion
 * @returns Something like `2.27.0-dev.50`
 */
export function getCliVersion(): string {
  return packageJson.prisma.cliVersion
}

export function handleWasmError(e: Error, cmd: string, onError?: (errorMessage: string) => void) {
  const getErrorMessage = () => {
    if (isWasmPanic(e)) {
      const { message } = getWasmError(e)
      const msg = `prisma-fmt errored when invoking ${cmd}. It resulted in a Wasm panic.\n${message}`

      return { message: msg, isPanic: true }
    }

    const msg = `prisma-fmt errored when invoking ${cmd}.\n${e.message}`
    return { message: msg, isPanic: false }
  }

  const { message, isPanic } = getErrorMessage()

  if (isPanic) {
    console.error(message)
  } else {
    console.warn(message)
  }

  if (onError) {
    onError(
      "prisma-fmt errored. To get a more detailed output please see Prisma Language Server output. You can do this by going to View, then Output from the toolbar, and then select 'Prisma Language Server' in the drop-down menu.",
    )
  }
}

export function handleFormatPanic(tryCb: () => void) {
  try {
    return tryCb()
  } catch (e: unknown) {
    throw getWasmError(e as WasmPanic)
  }
}
