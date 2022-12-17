/**
 * Imports
 */
const packageJson = require('../../../package.json') // eslint-disable-line

/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

/**
 * Lookup version
 */
export function getVersion(): string {
  if (!packageJson || !packageJson.prisma || !packageJson.prisma.enginesVersion) {
    return 'latest'
  }
  return packageJson.prisma.enginesVersion
}

/**
 * Gets Engines Version from package.json, dependencies, `@prisma/prisma-fmt-wasm`
 * @returns Something like `2.26.0-23.9b816b3aa13cc270074f172f30d6eda8a8ce867d`
 */
export function getEnginesVersion(): string {
  return packageJson.dependencies['@prisma/prisma-fmt-wasm']
}

/**
 * Gets CLI Version from package.json, prisma, cliVersion
 * @returns Something like `2.27.0-dev.50`
 */
export function getCliVersion(): string {
  return packageJson.prisma.cliVersion
}
