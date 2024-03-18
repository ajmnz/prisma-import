import { ParsedPrismaSchema } from './types'

export function findMissing(oldSchema: ParsedPrismaSchema, newSchema: ParsedPrismaSchema) {
  const { models: oldModels } = oldSchema
  const { models: newModels } = newSchema

  return oldModels.filter((m) => !newModels.includes(m))
}
