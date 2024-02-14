#!/usr/bin/env node

import { arg, format } from '@prisma/internals'
import chalk from 'chalk'
import prompts from 'prompts'
import path from 'path'
import { exists, getConfigFromPackageJson, glob } from './util'
import { merge } from './merge'

const main = async () => {
  const args = arg(process.argv.slice(2), {
    '--schemas': [String],
    '-s': '--schemas',
    '--output': String,
    '-o': '--output',
    '--dry': Boolean,
    '-d': '--dry',
    '--help': Boolean,
    '-h': '--help',
    '--force': Boolean,
    '-f': '--force',
  })

  if (args instanceof Error) {
    throw args.message
  }

  if (args['--help']) {
    console.log(
      format(`
Compile all your schemas into one and replace all imports

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma-import [flags/options]

${chalk.bold('Flags')}

          -h, --help    Display this help message
          -d, --dry     Print the resulting schema to stdout
          -f, --force   Skip asking for confirmation on schema overwrite
          -o, --output  Specify where you want your resulting schema to be written
          -s, --schemas Specify where your schemas are using a glob pattern
    `),
    )

    process.exit(0)
  }

  //
  // Get glob
  //

  let schemasGlob = args['--schemas']

  if (!args['--schemas']) {
    const config = await getConfigFromPackageJson('schemas')
    schemasGlob = config ? [config] : undefined
  }

  if (!schemasGlob?.length) {
    throw new Error(
      'Provide a glob pattern to find your schemas. Either pass it with `--schemas` or add it to your package.json at `prisma.import.schemas`',
    )
  }

  const schemaPaths = (
    await Promise.all(
      schemasGlob.map(
        async (s) =>
          await glob(s, {
            cwd: process.cwd(),
          }),
      ),
    )
  ).flat()

  if (!schemaPaths.length) {
    throw new Error(`No schemas found using glob pattern \`${schemasGlob.join(', ')}\``)
  }

  //
  // Get output
  //

  let relativeOutputPath: string | undefined = args['--output']

  if (!args['--output']) {
    relativeOutputPath = await getConfigFromPackageJson('output')
  }

  if (!relativeOutputPath) {
    throw new Error(
      'Provide an output path. Either pass it with `--output` or add it to your package.json at `prisma.import.output`',
    )
  }

  const absoluteOutputPath = path.isAbsolute(relativeOutputPath) ? relativeOutputPath : path.resolve(relativeOutputPath)

  //
  // Confirm schema overwrite
  //

  const dryMode = Boolean(args['--dry'])
  const forceMode = Boolean(args['--force'])

  if (dryMode) {
    console.log(`✔ Running in ${chalk.blueBright('dry mode')}\n`)
  }

  if (!forceMode && !dryMode && (await exists(absoluteOutputPath))) {
    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `This will ${chalk.red(
        'overwrite',
      )} your output schema. You can disable this prompt with the ${chalk.blueBright('--force')} option. Continue?`,
    })

    if (!result.confirm) {
      process.exit(1)
    }
  }

  await merge(schemaPaths, absoluteOutputPath, dryMode)
}

void main()
