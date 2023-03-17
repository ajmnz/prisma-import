import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
  MarkupKind,
  InsertTextFormat,
  TextEdit,
  Range,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { klona } from 'klona'
import {
  blockAttributes,
  fieldAttributes,
  allowedBlockTypes,
  corePrimitiveTypes,
  supportedDataSourceFields,
  supportedGeneratorFields,
  relationArguments,
  dataSourceUrlArguments,
  dataSourceProviders,
  dataSourceProviderArguments,
  generatorProviders,
  generatorProviderArguments,
  engineTypes,
  engineTypeArguments,
  givenBlockAttributeParams,
  givenFieldAttributeParams,
  sortLengthProperties,
  filterSortLengthBasedOnInput,
  toCompletionItems,
  filterSuggestionsForBlock,
  removeInvalidFieldSuggestions,
  getNativeTypes,
  handlePreviewFeatures,
  relationModeValues,
  blockTypeToCompletionItemKind,
  filterSuggestionsForLine,
} from './completionUtils'
import listAllAvailablePreviewFeatures from '../prisma-fmt/listAllAvailablePreviewFeatures'
import {
  Block,
  BlockType,
  getModelOrTypeOrEnumBlock,
  declaredNativeTypes,
  getAllRelationNames,
  isInsideAttribute,
  isInsideQuotationMark,
  isInsideFieldArgument,
  isInsideGivenProperty,
  getFirstDatasourceName,
  getFirstDatasourceProvider,
  getAllPreviewFeaturesFromGenerators,
  getFieldsFromCurrentBlock,
  getFieldType,
  getFieldTypesFromCurrentBlock,
  getValuesInsideSquareBrackets,
  getCompositeTypeFieldsRecursively,
  relativeToAbsolutePath,
  absoluteToRelativePath,
} from '../util'
import { getAllSchemas } from '../imports'
import { fileURLToPath } from 'url'

function getSuggestionForModelBlockAttribute(block: Block, lines: string[]): CompletionItem[] {
  if (block.type !== 'model') {
    return []
  }
  // create deep copy
  const suggestions: CompletionItem[] = filterSuggestionsForBlock(klona(blockAttributes), block, lines)

  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(lines)
  // We can filter on the previewFeatures enabled
  const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  // Full text indexes (MySQL and MongoDB)
  // https://www.prisma.io/docs/concepts/components/prisma-schema/indexes#full-text-indexes-mysql-and-mongodb
  const isFullTextAvailable = Boolean(
    datasourceProvider &&
      ['mysql', 'mongodb'].includes(datasourceProvider) &&
      previewFeatures?.includes('fulltextindex'),
  )

  if (isFullTextAvailable === false) {
    // fullTextIndex is not available, we need to filter it out
    return suggestions.filter((arg) => arg.label !== '@@fulltext')
  }

  return suggestions
}

export function getSuggestionForNativeTypes(
  foundBlock: Block,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
): CompletionList | undefined {
  const activeFeatureFlag = declaredNativeTypes(document)
  if (
    // TODO type? native "@db." types?
    foundBlock.type !== 'model' ||
    !activeFeatureFlag ||
    wordsBeforePosition.length < 2
  ) {
    return undefined
  }

  const datasourceName = getFirstDatasourceName(lines)
  if (!datasourceName || wordsBeforePosition[wordsBeforePosition.length - 1] !== `@${datasourceName}`) {
    return undefined
  }

  // line
  const prismaType = wordsBeforePosition[1].replace('?', '').replace('[]', '')
  const suggestions = getNativeTypes(document, prismaType)

  return {
    items: suggestions,
    isIncomplete: true,
  }
}

/**
 * Should suggest all field attributes for a given field
 * EX: id Int |> @id, @default, @datasourceName, ...etc
 *
 * If `@datasourceName.` |> suggests nativeTypes
 * @param block
 * @param currentLine
 * @param lines
 * @param wordsBeforePosition
 * @param document
 * @returns
 */
