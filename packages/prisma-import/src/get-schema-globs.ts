import { asArray } from './util'

export function getSchemaGlobs(fromArgs?: string | string[], fromPackageJson?: string | string[]) {
  const globsFromArgs = asArray(fromArgs)
  const globsFromPackageJson = asArray(fromPackageJson)

  return globsFromArgs ?? globsFromPackageJson
}
