import { beforeEach, describe, expect, it } from '@jest/globals'
import { writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { parse } from './parser'

describe('parser', () => {
  beforeEach(async () => await createTestSchemas())

  it('should have no datasource', async () => {
    const schemaFile = resolve(tmpdir(), 'post.prisma')
    const datasource = ''

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.datasource).toEqual(datasource)
  })

  it('should have a datasource', async () => {
    const schemaFile = resolve(tmpdir(), 'app.prisma')
    const datasource = 'datasource db {\n    provider = "sqlite"\n    url      = env("DATABASE_URL")\n}'

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.datasource).toEqual(datasource)
  })

  it('should have no generators', async () => {
    const schemaFile = resolve(tmpdir(), 'post.prisma')
    const generators: string[] = []

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.generators).toEqual(generators)
  })

  it('should have a generator', async () => {
    const schemaFile = resolve(tmpdir(), 'app.prisma')
    const generators: string[] = ['generator client {\n    provider = "prisma-client-js"\n}']

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.generators).toEqual(generators)
  })

  it('should have multiple generators', async () => {
    const schemaFile = resolve(tmpdir(), 'app-multi-generator.prisma')
    const generators: string[] = [
      'generator client {\n    provider = "prisma-client-js"\n}',
      'generator client2 {\n    provider = "prisma-client-js"\n}',
    ]

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.generators).toEqual(generators)
  })

  it('should have an import', async () => {
    const schemaFile = resolve(tmpdir(), 'user.prisma')
    const imports: string[] = ['import { Post } from "post"']

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.imports).toEqual(imports)
  })

  it('should have multiple import', async () => {
    const schemaFile = resolve(tmpdir(), 'app.prisma')
    const imports: string[] = ['import { Post } from "post"', 'import { User } from "user"']

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.imports).toEqual(imports)
  })

  it('should have a model', async () => {
    const schemaFile = resolve(tmpdir(), 'post.prisma')
    const models: string[] = ['Post']

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.models).toEqual(models)
  })

  it('should have multiple model', async () => {
    const schemaFile = resolve(tmpdir(), 'multi-model.prisma')
    const models: string[] = ['User', 'Post']

    const parsedSchema = await parse(schemaFile)
    expect(parsedSchema.models).toEqual(models)
  })
})

async function createTestSchemas() {
  await createPrismaSchemaFile(
    `
import { User } from "user"

model Post {
    id       Int  @id @default(autoincrement())
    author   User @relation(fields: [authorId], references: [id])
    authorId Int
}
    `,
    resolve(tmpdir(), 'post.prisma'),
  )

  await createPrismaSchemaFile(
    `
import { Post } from "post"

model User {
    id @id @default(autoincrement())
    post Post[]
}
    `,
    resolve(tmpdir(), 'user.prisma'),
  )

  await createPrismaSchemaFile(
    `
import { Post } from "post"
import { User } from "user"

datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
}

generator client {
    provider = "prisma-client-js"
}
    `,
    resolve(tmpdir(), 'app.prisma'),
  )

  await createPrismaSchemaFile(
    `
import { Post } from "post"
import { User } from "user"

generator client {
    provider = "prisma-client-js"
}

datasource db {
    provider = "sqlite"
    url      = env("DATABASE_URL")
}

generator client2 {
    provider = "prisma-client-js"
}
    `,
    resolve(tmpdir(), 'app-multi-generator.prisma'),
  )

  await createPrismaSchemaFile(
    `
model User {
    id @id @default(autoincrement())
    post Post[]
}

model Post {
    id       Int  @id @default(autoincrement())
    author   User @relation(fields: [authorId], references: [id])
    authorId Int
}
    `,
    resolve(tmpdir(), 'multi-model.prisma'),
  )
}

async function createPrismaSchemaFile(content: string, filename: string) {
  await writeFile(filename, content)
}