export function getSuggestionForFieldAttribute(
  block: Block,
  currentLine: string,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
): CompletionList | undefined {
  // TODO type? suggestions for "@..." for type?
  if (block.type !== 'model') {
    return
  }

  const fieldType = getFieldType(currentLine)
  // If we don't find a field type (e.g. String, Int...), return no suggestion
  if (!fieldType) {
    return
  }

  let suggestions: CompletionItem[] = []

  // Because @.?
  if (wordsBeforePosition.length >= 2) {
    const datasourceName = getFirstDatasourceName(lines)
    const prismaType = wordsBeforePosition[1]
    const nativeTypeSuggestions = getNativeTypes(document, prismaType)

    if (datasourceName) {
      if (!currentLine.includes(`@${datasourceName}`)) {
        suggestions.push({
          // https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions
          kind: CompletionItemKind.Property,
          label: '@' + datasourceName,
          documentation:
            'Defines a native database type that should be used for this field. See https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#native-types-mapping',
          insertText: `@${datasourceName}$0`,
          insertTextFormat: InsertTextFormat.Snippet,
        })
      }

      if (nativeTypeSuggestions.length !== 0) {
        if (
          // Check that we are not separated by a space like `@db. |`
          wordsBeforePosition[wordsBeforePosition.length - 1] === `@${datasourceName}`
        ) {
          suggestions.push(...nativeTypeSuggestions)
          return {
            items: suggestions,
            isIncomplete: false,
          }
        }
      }
    }
  }

  suggestions.push(...fieldAttributes)

  const modelOrTypeOrEnum = getModelOrTypeOrEnumBlock(fieldType, lines)

  suggestions = filterSuggestionsForLine(suggestions, currentLine, fieldType, modelOrTypeOrEnum?.type)

  suggestions = filterSuggestionsForBlock(suggestions, block, lines)

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function getSuggestionsForFieldTypes(
  foundBlock: Block,
  lines: string[],
  position: Position,
  currentLineUntrimmed: string,
  document: TextDocument,
): CompletionList {
  const suggestions: CompletionItem[] = []

  const datasourceProvider = getFirstDatasourceProvider(lines)
  // MongoDB doesn't support Decimal
  if (datasourceProvider === 'mongodb') {
    suggestions.push(...corePrimitiveTypes.filter((s) => s.label !== 'Decimal'))
  } else {
    suggestions.push(...corePrimitiveTypes)
  }

  if (foundBlock instanceof Block) {
    // get all model names
    const modelNames: string[] = getAllRelationNames(lines)
    suggestions.push(...toCompletionItems(modelNames, CompletionItemKind.Reference))

    const availableImports: CompletionItem[] = []
    const currentSchema = getAllSchemas().find((s) => s.path === fileURLToPath(document.uri))
    const importableSchemas = getAllSchemas().filter((s) => s.path !== fileURLToPath(document.uri))

    for (const schema of importableSchemas) {
      const importableBlocks = schema.blocks.filter((b) => ['enum', 'model', 'type', 'extend'].includes(b.type))
      const relativeSchemaPath = absoluteToRelativePath(document, schema.path)

      for (const block of importableBlocks) {
        let textEditText = `import { ${block.name} } from "${relativeSchemaPath.replace('.prisma', '')}"\n`
        if (!currentSchema?.blocks.some((b) => b.type === 'import')) {
          textEditText += '\n'
        }

        const lastImportIdx = currentSchema?.blocks.reduce((acc, b, index) => (b.type === 'import' ? index : acc), -1)
        const lastImport = !lastImportIdx || lastImportIdx === -1 ? undefined : currentSchema?.blocks[lastImportIdx]
        let textEdit: TextEdit | undefined = TextEdit.insert(Position.create(0, 0), textEditText)

        if (lastImport?.relativeImportPath !== relativeSchemaPath.replace('.prisma', '') || !currentSchema) {
          const lastImportLine = lastImport?.range.start.line
          if (lastImportLine !== undefined) {
            textEdit = TextEdit.insert(Position.create(lastImportLine + 1, 0), textEditText)
          }
        } else {
          textEdit = TextEdit.replace(
            lastImport.range,
            currentSchema.document.getText(lastImport.range).replace(/(?<=.*{)(.*)(?=})/, (blocks) => {
              const formattedBlocks = blocks
                .trim()
                .split(',')
                .map((b) => b.trim())
                .filter((b) => !!b)

              return ` ${[...formattedBlocks, block.name].sort().join(', ')} `
            }),
          )
        }

        availableImports.push({
          kind: blockTypeToCompletionItemKind(block.type),
          label: block.name,
          detail: `Auto-import from ${schema.path}`,
          documentation: {
            kind: MarkupKind.Markdown,
            value: ['```prisma', schema.document.getText(block.range), '```'].join('\n'),
          },
          additionalTextEdits: [textEdit],
        })
      }
    }

    suggestions.push(...availableImports)
  }

  const wordsBeforePosition = currentLineUntrimmed.slice(0, position.character).split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const completeSuggestions = suggestions.filter((s) => s.label.length === wordBeforePosition.length)
  if (completeSuggestions.length !== 0) {
    for (const sugg of completeSuggestions) {
      suggestions.push(
        {
          ...sugg,
          label: `${sugg.label}?`,
          kind: sugg.kind,
          documentation: sugg.documentation,
        },
        {
          ...sugg,
          label: `${sugg.label}[]`,
          kind: sugg.kind,
          documentation: sugg.documentation,
        },
      )
    }
  }

  return {
    items: suggestions,
    isIncomplete: true,
  }
}

function getSuggestionForDataSourceField(block: Block, lines: string[], position: Position): CompletionItem[] {
  // create deep copy
  let suggestions: CompletionItem[] = klona(supportedDataSourceFields)

  const postgresExtensionsEnabled = getAllPreviewFeaturesFromGenerators(lines)?.includes('postgresqlextensions')
  const isPostgres = getFirstDatasourceProvider(lines)?.includes('postgres')

  if (!(postgresExtensionsEnabled && isPostgres)) {
    suggestions = suggestions.filter((item) => item.label !== 'extensions')
  }

  const labels: string[] = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    lines,
    position,
  )

  return suggestions.filter((item) => labels.includes(item.label))
}

