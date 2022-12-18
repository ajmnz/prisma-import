import prismaFmt from '@prisma/prisma-fmt-wasm'

export interface LinterError {
  start: number
  end: number
  text: string
  is_warning: boolean
}

export default function lint(text: string, onError?: (errorMessage: string) => void): LinterError[] {
  console.log('running lint() from prisma-fmt')
  try {
    const result = prismaFmt.lint(text)
    return JSON.parse(result) // eslint-disable-line @typescript-eslint/no-unsafe-return
  } catch (errors) {
    const errorMessage = "prisma-fmt error'd during linting.\n"

    if (onError) {
      onError(errorMessage + errors) // eslint-disable-line @typescript-eslint/restrict-plus-operands
    }

    console.error(errorMessage)
    console.error(errors)
    return []
  }
}
