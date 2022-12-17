import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleRenameRequest } from '../MessageHandler'
import { WorkspaceEdit, RenameParams, Position } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertRename(expected: WorkspaceEdit, document: TextDocument, newName: string, position: Position): void {
  const params: RenameParams = {
    textDocument: document,
    newName: newName,
    position: position,
  }

  const renameResult: WorkspaceEdit | undefined = handleRenameRequest(params, document)

  assert.notStrictEqual(renameResult, undefined)
  assert.deepStrictEqual(renameResult, expected)
}

suite('Rename', () => {
  const renameModelPath = './rename/renameModel.prisma'
  const renameFieldPath = './rename/renameFields.prisma'
  const renameEnumPath = './rename/renameEnum.prisma'
  const renameFieldLargeSchemaPath = './rename/renameFieldLargeSchema.prisma'
  const renameModelWithJsonDefaultPath = './rename/renameModelWithJsonDefault.prisma'
  const renameMultipleModelsPath = './rename/renameMultipleModels.prisma'
  const renameModelBugPath = './rename/renameModelBug.prisma'

  const renameModel: TextDocument = getTextDocument(renameModelPath)
  const renameField: TextDocument = getTextDocument(renameFieldPath)
  const renameEnum: TextDocument = getTextDocument(renameEnumPath)
  const renameModelWithJsonDefault: TextDocument = getTextDocument(renameModelWithJsonDefaultPath)
  const renameFieldLargeSchema: TextDocument = getTextDocument(renameFieldLargeSchemaPath)
  const renameMultipleModels: TextDocument = getTextDocument(renameMultipleModelsPath)
  const renameModelBug: TextDocument = getTextDocument(renameModelBugPath)

  const newModelName = 'Customer'
  const newModelName2 = 'Posts'
  const newModelName3 = 'ArticleNew'

  const newFieldName = 'publisherId'
  const newFieldName2 = 'headline'
  const newFieldName3 = 'humanoidId'
  const newFieldName4 = 'AlbumFoo'

  const newEnumName = 'Function'
  const newEnumValue = 'A_VARIANT_WITHOUT_UNDERSCORES'

  test('Model', () => {
    assertRename(
      {
        changes: {
          [renameModel.uri]: [
            {
              newText: newModelName,
              range: {
                start: { line: 17, character: 6 },
                end: { line: 17, character: 10 },
              },
            },
            {
              newText: '\t@@map("User")\n}',
              range: {
                start: { line: 23, character: 0 },
                end: { line: 23, character: 1 },
              },
            },
            {
              newText: newModelName,
              range: {
                start: { line: 13, character: 12 },
                end: { line: 13, character: 16 },
              },
            },
          ],
        },
      },
      renameModel,
      newModelName,
      { line: 17, character: 10 },
    )
    assertRename(
      {
        changes: {
          [renameModel.uri]: [
            {
              newText: newModelName,
              range: {
                start: { line: 17, character: 6 },
                end: { line: 17, character: 10 },
              },
            },
            {
              newText: '\t@@map("User")\n}',
              range: {
                start: { line: 23, character: 0 },
                end: { line: 23, character: 1 },
              },
            },
            {
              newText: newModelName,
              range: {
                start: { line: 13, character: 12 },
                end: { line: 13, character: 16 },
              },
            },
          ],
        },
      },
      renameModel,
      newModelName,
      { line: 17, character: 9 },
    )
    assertRename(
      {
        changes: {
          [renameModel.uri]: [
            {
              newText: newModelName,
              range: {
                start: { line: 17, character: 6 },
                end: { line: 17, character: 10 },
              },
            },
            {
              newText: '\t@@map("User")\n}',
              range: {
                start: { line: 23, character: 0 },
                end: { line: 23, character: 1 },
              },
            },
            {
              newText: newModelName,
              range: {
                start: { line: 13, character: 12 },
                end: { line: 13, character: 16 },
              },
            },
          ],
        },
      },
      renameModel,
      newModelName,
      { line: 17, character: 8 },
    )
    assertRename(
      {
        changes: {
          [renameModel.uri]: [
            {
              newText: newModelName,
              range: {
                start: { line: 17, character: 6 },
                end: { line: 17, character: 10 },
              },
            },
            {
              newText: '\t@@map("User")\n}',
              range: {
                start: { line: 23, character: 0 },
                end: { line: 23, character: 1 },
              },
            },
            {
              newText: newModelName,
              range: {
                start: { line: 13, character: 12 },
                end: { line: 13, character: 16 },
              },
            },
          ],
        },
      },
      renameModel,
      newModelName,
      { line: 17, character: 6 },
    )
    assertRename(
      {
        changes: {
          [renameModel.uri]: [
            {
              newText: newModelName2,
              range: {
                start: { line: 9, character: 6 },
                end: { line: 9, character: 10 },
              },
            },
            {
              newText: '\t@@map("Post")\n}',
              range: {
                start: { line: 15, character: 0 },
                end: { line: 15, character: 1 },
              },
            },
            {
              newText: newModelName2,
              range: {
                start: { line: 21, character: 8 },
                end: { line: 21, character: 12 },
              },
            },
          ],
        },
      },
      renameModel,
      newModelName2,
      { line: 9, character: 10 },
    )
    assertRename(
      {
        changes: {
          [renameMultipleModels.uri]: [
            {
              newText: newModelName3,
              range: {
                start: { line: 6, character: 6 },
                end: { line: 6, character: 13 },
              },
            },
            {
              newText: '\t@@map("Article")\n}',
              range: {
                start: { line: 17, character: 0 },
                end: { line: 17, character: 1 },
              },
            },
            {
              newText: newModelName3,
              range: {
                start: { line: 2, character: 19 },
                end: { line: 2, character: 26 },
              },
            },
            {
              newText: newModelName3,
              range: {
                start: { line: 3, character: 19 },
                end: { line: 3, character: 26 },
              },
            },
          ],
        },
      },
      renameMultipleModels,
      newModelName3,
      { line: 6, character: 11 },
    )
    assertRename(
      {
        changes: {
          [renameModelBug.uri]: [
            {
              newText: newModelName,
              range: {
                start: { line: 6, character: 6 },
                end: { line: 6, character: 12 },
              },
            },
            {
              newText: '\t@@map("zaknos")\n}',
              range: {
                start: { line: 9, character: 0 },
                end: { line: 9, character: 1 },
              },
            },
          ],
        },
      },
      renameModelBug,
      newModelName,
      { line: 6, character: 12 },
    )
  })
  test('Model where it is used as type', () => {
    assertRename(
      {
        changes: {
          [renameModel.uri]: [
            {
              newText: newModelName2,
              range: {
                start: { line: 9, character: 6 },
                end: { line: 9, character: 10 },
              },
            },
            {
              newText: '\t@@map("Post")\n}',
              range: {
                start: { line: 15, character: 0 },
                end: { line: 15, character: 1 },
              },
            },
            {
              newText: newModelName2,
              range: {
                start: { line: 21, character: 8 },
                end: { line: 21, character: 12 },
              },
            },
          ],
        },
      },
      renameModel,
      newModelName2,
      { line: 21, character: 12 },
    )
  })
  test('Model with Json default attribute', () => {
    assertRename(
      {
        changes: {
          [renameModelWithJsonDefault.uri]: [
            {
              newText: newModelName,
              range: {
                start: { line: 17, character: 6 },
                end: { line: 17, character: 10 },
              },
            },
            {
              newText: '\t@@map("User")\n}',
              range: {
                start: { line: 24, character: 0 },
                end: { line: 24, character: 1 },
              },
            },
            {
              newText: newModelName,
              range: {
                start: { line: 13, character: 12 },
                end: { line: 13, character: 16 },
              },
            },
          ],
        },
      },
      renameModelWithJsonDefault,
      newModelName,
      { line: 17, character: 10 },
    )
  })
  test('Field not referenced in index block', () => {
    assertRename(
      {
        changes: {
          [renameFieldLargeSchema.uri]: [
            {
              newText: newFieldName4,
              range: {
                start: { line: 136, character: 2 },
                end: { line: 136, character: 7 },
              },
            },
            {
              newText: ' @map("Album")',
              range: {
                start: { line: 136, character: Number.MAX_VALUE },
                end: { line: 136, character: Number.MAX_VALUE },
              },
            },
          ],
        },
      },
      renameFieldLargeSchema,
      newFieldName4,
      { line: 136, character: 7 },
    )
  })
  test('Field rename on relation field does not add @map', () => {
    assertRename(
      {
        changes: {
          [renameFieldLargeSchema.uri]: [
            {
              newText: newFieldName,
              range: {
                start: { line: 137, character: 2 },
                end: { line: 137, character: 7 },
              },
            },
          ],
        },
      },
      renameFieldLargeSchema,
      newFieldName,
      { line: 137, character: 7 },
    )
  })
  test('Field referenced in @@id and @relation attributes', () => {
    assertRename(
      {
        changes: {
          [renameField.uri]: [
            {
              newText: newFieldName,
              range: {
                start: { line: 4, character: 4 },
                end: { line: 4, character: 12 },
              },
            },
            {
              newText: ' @map("authorId")',
              range: {
                start: { line: 4, character: Number.MAX_VALUE },
                end: { line: 4, character: Number.MAX_VALUE },
              },
            },
            {
              newText: newFieldName,
              range: {
                start: { line: 3, character: 41 },
                end: { line: 3, character: 49 },
              },
            },
            {
              newText: newFieldName,
              range: {
                start: { line: 5, character: 10 },
                end: { line: 5, character: 18 },
              },
            },
          ],
        },
      },
      renameField,
      newFieldName,
      { line: 4, character: 12 },
    )
  })
  // TODO?
  test('Field referenced in @@index attribute', () => {
    assertRename(
      {
        changes: {
          [renameField.uri]: [
            {
              newText: newFieldName2,
              range: {
                start: { line: 17, character: 2 },
                end: { line: 17, character: 7 },
              },
            },
            {
              newText: ' @map("title")',
              range: {
                start: { line: 17, character: Number.MAX_VALUE },
                end: { line: 17, character: Number.MAX_VALUE },
              },
            },
            {
              newText: newFieldName2,
              range: {
                start: { line: 19, character: 11 },
                end: { line: 19, character: 16 },
              },
            },
          ],
        },
      },
      renameField,
      newFieldName2,
      { line: 17, character: 7 },
    )
  })
  test('Field referenced in @@unique attribute and @relation attribute', () => {
    assertRename(
      {
        changes: {
          [renameField.uri]: [
            {
              newText: newFieldName3,
              range: {
                start: { line: 25, character: 2 },
                end: { line: 25, character: 9 },
              },
            },
            {
              newText: ' @map("humanId")',
              range: {
                start: { line: 25, character: Number.MAX_VALUE },
                end: { line: 25, character: Number.MAX_VALUE },
              },
            },
            {
              newText: newFieldName3,
              range: {
                start: { line: 24, character: 39 },
                end: { line: 24, character: 46 },
              },
            },
            {
              newText: newFieldName3,
              range: {
                start: { line: 28, character: 12 },
                end: { line: 28, character: 19 },
              },
            },
          ],
        },
      },
      renameField,
      newFieldName3,
      { line: 25, character: 9 },
    )
  })
  test('Enums', () => {
    assertRename(
      {
        changes: {
          [renameEnum.uri]: [
            {
              newText: newEnumName,
              range: {
                start: { line: 5, character: 5 },
                end: { line: 5, character: 9 },
              },
            },
            {
              newText: '\t@@map("Role")\n}',
              range: {
                start: { line: 9, character: 0 },
                end: { line: 9, character: 1 },
              },
            },
            {
              newText: newEnumName,
              range: {
                start: { line: 2, character: 7 },
                end: { line: 2, character: 11 },
              },
            },
          ],
        },
      },
      renameEnum,
      newEnumName,
      { line: 5, character: 9 },
    )
  })
  test('Enum Values', () => {
    assertRename(
      {
        changes: {
          [renameEnum.uri]: [
            {
              newText: newEnumValue,
              range: {
                start: { line: 8, character: 2 },
                end: { line: 8, character: 28 },
              },
            },
            {
              newText: ' @map("A_VARIANT_WITH_UNDERSCORES")',
              range: {
                start: { line: 8, character: Number.MAX_VALUE },
                end: { line: 8, character: Number.MAX_VALUE },
              },
            },
            {
              newText: `@default(${newEnumValue})`,
              range: {
                start: { line: 2, character: 12 },
                end: { line: 2, character: 48 },
              },
            },
          ],
        },
      },
      renameEnum,
      newEnumValue,
      { line: 8, character: 28 },
    )
  })
})
