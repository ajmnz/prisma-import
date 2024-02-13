#!/usr/bin/env node

import { format } from '@prisma/internals'
import chalk from 'chalk'
import prompts from 'prompts'
import path from 'path'
import { exists, getConfigFromPackageJson } from './util'
import { merge } from './merge'
import { ParseArgsConfig, parseArgs } from 'util'
import { glob } from 'glob'

const options: ParseArgsConfig['options'] = {
  schemas: {
    type: 'string',
    short: 's',
    multiple: true,
  },
  output: {
    type: 'string',
    short: 'o',
    multiple: false,
  },
  dry: {
    type: 'boolean',
    short: 'd',
    multiple: false,
  },
  help: {
    type: 'boolean',
    short: 'h',
    multiple: false,
  },
  force: {
    type: 'boolean',
    short: 'f',
    multiple: false,
  },
}

const main = async () => {
  try {
    const args = parseArgs({
      args: process.argv.slice(2),
      options,
      strict: true,
      allowPositionals: false,
      tokens: false,
    }).values

    if (args['help']) {
      console.log(
        format(`
  Compile all your schemas into one and replace all imports
  
  ${chalk.bold('Usage')}
  
    ${chalk.dim('$')} prisma-import [flags/options]
    ${chalk.dim('$')} prisma-import -s "glob/pattern/for/schemas" -o path/to/output/schema.prisma
    ${chalk.dim(
      '$',
    )} prisma-import -s "glob/pattern/for/schemas" -s "other/glob/pattern/for/schemas" -o path/to/output/schema.prisma
  
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

    let schemasGlob: string | string[] | undefined = args['schemas'] as string[] | undefined

    if (!args['schemas']) {
      schemasGlob = await getConfigFromPackageJson('schemas')
    }

    if (!schemasGlob) {
      throw new Error(
        'Provide a glob pattern to find your schemas. Either pass it with `--schemas` or add it to your package.json at `prisma.import.schemas`',
      )
    }

    const schemaPaths = await glob(schemasGlob, {
      cwd: process.cwd(),
    })

    if (!schemaPaths.length) {
      throw new Error(
        `No schemas found using glob pattern(s): \`${
          Array.isArray(schemasGlob) ? schemasGlob.join(', ') : schemasGlob
        }\``,
      )
    }

    //
    // Get output
    //

    let relativeOutputPath: string | undefined = args['output'] as string | undefined

    if (!args['output']) {
      relativeOutputPath = (await getConfigFromPackageJson('output')) as string | undefined
    }

    if (!relativeOutputPath) {
      throw new Error(
        'Provide an output path. Either pass it with `--output` or add it to your package.json at `prisma.import.output`',
      )
    }

    const absoluteOutputPath = path.isAbsolute(relativeOutputPath)
      ? relativeOutputPath
      : path.resolve(relativeOutputPath)

    //
    // Confirm schema overwrite
    //

    const dryMode = Boolean(args['dry'])
    const forceMode = Boolean(args['force'])

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
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message)
    } else {
      console.error(err)
    }

    process.exit(1)
  }
}

void main()
