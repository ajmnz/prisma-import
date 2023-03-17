import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleCompletionRequest } from '../MessageHandler'
import {
  CompletionList,
  CompletionParams,
  Position,
  CompletionItemKind,
  CompletionTriggerKind,
} from 'vscode-languageserver'
import assert from 'assert'
import dedent from 'ts-dedent'

/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-misused-promises */

type DatasourceProvider = 'sqlite' | 'postgresql' | 'mysql' | 'mongodb' | 'sqlserver' | 'cockroachdb'

const baseSchema = (provider?: DatasourceProvider, previewFeatures?: string[]) => {
  if (!provider && previewFeatures?.length === 0) {
    throw new Error(`provider and/or previewFeatures is required.`)
  }

  let base = ''
  if (provider) {
    base = /* Prisma */ `
  datasource db {
    provider = "${provider}"
    url      = env("DATABASE_URL")
  }`
  }

  if (previewFeatures?.length) {
    base += /* Prisma */ `
  generator js {
    provider        = "prisma-client-js"
    previewFeatures = ["${previewFeatures.join('","')}"]
  }`
  }

  return dedent(base)
}

function assertCompletion({
  provider,
  previewFeatures,
  schema,
  expected,
}: {
  provider?: DatasourceProvider
  previewFeatures?: string[]
  schema: string
  expected: CompletionList
}): void {
  const CURSOR_CHARACTER = '|'

  // Remove indentation
  schema = dedent(schema)

  if (provider || previewFeatures) {
    schema = `
    ${baseSchema(provider, previewFeatures)}
    ${schema}
    `
  }

  const findCursorPosition = (input: string): Position => {
    const lines = input.split('\n')

    let foundCursorCharacter = -1
    const foundLinePosition = lines.findIndex((line) => {
      const cursorPosition = line.indexOf(CURSOR_CHARACTER)
      if (cursorPosition !== -1) {
        foundCursorCharacter = cursorPosition
        return true
      }
    })

    if (foundLinePosition >= 0 && foundCursorCharacter >= 0) {
      return { line: foundLinePosition, character: foundCursorCharacter }
    }

    throw new Error(
      'Each test must include the `|` pipe character to signal where the cursor should be when executing the test.',
    )
  }

  const position = findCursorPosition(schema)
  const document: TextDocument = TextDocument.create(
    'completions/none.prisma',
    'prisma',
    1,
    schema.replace(CURSOR_CHARACTER, ''),
  )

  const completionParams: CompletionParams = {
    textDocument: document,
    position,
    context: {
      triggerKind: CompletionTriggerKind.Invoked,
    },
  }

  const completionResult: CompletionList | undefined = handleCompletionRequest(completionParams, document)

  assert.ok(completionResult !== undefined)

  assert.deepStrictEqual(
    completionResult.isIncomplete,
    expected.isIncomplete,
    `Line ${position.line} - Character ${position.character}
Expected isIncomplete to be '${expected.isIncomplete}' but got '${completionResult.isIncomplete}'`,
  )

  assert.deepStrictEqual(
    completionResult.items.map((item) => item.label),
    expected.items.map((item) => item.label),
    `Line ${position.line} - Character ${position.character}
mapped items => item.label`,
  )

  assert.deepStrictEqual(
    completionResult.items.map((item) => item.kind),
    expected.items.map((item) => item.kind),
    `Line ${position.line} - Character ${position.character}
mapped items => item.kind`,
  )

  assert.deepStrictEqual(
    completionResult.items.length,
    expected.items.length,
    `Line ${position.line} - Character ${position.character}
Expected ${expected.items.length} suggestions and got ${completionResult.items.length}: ${JSON.stringify(
      completionResult.items,
      undefined,
      2,
    )}`, // TODO: This is missing the output of `expected.items` so one can compare
  )

  assert.deepStrictEqual(
    completionResult.items.length,
    expected.items.length,
    `Line ${position.line} - Character ${position.character}
items.length`,
  )
}

