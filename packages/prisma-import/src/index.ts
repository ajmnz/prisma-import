#!/usr/bin/env node

import { arg, format } from '@prisma/internals'
import chalk from 'chalk'
import prompts from 'prompts'
import { isAbsolute, resolve } from 'path'
import { exists, getConfigFromPackageJson, glob } from './util'
import { merge } from './merge'
import { pathsFromBase } from './base'
import { writeSchema } from './write'
import { parse } from './parser'
import { findMissing } from './find-missing'
import { getSchemaGlobs } from './get-schema-globs'

const main = async () => {
  const args = arg(process.argv.slice(2), {
    '--schemas': [String],
    '-s': '--schemas',
    '--output': String,
    '-o': '--output',
    '--base': String,
    '-b': '--base',
    '--dry': Boolean,
    '-d': '--dry',
    '--help': Boolean,
    '-h': '--help',
    '--force': Boolean,
    '-f': '--force',
    '--quiet': Boolean,
    '-q': '--quiet',
    '--verbose': Boolean,
    '-v': '--verbose',
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
          -b, --base    Specify a base file to recursively resolve schemas from import statements. Mutually exclusive with --schemas
          -s, --schemas Specify where your schemas are using a glob pattern. Mutually exclusive with --base
          -q, --quiet   Skip display of log messages
          -v, --verbose Display additional log messages
    `),
    )

    process.exit(0)
  }

  //
  // Get possible parameter inputs
  //
  const schemasFromArg = args['--schemas']
  const schemasFromPackage = await getConfigFromPackageJson('schemas')
  const baseFromArg = args['--base']
  const baseFromPackage = await getConfigFromPackageJson('base')
  const dryMode = Boolean(args['--dry'])
  const forceMode = Boolean(args['--force'])
  const quietMode = Boolean(args['--quiet'])
  const verboseMode = Boolean(args['--verbose'])

  //
  // Ensure schemas and base are mutally exclusive
  //
  if ((!!schemasFromArg || !!schemasFromPackage) && (!!baseFromArg || !!baseFromPackage)) {
    throw new Error('Provide either a base file or schema glob patterns, not both.')
  }

  if (!schemasFromArg && !schemasFromPackage && !baseFromArg && !baseFromPackage) {
    throw new Error(
      'Provide a glob pattern to find your schemas. Either pass it with `--schemas` or add it to your package.json at `prisma.import.schemas`.\nAlternatively, Provide a base file. Either passit with `--base` or add it to your package.json at `prisma.import.base`',
    )
  }

  //
  // Prioritize base over schemas
  //
  const useBase = !!baseFromArg || !!baseFromPackage

  let schemaPaths: string[] = []

  if (useBase) {
    const relativeBasePath = baseFromArg ?? baseFromPackage

    if (relativeBasePath) {
      const absoluteBasePath = isAbsolute(relativeBasePath) ? relativeBasePath : resolve(relativeBasePath)

      schemaPaths = await pathsFromBase(absoluteBasePath, quietMode, verboseMode)

      if (!quietMode) {
        console.log(
          `✔ Resolved ${chalk.blueBright(schemaPaths.length.toString() + ' schema(s)')} from ${absoluteBasePath}`,
        )
      }
    }
  } else {
    //
    // Get glob
    //
    const schemasGlob = getSchemaGlobs(schemasFromArg, schemasFromPackage)

    if (schemasGlob) {
      schemaPaths = (
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

      if (!quietMode) {
        console.log(
          `✔ Resolved ${chalk.blueBright(schemaPaths.length.toString() + ' schema(s)')} from ${schemasGlob.join(', ')}`,
        )
      }
    }
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

  const absoluteOutputPath = isAbsolute(relativeOutputPath) ? relativeOutputPath : resolve(relativeOutputPath)

  //
  // Confirm schema overwrite
  //
  if (dryMode && !quietMode) {
    console.log(`✔ Running in ${chalk.blueBright('dry mode')}\n`)
  }

  const oldSchemaExists = await exists(absoluteOutputPath)

  if (!forceMode && !dryMode && oldSchemaExists) {
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

  const newSchema = await merge(schemaPaths)

  if (oldSchemaExists) {
    const oldSchema = await parse(absoluteOutputPath)
    const missing = findMissing(oldSchema, newSchema)

    if (!quietMode) {
      console.log(`✔ There are ${chalk.blueBright(missing.length)} models missing from the merged file`)

      if (missing.length) {
        console.table(missing)
      }
    }

    if (missing.length && !forceMode) {
      const result = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Using this schema will cause ${chalk.red('data loss')} due to ${chalk.red(
          missing.length,
        )} missing models. You can disable this prompt with the ${chalk.blueBright('--force')} option. Continue?`,
      })

      if (!result.confirm) {
        process.exit(1)
      }
    }
  }

  await writeSchema(newSchema, absoluteOutputPath, dryMode)
}

void main()
