import {
  DocumentFormattingParams,
  TextEdit,
  Range,
  DeclarationParams,
  CompletionParams,
  CompletionList,
  CompletionItem,
  HoverParams,
  Hover,
  CodeActionParams,
  CodeAction,
  Diagnostic,
  DiagnosticSeverity,
  RenameParams,
  WorkspaceEdit,
  CompletionTriggerKind,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  LocationLink,
} from 'vscode-languageserver'
import {
  Block,
  convertDocumentTextToTrimmedLineArray,
  fullDocumentRange,
  getBlockAtPosition,
  getCurrentLine,
  getExperimentalFeaturesRange,
  getModelOrTypeOrEnumBlock,
  getWordAtPosition,
  isFirstInsideBlock,
  positionIsAfterFieldAndType,
  isInsideAttribute,
  getSymbolBeforePosition,
  getBlocks,
  isInsideQuotationMark,
  isInsideBracket,
  relativeToAbsolutePath,
} from './util'
import { TextDocument } from 'vscode-languageserver-textdocument'
import format from './prisma-fmt/format'
import textDocumentCompletion from './prisma-fmt/textDocumentCompletion'
import {
  getSuggestionForFieldAttribute,
  getSuggestionsForFieldTypes,
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideRoundBrackets,
  suggestEqualSymbol,
  getSuggestionForNativeTypes,
  getSuggestionsForImportPaths,
  getSuggestionsForImportBlocks,
} from './completion/completions'
import { quickFix } from './codeActionProvider'
import lint from './prisma-fmt/lint'
import {
  isModelName,
  insertBasicRename,
  renameReferencesForModelName,
  isEnumValue,
  renameReferencesForEnumValue,
  isValidFieldName,
  extractCurrentName,
  mapExistsAlready,
  insertMapAttribute,
  renameReferencesForFieldValue,
  isEnumName,
  printLogMessage,
  isRelationField,
} from './rename/renameUtil'
import { createDiagnosticsForIgnore } from './diagnosticsHandler'
import { getAllSchemas, getImportsFromSchema } from './imports'
import { fileURLToPath, pathToFileURL } from 'url'
import { getVirtualSchema } from './virtual-schema'

