<h2 align="center">Prisma Import</h2>
<hr>

Unofficial release of the [Prisma extension](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) that adds import syntax support to Prisma schemas.

## How imports work

In order to start using them in your schema, first disable the official extension so it doesn't collide with this one.

Imports allow you to reference `models`, `enums` and `types` from other schemas and they work quite similar as to how they do in JavaScript. Here's how they look:

```
import { User, Posts } from "relative/path/to/schema"
```

`User` and `Posts` are the blocks being imported, and `relative/path/to/schema` is the path where those blocks are. Paths must not include the `.prisma` extension.

When you are done working on your schemas, you will need to merge them all into a single schema file and remove all import statements. To achieve this you can either

- Install and run the [prisma-import](https://www.npmjs.com/package/prisma-import) CLI
- Run the `Prisma Import: Merge schemas` command in VSCode

## Features

All existing features in the official extension, plus:

- Import syntax highlighting
- Linting
  - Find errors within your import statements
- Code Completion
  - Completion within import statements for schema paths and importable blocks
  - Completion for importable blocks and automatic import upon selection
- Symbols for `import` blocks
- Go to definition
  - Jump or peak an imported `model`, `enum` or `type` and open the schema that contains it
- Formatting
  - Document formatting manually or on save
  - Format across schemas, like automatically adding missing relations on models
