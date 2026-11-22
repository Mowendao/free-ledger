# Android APK

## 这是什么

Free Ledger 使用 [Capacitor](https://capacitorjs.com/) 把同一套 PWA 资源打进 Android WebView，生成本地安装包。
Web 资源在 APK 内（`android/app/src/main/assets/public`），首次打开即可离线使用，不依赖线上站点。

- 包名：`io.github.mowendao.freeledger`
- 版本：`0.8.3`（versionCode 803）
- 最低系统：Android 6.0（API 23）
- 当前安装包：debug 签名，仅适合个人安装

## 数据说明

**APK 的数据与浏览器 PWA 不互通**——两者使用不同的 WebView / 浏览器存储。

迁移方式：在 PWA 的「我的 → 数据备份与导出」导出 JSON，然后在 APK 的同一页面导入。
之后可继续用 JSON 备份在两端之间迁移。

## 下载

<https://github.com/Mowendao/free-ledger/releases/download/v0.8.3/FreeLedger-0.8.3-debug.apk>

SHA-256：构建后更新

安装时系统会提示「未知来源」，允许浏览器/文件管理器安装即可。

## 构建

需要 JDK 21 与 Android SDK（platform 35 / build-tools 35）。

```bash
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

## CI 构建

`.github/workflows/android.yml` 在以下时机构建 APK、上传 artifact，并附加到对应 GitHub Release：

- 推送 `v*` tag；
- 手动触发 `Build Android APK` workflow。

CI 使用 GitHub 托管 runner 预装的 Android SDK（`/usr/local/lib/android/sdk`），不额外安装 Android Studio。

## 正式签名

当前为 debug keystore，不适合分发到应用商店。正式发布时需要：

1. 生成 release keystore；
2. 在 `android/app/build.gradle` 配置 `signingConfigs`；
3. 通过 GitHub Secrets 注入 keystore 与密码，构建 `assembleRelease`。

具体签名配置属于发布流程，未包含在仓库中，避免泄露密钥。
