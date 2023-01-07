import prismaFmt from '@prisma/prisma-fmt-wasm'
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
    const result = prismaFmt.native_types(text)
    return JSON.parse(result) as NativeTypeConstructors[]
  } catch (err: any) {
    if (onError) {
      onError(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `prisma-fmt error'd during getting available native types. ${err}`,
      )
    }

    return []
  }
}
