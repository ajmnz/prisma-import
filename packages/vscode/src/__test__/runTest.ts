import path from 'path'
import { runTests } from '@vscode/test-electron'
// This is executed from dist like `node dist/src/__test__/runTest true`
const packageJson = require('../../../package.json') // eslint-disable-line

function test({ PRISMA_USE_LOCAL_LS, version }: { PRISMA_USE_LOCAL_LS: string; version?: string }) {
  // The folder containing the Extension Manifest package.json
  // Passed to `--extensionDevelopmentPath`
  const extensionDevelopmentPath = path.resolve(__dirname, '../../../')

  // The path to test runner
  // Passed to --extensionTestsPath
  const extensionTestsPath = path.resolve(__dirname, './index')

  // Downloads VS Code, unzip it and run the integration test
  return runTests({
    version, // optional, default = latest
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      // This disables all extensions except the one being testing
      '--disable-extensions',
    ],
    extensionTestsEnv: {
      PRISMA_USE_LOCAL_LS,
    },
  })
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2)
    // eslint-disable-next-line
    if (args.length < 1) {
      console.error('Expected one argument, but received none.')
      process.exit(1)
    }

    // 1 - Run on our minimum supported version from package.json
    // eslint-disable-next-line
    const minimumSupportedVersion: string = packageJson.engines.vscode.replace('~', '').replace('^', '') // remove semver chars
    console.log(`*** Testing on minimum supported version of VS Code: ${minimumSupportedVersion} ***`)
    await test({
      PRISMA_USE_LOCAL_LS: args[0],
      version: minimumSupportedVersion,
    })

    // 2 - Run again on latest version
    console.log(`*** Testing on latest version of VS Code ***`)
    await test({
      PRISMA_USE_LOCAL_LS: args[0],
    })
  } catch (err) {
    console.error('Failed to run tests')
    process.exit(1)
  }
}

main() // eslint-disable-line @typescript-eslint/no-floating-promises
