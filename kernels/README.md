Bundled Mihomo kernel archives are generated before publishing:

```bash
pnpm download:kernels
```

By default this downloads:

- `darwin-arm64`
- `darwin-x64`
- `linux-x64`
- `linux-arm64`
- `win32-x64`

Pass target keys to download a custom set.