function getSuggestionForGeneratorField(block: Block, lines: string[], position: Position): CompletionItem[] {
  // create deep copy
  const suggestions: CompletionItem[] = klona(supportedGeneratorFields)

  const labels = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    lines,
    position,
  )

  return suggestions.filter((item) => labels.includes(item.label))
}

/**
 * gets suggestions for block type
 */
export function getSuggestionForFirstInsideBlock(
  blockType: BlockType,
  lines: string[],
  position: Position,
  block: Block,
): CompletionList {
  let suggestions: CompletionItem[] = []
  switch (blockType) {
    case 'datasource':
      suggestions = getSuggestionForDataSourceField(block, lines, position)
      break
    case 'generator':
      suggestions = getSuggestionForGeneratorField(block, lines, position)
      break
    case 'model':
      suggestions = getSuggestionForModelBlockAttribute(block, lines)
      break
    case 'type':
      // No suggestions
      break
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function getSuggestionForBlockTypes(lines: string[]): CompletionList {
  // create deep copy
  const suggestions: CompletionItem[] = klona(allowedBlockTypes)

  // enum is not supported in sqlite
  let foundDataSourceBlock = false
  for (const item of lines) {
    if (item.includes('datasource')) {
      foundDataSourceBlock = true
      continue
    }
    if (foundDataSourceBlock) {
      if (item.includes('}')) {
        break
      }
      if (item.startsWith('provider') && item.includes('sqlite')) {
        suggestions.pop()
      }
    }
    if (!suggestions.map((sugg) => sugg.label).includes('enum')) {
      break
    }
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function suggestEqualSymbol(blockType: BlockType): CompletionList | undefined {
  if (!(blockType == 'datasource' || blockType == 'generator')) {
    return
  }
  const equalSymbol: CompletionItem = { label: '=' }
  return {
    items: [equalSymbol],
    isIncomplete: false,
  }
}

// Suggest fields for a BlockType
export function getSuggestionForSupportedFields(
  blockType: BlockType,
  currentLine: string,
  currentLineUntrimmed: string,
  position: Position,
  lines: string[],
): CompletionList | undefined {
  let suggestions: string[] = []
  const isInsideQuotation: boolean = isInsideQuotationMark(currentLineUntrimmed, position)
  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(lines)
  // We can filter on the previewFeatures enabled
  // const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  switch (blockType) {
    case 'generator':
      // provider
      if (currentLine.startsWith('provider')) {
        const providers: CompletionItem[] = generatorProviders
        if (isInsideQuotation) {
          return {
            items: providers,
            isIncomplete: true,
          }
        } else {
          return {
            items: generatorProviderArguments,
            isIncomplete: true,
          }
        }
      }
      // previewFeatures
      else if (currentLine.startsWith('previewFeatures')) {
        const generatorPreviewFeatures: string[] = listAllAvailablePreviewFeatures()
        if (generatorPreviewFeatures.length > 0) {
          return handlePreviewFeatures(generatorPreviewFeatures, position, currentLineUntrimmed, isInsideQuotation)
        }
      }
      // engineType
      else if (currentLine.startsWith('engineType')) {
        const engineTypesCompletion: CompletionItem[] = engineTypes
        if (isInsideQuotation) {
          return {
            items: engineTypesCompletion,
            isIncomplete: true,
          }
        } else {
          return {
            items: engineTypeArguments,
            isIncomplete: true,
          }
        }
      }
      break
    case 'datasource':
      // provider
      if (currentLine.startsWith('provider')) {
        const providers: CompletionItem[] = dataSourceProviders

        if (isInsideQuotation) {
          return {
            items: providers,
            isIncomplete: true,
          }
        } else {
          return {
            items: dataSourceProviderArguments,
            isIncomplete: true,
          }
        }
        // url
      } else if (currentLine.startsWith('url')) {
        // check if inside env
        if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
          suggestions = ['DATABASE_URL']
        } else {
          if (currentLine.includes('env')) {
            return {
              items: dataSourceUrlArguments.filter((a) => !a.label.includes('env')),
              isIncomplete: true,
            }
          }
          return {
            items: dataSourceUrlArguments,
            isIncomplete: true,
          }
        }
      }
      // `relationMode` can only be set for SQL databases
      else if (currentLine.startsWith('relationMode') && datasourceProvider !== 'mongodb') {
        const relationModeValuesSuggestion: CompletionItem[] = relationModeValues
        // values inside quotes `"value"`
        const relationModeValuesSuggestionWithQuotes: CompletionItem[] = klona(relationModeValuesSuggestion).map(
          (suggestion) => {
            suggestion.label = `"${suggestion.label}"`
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            suggestion.insertText = `"${suggestion.insertText!}"`
            return suggestion
          },
        )

        if (isInsideQuotation) {
          return {
            items: relationModeValuesSuggestion,
            isIncomplete: true,
          }
        }
        // If line ends with `"`, a value is already set.
        else if (!currentLine.endsWith('"')) {
          return {
            items: relationModeValuesSuggestionWithQuotes,
            isIncomplete: true,
          }
        }
      }
  }

  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Constant),
    isIncomplete: false,
  }
}

