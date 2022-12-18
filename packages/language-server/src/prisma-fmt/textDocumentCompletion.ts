import prismaFmt from '@prisma/prisma-fmt-wasm'
import { CompletionParams, CompletionList } from 'vscode-languageserver'

/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

// This can't panic / throw exceptions. Any panic here should be considered a
// bug to be fixed. prisma-fmt will return an empty CompletionList on error.
export default function textDocumentCompletion(schema: string, params: CompletionParams): CompletionList {
  // CompletionParams.textDocument doesn't match the Language Server JSON-RPC protocol
  // as defined by the spec. In the spec, it is an object with one property:
  // uri, which is a string. The above `params` are a structured object with
  // methods, and `__uri` and `__contents` properties.
  //
  // prisma-fmt expects something spec-compliant, so we enforce this here.
  const correctParams: any = params
  correctParams['textDocument'] = { uri: 'file:/dev/null' }
  const stringifiedParams = JSON.stringify(correctParams)
  const response = prismaFmt.text_document_completion(schema, stringifiedParams)
  return JSON.parse(response)
}
