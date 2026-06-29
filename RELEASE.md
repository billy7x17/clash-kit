# Clash Kit 发版流程

## 1. 更新版本号

修改 `package.json` 中的 `version`：

```json
{
  "version": "1.1.7"
}
```

## 2. 下载或补齐内置内核

```bash
pnpm download:kernels
```

默认会准备以下平台的 Mihomo 内核压缩包：

- `darwin-arm64`
- `darwin-x64`
- `linux-x64`
- `linux-arm64`
- `win32-x64`

同版本文件已存在时会跳过，缺失时才会下载。

## 3. 打包并更新 Homebrew Formula

```bash
node scripts/release.js
```

该脚本会执行：

- 自动运行 `node scripts/download-kernels.js`
- 执行 `npm pack`
- 计算生成的 `.tgz` 包 SHA256
- 更新 `Formula/clash-kit.rb` 中的 npm tarball URL 和 SHA256

## 4. 发布 npm 包

使用 `scripts/release.js` 输出的 tarball 文件名发布：

```bash
npm publish clash-kit-1.1.7.tgz
```

## 5. 提交代码

```bash
git add package.json Formula/clash-kit.rb .gitignore README.md bin/index.js lib scripts kernels/README.md RELEASE.md
git commit -m "chore: release 1.1.7"
git push
```

注意：`kernels/*.gz`、`kernels/*.zip`、`kernels/manifest.json` 已被 `.gitignore` 忽略，不需要提交到 Git，但会被 `npm pack` 打进 npm 包。

## 6. 清理本地 tarball

```bash
rm clash-kit-1.1.7.tgz
```

## 发布前检查

可以先确认 npm 包内容：

```bash
npm pack --dry-run
```

当前内置 5 个平台内核后，npm 包大小大约为 82 MB。

## 用户侧内核更新语义

```bash
ck init
```

优先使用 npm 包内置内核。

```bash
ck init --force
```

强制重装内核，仍优先使用 npm 包内置内核。

```bash
ck init --remote
```

强制跳过内置内核，从 GitHub 下载最新 Mihomo 内核。

```bash
ck init --force --remote
```

与 `ck init --remote` 等价。
