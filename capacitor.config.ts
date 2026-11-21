import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.mowendao.freeledger',
  appName: 'Free Ledger',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
}

export default config
