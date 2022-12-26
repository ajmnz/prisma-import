import { existsSync, readFileSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import { URI } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { LinterError } from './prisma-fmt/lint'
import {
  Block,
  convertDocumentTextToTrimmedLineArray,
  fullDocumentRange,
  getBlocks,
  getImportBlocks,
  relativeToAbsolutePath,
} from './util'
import { getVirtualSchema } from './virtual-schema'

export const getImportStatementLineIndexes = (statement: string, trimmedLineArray: string[]) => {
  return trimmedLineArray
    .map((l, i) => [l, i] as const)
    .filter(([l]) => l.includes(statement))
    .map(([l, i]) => ({ lineId: i, lineText: l }))
}

const readFromDocumentOrFs = (absolutePath: string, documents: TextDocument[]) => {
  return (
    documents.find((document) => fileURLToPath(document.uri) === absolutePath) ??
    TextDocument.create(pathToFileURL(absolutePath).toString(), 'prisma', 1, readFileSync(absolutePath, 'utf-8'))
  )
}

interface ImportAst {
  path: string
  relativePath: string
  block: Block
}

export const getImportsFromSchema = (
  document: TextDocument,
): { schema: string; rangeOffset: number; importAst: ImportAst[]; errors: LinterError[] } => {
  const schema = document.getText(fullDocumentRange(document))

  const importStatements: string[] = []
  let rangeOffset = 0
  let schemaWithReplacedImports = schema.replace(/^(?<=\s*)(import\s*{.*)/gm, (match) => {
    importStatements.push(match)
    rangeOffset += 2
    return `//${match}`
  })

  const documentLines = convertDocumentTextToTrimmedLineArray(document)

  const importAst: ImportAst[] = []
  const errors: LinterError[] = []

  for (const importStatement of importStatements) {
    const importStatementMatch = importStatement.match(
      /^(?:import\s*{)(?<entities>.*)(?:}\s*from\s*")(?<path>.*)(?:")$/,
    )

    if (!importStatementMatch?.groups?.entities || !importStatementMatch?.groups?.path) {
      errors.push(
        ...getImportStatementLineIndexes(importStatement, documentLines).map(({ lineId: line }) => ({
          start: document.offsetAt({ line, character: 0 }) + rangeOffset,
          end: document.offsetAt({ line, character: importStatement.length }) + rangeOffset,
          text: 'This import is invalid. Imports should look like \'import { Model, Enum, Whatever } from "./path/to/schema"\'.',
          is_warning: false,
        })),
      )

      continue
    }

    const { entities, path: relativeImportPathDirty } = importStatementMatch.groups
    const relativeImportPath = relativeImportPathDirty + '.prisma'

    if (relativeImportPathDirty.endsWith('.prisma')) {
      errors.push(
        ...getImportStatementLineIndexes(importStatement, documentLines).map(({ lineId, lineText }) => {
          const pathIndex = lineText.indexOf(relativeImportPathDirty)

          return {
            start: document.offsetAt({ line: lineId, character: pathIndex }) + rangeOffset,
            end:
              document.offsetAt({ line: lineId, character: pathIndex + relativeImportPathDirty.length }) + rangeOffset,
            text: `This import path is invalid. Paths should not include the \'.prisma\' extension. Change it to \"${relativeImportPathDirty.replace(
              '.prisma',
              '',
            )}\".`,
            is_warning: false,
          }
        }),
      )

      continue
    }

    const absoluteImportPath = relativeToAbsolutePath(document, relativeImportPath)
    const foundSchema = getAllSchemas().find((s) => s.path === absoluteImportPath)

    if (!existsSync(absoluteImportPath) || !foundSchema) {
      errors.push(
        ...getImportStatementLineIndexes(importStatement, documentLines).map(({ lineId, lineText }) => {
          const pathIndex = lineText.indexOf(relativeImportPathDirty)
          return {
            start: document.offsetAt({ line: lineId, character: pathIndex }) + rangeOffset,
            end: document.offsetAt({ line: lineId, character: pathIndex + relativeImportPath.length }) + rangeOffset,
            text: `Cannot find schema at '${relativeImportPath}'`,
            is_warning: false,
          }
        }),
      )

      continue
    }

    const importedEntities = entities
      .replace(/\s*/g, '')
      .split(',')
      .filter((e) => !!e)

    if (!importedEntities.length) {
      errors.push(
        ...getImportStatementLineIndexes(importStatement, documentLines).map(({ lineId, lineText }) => {
          const firstBracket = lineText.indexOf('{')
          const lastBracket = lineText.indexOf('}')

          return {
            start: document.offsetAt({ line: lineId, character: firstBracket }) + rangeOffset,
            end: document.offsetAt({ line: lineId, character: lastBracket + 1 }) + rangeOffset,
            text: `Empty imports are useless, either import a block or remove this line.`,
            is_warning: true,
          }
        }),
      )

      continue
    }

    let importStatementLineIndexes: { lineId: number; lineText: string }[] | null = null

    for (const blockName of importedEntities) {
      const foundBlock = foundSchema.blocks.find((b) => b.name === blockName)

      if (!foundBlock) {
        if (!importStatementLineIndexes) {
          importStatementLineIndexes = getImportStatementLineIndexes(importStatement, documentLines)
        }

        errors.push(
          ...importStatementLineIndexes.map(({ lineId, lineText }) => {
            const blockIndex = lineText.indexOf(blockName)

            return {
              start: document.offsetAt({ line: lineId, character: blockIndex }) + rangeOffset,
              end: document.offsetAt({ line: lineId, character: blockIndex + blockName.length }) + rangeOffset,
              text: `'${absoluteImportPath}' has no block named "${blockName}".`,
              is_warning: false,
            }
          }),
        )

        continue
      }

      importAst.push({
        path: absoluteImportPath,
        relativePath: relativeImportPath,
        block: foundBlock,
      })
    }
  }

  if (!errors.length) {
    const virtualSchema = getVirtualSchema(document)
    if (virtualSchema) {
      schemaWithReplacedImports += '\n'
      schemaWithReplacedImports += virtualSchema
    }
  }

  return {
    importAst,
    schema: schemaWithReplacedImports,
    rangeOffset,
    errors,
  }
}

export interface SchemaWithBlocks {
  path: string
  document: TextDocument
  blocks: Block[]
}

let _allSchemas: SchemaWithBlocks[] = []
let _allBlocks: string[] = []

export const setAllSchemas = (v: SchemaWithBlocks[]) => {
  _allSchemas = v
}
export const setAllBlocks = (v: string[]) => {
  _allBlocks = v
}
export const getAllSchemas = () => _allSchemas
export const getAllBlocks = () => _allBlocks

export const setSchemasAndBlocksFromURIs = (uris: URI[], documents: TextDocument[]): void => {
  const allBlocks: string[] = []
  const allSchemas: SchemaWithBlocks[] = uris.map((uri) => {
    const documentPath = fileURLToPath(uri)
    const document = readFromDocumentOrFs(fileURLToPath(uri), documents)
    const lines = convertDocumentTextToTrimmedLineArray(document)
    const blocks = Array.from(getBlocks(lines))

    allBlocks.push(...blocks.filter((b) => ['enum', 'model', 'type'].includes(b.type)).map((b) => b.name))

    const importBlocks = getImportBlocks(lines)
    blocks.push(...importBlocks)

    return {
      path: documentPath,
      document,
      blocks,
    }
  })

  setAllSchemas(allSchemas)
  setAllBlocks(allBlocks)
}
