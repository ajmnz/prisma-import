import { getPrismaConfigFromPackageJson } from '@prisma/internals'
import { PrismaImportConfig } from './types'
import fs from 'fs'
import path from 'path'
import _glob from 'glob'
import { promisify } from 'util'

export const stat = promisify(fs.stat)
export const readFile = promisify(fs.readFile)
export const mkdir = promisify(fs.mkdir)
export const writeFile = promisify(fs.writeFile)
export const glob = promisify(_glob)

/**
 * Determines if a path already exists. This is a replacement for `fs.exists`
 * which is deprecated.
 */
export async function exists(filePath: string) {
  try {
    await stat(filePath)
    return true
  } catch (error) {
    if (isErrnoException(error) && error.code == 'ENOENT') {
      return false
    }
    throw error
  }
}

function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return 'code' in (e as any)
}

/**
 * Given a file path ensures that the directories preceeding the file all exist
 * by creating those which don't.
 *
 * Example:
 * The path `/foo/bar/baz.txt` would ensure that `/foo/bar/` exists.
 */
export async function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath)
  if (!(await exists(dirname))) {
    await mkdir(dirname, { recursive: true })
  }
}

export const getConfigFromPackageJson = async (
  key: keyof NonNullable<PrismaImportConfig['import']>,
): Promise<string | undefined> => {
  const prismaConfig = (await getPrismaConfigFromPackageJson(process.cwd())) as {
    data: PrismaImportConfig | undefined
    packagePath: string
  } | null

  return prismaConfig?.data?.import?.[key]
}