export function handleDiagnosticsRequest(
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): Diagnostic[] {
  const { schema, importAst, rangeOffset, errors } = getImportsFromSchema(document)
  const documentText = document.getText()

  const res = lint(schema, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  const diagnostics: Diagnostic[] = []
  if (
    res.some(
      (diagnostic) =>
        diagnostic.text === "Field declarations don't require a `:`." ||
        diagnostic.text === 'Model declarations have to be indicated with the `model` keyword.',
    )
  ) {
    if (onError) {
      onError(
        "You might currently be viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma Language Server doesn't support this syntax. If you are handling a Prisma 1 datamodel, please change the file extension to `.graphql` so the new Prisma Language Server does not get triggered anymore.",
      )
    }
  }

  for (const diag of [...res, ...errors]) {
    const isDuplicateEntity = /The .* cannot be defined because/.test(diag.text)
    const isFromVirtualSchema = documentText.length < diag.start

    if (isFromVirtualSchema && !isDuplicateEntity) {
      // Error is from injected model and will be shown in appropriate
      // imported file
      console.log(diag.text)
      continue
    } else if (isFromVirtualSchema) {
      // Change range to highlight import
      const entityName = diag.text.match(/(?<=The .+ ")(.*)(?=" cannot be defined because .*)/)?.[0]
      if (entityName) {
        const match = importAst.find((m) => m.block.name === entityName)
        if (match) {
          const lineMatch = documentText
            .split('\n')
            .map((l, i) => [l, i] as const)
            .find(([line]) => line.includes(match.relativePath))

          if (lineMatch) {
            diag.start =
              document.offsetAt({
                line: lineMatch[1],
                character: 0,
              }) + rangeOffset
            diag.end =
              document.offsetAt({
                line: lineMatch[1],
                character: Number.MAX_SAFE_INTEGER,
              }) + rangeOffset
          }
        }
      }
    }

    const diagnostic: Diagnostic = {
      range: {
        start: document.positionAt(diag.start - rangeOffset),
        end: document.positionAt(diag.end - rangeOffset),
      },
      message: diag.text,
      source: '',
    }
    if (diag.is_warning) {
      diagnostic.severity = DiagnosticSeverity.Warning
    } else {
      diagnostic.severity = DiagnosticSeverity.Error
    }
    diagnostics.push(diagnostic)
  }

  // TODO can be removed? Since it was renamed to `previewFeatures`
  // check for experimentalFeatures inside generator block
  // Related code in codeActionProvider.ts, around lines 185-204
  if (document.getText().includes('experimentalFeatures')) {
    const experimentalFeaturesRange: Range | undefined = getExperimentalFeaturesRange(document)
    if (experimentalFeaturesRange) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: experimentalFeaturesRange,
        message: "This property has been renamed to 'previewFeatures' to better communicate what they are.",
        source: '',
      })
    }
  }

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const diagnosticsForIgnore = createDiagnosticsForIgnore(lines)
  diagnostics.push(...diagnosticsForIgnore)

  return diagnostics
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(document: TextDocument, params: DeclarationParams): LocationLink[] | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  // get start position of block
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(word)) ||
        (line.includes('type') && line.includes(word)) ||
        (line.includes('enum') && line.includes(word)) ||
        (line.includes('import') && line.includes(word))
      ) {
        return index
      }
    })
    .filter((index) => index !== undefined) as number[]

  if (results.length === 0) {
    return
  }

  const foundBlocks: Block[] = results
    .map((result) => {
      const block = getBlockAtPosition(result, lines, true)
      console.log(block && block.type)
      console.log(block && block.importedBlocks?.map((b) => b.name))
      console.log(block && word)
      if (
        block &&
        (block.name === word ||
          (block.type === 'import' &&
            (block.importedBlocks?.some((b) => b.name === word) ||
              getWordAtPosition(document, {
                ...block.nameRange.start,
                character: block.nameRange.start.character + 1,
              }) === word)))
      ) {
        return block
      }
    })
    .filter((block) => block !== undefined) as Block[]

  if (foundBlocks.length !== 1) {
    console.log('no blocks')

    return
  }

  const foundBlock = foundBlocks[0]

  if (!foundBlock) {
    console.log('no blocks 0')
    return
  }

  if (foundBlock.type === 'import') {
    const importPath = relativeToAbsolutePath(document, document.getText(foundBlock.nameRange) + '.prisma')
    const foundSchema = getAllSchemas().find((s) => s.path === importPath)

    if (!foundSchema) {
      console.log('no schema')
      return
    }

    const foundImportedBlock = foundSchema.blocks.find((b) => b.name === word)
    if (!foundImportedBlock) {
      console.log('no block')
      return
    }

    return [
      {
        targetUri: pathToFileURL(importPath).toString(),
        targetRange: foundImportedBlock.range,
        targetSelectionRange: foundImportedBlock.nameRange,
      },
    ]
  }

  return [
    {
      targetUri: textDocument.uri,
      targetRange: foundBlock.range,
      targetSelectionRange: foundBlock.nameRange,
    },
  ]
}

/**
 * This handler provides the modification to the document to be formatted.
 */