suite('Completions', function () {
  // used in more than 1 suite
  const fieldProvider = {
    label: 'provider',
    kind: CompletionItemKind.Field,
  }
  const staticValueTrue = {
    label: 'true',
    kind: CompletionItemKind.Value,
  }
  const staticValueFalse = {
    label: 'false',
    kind: CompletionItemKind.Value,
  }
  const fieldsProperty = {
    label: 'fields',
    kind: CompletionItemKind.Property,
  }
  const mapProperty = {
    label: 'map',
    kind: CompletionItemKind.Property,
  }
  const sortProperty = {
    label: 'sort',
    kind: CompletionItemKind.Property,
  }
  const nameProperty = {
    label: 'name',
    kind: CompletionItemKind.Property,
  }

  suite('BASE BLOCKS', () => {
    test('Diagnoses block type suggestions for empty file', () => {
      assertCompletion({
        schema: /* Prisma */ `|`,
        expected: {
          isIncomplete: false,
          items: [
            { label: 'datasource', kind: CompletionItemKind.Class },
            { label: 'generator', kind: CompletionItemKind.Class },
            { label: 'model', kind: CompletionItemKind.Class },
            { label: 'import', kind: CompletionItemKind.Class },
            { label: 'enum', kind: CompletionItemKind.Class },
            { label: 'extend', kind: CompletionItemKind.Class },
          ],
        },
      })
    })

    test('Diagnoses block type suggestions with sqlite as provider', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          provider = "sqlite"
        }
        |
        `,
        expected: {
          isIncomplete: false,
          items: [
            { label: 'datasource', kind: CompletionItemKind.Class },
            { label: 'generator', kind: CompletionItemKind.Class },
            { label: 'model', kind: CompletionItemKind.Class },
            { label: 'import', kind: CompletionItemKind.Class },
            { label: 'enum', kind: CompletionItemKind.Class },
          ],
        },
      })
    })
  })

  suite('DATABASE BLOCK', () => {
    const fieldUrl = { label: 'url', kind: CompletionItemKind.Field }
    const fieldShadowDatabaseUrl = {
      label: 'shadowDatabaseUrl',
      kind: CompletionItemKind.Field,
    }
    const fieldRelationMode = {
      label: 'relationMode',
      kind: CompletionItemKind.Field,
    }
    const fieldPostgresqlExtensions = {
      label: 'extensions',
      kind: CompletionItemKind.Field,
    }

    const sqlite = { label: 'sqlite', kind: CompletionItemKind.Constant }
    const mysql = { label: 'mysql', kind: CompletionItemKind.Constant }
    const postgresql = {
      label: 'postgresql',
      kind: CompletionItemKind.Constant,
    }
    const sqlserver = {
      label: 'sqlserver',
      kind: CompletionItemKind.Constant,
    }
    const mongodb = { label: 'mongodb', kind: CompletionItemKind.Constant }
    const cockroachdb = {
      label: 'cockroachdb',
      kind: CompletionItemKind.Constant,
    }

    const relationModeForeignKeys = {
      label: 'foreignKeys',
      kind: CompletionItemKind.Field,
    }
    const relationModePrisma = {
      label: 'prisma',
      kind: CompletionItemKind.Field,
    }
    const relationModeForeignKeysWithQuotes = {
      label: '"foreignKeys"',
      kind: CompletionItemKind.Field,
    }
    const relationModePrismaWithQuotes = {
      label: '"prisma"',
      kind: CompletionItemKind.Field,
    }

    const quotationMarks = {
      label: '""',
      kind: CompletionItemKind.Property,
    }
    const envArgument = {
      label: 'DATABASE_URL',
      kind: CompletionItemKind.Constant,
    }
    const env = { label: 'env()', kind: CompletionItemKind.Property }

    test('Diagnoses datasource field suggestions in empty block', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          |
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldProvider, fieldUrl, fieldShadowDatabaseUrl, fieldRelationMode],
        },
      })
    })

    test('Diagnoses datasource field suggestions with existing field', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          provider = "sqlite"
          |
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldUrl, fieldShadowDatabaseUrl, fieldRelationMode],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          url      = env("DATABASE_URL")
          |      
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldProvider, fieldShadowDatabaseUrl, fieldRelationMode],
        },
      })
    })

    test('Diagnoses url argument suggestions for datasource block', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
            url = |
        }`,
        expected: {
          isIncomplete: true,
          items: [quotationMarks, env],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
            url = env("|")
        }`,
        expected: {
          isIncomplete: false,
          items: [envArgument],
        },
      })
    })

    test('Diagnoses field extension availability', () => {
      assertCompletion({
        schema: /* Prisma */ `
          generator client {
            previewFeatures = ["postgresqlExtensions"]
          }

          datasource db {
            provider = "postgresql"
            |
          }
        `,
        expected: {
          isIncomplete: false,
          items: [fieldUrl, fieldShadowDatabaseUrl, fieldRelationMode, fieldPostgresqlExtensions],
        },
      })
    })

    test('provider = "|"', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
         provider = "|"
        }`,
        expected: {
          isIncomplete: true,
          items: [mysql, postgresql, sqlite, sqlserver, mongodb, cockroachdb],
        },
      })
    })
    test('provider = |', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          provider = |
        }`,
        expected: {
          isIncomplete: true,
          items: [quotationMarks],
        },
      })
    })

    test('relationMode = "|"', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          provider = "sqlite"
          relationMode = "|"
        }`,
        expected: {
          isIncomplete: true,
          items: [relationModeForeignKeys, relationModePrisma],
        },
      })
    })
    test('relationMode = |', () => {
      assertCompletion({
        schema: /* Prisma */ `
        datasource db {
          relationMode = |
        }`,
        expected: {
          isIncomplete: true,
          items: [relationModeForeignKeysWithQuotes, relationModePrismaWithQuotes],
        },
      })
    })
  })

  suite('GENERATOR BLOCK', () => {
    // fieldProvider defined above already
    const fieldOutput = { label: 'output', kind: CompletionItemKind.Field }
    const fieldBinaryTargets = {
      label: 'binaryTargets',
      kind: CompletionItemKind.Field,
    }
    const fieldPreviewFeatures = {
      label: 'previewFeatures',
      kind: CompletionItemKind.Field,
    }
    const fieldEngineType = {
      label: 'engineType',
      kind: CompletionItemKind.Field,
    }

    test('Diagnoses generator field suggestions in empty block', () => {
      assertCompletion({
        schema: /* Prisma */ `
        generator gen {
          |
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldProvider, fieldOutput, fieldBinaryTargets, fieldPreviewFeatures, fieldEngineType],
        },
      })
    })

    test('Diagnoses generator field suggestions with existing fields', () => {
      assertCompletion({
        schema: /* Prisma */ `
          generator gen {
            provider = 'sqlite'
            |
          }`,
        expected: {
          isIncomplete: false,
          items: [fieldOutput, fieldBinaryTargets, fieldPreviewFeatures, fieldEngineType],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
          generator gen {
            output  = "node_modules/@prisma/client"
            |
          }`,
        expected: {
          isIncomplete: false,
          items: [fieldProvider, fieldBinaryTargets, fieldPreviewFeatures, fieldEngineType],
        },
      })
    })

    test('engineType = |', () => {
      assertCompletion({
        schema: /* Prisma */ `
          generator gen {
            engineType = |
          }`,
        expected: {
          isIncomplete: true,
          items: [
            {
              label: '""',
              kind: CompletionItemKind.Property,
            },
          ],
        },
      })
    })
    test('engineType = "|"', () => {
      assertCompletion({
        schema: /* Prisma */ `
          generator gen {
            engineType = "|"
          }`,
        expected: {
          isIncomplete: true,
          items: [
            {
              label: 'library',
              kind: CompletionItemKind.Constant,
            },
            {
              label: 'binary',
              kind: CompletionItemKind.Constant,
            },
            {
              label: 'dataproxy',
              kind: CompletionItemKind.Constant,
            },
          ],
        },
      })
    })
  })

  suite('BLOCK ATTRIBUTES', () => {
    const blockAttributeId = {
      label: '@@id',
      kind: CompletionItemKind.Property,
    }
    const blockAttributeMap = {
      label: '@@map',
      kind: CompletionItemKind.Property,
    }
    const blockAttributeUnique = {
      label: '@@unique',
      kind: CompletionItemKind.Property,
    }
    const blockAttributeIndex = {
      label: '@@index',
      kind: CompletionItemKind.Property,
    }
    const blockAttributeFulltextIndex = {
      label: '@@fulltext',
      kind: CompletionItemKind.Property,
    }
    const blockAttributeIgnore = {
      label: '@@ignore',
      kind: CompletionItemKind.Property,
    }
    const typeProperty = {
      label: 'type',
      kind: CompletionItemKind.Property,
    }

    test('@@id([|])', () => {
      assertCompletion({
        schema: /* Prisma */ `
              model ThirdUser {
                  firstName String
                  lastName String
                  isAdmin Boolean @default(false)
                  @@id([|])
              }`,
        expected: {
          isIncomplete: false,
          items: [
            { label: 'firstName', kind: CompletionItemKind.Field },
            { label: 'lastName', kind: CompletionItemKind.Field },
            { label: 'isAdmin', kind: CompletionItemKind.Field },
          ],
        },
      })
    })

    suite('First in a line', () => {
      test('Empty model', () => {
        assertCompletion({
          schema: /* Prisma */ `
          model user {
            |
          }`,
          expected: {
            isIncomplete: false,
            items: [
              blockAttributeMap,
              blockAttributeId,
              blockAttributeUnique,
              blockAttributeIndex,
              blockAttributeIgnore,
            ],
          },
        })
      })
      test('Model', () => {
        assertCompletion({
          schema: /* Prisma */ `
          model User {
            firstName String
            lastName String
            email String @unique
            isAdmin Boolean @default(false)
            |
          }`,
          expected: {
            isIncomplete: false,
            items: [
              blockAttributeMap,
              blockAttributeId,
              blockAttributeUnique,
              blockAttributeIndex,
              blockAttributeIgnore,
            ],
          },
        })
        assertCompletion({
          schema: /* Prisma */ `
          model Post {
            id Int @id @default()
            email String? @unique
            name String 
            |
          }`,
          expected: {
            isIncomplete: false,
            items: [blockAttributeMap, blockAttributeUnique, blockAttributeIndex, blockAttributeIgnore],
          },
        })
      })

      suite('fullTextIndex', () => {
        test('MySQL', () => {
          assertCompletion({
            provider: 'mysql',
            previewFeatures: ['fullTextIndex'],
            schema: /* Prisma */ `
          model Fulltext {
            id      Int    @id
            title   String @db.VarChar(255)
            content String @db.Text
            |
            @@fulltext()
            @@fulltext([title, content], )
          }          
          `,
            expected: {
              isIncomplete: false,
              items: [
                blockAttributeMap,
                // blockAttributeId,
                blockAttributeUnique,
                blockAttributeIndex,
                blockAttributeFulltextIndex,
                blockAttributeIgnore,
              ],
            },
          })
        })
        test('MongoDB', () => {
          assertCompletion({
            provider: 'mongodb',
            previewFeatures: ['fullTextIndex'],
            schema: /* Prisma */ `
          model Fulltext {
            id      String @id @map("_id") @db.ObjectId
            title   String
            content String
            |
            @@fulltext()
            @@fulltext([title, content], )
          }`,
            expected: {
              isIncomplete: false,
              items: [
                blockAttributeMap,
                // blockAttributeId,
                blockAttributeUnique,
                blockAttributeIndex,
                blockAttributeFulltextIndex,
                blockAttributeIgnore,
              ],
            },
          })
        })
        test('PostgreSQL', () => {
          assertCompletion({
            provider: 'postgresql',
            previewFeatures: ['fullTextIndex'],
            schema: /* Prisma */ `
            model A {
              id    Int @id
              title   String
              content String
              |
            }
          `,
            expected: {
              isIncomplete: false,
              items: [
                blockAttributeMap,
                // blockAttributeId,
                blockAttributeUnique,
                blockAttributeIndex,
                blockAttributeIgnore,
              ],
            },
          })
        })
      })
    })

    suite('@@unique()', function () {
      suite('No provider', function () {
        test('@@unique([|])', () => {
          assertCompletion({
            schema: /* Prisma */ `
          model SecondUser {
            firstName String
            lastName String
            isAdmin Boolean @default(false)
            @@unique([|])
        }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'firstName', kind: CompletionItemKind.Field },
                { label: 'lastName', kind: CompletionItemKind.Field },
                { label: 'isAdmin', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@unique(fields: [|])', () => {
          assertCompletion({
            schema: /* Prisma */ `
          model SecondUser {
            firstName String
            lastName String
            isAdmin Boolean @default(false)
            @@unique(fields: [|])
        }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'firstName', kind: CompletionItemKind.Field },
                { label: 'lastName', kind: CompletionItemKind.Field },
                { label: 'isAdmin', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
      })
      suite('MongoDB', function () {
        test('@@unique([|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@unique([|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
                { label: 'address', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@unique(fields: [|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@unique(fields: [|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
                { label: 'address', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
      })
    })

    suite('@@index()', function () {
      suite('No provider', function () {
        test('@@index([|])', () => {
          assertCompletion({
            schema: /* Prisma */ `
          model ThirdUser {
              firstName String
              lastName String
              isAdmin Boolean @default(false)
              @@index([|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'firstName', kind: CompletionItemKind.Field },
                { label: 'lastName', kind: CompletionItemKind.Field },
                { label: 'isAdmin', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index(fields: [|])', () => {
          assertCompletion({
            schema: /* Prisma */ `
          model ThirdUser {
              firstName String
              lastName String
              isAdmin Boolean @default(false)
              @@index(field: [|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'firstName', kind: CompletionItemKind.Field },
                { label: 'lastName', kind: CompletionItemKind.Field },
                { label: 'isAdmin', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
      })
      suite('MongoDB', function () {
        test('@@index([|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
                { label: 'address', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([a|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            account Int
            @@index([a|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                // These are returned, but `onCompletionResolve` will only complete with the current match
                // which means the completion will actually be
                // address and account
                // TODO create a test that shows that
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
                { label: 'address', kind: CompletionItemKind.Field },
                { label: 'account', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([address|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            account Int
            @@index([address|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                // These are returned though the completion will actually be
                // No suggestions
                // TODO create a test that shows that
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
                { label: 'account', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([address,|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([address,|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([address, |])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([address, |])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([address.|]) first position, with only one type', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([address.|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'street', kind: CompletionItemKind.Field },
                { label: 'number', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([address.|]) with composite type suggestion 1', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([address.|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'street', kind: CompletionItemKind.Field },
                { label: 'number', kind: CompletionItemKind.Field },
                { label: 'alpha', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([address.a|]) with composite type suggestion 1', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([address.a|])
          }`,
            expected: {
              isIncomplete: false,
              // TODO, see if we can have better suggestions here, should suggest `alpha`
              items: [],
            },
          })
        })
        test('@@index([email,address.|]) with composite type suggestion, depth 1', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([email,address.|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'street', kind: CompletionItemKind.Field },
                { label: 'number', kind: CompletionItemKind.Field },
                { label: 'alpha', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([email, address.|]) with composite type suggestion, depth 1', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([email, address.|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'street', kind: CompletionItemKind.Field },
                { label: 'number', kind: CompletionItemKind.Field },
                { label: 'alpha', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([email, address.alpha.|]) with composite type suggestion, depth 2', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([email, address.alpha.|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'bravo', kind: CompletionItemKind.Field },
                { label: 'helloA', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([email, address.alpha.bravo.|]) with composite type suggestion, depth 3', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([email, address.alpha.bravo.|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'something', kind: CompletionItemKind.Field },
                { label: 'helloBravo', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
        test('@@index([email, address.alpha.bravo.hello|]) with composite type suggestion, depth 3', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
            alpha  Alpha
          }
          type Alpha {
            bravo  Bravo
            helloA Int
          }
          type Bravo {
            something  String
            helloBravo Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index([email, address.alpha.bravo.hello||])
          }`,
            expected: {
              isIncomplete: false,
              // TODO, see if we can have better suggestions here, should suggest `helloBravo`
              items: [],
            },
          })
        })
        test('@@index(fields: [|])', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
          type Address {
            street String
            number Int
          }
          model User {
            id      Int     @id @map("_id")
            email   String
            address Address
            @@index(fields: [|])
          }`,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'id', kind: CompletionItemKind.Field },
                { label: 'email', kind: CompletionItemKind.Field },
                { label: 'address', kind: CompletionItemKind.Field },
              ],
            },
          })
        })
      })

      suite('extendedIndexes - PostgreSQL', function () {
        test('@@index(|)', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
          model A {
            id    Int @id
            title   String
            content String
            
            @@index(|)
          }
        `,
            expected: {
              isIncomplete: false,
              items: [fieldsProperty, mapProperty, typeProperty],
            },
          })
        })
        test('@@index([title], |) - postgresql', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
        model A {
          id    Int @id
          title   String
          content String
          
          @@index([title], |)
        }
      `,
            expected: {
              isIncomplete: false,
              items: [fieldsProperty, mapProperty, typeProperty],
            },
          })
        })
        test('@@index([title], type: |) - postgresql', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
        model A {
          id    Int @id
          title   String
          content String
          
          @@index([title], type: |)
        }
      `,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'BTree', kind: CompletionItemKind.Enum },
                { label: 'Hash', kind: CompletionItemKind.Enum },
                { label: 'Gist', kind: CompletionItemKind.Enum },
                { label: 'Gin', kind: CompletionItemKind.Enum },
                { label: 'SpGist', kind: CompletionItemKind.Enum },
                { label: 'Brin', kind: CompletionItemKind.Enum },
              ],
            },
          })
        })
        test('@@index([title], type: Hash, |) - postgresql', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
        model A {
          id    Int @id
          title   String
          content String
          
          @@index([title], type: Hash, |)
        }
      `,
            expected: {
              isIncomplete: false,
              items: [fieldsProperty, mapProperty],
            },
          })
        })
        test('@@index([title(|)]) - postgresql', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
        model A {
          id    Int @id
          title   String
          content String
          
          @@index([title(|)])
        }
      `,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'ops', kind: CompletionItemKind.Property },
                { label: 'sort', kind: CompletionItemKind.Property },
              ],
            },
          })
        })
        test('@@index([title(ops: |)]) - postgresql', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
        model A {
          id    Int @id
          title   String @db.Inet
          content String
          
          @@index([title(ops: |)])
        }
      `,
            expected: {
              isIncomplete: false,
              items: [{ label: 'raw', kind: CompletionItemKind.Function }],
            },
          })
        })
        test('@@index([title(ops: |)], type: Gist) - postgresql', () => {
          assertCompletion({
            provider: 'postgresql',
            schema: /* Prisma */ `
        model A {
          id    Int @id
          title   String @db.Inet
          content String
          
          @@index([title(ops: |)], type: Gist)
        }
      `,
            expected: {
              isIncomplete: false,
              items: [
                { label: 'InetOps', kind: CompletionItemKind.Enum },
                { label: 'raw', kind: CompletionItemKind.Function },
              ],
            },
          })
        })
      })
    })

    suite('@@fulltext()', function () {
      test('@@fulltext(|) - mysql', () => {
        assertCompletion({
          provider: 'mysql',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `
          model Fulltext {
            id      Int    @id
            title   String @db.VarChar(255)
            content String @db.Text
            
            @@fulltext(|)
            @@fulltext([title, content], )
          }          
          `,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
      test('@@fulltext([title, content], |) - mysql', () => {
        assertCompletion({
          provider: 'mysql',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `
          model Fulltext {
            id      Int    @id
            title   String @db.VarChar(255)
            content String @db.Text
            
            @@fulltext()
            @@fulltext([title, content], |)
          }          
          `,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })

      test('@@fulltext(|) - mongodb', () => {
        assertCompletion({
          provider: 'mongodb',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `
          model Fulltext {
            id      String @id @map("_id") @db.ObjectId
            title   String
            content String
            
            @@fulltext(|)
            @@fulltext([title, content], )
          }

          // https://www.prisma.io/docs/concepts/components/prisma-schema/indexes#examples
          // On MongoDB, the fullTextIndex and extendedIndexes preview features can be combined
          // to add fields in ascending or descending order to your full-text index:
          model Post {
            id      String @id @map("_id") @db.ObjectId
            title   String
            content String

            @@fulltext([title(sort: Desc), content])
          }
          `,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
      test('@@fulltext([title, content], |) - mongodb', () => {
        assertCompletion({
          provider: 'mongodb',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `

          model Fulltext {
            id      String @id @map("_id") @db.ObjectId
            title   String
            content String
            
            @@fulltext()
            @@fulltext([title, content], |)
          }

          // https://www.prisma.io/docs/concepts/components/prisma-schema/indexes#examples
          // On MongoDB, the fullTextIndex and extendedIndexes preview features can be combined
          // to add fields in ascending or descending order to your full-text index:
          model Post {
            id      String @id @map("_id") @db.ObjectId
            title   String
            content String

            @@fulltext([title(sort: Desc), content])
          }
          `,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
    })
  })

  suite('TYPES', () => {
    test('Diagnoses type suggestions in model - No datasource', () => {
      assertCompletion({
        schema: /* Prisma */ `
        model User {
            firstName String
            lastName String
            email String @unique
            isAdmin Boolean @default(false)
        }
        model Post {
            id Int @id @default()
            email String? @unique
            name String 
        }
        model Person {
            id String 
            name Post 
        }
        model Test {
          email    String  @unique
          isAdmin  Boolean @default()
        }
        model Cat {
            id String @id @default()
            name String
            createdAt  DateTime    @default()
        }
        model SecondUser {
            firstName String
            lastName String
            isAdmin Boolean @default(false)
            @@unique([])
        }
        model ThirdUser {
            firstName String
            lastName String
            isAdmin Boolean @default(false)
            @@id([])
            @@index([])
        }
        model TypeCheck {
          // Here!
            hi |
        }
        enum Hello {
            Hey
            Hallo
        }
        model DateTest {
            id Int @id @default(autoincrement())
            update DateTime  
            type UserType @default()
        }
        enum UserType {
            ADMIN
            NORMAL
        }
        model ForthUser {
            firstName String
            lastName String

            @@index([firstName, ])
            @@fulltext()
            @@fulltext([])
        }`,
        expected: {
          isIncomplete: true,
          items: [
            { label: 'String', kind: CompletionItemKind.TypeParameter },
            { label: 'Boolean', kind: CompletionItemKind.TypeParameter },
            { label: 'Int', kind: CompletionItemKind.TypeParameter },
            { label: 'Float', kind: CompletionItemKind.TypeParameter },
            { label: 'DateTime', kind: CompletionItemKind.TypeParameter },
            { label: 'Json', kind: CompletionItemKind.TypeParameter },
            { label: 'Bytes', kind: CompletionItemKind.TypeParameter },
            { label: 'Decimal', kind: CompletionItemKind.TypeParameter },
            { label: 'BigInt', kind: CompletionItemKind.TypeParameter },
            {
              label: 'Unsupported',
              kind: CompletionItemKind.TypeParameter,
            },
            { label: 'User', kind: CompletionItemKind.Reference },
            { label: 'Post', kind: CompletionItemKind.Reference },
            { label: 'Person', kind: CompletionItemKind.Reference },
            { label: 'Test', kind: CompletionItemKind.Reference },
            { label: 'Cat', kind: CompletionItemKind.Reference },
            { label: 'SecondUser', kind: CompletionItemKind.Reference },
            { label: 'ThirdUser', kind: CompletionItemKind.Reference },
            { label: 'TypeCheck', kind: CompletionItemKind.Reference },
            { label: 'Hello', kind: CompletionItemKind.Reference },
            { label: 'DateTest', kind: CompletionItemKind.Reference },
            { label: 'UserType', kind: CompletionItemKind.Reference },
            { label: 'ForthUser', kind: CompletionItemKind.Reference },
          ],
        },
      })
    })
    // TODO should suggest `MyType`?
    test('Diagnoses type suggestions in model - MongoDB', () => {
      assertCompletion({
        provider: 'mongodb',
        schema: /* Prisma */ `
        model Post {
          something |
        }
        enum PostType {
          ADMIN
          NORMAL
        }
        model Something {
          id Int @id @default() @map("_id") @db.ObjectId
        }
        type MyType {
          text String
        }
      `,
        expected: {
          isIncomplete: true,
          items: [
            { label: 'String', kind: CompletionItemKind.TypeParameter },
            { label: 'Boolean', kind: CompletionItemKind.TypeParameter },
            { label: 'Int', kind: CompletionItemKind.TypeParameter },
            { label: 'Float', kind: CompletionItemKind.TypeParameter },
            { label: 'DateTime', kind: CompletionItemKind.TypeParameter },
            { label: 'Json', kind: CompletionItemKind.TypeParameter },
            { label: 'Bytes', kind: CompletionItemKind.TypeParameter },
            { label: 'BigInt', kind: CompletionItemKind.TypeParameter },
            {
              label: 'Unsupported',
              kind: CompletionItemKind.TypeParameter,
            },
            { label: 'Post', kind: CompletionItemKind.Reference },
            { label: 'PostType', kind: CompletionItemKind.Reference },
            { label: 'Something', kind: CompletionItemKind.Reference },
          ],
        },
      })
    })
    test('Diagnoses type suggestions in model - SQLite, PostgreSQL, MySQL, SQL Server, CockroachDB', () => {
      for (const provider of ['sqlite', 'postgresql', 'mysql', 'sqlserver', 'cockroachdb']) {
        console.info(`provider = ${provider}`)
        assertCompletion({
          provider: provider as DatasourceProvider,
          schema: /* Prisma */ `
            model Post {
              something |
            }
            enum PostType {
              ADMIN
              NORMAL
            }
            model Something {
              id Int @id
            }
          `,
          expected: {
            isIncomplete: true,
            items: [
              { label: 'String', kind: CompletionItemKind.TypeParameter },
              { label: 'Boolean', kind: CompletionItemKind.TypeParameter },
              { label: 'Int', kind: CompletionItemKind.TypeParameter },
              { label: 'Float', kind: CompletionItemKind.TypeParameter },
              { label: 'DateTime', kind: CompletionItemKind.TypeParameter },
              { label: 'Json', kind: CompletionItemKind.TypeParameter },
              { label: 'Bytes', kind: CompletionItemKind.TypeParameter },
              { label: 'Decimal', kind: CompletionItemKind.TypeParameter },
              { label: 'BigInt', kind: CompletionItemKind.TypeParameter },
              {
                label: 'Unsupported',
                kind: CompletionItemKind.TypeParameter,
              },
              { label: 'Post', kind: CompletionItemKind.Reference },
              { label: 'PostType', kind: CompletionItemKind.Reference },
              { label: 'Something', kind: CompletionItemKind.Reference },
            ],
          },
        })
      }
    })
  })

  suite('NATIVE TYPES', () => {
    suite('CockroachDB', () => {
      test('String', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something String @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Bit()', kind: CompletionItemKind.TypeParameter },
              { label: 'Char()', kind: CompletionItemKind.TypeParameter },
              { label: 'Inet', kind: CompletionItemKind.TypeParameter },
              { label: 'CatalogSingleChar', kind: CompletionItemKind.TypeParameter },
              { label: 'String()', kind: CompletionItemKind.TypeParameter },
              { label: 'Uuid', kind: CompletionItemKind.TypeParameter },
              { label: 'VarBit()', kind: CompletionItemKind.TypeParameter },
            ],
          },
        })
      })
      test('Boolean', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something Boolean @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [{ label: 'Bool', kind: CompletionItemKind.TypeParameter }],
          },
        })
      })
      test('Int', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something Int @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Int2', kind: CompletionItemKind.TypeParameter },
              { label: 'Int4', kind: CompletionItemKind.TypeParameter },
              { label: 'Oid', kind: CompletionItemKind.TypeParameter },
            ],
          },
        })
      })
      test('Float', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something Float @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Float4', kind: CompletionItemKind.TypeParameter },
              { label: 'Float8', kind: CompletionItemKind.TypeParameter },
            ],
          },
        })
      })
      test('DateTime', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something DateTime @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Date', kind: CompletionItemKind.TypeParameter },
              { label: 'Time()', kind: CompletionItemKind.TypeParameter },
              { label: 'Timestamp()', kind: CompletionItemKind.TypeParameter },
              { label: 'Timestamptz()', kind: CompletionItemKind.TypeParameter },
              { label: 'Timetz()', kind: CompletionItemKind.TypeParameter },
            ],
          },
        })
      })
      test('Json', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something Json @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [{ label: 'JsonB', kind: CompletionItemKind.TypeParameter }],
          },
        })
      })
      test('Diagnoses Native Types suggestions - CockroachDB - Bytes', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something Bytes @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [{ label: 'Bytes', kind: CompletionItemKind.TypeParameter }],
          },
        })
      })
      test('Decimal', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something Decimal @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [{ label: 'Decimal()', kind: CompletionItemKind.TypeParameter }],
          },
        })
      })
      test('BigInt', () => {
        assertCompletion({
          provider: 'cockroachdb',
          schema: /* Prisma */ `
        model Post {
          something BigInt @db.|
        }
      `,
          expected: {
            isIncomplete: false,
            items: [{ label: 'Int8', kind: CompletionItemKind.TypeParameter }],
          },
        })
      })
    })
  })

  suite('FIELD ATTRIBUTES', () => {
    const fieldAttributeId = {
      label: '@id',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeUnique = {
      label: '@unique',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeMap = {
      label: '@map',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeDefault = {
      label: '@default',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeRelation = {
      label: '@relation',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeUpdatedAt = {
      label: '@updatedAt',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeIgnore = {
      label: '@ignore',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeDatasourceName = {
      label: '@db',
      kind: CompletionItemKind.Property,
    }

    const functionCuid = {
      label: 'cuid()',
      kind: CompletionItemKind.Function,
    }
    const functionUuid = {
      label: 'uuid()',
      kind: CompletionItemKind.Function,
    }
    const functionAuto = {
      label: 'auto()',
      kind: CompletionItemKind.Function,
    }
    const functionSequence = {
      label: 'sequence()',
      kind: CompletionItemKind.Function,
    }
    const functionAutoincrement = {
      label: 'autoincrement()',
      kind: CompletionItemKind.Function,
    }
    const functionNow = {
      label: 'now()',
      kind: CompletionItemKind.Function,
    }
    const functionDbGenerated = {
      label: 'dbgenerated("")',
      kind: CompletionItemKind.Function,
    }

    const staticValueEmptyList = {
      label: '[]',
      kind: CompletionItemKind.Value,
    }
    const enumValueOne = {
      label: 'ADMIN',
      kind: CompletionItemKind.Value,
    }
    const enumValueTwo = {
      label: 'NORMAL',
      kind: CompletionItemKind.Value,
    }

    const referencesProperty = {
      label: 'references',
      kind: CompletionItemKind.Property,
    }
    const onDeleteProperty = {
      label: 'onDelete',
      kind: CompletionItemKind.Property,
    }
    const onUpdateProperty = {
      label: 'onUpdate',
      kind: CompletionItemKind.Property,
    }
    const nameQuotesProperty = {
      label: '""',
      kind: CompletionItemKind.Property,
    }
    const lengthProperty = {
      label: 'length',
      kind: CompletionItemKind.Property,
    }

    // sequence()
    const minValueProperty = {
      label: 'minValue',
      kind: CompletionItemKind.Property,
    }
    const maxValueProperty = {
      label: 'maxValue',
      kind: CompletionItemKind.Property,
    }
    const cacheProperty = {
      label: 'cache',
      kind: CompletionItemKind.Property,
    }
    const incrementProperty = {
      label: 'increment',
      kind: CompletionItemKind.Property,
    }
    const startProperty = {
      label: 'start',
      kind: CompletionItemKind.Property,
    }
    const virtualProperty = {
      label: 'virtual',
      kind: CompletionItemKind.Property,
    }

    const asc = {
      label: 'Asc',
      kind: CompletionItemKind.Enum,
    }
    const desc = {
      label: 'Desc',
      kind: CompletionItemKind.Enum,
    }

    test('Diagnoses field and block attribute suggestions', () => {
      assertCompletion({
        schema: /* Prisma */ `
          model Post {
            id Int @id @default()
            email String? @unique
            name String 
          }

          model Person {
              id String |
              name Post 
          }`,
        expected: {
          isIncomplete: false,
          items: [
            fieldAttributeId,
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeIgnore,
          ],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
          model Post {
            id Int @id @default()
            email String? @unique
            name String 
          }

          model Person {
              id String 
              name Post |
          }`,
        expected: {
          isIncomplete: false,
          items: [
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeIgnore,
          ],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
          model DateTest {
            id Int @id @default(autoincrement())
            update DateTime |
            type UserType @default()
          }

          enum UserType {
            ADMIN
            NORMAL
          }`,
        expected: {
          isIncomplete: false,
          items: [
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeUpdatedAt,
            fieldAttributeIgnore,
          ],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
            model Post {
                id Int @id @default()
                email String? @unique
                name String |
            }`,
        expected: {
          isIncomplete: false,
          items: [
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeIgnore,
          ],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
          model ForthUser {
            firstName String
            lastName String

            @@index([firstName, |])
          }`,
        expected: {
          isIncomplete: false,
          items: [{ label: 'lastName', kind: CompletionItemKind.Field }],
        },
      })
      assertCompletion({
        provider: 'postgresql',
        schema: /* Prisma */ `
          model Post {
            id Int @id @default() @map("foobar")
            email String? @unique
            name String |
          }`,
        expected: {
          isIncomplete: false,
          items: [
            fieldAttributeDatasourceName,
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeIgnore,
          ],
        },
      })
      assertCompletion({
        schema: /* Prisma */ `
          model Post {
            id Int @id @default()
            email String? @unique
            name String @map("_name")|
          }
        `,
        expected: {
          isIncomplete: false,
          items: [fieldAttributeUnique, fieldAttributeDefault, fieldAttributeRelation, fieldAttributeIgnore],
        },
      })
    })

    const enumUserTypeExpectedItems = [
      fieldAttributeId,
      fieldAttributeUnique,
      fieldAttributeMap,
      fieldAttributeDefault,
      fieldAttributeRelation,
      fieldAttributeIgnore,
    ]
    test('enum UserType |', () => {
      assertCompletion({
        schema: /* Prisma */ `
        model DateTest {
          enum UserType |
        }
        enum UserType {
          ADMIN
          NORMAL
        }`,
        expected: {
          isIncomplete: false,
          items: enumUserTypeExpectedItems,
        },
      })
    })
    test('enum UserType | with 1 commented field', () => {
      assertCompletion({
        schema: /* Prisma */ `
        model DateTest {
          // id Int @id @default()
          enum UserType |
        }
        enum UserType {
          ADMIN
          NORMAL
        }`,
        expected: {
          isIncomplete: false,
          items: enumUserTypeExpectedItems,
        },
      })
    })

    test('field CompositeType |', () => {
      assertCompletion({
        provider: 'mongodb',
        schema: /* Prisma */ `
        model A {
          field CompositeType |
        }
        type CompositeType {
          someting String
        }`,
        expected: {
          isIncomplete: false,
          items: [
            fieldAttributeDatasourceName,
            fieldAttributeUnique,
            fieldAttributeMap,
            // fieldAttributeDefault, is invalid
            // fieldAttributeRelation, is invalid
            fieldAttributeIgnore,
          ],
        },
      })
    })

    suite('@default()', function () {
      test('Scalar lists', () => {
        const scalarTypes = ['String', 'color', 'Int', 'Float', 'Boolean', 'DateTime'] as const

        for (const scalarType of scalarTypes) {
          assertCompletion({
            schema: /* Prisma */ `
              model Test {
                id    Int             @id
                lists ${scalarType}[] @default(|)
              }
              
              enum color {
                RED
                GREEN
                BLUE
              }
              `,
            expected: {
              isIncomplete: false,
              items: [staticValueEmptyList, functionDbGenerated],
            },
          })
        }
      })

      suite('No provider', function () {
        test('Int @id @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                    model Post {
                        id Int @id @default(|)
                        email String? @unique
                        name String 
                    }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionAutoincrement],
            },
          })
        })
        test('BigInt @id @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                    model Post {
                        id BigInt @id @default(|)
                        email String? @unique
                        name String 
                    }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionAutoincrement],
            },
          })
        })
        test('String @id @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                  model Cat {
                    id String @id @default(|)
                    name String
                    createdAt  DateTime @default()
                }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionUuid, functionCuid],
            },
          })
        })
        test('DateTime @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                  model Cat {
                    id String @id @default()
                    name String
                    createdAt  DateTime @default(|)
                }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionNow],
            },
          })
        })
        test('Boolean @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                  model Test {
                    email    String  @unique
                    isAdmin  Boolean @default(|)
                  }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, staticValueTrue, staticValueFalse],
            },
          })
        })
        test('Enum @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                  model DateTest {
                    id Int @id @default(autoincrement())
                    update DateTime  
                    enum UserType @default(|)
                  }
                  enum UserType {
                    ADMIN
                    NORMAL
                  }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, enumValueOne, enumValueTwo],
            },
          })
        })
        test('Enum @default(|) (enum with comments)', () => {
          assertCompletion({
            schema: /* Prisma */ `
              model Test {
                id Int @id
                enum CommentEnum @default(|)
              }
              enum CommentEnum {
                ADMIN
                NORMAL
              }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, enumValueOne, enumValueTwo],
            },
          })
        })
      })
      suite('MongoDB', function () {
        test('String @id @default(|)', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
            model Post {
              id       String   @id @default(|) @map("_id") @db.ObjectId
            }`,
            expected: {
              isIncomplete: false,
              items: [functionAuto, functionUuid, functionCuid],
            },
          })
        })
        test('Int @id @default(|)', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
            model Something {
              id Int @id @default(|) @map("_id") @db.ObjectId
            }`,
            expected: {
              isIncomplete: false,
              items: [functionAuto, functionAutoincrement],
            },
          })
        })
        test('BigInt @id @default(|)', () => {
          assertCompletion({
            schema: /* Prisma */ `
                    model Post {
                        id BigInt @id @default(|)
                        email String? @unique
                        name String 
                    }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionAutoincrement],
            },
          })
        })
        test('String @default(|)', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
            model Post {
              string   String   @default(|)
            }`,
            expected: {
              isIncomplete: false,
              items: [functionAuto, functionUuid, functionCuid],
            },
          })
        })
        test('Boolean @default(|)', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
            model Post {
              boolean  Boolean  @default(|)
            }`,
            expected: {
              isIncomplete: false,
              items: [functionAuto, staticValueTrue, staticValueFalse],
            },
          })
        })
        test('DateTime @default(|)', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
            model Post {
              datetime DateTime @default(|)
            }`,
            expected: {
              isIncomplete: false,
              items: [functionAuto, functionNow],
            },
          })
        })
        test('Enum @default(|)', () => {
          assertCompletion({
            provider: 'mongodb',
            schema: /* Prisma */ `
            model Post {
              enum     PostType @default(|)
            }
            enum PostType {
              ADMIN
              NORMAL
            }`,
            expected: {
              isIncomplete: false,
              items: [functionAuto, enumValueOne, enumValueTwo],
            },
          })
        })
      })
      suite('CockroachDB', function () {
        test('Int @id @default(|)', () => {
          assertCompletion({
            provider: 'cockroachdb',
            schema: /* Prisma */ `
                  model Post {
                      id Int @id @default(|)
                      email String? @unique
                      name String 
                  }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionSequence],
            },
          })
        })
        test('BigInt @id @default(|)', () => {
          assertCompletion({
            provider: 'cockroachdb',
            schema: /* Prisma */ `
                  model Post {
                      id BigInt @id @default(|)
                      email String? @unique
                      name String 
                  }`,
            expected: {
              isIncomplete: false,
              items: [functionDbGenerated, functionSequence, functionAutoincrement],
            },
          })
        })

        suite('@default(sequence())', function () {
          test('@default(sequence(|))', () => {
            assertCompletion({
              provider: 'cockroachdb',
              schema: /* Prisma */ `
              model Post {
                  id Int @id @default(sequence(|))
              }`,
              expected: {
                isIncomplete: false,
                items: [
                  virtualProperty,
                  minValueProperty,
                  maxValueProperty,
                  cacheProperty,
                  incrementProperty,
                  startProperty,
                ],
              },
            })
          })
          test('@default(sequence(virtual|))', () => {
            assertCompletion({
              provider: 'cockroachdb',
              schema: /* Prisma */ `
              model Post {
                  id Int @id @default(sequence(virtual|))
              }`,
              expected: {
                isIncomplete: false,
                items: [],
              },
            })
          })
          test('@default(sequence(min|))', () => {
            assertCompletion({
              provider: 'cockroachdb',
              schema: /* Prisma */ `
              model Post {
                  id Int @id @default(sequence(min|))
              }`,
              expected: {
                isIncomplete: false,
                // TODO create a test that shows that the completion is actually `minValue`
                // because of `onCompletionResolve`
                items: [
                  virtualProperty,
                  minValueProperty,
                  maxValueProperty,
                  cacheProperty,
                  incrementProperty,
                  startProperty,
                ],
              },
            })
          })
          test('@default(sequence(minValue: 10,|))', () => {
            assertCompletion({
              provider: 'cockroachdb',
              schema: /* Prisma */ `
              model Post {
                  id Int @id @default(sequence(minValue: 10,|))
              }`,
              expected: {
                isIncomplete: false,
                items: [maxValueProperty, cacheProperty, incrementProperty, startProperty],
              },
            })
          })
          test('@default(sequence(minValue: 10, |))', () => {
            assertCompletion({
              provider: 'cockroachdb',
              schema: /* Prisma */ `
              model Post {
                  id Int @id @default(sequence(minValue: 10, |))
              }`,
              expected: {
                isIncomplete: false,
                items: [maxValueProperty, cacheProperty, incrementProperty, startProperty],
              },
            })
          })
          test('@default(sequence(minValue: 10, maxValue: 39, |))', () => {
            assertCompletion({
              provider: 'cockroachdb',
              schema: /* Prisma */ `
              model Post {
                  id Int @id @default(sequence(minValue: 10, maxValue: 39, |))
              }`,
              expected: {
                isIncomplete: false,
                items: [cacheProperty, incrementProperty, startProperty],
              },
            })
          })
        })
      })
    })

    suite('@relation()', function () {
      test('@relation(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              referencesProperty,
              fieldsProperty,
              onDeleteProperty,
              onUpdateProperty,
              nameQuotesProperty,
              nameProperty,
              mapProperty,
            ],
          },
        })
      })
      test('@relation(references: [|])', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model Order {
              id Int @id @default(autoincrement())
              items OrderItem[]
              total Int
            }
            model OrderItemTwo {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(references: [|])
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'id', kind: CompletionItemKind.Field },
              { label: 'items', kind: CompletionItemKind.Field },
              { label: 'total', kind: CompletionItemKind.Field },
            ],
          },
        })
      })
      test('MongoDB: embedded m2m @relation(references: [|])', () => {
        assertCompletion({
          provider: 'mongodb',
          schema: /* Prisma */ `
            model Bar {
              id      Int   @id @map("_id")
              foo_ids Int[]
              foo     Foo[] @relation(fields: [foo_ids], references: [|])
            }
            model Foo {
              id      Int   @id @map("_id")
              bar_ids Int[]
              bar     Bar[] @relation(fields: [bar_ids], references: [id])
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'id', kind: CompletionItemKind.Field },
              { label: 'bar_ids', kind: CompletionItemKind.Field },
              { label: 'bar', kind: CompletionItemKind.Field },
            ],
          },
        })
      })
      test('@relation(references: [id], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(references: [id], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, onDeleteProperty, onUpdateProperty, nameQuotesProperty, nameProperty, mapProperty],
          },
        })
      })
      test('order Order @relation(fields: [orderId], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(fields: [orderId], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              referencesProperty,
              onDeleteProperty,
              onUpdateProperty,
              nameQuotesProperty,
              nameProperty,
              mapProperty,
            ],
          },
        })
      })
      // TODO fields shortcut fails
      // test('@relation([|])', () => {
      //   assertCompletion({
      //     schema: /* Prisma */ `
      //       model OrderItem {
      //         id Int @id @default(autoincrement())
      //         productName String
      //         productPrice Int
      //         quantity Int
      //         orderId Int
      //         order Order @relation([|])
      //       }`,
      //     expected: {
      //       isIncomplete: false,
      //       items: [
      //         { label: 'id', kind: CompletionItemKind.Field },
      //         { label: 'productName', kind: CompletionItemKind.Field },
      //         { label: 'productPrice', kind: CompletionItemKind.Field },
      //         { label: 'quantity', kind: CompletionItemKind.Field },
      //         { label: 'orderId', kind: CompletionItemKind.Field },
      //       ],
      //     },
      //   })
      // })
      test('@relation(fields: [|])', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(fields: [|])
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'id', kind: CompletionItemKind.Field },
              { label: 'productName', kind: CompletionItemKind.Field },
              { label: 'productPrice', kind: CompletionItemKind.Field },
              { label: 'quantity', kind: CompletionItemKind.Field },
              { label: 'orderId', kind: CompletionItemKind.Field },
            ],
          },
        })
      })
      test('@relation(fields: [orderId], references: [id], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id           Int    @id @default(autoincrement())
              productName  String
              productPrice Int
              quantity     Int
              orderId      Int
              order Order @relation(fields: [orderId], references: [id], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [onDeleteProperty, onUpdateProperty, nameQuotesProperty, nameProperty, mapProperty],
          },
        })
      })
      test('@relation(onDelete: |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(onDelete: |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'Restrict', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        })
      })
      test('@relation(onUpdate: |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(onUpdate: |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'Restrict', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        })
      })
      test('@relation(fields: [orderId], references: [id], onDelete: |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(fields: [orderId], references: [id], onDelete: |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'Restrict', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        })
      })

      // SQL Server datasource
      test('sqlserver: @relation(onDelete: |)', () => {
        assertCompletion({
          provider: 'sqlserver',
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(onDelete: |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        })
      })
      test('sqlserver: @relation(onUpdate: |)', () => {
        assertCompletion({
          provider: 'sqlserver',
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(onUpdate: |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        })
      })
      test('sqlserver: @relation(fields: [orderId], references: [id], onDelete: |)', () => {
        assertCompletion({
          provider: 'sqlserver',
          schema: /* Prisma */ `
            model OrderItem {
              id Int @id @default(autoincrement())
              productName String
              productPrice Int
              quantity Int
              orderId Int
              order Order @relation(fields: [orderId], references: [id], onDelete: |)
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        })
      })
    })

    suite('namedConstraints', function () {
      test('@id(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtId {
              orderId Int @id(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [mapProperty],
          },
        })
      })
      test('@@id(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtIdEmpty {
              something Int
              orderId   Int
              @@id(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, nameProperty, mapProperty],
          },
        })
      })
      test('@@id([orderId, something], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtId {
              something Int
              orderId   Int
              @@id([orderId, something], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, nameProperty, mapProperty],
          },
        })
      })
      test('extendedIndexes: @id(|)', () => {
        assertCompletion({
          provider: 'mysql',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `
          model Id {
            id String @id(|) @db.VarChar(3000)
          }  
          `,
          expected: {
            isIncomplete: false,
            items: [mapProperty, lengthProperty],
          },
        })
      })
      test('extendedIndexes: @@id([title(length: 100, |), abstract()])', () => {
        assertCompletion({
          provider: 'mysql',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `
          model Fulltext {
            id      Int    @id
            title   String @db.VarChar(255)
            content String @db.Text
            
            @@fulltext()
            @@fulltext([title, content], )
          }
          model Id {
            id String @id() @db.VarChar(3000)
          }
          model IdWithLength {
            id String @id(length: 100) @db.VarChar(3000)
          }
          model Unique {
            unique Int @unique()
          }
          model CompoundId {
            id_1 String @db.VarChar(3000)
            id_2 String @db.VarChar(3000)
          
            @@id([id_1(length: 100), id_2(length: 10)])
          }
          model CompoundUnique {
            unique_1 Int
            unique_2 Int
          
            @@unique([unique_1(sort: Desc), unique_2])
          }
          model Post {
            title      String   @db.VarChar(300)
            abstract   String   @db.VarChar(3000)
            slug       String   @unique(sort: , length: 42) @db.VarChar(3000)
            slug2      String   @unique() @db.VarChar(3000)
            author     String
            created_at DateTime
          
            @@id([title(length: 100, |), abstract()])
            @@index([author, created_at(sort: )])
            @@index([author, ])
            @@index([])
          }
          `,
          expected: {
            isIncomplete: false,
            items: [lengthProperty],
          },
        })
      })
      test('extendedIndexes: @@id([title(length: 100, ), abstract(|)])', () => {
        assertCompletion({
          provider: 'mysql',
          previewFeatures: ['fullTextIndex'],
          schema: /* Prisma */ `
          model Fulltext {
            id      Int    @id
            title   String @db.VarChar(255)
            content String @db.Text
            
            @@fulltext()
            @@fulltext([title, content], )
          }
          model Id {
            id String @id() @db.VarChar(3000)
          }
          model IdWithLength {
            id String @id(length: 100) @db.VarChar(3000)
          }
          model Unique {
            unique Int @unique()
          }
          model CompoundId {
            id_1 String @db.VarChar(3000)
            id_2 String @db.VarChar(3000)
          
            @@id([id_1(length: 100), id_2(length: 10)])
          }
          model CompoundUnique {
            unique_1 Int
            unique_2 Int
          
            @@unique([unique_1(sort: Desc), unique_2])
          }
          model Post {
            title      String   @db.VarChar(300)
            abstract   String   @db.VarChar(3000)
            slug       String   @unique(sort: , length: 42) @db.VarChar(3000)
            slug2      String   @unique() @db.VarChar(3000)
            author     String
            created_at DateTime
          
            @@id([title(length: 100, ), abstract(|)])
          }
          `,
          expected: {
            isIncomplete: false,
            items: [lengthProperty],
          },
        })
      })

      test('@unique(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtUnique {
              email String @unique(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [mapProperty, sortProperty],
          },
        })
      })
      test('@@unique(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtUniqueEmpty {
              something Int
              email     String
              @@unique(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, nameProperty, mapProperty],
          },
        })
      })
      test('@@unique([email, something], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtUnique {
              something Int
              email     String
              @@unique([email, something], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, nameProperty, mapProperty],
          },
        })
      })
      test('extendedIndexes: @unique(|)', () => {
        assertCompletion({
          provider: 'mysql',
          schema: /* Prisma */ `
            model Unique {
              unique Int @unique(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [mapProperty, lengthProperty, sortProperty],
          },
        })
      })
      test('extendedIndexes: @unique(sort: |)', () => {
        assertCompletion({
          provider: 'mysql',
          schema: /* Prisma */ `
            model Post {
              slug String @unique(sort: |, length: 42) @db.VarChar(3000)
            }`,
          expected: {
            isIncomplete: false,
            items: [asc, desc],
          },
        })
      })

      test('@@index(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtIndexEmpty {
              firstName String
              lastName  String
              email     String @unique
              @@index(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
      test('@@index([firstName, lastName], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtIndex {
              firstName String
              lastName String
              @@index([firstName, lastName], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
      test('extendedIndexes: @@index([author, created_at(sort: |)])', () => {
        assertCompletion({
          provider: 'mysql',
          schema: /* Prisma */ `
            model Post {
              title      String   @db.VarChar(300)
              @@index([author, created_at(sort: |)])
            }`,
          expected: {
            isIncomplete: false,
            items: [asc, desc],
          },
        })
      })
      test('extendedIndexes: @@index([author, |])', () => {
        assertCompletion({
          provider: 'mysql',
          schema: /* Prisma */ `
            model Post {
              title      String   @db.VarChar(300)
              abstract   String   @db.VarChar(3000)
              slug       String   @unique(length: 42) @db.VarChar(3000)
              slug2      String   @unique() @db.VarChar(3000)
              author     String
              created_at DateTime

              @@index([author, |])
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'title', kind: CompletionItemKind.Field },
              { label: 'abstract', kind: CompletionItemKind.Field },
              { label: 'slug', kind: CompletionItemKind.Field },
              { label: 'slug2', kind: CompletionItemKind.Field },
              // { label: 'author', kind: CompletionItemKind.Field },
              { label: 'created_at', kind: CompletionItemKind.Field },
            ],
          },
        })
      })
      test('extendedIndexes: @@index([|])', () => {
        assertCompletion({
          provider: 'mysql',
          schema: /* Prisma */ `
            model Post {
              title      String   @db.VarChar(300)
              abstract   String   @db.VarChar(3000)
              slug       String   @unique(length: 42) @db.VarChar(3000)
              slug2      String   @unique() @db.VarChar(3000)
              author     String
              created_at DateTime

              @@index([|])
            }`,
          expected: {
            isIncomplete: false,
            items: [
              { label: 'title', kind: CompletionItemKind.Field },
              { label: 'abstract', kind: CompletionItemKind.Field },
              { label: 'slug', kind: CompletionItemKind.Field },
              { label: 'slug2', kind: CompletionItemKind.Field },
              { label: 'author', kind: CompletionItemKind.Field },
              { label: 'created_at', kind: CompletionItemKind.Field },
            ],
          },
        })
      })
      test('@@fulltext(|)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtIndexEmpty {
              firstName String
              lastName  String
              email     String @unique
              @@index(|)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
      test('@@fulltext([firstName, lastName], |)', () => {
        assertCompletion({
          schema: /* Prisma */ `
            model AtAtIndex {
              firstName String
              lastName String
              @@index([firstName, lastName], |)
            }`,
          expected: {
            isIncomplete: false,
            items: [fieldsProperty, mapProperty],
          },
        })
      })
    })
  })

  suite('SQL Server: clustered', () => {
    const clusteredProperty = {
      label: 'clustered',
      kind: CompletionItemKind.Property,
    }

    /*
     * Block attributes
     */
    test('@@index([slug], |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String   @unique() @db.VarChar(3000)
          @@index([slug], |)
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldsProperty, mapProperty, clusteredProperty],
        },
      })
    })
    test('@@id([slug], |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String   @unique() @db.VarChar(3000)
          @@id([slug], |)
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldsProperty, nameProperty, mapProperty, clusteredProperty],
        },
      })
    })
    test('@@unique([slug], |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String   @unique() @db.VarChar(3000)
          @@unique([slug], |)
        }`,
        expected: {
          isIncomplete: false,
          items: [fieldsProperty, nameProperty, mapProperty, clusteredProperty],
        },
      })
    })

    /*
     * Field attributes
     */
    test('@id(|)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          unique Int @id(|)
        }`,
        expected: {
          isIncomplete: false,
          items: [mapProperty, sortProperty, clusteredProperty],
        },
      })
    })
    test('@unique(|)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String @unique(|) @db.VarChar(3000)
        }`,
        expected: {
          isIncomplete: false,
          items: [mapProperty, sortProperty, clusteredProperty],
        },
      })
    })

    /*
     * Values
     */
    test('@id(clustered: |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          unique Int @id(clustered: |)
        }`,
        expected: {
          isIncomplete: false,
          items: [staticValueTrue, staticValueFalse],
        },
      })
    })
    test('@unique(clustered: |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String  @unique(clustered: |) @db.VarChar(3000)
        }`,
        expected: {
          isIncomplete: false,
          items: [staticValueTrue, staticValueFalse],
        },
      })
    })
    test('@@index([slug], clustered: |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String   @unique() @db.VarChar(3000)
          @@index([slug], clustered: |)
        }`,
        expected: {
          isIncomplete: false,
          items: [staticValueTrue, staticValueFalse],
        },
      })
    })
    test('@@id([slug], clustered: |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String   @unique() @db.VarChar(3000)
          @@id([slug], clustered: |)
        }`,
        expected: {
          isIncomplete: false,
          items: [staticValueTrue, staticValueFalse],
        },
      })
    })
    test('@@unique([slug], clustered: |)', () => {
      assertCompletion({
        provider: 'sqlserver',
        schema: /* Prisma */ `
        model Post {
          slug      String   @unique() @db.VarChar(3000)
          @@unique([slug], clustered: |)
        }`,
        expected: {
          isIncomplete: false,
          items: [staticValueTrue, staticValueFalse],
        },
      })
    })
  })
})
