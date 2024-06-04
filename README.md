<h1 align="center">Prisma Import</h1>
<p align="center">Bringing import statements to Prisma schemas</p>
<div align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=ajmnz.prisma-import">VSCode Extension</a>
  —
  <a href="https://www.npmjs.com/package/prisma-import">CLI</a>
  —
  <a href="https://www.npmjs.com/package/@ajmnz/prisma-language-server">Language Server</a>
</div>

<hr>

### ❗ This project is no longer maintained

Prisma has released native multi-schema support, addressing exactly what this project aimed to solve. More info:

- Release Notes: https://github.com/prisma/prisma/releases/tag/5.15.0
- Documentation: https://prisma.io/docs/orm/prisma-schema/overview/location#multi-file-prisma-schema
- Announcement blog post: https://www.prisma.io/blog/organize-your-prisma-schema-with-multi-file-support

Thank you!

<hr>

- [Description](#description)
  - [VSCode Extension \& Language Server](#vscode-extension--language-server)
  - [CLI](#cli)
- [Usage](#usage)
- [Import syntax](#import-syntax)
- [How it works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

## Description

`prisma-import` exists in order to address the [multiple-schema situation](https://github.com/prisma/prisma/issues/2377) on Prisma. Current solutions only focus on the schema merging part, and not on good DX and integration within the Prisma ecosystem.

This is an attempt to allow importing models and other blocks between schemas, and thus give the developer the flexibility of working with multiple files.

→ See [How it works](#how-it-works) for a more in-depth description

<hr>

The project is divided into 2 different areas.

### VSCode Extension & Language Server

Both the Prisma VSCode extension and the Language Server have been refactored to understand import statements and to provide IDE features that support them (such as syntax highlighting, linting, formatting, etc.)

→ See the [VSCode extension README](packages/vscode/README.md)

### CLI

The [prisma-import](https://www.npmjs.com/package/prisma-import) CLI can be used to merge all schemas into one that Prisma can understand.

→ See the [prisma-import CLI README](packages/prisma-import/README.md)

<hr>

## Usage

Install the VSCode Prisma Import extension from the marketplace [here](https://marketplace.visualstudio.com/items?itemName=ajmnz.prisma-import) and **disable the official Prisma extension** so they don't collide.

Optionally install the [prisma-import CLI](https://www.npmjs.com/package/prisma-import) to merge all your schemas into one.

## Import syntax

Import statements work pretty similar to JavaScript's. Basically, they describe a list of blocks (`model`, `enum` or `type`) that are imported from another schema.

They look like this:

```prisma
// modules/user/user.prisma

import { Post, Comment } from "../blog/post/post"

model User {
  id        Int       @id @default(autoincrement())
  firstName String
  lastName  String
  email     String    @unique
  password  String
  posts     Post[]
  comments  Comment[]
}

// modules/blog/post/post.prisma

import { User } from "../../user/user"

model Post {
  id          Int       @id @default(autoincrement())
  title       String
  description String
  content     String
  user        User      @relation(fields: [userId], references: [id])
  userId      Int
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  comments    Comment[]
}

model Comment {
  id        Int      @id @default(autoincrement())
  user      User     @relation(fields: [userId], references: [id])
  userId    Int
  post      Post     @relation(fields: [postId], references: [id])
  postId    Int
  message   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

An import statement is composed of four main parts:

1. The `import` keyword
2. The comma-separated list of blocks to import within brackets (`{}`)
   - Only `model`, `type` or `enum` are allowed
3. The `from` keyword
4. The relative path to the schema containing those blocks
   - It must **not** include the `.prisma` extension

Additional notes:

- Multiple imports from the same path are allowed
- Duplicate blocks (either in imports or the current schema) are not allowed
- Import statements must be contained in a single line
- Import paths are workspace-bound, meaning that only those schemas in your workspace (opened VSCode directory) are importable

## How it works

When planning this project, there were two main ways to approach the issue.

The first one was to refactor `prisma-engines` and `prisma-fmt` in order to add import statements to the Prisma AST/PSL, but even though I tried, the rabbit hole was _too_ deep. Prisma is built to work with a single schema —not many—, and there's _a lot_ of things to take into account when introducing such a breaking change

- What happens with introspections when working with imports?
- How does one solve the implicit circular dependencies of model relations? (related models almost always reference each other)
- How would Prisma know which files to read? All schemas? Only those specified?
- Should Prisma merge all schemas into one, or always work with imports?
- etc, etc

So after giving up on modifying the Prisma core, I focused on how to tweak the Prisma extension and Language Server to understand import statements.

What was clear was that whatever was going to be fed into `prisma-fmt` should be a single, valid schema (aside from any user errors). With this in mind, in order to avoid not found blocks and other errors that would cause the formatter and linter to misbehave, a _virtual schema_ had to be resolved from the import statements and appended to the current schema. The virtual schema is invisible to the user and is resolved following these steps.

**Analyze current schema**

Get all the blocks in the current schema as well as identify all import statements together with the imported blocks. This allows us to know _what_ we're looking for and _where_.

**Identify dependencies**

Once we have the current schema information, we know which blocks we need to search and on which schema. If there are no imports, then there's nothing to virtualize and no virtual schema should be created.

**Recursively resolve blocks**

Find imported blocks, identify their relations and recursively resolve them until there are no blocks left.

With a schema file and an array of blocks to search, the steps go roughly like this.

For each block to search

1. If it is already visited (ie added to the virtual schema), ignore it
2. If the block is not a direct dependency of the origin schema (the one requesting linting/formatting — the one opened by the user), append `VirtualReplaced` to its name. (`model User` → `model UserVirtualReplaced`)

> Step 2 is essential. Imagine the origin schema is using the `User` model and the `Post` model, but only importing the latter. We would want the linter to catch that and mark the `User` reference as not defined.
>
> If we were to not rename the `User` model as `UserVirtualReplaced`, since `Post` has `User` as dependency, both would be added to the virtual schema as is and the linter would assume that `User` is defined in the origin schema and thus not mark it as error.

3. Go through all fields of the block, filter out the ones that are not a relation/enum/type (ie. `String`, `Int`) and identify the blocks

   - If block is visited, only rename it to `<name>VirtualReplaced` if necessary (so the linter does not catch it as not found)
   - If block is in current schema, rename if necessary and go to n.1 searching only for this block
   - If block is in imports, rename if necessary, find it in imported schema and go to n.1 searching only for this block

4. Once all dependencies of the block have been resolved, add it to the virtual schema

**Append virtual schema**

With everything resolved, the virtual schema can be appended to the end of the current schema. Then, all import statements are commented out so Prisma doesn't complain.

Assuming the following `user.schema` as the origin schema

```prisma
// modules/user/user.prisma

import { Post } from "../blog/post/post"

model User {
  id        Int       @id @default(autoincrement())
  firstName String
  lastName  String
  email     String    @unique
  password  String
  posts     Post[]
}

// modules/blog/post/post.prisma

import { User } from "../../user/user"

model Post {
  id          Int       @id @default(autoincrement())
  title       String
  description String
  content     String
  user        User      @relation(fields: [userId], references: [id])
  userId      Int
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  comments    Comment[]
}

model Comment {
  id        Int      @id @default(autoincrement())
  username  String
  post      Post     @relation(fields: [postId], references: [id])
  postId    Int
  message   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

This is what Prisma would see, once the virtual schema is resolved

```prisma

//import { User } from "../../user/user"

model User {
  id        Int       @id @default(autoincrement())
  firstName String
  lastName  String
  email     String    @unique
  password  String
  posts     Post[] // Direct origin dependency -> not renamed
}

// begin_virtual_schema

model Post { // Direct origin dependency -> not renamed
  id          Int                       @id @default(autoincrement())
  title       String
  description String
  content     String
  user        User                      @relation(fields: [userId], references: [id])
  userId      Int
  createdAt   DateTime                  @default(now())
  updatedAt   DateTime                  @updatedAt
  comments    CommentVirtualReplaced[] // Non-direct dependency -> renamed
}

model CommentVirtualReplaced { // Non-direct origin dependency -> renamed
  id        Int      @id @default(autoincrement())
  username  String
  post      Post     @relation(fields: [postId], references: [id])
  postId    Int
  message   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

To document

- How does the extension resolve errors in the virtual schema
- How does the extension format across schemas

## Contributing

All aspects of this project are open to contributions. Feel free to open PRs for bug fixes, improvements and new features.

## License

VSCode Extension

- Apache 2.0
- [LICENSE](packages/vscode/LICENSE)

Language Server

- Apache 2.0
- [LICENSE](packages/language-server/LICENSE)

CLI

- MIT
- [LICENSE](packages/prisma-import/LICENSE)