export function handleDocumentFormatting(
  params: DocumentFormattingParams,
  document: TextDocument,
  applyEdits: (edit: WorkspaceEdit) => Promise<void>,
  onError?: (errorMessage: string) => void,
): TextEdit[] {
  const t1 = process.hrtime()
  let text = document.getText().replace(/import.*/g, (a) => {
    return `//_${a}`
  })

  const virtualSchema = getVirtualSchema(document)
  if (virtualSchema) {
    text += virtualSchema
  }

  const formatted = format(text, params, onError).replace(/\/\/_import/g, 'import')
  const formattedDocument = TextDocument.create(document.uri, 'prisma', 1, formatted)
  const formattedDocumentLines = convertDocumentTextToTrimmedLineArray(formattedDocument)
  const virtualSchemaStartLine = formattedDocumentLines.findIndex((value) => value.includes('// begin_virtual_schema'))

  const currentSchema = getAllSchemas().find((schema) => schema.path === fileURLToPath(document.uri))
  const currentSchemaImports = currentSchema?.blocks.filter((b) => b.type === 'import')
  const edits: NonNullable<WorkspaceEdit['changes']> = {}

  if (currentSchemaImports?.length) {
    const formattedDocumentBlocks = [...getBlocks(formattedDocumentLines)]

    for (const currentSchemaimportBlock of currentSchemaImports) {
      if (!currentSchemaimportBlock.importedBlocks?.length || !currentSchemaimportBlock.relativeImportPath) {
        console.log('invalid import')
        continue
      }

      const importPath = relativeToAbsolutePath(document, currentSchemaimportBlock.relativeImportPath + '.prisma')
      const schemaMatch = getAllSchemas().find((s) => s.path === importPath)

      if (!schemaMatch) {
        console.log(`no schema: ${importPath}`)
        continue
      }

      const matchedBlocks = formattedDocumentBlocks.filter((b) =>
        currentSchemaimportBlock.importedBlocks?.some((ib) => ib.name === b.name),
      )

      edits[schemaMatch.document.uri] = [...(edits[schemaMatch.document.uri] ?? [])]

      for (const matchedBlock of matchedBlocks) {
        const importedBlock = schemaMatch.blocks.find((b) => b.name === matchedBlock.name)

        if (importedBlock) {
          const originalBlock = schemaMatch.document.getText(importedBlock.range) + '\n'
          const replacementBlock = format(
            formattedDocument.getText(matchedBlock.range).replace(/VirtualReplaced/g, ''),
            params,
            onError,
          )

          if (originalBlock !== replacementBlock) {
            edits[schemaMatch.document.uri].push(TextEdit.replace(importedBlock.range, replacementBlock))
          }
        }
      }
    }
  }

  if (Object.keys(edits).length) {
    void applyEdits({ changes: edits })
  }

  const t2 = process.hrtime(t1)
  const totalMs = ((t2[0] + t2[1] / 1000000000) * 1000).toFixed(4)
  console.log(`---- Formatted in ${totalMs}ms`)

  return [
    TextEdit.replace(
      fullDocumentRange(document),
      formattedDocument.getText({
        start: { line: 0, character: 0 },
        end: {
          line: virtualSchemaStartLine !== -1 ? virtualSchemaStartLine - 1 : document.lineCount - 1,
          character: Number.MAX_SAFE_INTEGER,
        },
      }),
    ),
  ]
}

export function handleHoverRequest(document: TextDocument, params: HoverParams): Hover | undefined {
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const foundBlock = getModelOrTypeOrEnumBlock(word, lines)
  if (!foundBlock) {
    return
  }

  const commentLine = foundBlock.range.start.line - 1
  const docComments = document.getText({
    start: { line: commentLine, character: 0 },
    end: { line: commentLine, character: Number.MAX_SAFE_INTEGER },
  })
  if (docComments.startsWith('///')) {
    return {
      contents: docComments.slice(4).trim(),
    }
  }
  // TODO uncomment once https://github.com/prisma/prisma/issues/2546 is resolved!
  /*if (docComments.startsWith('//')) {
    return {
      contents: docComments.slice(3).trim(),
    }
  } */

  return
}

