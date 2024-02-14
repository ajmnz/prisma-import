import { PrismaConfig } from '@prisma/internals/dist/cli/getSchema'

export interface PrismaImportConfig extends PrismaConfig {
  import?: {
    schemas?: string
    output?: string
    base?: string
  }
}
