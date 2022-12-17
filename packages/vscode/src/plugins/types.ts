import { ExtensionContext } from 'vscode'

export interface PrismaVSCodePlugin {
  name: string
  /** This is called during vscodes' activate event and if true will call the plugins activate function */
  enabled: () => Promise<boolean> | boolean

  /** Called when the extension is activated and if enabled returns true */
  activate?: (context: ExtensionContext) => Promise<void> | void
  deactivate?: () => Promise<void> | void
}