function prismaFmtCompletions(params: CompletionParams, document: TextDocument): CompletionList | undefined {
  const text = document.getText(fullDocumentRange(document))

  const completionList = textDocumentCompletion(text, params)

  if (completionList.items.length === 0) {
    return undefined
  } else {
    return completionList
  }
}

function localCompletions(params: CompletionParams, document: TextDocument): CompletionList | undefined {
  const context = params.context
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const currentLineUntrimmed = getCurrentLine(document, position.line)
  const currentLineTillPosition = currentLineUntrimmed.slice(0, position.character - 1).trim()
  const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)

  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforePositionIsWhiteSpace = symbolBeforePosition.search(/\s/) !== -1

  const positionIsAfterArray: boolean =
    wordsBeforePosition.length >= 3 && !currentLineTillPosition.includes('[') && symbolBeforePositionIsWhiteSpace

  // datasource, generator, model, type, enum or import
  const foundBlock = getBlockAtPosition(position.line, lines, true)
  if (!foundBlock) {
    if (wordsBeforePosition.length > 1 || (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace)) {
      return
    }
    return getSuggestionForBlockTypes(lines)
  }

  if (foundBlock.type !== 'import' && isFirstInsideBlock(position, getCurrentLine(document, position.line))) {
    return getSuggestionForFirstInsideBlock(foundBlock.type, lines, position, foundBlock)
  }

  if (foundBlock.type === 'import' && isInsideQuotationMark(getCurrentLine(document, position.line), position)) {
    return getSuggestionsForImportPaths(document, getCurrentLine(document, position.line), position.line)
  }

  if (foundBlock.type === 'import' && isInsideBracket(getCurrentLine(document, position.line), position)) {
    return getSuggestionsForImportBlocks(document, getCurrentLine(document, position.line))
  }

  // Completion was triggered by a triggerCharacter
  // triggerCharacters defined in src/server.ts
  if (context?.triggerKind === CompletionTriggerKind.TriggerCharacter) {
    switch (context.triggerCharacter as '@' | '"' | '.') {
      case '@':
        if (!positionIsAfterFieldAndType(position, document, wordsBeforePosition)) {
          return
        }
        return getSuggestionForFieldAttribute(
          foundBlock,
          getCurrentLine(document, position.line),
          lines,
          wordsBeforePosition,
          document,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          lines,
        )
      case '.':
        // check if inside attribute
        // Useful to complete composite types
        if (foundBlock.type === 'model' && isInsideAttribute(currentLineUntrimmed, position, '()')) {
          return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, lines, document, position, foundBlock)
        } else {
          return getSuggestionForNativeTypes(foundBlock, lines, wordsBeforePosition, document)
        }
    }
  }

  switch (foundBlock.type) {
    case 'model':
    case 'type':
      // check if inside attribute
      if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
        return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, lines, document, position, foundBlock)
      }
      // check if field type
      if (!positionIsAfterFieldAndType(position, document, wordsBeforePosition)) {
        return getSuggestionsForFieldTypes(foundBlock, lines, position, currentLineUntrimmed, document)
      }
      return getSuggestionForFieldAttribute(foundBlock, lines[position.line], lines, wordsBeforePosition, document)
    case 'datasource':
    case 'generator':
      if (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace) {
        return suggestEqualSymbol(foundBlock.type)
      }
      if (
        currentLineTillPosition.includes('=') &&
        !currentLineTillPosition.includes(']') &&
        !positionIsAfterArray &&
        symbolBeforePosition !== ','
      ) {
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          lines,
        )
      }
      break
    case 'enum':
      break
  }
}

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(params: CompletionParams, document: TextDocument): CompletionList | undefined {
  return prismaFmtCompletions(params, document) || localCompletions(params, document)
}

