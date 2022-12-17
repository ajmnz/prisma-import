<h2 align="center">Prisma VS Code Extension</h2>
<div align="center">

[![Version](https://vsmarketplacebadge.apphb.com/version/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating/prisma.Prisma.svg)](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma)

</div>
<hr>
Adds syntax highlighting, formatting, jump-to-definition and linting for [Prisma Schema](https://www.prisma.io/docs/concepts/components/prisma-schema) files.

## VS Code Marketplace

You can find both the [stable](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) and [Insider](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma-insider) extension on the Marketplace.

## Open VSX Registry

You can find both the [stable](https://open-vsx.org/extension/Prisma/prisma) and [Insider](https://open-vsx.org/extension/Prisma/prisma-insider) extension on the Open VSX Registry.

## Features

- Syntax highlighting of `schema.prisma`
- Linting
  - Diagnostic tools are used to surface errors and warnings in your schema file as you type.
- Code Completion
  - Completion results appear for symbols as you type.
  - You can trigger this manually with the <kbd>Ctrl</kbd>+<kbd>Space</kbd> shortcut.
- Symbols for schema blocks `datasource`, `generator`, `model`, `enum` and `type`
  - They are listed in the [Outline view of VS Code](https://code.visualstudio.com/docs/getstarted/userinterface#_outline-view) and clicking them will go to their definition.  
- Documentation help
  - Documentation of a completion result pops up as completion results are provided.
- Quick info on hover
  - Documentation Comments (`///`) of `model`, `enum` or `type` appear anywhere you hover over their usages.
  - <kbd>CMD</kbd> + hover on a field whose type is a `model`, `enum` or `type` will show the corresponding block in a popup.
- Go to Definition
  - Jump to or peek a `model`, `enum` or `type` definition. (<kbd>CMD</kbd> + left click)
- Formatting
  - Format code either manually or on save (if configured).
    - _To automatically format on save, add the following to your `settings.json` file:_
      ```
      "editor.formatOnSave": true
      ```
    - _To enable formatting in combination with `prettier`, add the following to your `settings.json` file:_
      ```
      "[prisma]": {
        "editor.defaultFormatter": "Prisma.prisma"
      },
      ```
      or use the [Prettier plugin for Prisma](https://github.com/umidbekk/prettier-plugin-prisma)
- Rename
  - Rename models, enums, fields and enum values
    - Click into the model or enum, press <kbd>F2</kbd> and then type the new desired name and press <kbd>Enter</kbd>
    - All usages will be renamed
    - Automatically applies `@map` or `@@map` on the schema
- Quick-fixes
  - Quickly fix typos in model and enum names
  - Create new models and enums with a single click
  - Add `@unique` on model fields for a `@relation` where the `references` value is pointing to a field missing it.

## Preview

<details>
  <summary>Syntax-Highlighting</summary>

Syntax highlighting eases visual comprehension of the Prisma schema.
![Preview Schema](https://user-images.githubusercontent.com/1328733/147264843-fc32c2aa-7490-4e49-9478-abc16cbd0682.png)

</details>
<details>
  <summary>Formatting</summary>

Formatting ensures consistent indentation of your models for better readability.
![Formatting](https://user-images.githubusercontent.com/1328733/147264852-849cb539-9bdc-4916-9d0f-483536061f7c.gif)

</details>
<details>
  <summary>Linting and autocompletion</summary>

Linting shows inline errors in the schema, and autocompletion assists in defining the correct type.
![Linting and autocompletion](https://user-images.githubusercontent.com/1328733/147265321-2e1956ec-9f57-4ff3-9493-8163a727308d.gif)

</details>
<details>
  <summary>Contextual suggestions</summary>

Contextual suggestions assist in defining field types, models, and relations while formatting automatically defines back relations.
![Contextual suggestions](https://user-images.githubusercontent.com/1328733/147265323-4eb397b4-acda-4c78-9f27-1230d7ea4603.gif)

</details>
<details>
  <summary>Jump-to-definition</summary>

Easily navigate definitions, i.e. models in the Prisma schema.

![Jump-to-definition](https://user-images.githubusercontent.com/1328733/147265315-838cd63c-e0c6-485c-aec9-1b1707291719.gif)

</details>

## Contributing

Read more about [how to contribute to the Prisma VS Code extension](./CONTRIBUTING.md)

## Security

If you have a security issue to report, please contact us at [security@prisma.io](mailto:security@prisma.io?subject=[GitHub]%20Prisma%202%20Security%20Report%20VSCode)

## Build Status

- E2E Tests Status

  ![E2E tests after release on VSIX](https://github.com/prisma/language-tools/workflows/E2E%20tests%20after%20release%20on%20VSIX/badge.svg?branch=main)

  ![E2E tests before Insider release](https://github.com/prisma/language-tools/workflows/5.%20Integration%20tests%20in%20VSCode%20folder%20with%20published%20LS/badge.svg?branch=main)
