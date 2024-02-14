<h1 align="center">Prisma Import</h1>
<p align="center">Compile all your schemas into one and replace all imports</p>

---

## Usage

```shell
$ npx prisma-import

# or with yarn

$ yarn dlx prisma-import
```

## Options

Use the `--help` flag to get a list of possible options

```
Compile all your schemas into one and replace all imports

Usage

  $ prisma-import [flags/options]
  $ prisma-import -s "glob/pattern/for/schemas" -o path/to/output/schema.prisma
  $ prisma-import -s "glob/pattern/for/schemas" -s "other/glob/pattern/for/schemas" -o path/to/output/schema.prisma

Flags

          -h, --help    Display this help message
          -d, --dry     Print the resulting schema to stdout
          -f, --force   Skip asking for confirmation on schema overwrite
          -o, --output  Specify where you want your resulting schema to be written
          -s, --schemas Specify where your schemas are using a glob pattern
```
