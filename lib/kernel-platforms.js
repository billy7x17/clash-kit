export const KERNEL_TARGETS = {
  'win32-x64': { assetName: 'mihomo-windows-amd64-compatible', archiveExt: 'zip', platform: 'win32' },
  'win32-ia32': { assetName: 'mihomo-windows-386', archiveExt: 'zip', platform: 'win32' },
  'win32-arm64': { assetName: 'mihomo-windows-arm64', archiveExt: 'zip', platform: 'win32' },
  'darwin-x64': { assetName: 'mihomo-darwin-amd64-compatible', archiveExt: 'gz', platform: 'darwin' },
  'darwin-arm64': { assetName: 'mihomo-darwin-arm64', archiveExt: 'gz', platform: 'darwin' },
  'linux-x64': { assetName: 'mihomo-linux-amd64-compatible', archiveExt: 'gz', platform: 'linux' },
  'linux-arm64': { assetName: 'mihomo-linux-arm64', archiveExt: 'gz', platform: 'linux' },
}

export const DEFAULT_BUNDLED_TARGETS = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64']

export function getKernelTarget(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`
  const target = KERNEL_TARGETS[key]
  if (!target) return null
  return { ...target, key, isWindows: platform === 'win32' }
}

export function getTargetBinName(platform = process.platform) {
  return `clash-kit${platform === 'win32' ? '.exe' : ''}`
}
