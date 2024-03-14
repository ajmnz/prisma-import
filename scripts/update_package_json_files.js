const execa = require('execa')
const path = require('path')
const { writeJsonToPackageJson, getPackageJsonContent } = require('./util')

function bumpVersionInVSCodeRepo({ version, name, displayName, description, preview }) {
  const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')
  let content = getPackageJsonContent({ path: vscodePackageJsonPath })
  content['version'] = version
  content['name'] = name
  content['displayName'] = displayName
  content['description'] = description
  content['preview'] = preview
  writeJsonToPackageJson({ content: content, path: vscodePackageJsonPath })
}

function bumpLSVersionInExtension({ version }) {
  const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')
  let content = getPackageJsonContent({ path: vscodePackageJsonPath })
  content['dependencies']['@ajmnz/prisma-language-server'] = version
  writeJsonToPackageJson({ content: content, path: vscodePackageJsonPath })
}

function bumpVersionsInRepo({ channel, newExtensionVersion, newPrismaVersion = '' }) {
  const languageServerPackageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  const rootPackageJsonPath = path.join(__dirname, '../package.json')

  // update version in packages/vscode folder
  if (channel === 'dev' || channel === 'patch-dev') {
    throw new Error(`Channel '${channel}' not allowed`)
  } else {
    bumpVersionInVSCodeRepo({
      version: newExtensionVersion,
      name: 'prisma-import',
      displayName: 'Prisma Import',
      description: 'Adds import statements to your Prisma schemas',
      preview: false,
    })
  }

  // update dependency and engines versions in packages/language-server/package.json
  if (newPrismaVersion !== '') {
    ;(async () => {
      // Find the version needed for `@prisma/prisma-schema-wasm`
      // Let's look into the `package.json` of the `@prisma/engines` package
      // and get the version of `@prisma/engines-version` it uses
      const { stdout } = await execa('npm', ['show', `@prisma/engines@${newPrismaVersion}`, 'dependencies', '--json'])
      console.debug(stdout)
      const npmInfoOutput = JSON.parse(stdout)
      const engineVersion = npmInfoOutput['@prisma/engines-version'] // 2.26.0-23.9b816b3aa13cc270074f172f30d6eda8a8ce867d
      console.debug({ engineVersion })
      const engineSha = engineVersion.split('.')[3]
      console.debug({ engineSha })

      const languageServerPackageJson = getPackageJsonContent({
        path: languageServerPackageJsonPath,
      })
      // update engines sha
      languageServerPackageJson['prisma']['enginesVersion'] = engineSha
      // update engines version
      languageServerPackageJson['dependencies']['@prisma/prisma-schema-wasm'] = engineVersion
      // update CLI version
      languageServerPackageJson['prisma']['cliVersion'] = newPrismaVersion
      writeJsonToPackageJson({
        content: languageServerPackageJson,
        path: languageServerPackageJsonPath,
      })
    })()
  }

  // update version in root package.json
  let rootPackageJson = getPackageJsonContent({ path: rootPackageJsonPath })
  rootPackageJson['version'] = newExtensionVersion
  writeJsonToPackageJson({
    content: rootPackageJson,
    path: rootPackageJsonPath,
  })

  // update version in Language Server
  const lsPackageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  let lspPackageJson = getPackageJsonContent({ path: lsPackageJsonPath })
  lspPackageJson['version'] = newExtensionVersion
  writeJsonToPackageJson({ content: lspPackageJson, path: lsPackageJsonPath })
}

module.exports = { bumpVersionsInRepo }

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length === 3) {
    console.log('Bumping Prisma CLI version, extension and Language Server version in repo.')
    bumpVersionsInRepo({
      channel: args[0],
      newExtensionVersion: args[1],
      newPrismaVersion: args[2],
    })
  } else if (args.length === 2) {
    console.log('Bumping extension and Language Server version in repo.')
    bumpVersionsInRepo({
      channel: args[0],
      newExtensionVersion: args[1],
    })
  } else if (args.length === 1) {
    // only bump Language Server version in extension
    console.log('Bumping Language Server version in extension.')
    bumpLSVersionInExtension({
      version: args[0],
    })
  } else {
    throw new Error(`Expected 1, 2 or 3 arguments, but received ${args.length}.`)
  }
}
