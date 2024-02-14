import { readFile } from './util'
import { isAbsolute, resolve } from 'path'

export async function pathsFromBase(filePath: string, paths: Set<string> = new Set()): Promise<string[]> {
  const absoluteFilePath = isAbsolute(filePath) ? filePath : resolve(filePath)
  const importPaths = await identifyImports(absoluteFilePath)

  paths.add(absoluteFilePath)

  for (const importPath of importPaths) {
    const basePathWithoutFile = absoluteFilePath.replace(/\/[\w -]+?\.prisma$/, '/')
    const absoluteImportPath = isAbsolute(importPath) ? importPath : resolve(basePathWithoutFile, importPath)

    if (!paths.has(absoluteImportPath)) {
      const p = await pathsFromBase(absoluteImportPath, paths)

      paths.add(absoluteImportPath)
      p.forEach((s) => paths.add(s))
    }
  }

  return Array.from(paths.values())
}

async function identifyImports(file: string): Promise<string[]> {
  const content = await readFile(file, 'utf-8')
  const paths: string[] = content
    .split('\n')
    .map((line) => {
      const matches = /^(?<=\s*)(import\s*{.*)from "(.+)"/g.exec(line)

      if (matches?.[2]) {
        return `${matches[2]}.prisma`
      }

      return ''
    })
    .filter((m) => !!m)

  return paths
}