export function handleRenameRequest(params: RenameParams, document: TextDocument): WorkspaceEdit | undefined {
  const lines: string[] = convertDocumentTextToTrimmedLineArray(document)
  const position = params.position
  const currentLine: string = lines[position.line]
  const currentBlock = getBlockAtPosition(position.line, lines)
  const edits: TextEdit[] = []
  if (!currentBlock) {
    return
  }

  const isModelRename: boolean = isModelName(params.position, currentBlock, lines, document)
  const isEnumRename: boolean = isEnumName(params.position, currentBlock, lines, document)
  const isEnumValueRename: boolean = isEnumValue(currentLine, params.position, currentBlock, document)
  const isValidFieldRename: boolean = isValidFieldName(currentLine, params.position, currentBlock, document)
  const isRelationFieldRename: boolean = isValidFieldRename && isRelationField(currentLine, lines)

  if (isModelRename || isEnumRename || isEnumValueRename || isValidFieldRename) {
    const currentName = extractCurrentName(
      currentLine,
      isModelRename || isEnumRename,
      isEnumValueRename,
      isValidFieldRename,
      document,
      params.position,
    )

    let lineNumberOfDefinition = position.line
    let blockOfDefinition = currentBlock
    let lineOfDefinition = currentLine
    if (isModelRename || isEnumRename) {
      // get definition of model or enum
      const matchModelOrEnumBlockBeginning = new RegExp(`\\s*(model|enum)\\s+(${currentName})\\s*({)`, 'g')
      lineNumberOfDefinition = lines.findIndex((l) => matchModelOrEnumBlockBeginning.test(l))
      if (lineNumberOfDefinition === -1) {
        return
      }
      lineOfDefinition = lines[lineNumberOfDefinition]
      const definitionBlockAtPosition = getBlockAtPosition(lineNumberOfDefinition, lines)
      if (!definitionBlockAtPosition) {
        return
      }
      blockOfDefinition = definitionBlockAtPosition
    }

    // rename marked string
    edits.push(insertBasicRename(params.newName, currentName, document, lineNumberOfDefinition))

    // check if map exists already
    if (
      !isRelationFieldRename &&
      !mapExistsAlready(lineOfDefinition, lines, blockOfDefinition, isModelRename || isEnumRename)
    ) {
      // add map attribute
      edits.push(insertMapAttribute(currentName, position, blockOfDefinition, isModelRename || isEnumRename))
    }

    // rename references
    if (isModelRename || isEnumRename) {
      edits.push(...renameReferencesForModelName(currentName, params.newName, document, lines))
    } else if (isEnumValueRename) {
      edits.push(...renameReferencesForEnumValue(currentName, params.newName, document, lines, blockOfDefinition.name))
    } else if (isValidFieldRename) {
      edits.push(
        ...renameReferencesForFieldValue(
          currentName,
          params.newName,
          document,
          lines,
          blockOfDefinition,
          isRelationFieldRename,
        ),
      )
    }

    printLogMessage(currentName, params.newName, isEnumRename, isModelRename, isValidFieldRename, isEnumValueRename)
    return {
      changes: {
        [document.uri]: edits,
      },
    }
  }

  return
}

/**
 *
 * @param item This handler resolves additional information for the item selected in the completion list.
 */
export function handleCompletionResolveRequest(item: CompletionItem): CompletionItem {
  return item
}

export function handleCodeActions(params: CodeActionParams, document: TextDocument): CodeAction[] {
  if (!params.context.diagnostics.length) {
    return []
  }

  return quickFix(document, params)
}

export function handleDocumentSymbol(params: DocumentSymbolParams, document: TextDocument): DocumentSymbol[] {
  const lines: string[] = convertDocumentTextToTrimmedLineArray(document)
  return Array.from(getBlocks(lines), (block) => ({
    kind: {
      model: SymbolKind.Class,
      enum: SymbolKind.Enum,
      type: SymbolKind.Interface,
      datasource: SymbolKind.Struct,
      generator: SymbolKind.Function,
      import: SymbolKind.Namespace,
    }[block.type],
    name: block.name,
    range: block.range,
    selectionRange: block.nameRange,
  }))
}
