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

export const getImportsFromSchema = (document: TextDocument) => {
  const schemaText = document.getText(fullDocumentRange(document))

  const importStatements: string[] = []
  const rangeOffsets: { position: number; offset: number }[] = []
  let schemaWithReplacedImports = schemaText.replace(/^(?<=\s*)(import\s*{.*)/gm, (match, ...rest) => {
    importStatements.push(match)
    const position = rest.find((position): position is number => typeof position === 'number')!
    rangeOffsets.push({ position, offset: 2 })
    return `//${match}`
  })

  const documentAbsolutePath = fileURLToPath(document.uri)
  const schema = getAllSchemas().find((schema) => schema.path === documentAbsolutePath)
  const extendBlocks = schema?.blocks.filter((block) => block.type === 'extend') ?? []

  extendBlocks.forEach((block) => {
    const lines = document.getText(block.range).split(/\r?\n/)
    const commentedLines = lines.map((line) => `//${line}`).join('\n')
    let lineStartPosition = document.offsetAt(block.range.start)

    for (const line of lines) {
      rangeOffsets.push({ position: lineStartPosition, offset: 2 })
      lineStartPosition += line.length
    }
    schemaWithReplacedImports = schemaWithReplacedImports.replace(document.getText(block.range), commentedLines)
  })

  function getPositionInVirtualSchema(position: number) {
    let totalOffset = 0
    for (const rangeOffset of rangeOffsets) {
      if (position > rangeOffset.position) {
        totalOffset += rangeOffset.offset
      } else {
        break
      }
    }
    return totalOffset + position
  }

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
          start: getPositionInVirtualSchema(document.offsetAt({ line, character: 0 })),
          end: getPositionInVirtualSchema(document.offsetAt({ line, character: importStatement.length })),
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
            start: getPositionInVirtualSchema(document.offsetAt({ line: lineId, character: pathIndex })),
            end: getPositionInVirtualSchema(
              document.offsetAt({ line: lineId, character: pathIndex + relativeImportPathDirty.length }),
            ),
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
            start: getPositionInVirtualSchema(document.offsetAt({ line: lineId, character: pathIndex })),
            end: getPositionInVirtualSchema(
              document.offsetAt({ line: lineId, character: pathIndex + relativeImportPath.length }),
            ),
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
            start: getPositionInVirtualSchema(document.offsetAt({ line: lineId, character: firstBracket })),
            end: getPositionInVirtualSchema(document.offsetAt({ line: lineId, character: lastBracket + 1 })),
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
              start: getPositionInVirtualSchema(document.offsetAt({ line: lineId, character: blockIndex })),
              end: getPositionInVirtualSchema(
                document.offsetAt({ line: lineId, character: blockIndex + blockName.length }),
              ),
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

  for (const extendBlock of extendBlocks) {
    const extendedImportedBlock = importAst.find(
      ({ block }) => ['model', 'type'].includes(block.type) && block.name === extendBlock.name,
    )
    if (extendedImportedBlock) {
      const importedBlockSchema = getAllSchemas().find((schema) => schema.path === extendedImportedBlock.path)

      if (!importedBlockSchema) {
        continue
      }

      const importedBlockText = importedBlockSchema.document.getText(extendedImportedBlock.block.range)
      const importedBlockLines = importedBlockText.split('\n')
      const importedBlockBodyText = importedBlockLines.join('\n')
      const importedBlockProperties = importedBlockBodyText.match(/(?<=\n\s*)(\w+)\b/g)

      if (!importedBlockProperties) {
        continue
      }

      const extendBlockText = document.getText(extendBlock.range)
      const extendBlockLines = extendBlockText.split('\n')
      const extendBlockBodyText = extendBlockLines.join('\n')
      const extendBlockProperties = extendBlockBodyText.match(/(?<=\n\s*)(\w+)\b/g)

      if (!extendBlockProperties) {
        continue
      }

      for (const prop of extendBlockProperties) {
        if (importedBlockProperties.includes(prop)) {
          const offset = extendBlockText.search(new RegExp(`(?<=\\n\\s*)(${prop})\\b`, 'g'))

          errors.push({
            start: getPositionInVirtualSchema(document.offsetAt(extendBlock.range.start) + offset),
            end: getPositionInVirtualSchema(document.offsetAt(extendBlock.range.start) + offset + prop.length),
            text: `Field ${prop} is already defined on ${extendedImportedBlock.block.type} ${extendedImportedBlock.block.name}.`,
            is_warning: false,
          })
        }
      }
    } else {
      errors.push({
        start: getPositionInVirtualSchema(document.offsetAt(extendBlock.nameRange.start)),
        end: getPositionInVirtualSchema(document.offsetAt(extendBlock.nameRange.end)),
        text: `There is no imported block named ${extendBlock.name}. Local blocks can't be extended.`,
        is_warning: false,
      })
    }
  }

  const virtualSchema = getVirtualSchema(document)
  if (virtualSchema) {
    schemaWithReplacedImports += '\n'
    schemaWithReplacedImports += virtualSchema
  }

  return {
    importAst,
    schema: schemaWithReplacedImports,
    getPositionInVirtualSchema: getPositionInVirtualSchema,
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