function getDefaultValues({
  currentLine,
  lines,
  wordsBeforePosition,
}: {
  currentLine: string
  lines: string[]
  wordsBeforePosition: string[]
}): CompletionItem[] {
  const suggestions: CompletionItem[] = []
  const datasourceProvider = getFirstDatasourceProvider(lines)

  // Completions for sequence(|)
  if (datasourceProvider === 'cockroachdb') {
    if (wordsBeforePosition.some((a) => a.includes('sequence('))) {
      const sequenceProperties = ['virtual', 'minValue', 'maxValue', 'cache', 'increment', 'start']

      // No suggestions if virtual is present
      if (currentLine.includes('virtual')) {
        return suggestions
      }

      // Only suggests if empty
      if (!sequenceProperties.some((it) => currentLine.includes(it))) {
        suggestions.push({
          label: 'virtual',
          insertText: 'virtual',
          kind: CompletionItemKind.Property,
          documentation:
            'Virtual sequences are sequences that do not generate monotonically increasing values and instead produce values like those generated by the built-in function unique_rowid(). They are intended for use in combination with SERIAL-typed columns.',
        })
      }

      if (!currentLine.includes('minValue')) {
        suggestions.push({
          label: 'minValue',
          insertText: 'minValue: $0',
          kind: CompletionItemKind.Property,
          documentation: 'The new minimum value of the sequence.',
        })
      }
      if (!currentLine.includes('maxValue')) {
        suggestions.push({
          label: 'maxValue',
          insertText: 'maxValue: $0',
          kind: CompletionItemKind.Property,
          documentation: 'The new maximum value of the sequence.',
        })
      }
      if (!currentLine.includes('cache')) {
        suggestions.push({
          label: 'cache',
          insertText: 'cache: $0',
          kind: CompletionItemKind.Property,
          documentation:
            'The number of sequence values to cache in memory for reuse in the session. A cache size of 1 means that there is no cache, and cache sizes of less than 1 are not valid.',
        })
      }
      if (!currentLine.includes('increment')) {
        suggestions.push({
          label: 'increment',
          insertText: 'increment: $0',
          kind: CompletionItemKind.Property,
          documentation:
            'The new value by which the sequence is incremented. A negative number creates a descending sequence. A positive number creates an ascending sequence.',
        })
      }
      if (!currentLine.includes('start')) {
        suggestions.push({
          label: 'start',
          insertText: 'start: $0',
          kind: CompletionItemKind.Property,
          documentation:
            'The value the sequence starts at if you RESTART or if the sequence hits the MAXVALUE and CYCLE is set.',
        })
      }

      return suggestions
    }
  }

  // MongoDB only
  if (datasourceProvider === 'mongodb') {
    suggestions.push({
      label: 'auto()',
      kind: CompletionItemKind.Function,
      documentation: 'Represents default values that are automatically generated by the database.',
      insertText: 'auto()',
      insertTextFormat: InsertTextFormat.Snippet,
    })
  } else {
    suggestions.push({
      label: 'dbgenerated("")',
      kind: CompletionItemKind.Function,
      documentation:
        'The SQL definition of the default value which is generated by the database. This is not validated by Prisma.',
      insertText: 'dbgenerated("$0")',
      insertTextFormat: InsertTextFormat.Snippet,
    })
  }

  const fieldType = getFieldType(currentLine)
  // If we don't find a field type (e.g. String, Int...), return no suggestion
  if (!fieldType) {
    return []
  }

  switch (fieldType) {
    case 'BigInt':
    case 'Int':
      if (datasourceProvider === 'cockroachdb') {
        suggestions.push({
          label: 'sequence()',
          kind: CompletionItemKind.Function,
          documentation:
            'Create a sequence of integers in the underlying database and assign the incremented values to the ID values of the created records based on the sequence.',
        })

        if (fieldType === 'Int') {
          // @default(autoincrement()) is only supported on BigInt fields for cockroachdb.
          break
        }
      }

      suggestions.push({
        label: 'autoincrement()',
        kind: CompletionItemKind.Function,
        documentation:
          'Create a sequence of integers in the underlying database and assign the incremented values to the ID values of the created records based on the sequence.',
      })
      break
    case 'DateTime':
      suggestions.push({
        label: 'now()',
        kind: CompletionItemKind.Function,
        documentation: {
          kind: MarkupKind.Markdown,
          value: 'Set a timestamp of the time when a record is created.',
        },
      })
      break
    case 'String':
      suggestions.push(
        {
          label: 'uuid()',
          kind: CompletionItemKind.Function,
          documentation: {
            kind: MarkupKind.Markdown,
            value:
              'Generate a globally unique identifier based on the [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier) spec.',
          },
        },
        {
          label: 'cuid()',
          kind: CompletionItemKind.Function,
          documentation: {
            kind: MarkupKind.Markdown,
            value:
              'Generate a globally unique identifier based on the [cuid](https://github.com/ericelliott/cuid) spec.',
          },
        },
      )
      break
    case 'Boolean':
      suggestions.push(
        { label: 'true', kind: CompletionItemKind.Value },
        { label: 'false', kind: CompletionItemKind.Value },
      )
      break
  }

  const isScalarList = fieldType.endsWith('[]')
  if (isScalarList) {
    suggestions.unshift({
      label: '[]',
      insertText: '[$0]',
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: 'Set a default value on the list field',
      kind: CompletionItemKind.Value,
    })
  }

  const modelOrEnum = getModelOrTypeOrEnumBlock(fieldType, lines)
  if (modelOrEnum && modelOrEnum.type === 'enum') {
    // get fields from enum block for suggestions
    const values: string[] = getFieldsFromCurrentBlock(lines, modelOrEnum)
    values.forEach((v) => suggestions.push({ label: v, kind: CompletionItemKind.Value }))
  }

  return suggestions
}

