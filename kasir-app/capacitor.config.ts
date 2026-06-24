import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jagoankasir.app',
  appName: 'kasir-app',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
