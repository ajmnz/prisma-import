import { check } from 'checkpoint-client'
import { Disposable, workspace } from 'vscode'
import { getProjectHash } from './hashes'
export default class TelemetryReporter {
  private userOptIn = false
  private readonly configListener: Disposable

  private static TELEMETRY_CONFIG_ID = 'telemetry'
  private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry'

  constructor(private extensionId: string, private extensionVersion: string) {
    this.updateUserOptIn()
    this.configListener = workspace.onDidChangeConfiguration(() => this.updateUserOptIn())
  }

  public async sendTelemetryEvent(): Promise<void> {
    if (this.userOptIn) {
      await check({
        product: this.extensionId,
        version: this.extensionVersion,
        project_hash: await getProjectHash(),
      })
    }
  }

  private updateUserOptIn() {
    const config = workspace.getConfiguration(TelemetryReporter.TELEMETRY_CONFIG_ID)
    if (this.userOptIn !== config.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true)) {
      this.userOptIn = config.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true)
    }
  }

  public dispose(): void {
    this.configListener.dispose()
  }
}