function getSuggestionsForAttribute(
  {
    attribute,
    wordsBeforePosition,
    untrimmedCurrentLine,
    lines,
    block,
    position,
  }: {
    attribute?: '@relation'
    wordsBeforePosition: string[]
    untrimmedCurrentLine: string
    lines: string[]
    block: Block
    position: Position
  }, // eslint-disable-line @typescript-eslint/no-unused-vars
): CompletionList | undefined {
  const firstWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const secondWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 2]
  const wordBeforePosition = firstWordBeforePosition === '' ? secondWordBeforePosition : firstWordBeforePosition

  let suggestions: CompletionItem[] = []

  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(lines)
  // We can filter on the previewFeatures enabled
  const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  if (attribute === '@relation') {
    if (datasourceProvider === 'mongodb') {
      suggestions = relationArguments.filter(
        (arg) => arg.label !== 'map' && arg.label !== 'onDelete' && arg.label !== 'onUpdate',
      )
    } else {
      suggestions = relationArguments
    }

    // If we are right after @relation(
    if (wordBeforePosition.includes('@relation')) {
      return {
        items: suggestions,
        isIncomplete: false,
      }
    }

    // TODO check fields with [] shortcut
    if (isInsideGivenProperty(untrimmedCurrentLine, wordsBeforePosition, 'fields', position)) {
      return {
        items: toCompletionItems(getFieldsFromCurrentBlock(lines, block, position), CompletionItemKind.Field),
        isIncomplete: false,
      }
    }

    if (isInsideGivenProperty(untrimmedCurrentLine, wordsBeforePosition, 'references', position)) {
      // Get the name by potentially removing ? and [] from Foo? or Foo[]
      const referencedModelName = wordsBeforePosition[1].replace('?', '').replace('[]', '')
      const referencedBlock = getModelOrTypeOrEnumBlock(referencedModelName, lines)
      // referenced model does not exist
      // TODO type?
      if (!referencedBlock || referencedBlock.type !== 'model') {
        return
      }
      return {
        items: toCompletionItems(getFieldsFromCurrentBlock(lines, referencedBlock), CompletionItemKind.Field),
        isIncomplete: false,
      }
    }
  } else {
    // @id, @unique
    // @@id, @@unique, @@index, @@fulltext

    // The length argument is available on MySQL only on the
    // @id, @@id, @unique, @@unique and @@index fields.

    // The sort argument is available for all databases on the
    // @unique, @@unique and @@index fields.
    // Additionally, SQL Server also allows it on @id and @@id.

    let attribute: '@@unique' | '@unique' | '@@id' | '@id' | '@@index' | '@@fulltext' | undefined = undefined
    if (wordsBeforePosition.some((a) => a.includes('@@id'))) {
      attribute = '@@id'
    } else if (wordsBeforePosition.some((a) => a.includes('@id'))) {
      attribute = '@id'
    } else if (wordsBeforePosition.some((a) => a.includes('@@unique'))) {
      attribute = '@@unique'
    } else if (wordsBeforePosition.some((a) => a.includes('@unique'))) {
      attribute = '@unique'
    } else if (wordsBeforePosition.some((a) => a.includes('@@index'))) {
      attribute = '@@index'
    } else if (wordsBeforePosition.some((a) => a.includes('@@fulltext'))) {
      attribute = '@@fulltext'
    }

    /**
     * inside []
     * suggest composite types for MongoDB
     * suggest fields and extendedIndexes arguments (sort / length)
     *
     * Examples
     * field attribute: slug String @unique(sort: Desc, length: 42) @db.VarChar(3000)
     * block attribute: @@id([title(length: 100, sort: Desc), abstract(length: 10)])
     */
    if (attribute && attribute !== '@@fulltext' && isInsideAttribute(untrimmedCurrentLine, position, '[]')) {
      if (isInsideFieldArgument(untrimmedCurrentLine, position)) {
        // extendedIndexes
        const items: CompletionItem[] = []
        // https://www.notion.so/prismaio/Proposal-More-PostgreSQL-index-types-GiST-GIN-SP-GiST-and-BRIN-e27ef762ee4846a9a282eec1a5129270
        if (datasourceProvider === 'postgresql' && attribute === '@@index') {
          items.push({
            label: 'ops',
            insertText: 'ops: $0',
            insertTextFormat: InsertTextFormat.Snippet,
            kind: CompletionItemKind.Property,
            documentation: 'Specify the operator class for an indexed field.',
          })
        }

        items.push(
          ...filterSortLengthBasedOnInput(
            attribute,
            previewFeatures,
            datasourceProvider,
            wordBeforePosition,
            sortLengthProperties,
          ),
        )

        return {
          items,
          isIncomplete: false,
        }
      }

      const fieldsFromLine = getValuesInsideSquareBrackets(untrimmedCurrentLine)

      /*
       * MongoDB composite type fields, see https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#composite-type-unique-constraints
       * Examples
       * @@unique([address.|]) or @@unique(fields: [address.|])
       * @@index([address.|]) or @@index(fields: [address.|])
       */
      if (datasourceProvider === 'mongodb' && fieldsFromLine && firstWordBeforePosition.endsWith('.')) {
        const getFieldName = (text: string): string => {
          const [_, __, value] = new RegExp(/(.*\[)?(.+)/).exec(text) || []
          let name = value
          // Example for `@@index([email,address.|])` when there is no space between fields
          if (name?.includes(',')) {
            name = name.split(',').pop()!
          }
          // Remove . to only get the name
          if (name?.endsWith('.')) {
            name = name.slice(0, -1)
          }
          return name
        }

        const currentFieldName = getFieldName(firstWordBeforePosition)

        if (!currentFieldName) {
          return {
            isIncomplete: false,
            items: [],
          }
        }

        const currentCompositeAsArray = currentFieldName.split('.')
        const fieldTypesFromCurrentBlock = getFieldTypesFromCurrentBlock(lines, block)

        const fields = getCompositeTypeFieldsRecursively(lines, currentCompositeAsArray, fieldTypesFromCurrentBlock)
        return {
          items: toCompletionItems(fields, CompletionItemKind.Field),
          isIncomplete: false,
        }
      }

      let fieldsFromCurrentBlock = getFieldsFromCurrentBlock(lines, block, position)

      if (fieldsFromLine.length > 0) {
        // If we are in a composite type, exit here, to not pollute results with first level fields
        if (firstWordBeforePosition.includes('.')) {
          return {
            isIncomplete: false,
            items: [],
          }
        }

        // Remove items already used
        fieldsFromCurrentBlock = fieldsFromCurrentBlock.filter((s) => !fieldsFromLine.includes(s))

        // Return fields
        // `onCompletionResolve` will take care of filtering the partial matches
        if (
          firstWordBeforePosition !== '' &&
          !firstWordBeforePosition.endsWith(',') &&
          !firstWordBeforePosition.endsWith(', ')
        ) {
          return {
            items: toCompletionItems(fieldsFromCurrentBlock, CompletionItemKind.Field),
            isIncomplete: false,
          }
        }
      }

      return {
        items: toCompletionItems(fieldsFromCurrentBlock, CompletionItemKind.Field),
        isIncomplete: false,
      }
    }

    // "@@" block attributes
    let blockAtrributeArguments: CompletionItem[] = []
    if (attribute === '@@unique') {
      blockAtrributeArguments = givenBlockAttributeParams({
        blockAttribute: '@@unique',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    } else if (attribute === '@@id') {
      blockAtrributeArguments = givenBlockAttributeParams({
        blockAttribute: '@@id',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    } else if (attribute === '@@index') {
      blockAtrributeArguments = givenBlockAttributeParams({
        blockAttribute: '@@index',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    } else if (attribute === '@@fulltext') {
      blockAtrributeArguments = givenBlockAttributeParams({
        blockAttribute: '@@fulltext',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    }

    if (blockAtrributeArguments.length) {
      suggestions = blockAtrributeArguments
    } else {
      // "@" field attributes
      let fieldAtrributeArguments: CompletionItem[] = []
      if (attribute === '@unique') {
        fieldAtrributeArguments = givenFieldAttributeParams(
          '@unique',
          previewFeatures,
          datasourceProvider,
          wordBeforePosition,
        )
      } else if (attribute === '@id') {
        fieldAtrributeArguments = givenFieldAttributeParams(
          '@id',
          previewFeatures,
          datasourceProvider,
          wordBeforePosition,
        )
      }
      suggestions = fieldAtrributeArguments
    }
  }

  // Check which attributes are already present
  // so we can filter them out from the suggestions
  const attributesFound: Set<string> = new Set()

  for (const word of wordsBeforePosition) {
    if (word.includes('references')) {
      attributesFound.add('references')
    }
    if (word.includes('fields')) {
      attributesFound.add('fields')
    }
    if (word.includes('onUpdate')) {
      attributesFound.add('onUpdate')
    }
    if (word.includes('onDelete')) {
      attributesFound.add('onDelete')
    }
    if (word.includes('map')) {
      attributesFound.add('map')
    }
    if (word.includes('name') || /".*"/.exec(word)) {
      attributesFound.add('name')
      attributesFound.add('""')
    }
    if (word.includes('type')) {
      attributesFound.add('type')
    }
  }

  // now filter them out of the suggestions as they are already present
  const filteredSuggestions: CompletionItem[] = suggestions.reduce(
    (accumulator: CompletionItem[] & unknown[], sugg) => {
      let suggestionMatch = false
      for (const attribute of attributesFound) {
        if (sugg.label.includes(attribute)) {
          suggestionMatch = true
        }
      }

      if (!suggestionMatch) {
        accumulator.push(sugg)
      }

      return accumulator
    },
    [],
  )

  // nothing to present any more, return
  if (filteredSuggestions.length === 0) {
    return
  }

  return {
    items: filteredSuggestions,
    isIncomplete: false,
  }
}

export function getSuggestionsForInsideRoundBrackets(
  untrimmedCurrentLine: string,
  lines: string[],
  document: TextDocument,
  position: Position,
  block: Block,
): CompletionList | undefined {
  const wordsBeforePosition = untrimmedCurrentLine.slice(0, position.character).trimLeft().split(/\s+/)

  if (wordsBeforePosition.some((a) => a.includes('@default'))) {
    return {
      items: getDefaultValues({
        currentLine: lines[position.line],
        lines,
        wordsBeforePosition,
      }),
      isIncomplete: false,
    }
  } else if (wordsBeforePosition.some((a) => a.includes('@relation'))) {
    return getSuggestionsForAttribute({
      attribute: '@relation',
      wordsBeforePosition,
      untrimmedCurrentLine,
      lines,
      // document,
      block,
      position,
    })
  } else if (
    // matches
    // @id, @unique
    // @@id, @@unique, @@index, @@fulltext
    wordsBeforePosition.some(
      (a) => a.includes('@unique') || a.includes('@id') || a.includes('@@index') || a.includes('@@fulltext'),
    )
  ) {
    return getSuggestionsForAttribute({
      wordsBeforePosition,
      untrimmedCurrentLine,
      lines,
      // document,
      block,
      position,
    })
  } else {
    return {
      items: toCompletionItems([], CompletionItemKind.Field),
      isIncomplete: false,
    }
  }
}

export function getSuggestionsForImportPaths(
  document: TextDocument,
  currentLine: string,
  lineIndex: number,
): CompletionList | undefined {
  const schemaPaths = getAllSchemas().map((sc) => absoluteToRelativePath(document, sc.path))
  const firstQuotation = currentLine.indexOf('"')
  const lastQuotation = currentLine.lastIndexOf('"')

  if (firstQuotation === lastQuotation || firstQuotation === -1) {
    return undefined
  }

  return {
    items: schemaPaths.map((p) => ({
      kind: CompletionItemKind.File,
      label: p.replace('.prisma', ''),
      detail: p,
      textEdit: TextEdit.replace(
        Range.create(Position.create(lineIndex, firstQuotation + 1), Position.create(lineIndex, lastQuotation - 1)),
        p.replace('.prisma', ''),
      ),
    })),
    isIncomplete: false,
  }
}

export function getSuggestionsForImportBlocks(document: TextDocument, currentLine: string): CompletionList | undefined {
  const importPath = currentLine.match(/(?<=")(.*)(?=")/g)

  if (!importPath?.length) {
    return
  }

  const relativePath = importPath[0] + '.prisma'
  const absolutePath = relativeToAbsolutePath(document, relativePath)

  const schemaMatch = getAllSchemas().find((s) => s.path === absolutePath)

  if (!schemaMatch) {
    return
  }

  return {
    items: schemaMatch.blocks
      .filter((b) => ['enum', 'model', 'type', 'extend'].includes(b.type))
      .map((b) => ({
        kind: blockTypeToCompletionItemKind(b.type),
        label: b.name,
        detail: `${b.name} ${b.type}`,
        documentation: {
          kind: MarkupKind.Markdown,
          value: ['```prisma', schemaMatch.document.getText(b.range), '```'].join('\n'),
        },
      })),
    isIncomplete: false,
  }
}
