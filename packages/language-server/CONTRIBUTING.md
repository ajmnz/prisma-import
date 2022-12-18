# Contributing

## Development

- Run `npm install` in the root folder. This installs all necessary npm modules in both the vscode and language-server folder.
- Run `npm run watch`.
- Open VS Code on this folder.
- Switch to the debug viewlet.
- Select `Launch VSCode extension` from the drop down.
- Run the launch config.
- To debug the server as well use the launch configuration `Attach to Server` afterwards.
- A new file should open in the [Extension Development Host] instance of VSCode.
- Change the language to Prisma.
- Make a change to the syntax
- To reload, press the reload button in VSCode ( **Developer: Inspect TM Scopes** is helpful for debugging syntax issues )

## Testing

Unit tests:

- Switch to the debug viewlet.
- Select `Unit tests` from the drop down.
- Run the config.

## Publishing

The extension is automatically published to npm via GitHub actions (see `.github/workflows`).

## Nix users

The flake in this repository has a language server package.

Run `nix build .#prisma-language-server` to build it. The compiled output and a
wrapper script will be in the `result/` directory.

Run `nix run .#prisma-language-server -- --stdio` to run the language server, listening
over stdio.
