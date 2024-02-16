import { PrismaConfig } from '@prisma/internals/dist/cli/getSchema'

export interface PrismaImportConfig extends PrismaConfig {
  import?: {
    schemas?: string
    output?: string
    base?: string
  }
}

export interface ParsedPrismaSchema {
  imports: string[]
  datasource: string
  generators: string[]
  models: string[]
  content: string
}
