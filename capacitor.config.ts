import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The iPad app: the same web app, packaged by Capacitor. The bundle id is Apple's internal name
 * for the app; people only ever see "Broomit".
 */
const config: CapacitorConfig = {
  appId: 'com.luisschiffter.broomit',
  appName: 'Broomit',
  webDir: 'dist',
  ios: {
    // Pages scroll inside the app; the web view itself never bounces.
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#f7f2ea',
  },
  plugins: {
    LocalNotifications: { iconColor: '#795a46' },
    // Requests go through iOS, not the web view: calendar links load from any site.
    CapacitorHttp: { enabled: true },
  },
}

export default config
