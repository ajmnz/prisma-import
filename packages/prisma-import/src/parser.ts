import { ParsedPrismaSchema } from './types'
import { readFile } from './util'

export async function parse(schemaPath: string): Promise<ParsedPrismaSchema> {
  const importPattern = /(import\s\{([^}]+)\} from ".+?")/g
  const datasourcePattern = /(datasource\s.+\{([^}]+)\})/g
  const generatorPattern = /(generator\s.+\{[^}]+\})/g
  const modelPattern = /(model\s(.+)\{[^}]+\})/g

  let content = await readFile(schemaPath, 'utf-8')

  const datasource = datasourcePattern.exec(content)?.[0] ?? ''
  const generators = Array.from(content.matchAll(generatorPattern)).map((g) => g[0])
  const imports = Array.from(content.matchAll(importPattern)).map((g) => g[0])
  const models = Array.from(content.matchAll(modelPattern)).map((g) => g[0])

  content = content.replace(importPattern, '').replace(generatorPattern, '').replace(datasource, '')

  return { imports, datasource, generators, models, content }
}
