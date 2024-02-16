import path from 'path'
import { parse } from './parser'
import { ParsedPrismaSchema } from './types'

export const merge = async (schemaPaths: string[]): Promise<ParsedPrismaSchema> => {
  const outputContent: string[] = []
  const datasourceContent: string[] = []
  const generatorContent: string[] = []
  const modelContent: string[] = []

  for (const schemaPath of schemaPaths) {
    const { datasource, generators, content, models } = await parse(schemaPath)

    datasourceContent.push(datasource)
    generatorContent.push(...generators)
    modelContent.push(...models)

    outputContent.push('\n')
    outputContent.push('//')
    outputContent.push(`// ${path.basename(schemaPath)}`)
    outputContent.push('//')
    outputContent.push('\n')
    outputContent.push(content)
  }

  return {
    imports: [],
    datasource: datasourceContent.join('\n'),
    generators: generatorContent,
    content: outputContent.join('\n'),
    models: modelContent,
  }
}
