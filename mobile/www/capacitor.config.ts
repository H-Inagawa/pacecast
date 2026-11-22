import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.pacecast.android",
  appName: "PaceCast",
  webDir: "www",
  server: {
    // 本番相当: Vercel の HTTPS
    url: "https://pacecast-three.vercel.app/",
    cleartext: false,
    // 例: PC の LAN IP。ipconfig で確認。127.0.0.1 は使わない
    // url: "http://192.168.0.12:3000",
    // cleartext: true,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;