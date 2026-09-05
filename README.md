# zashboard

<p align="center">
  <img src="./readme/pc.png" height="300">
  <img src="./readme/mobile.png" height="300">
</p>

## **Requirement**

Browser support

- Chrome 111 (released March 2023)
- Firefox 128 (released July 2024)
- Safari 16.4 (released March 2023)
- Not supported on iOS 16.4 jailbroken version.

## **Online**

You can access the online zashboard at the following link:

- [Online zashboard](http://board.zash.run.place)

## **Download**

You can download the zashboard files here:

> [!WARNING]
> Support for sing-box has been removed. [Learn more about this
> decision](./docs/sing-box-deprecation.md).

release:

- [LAN-device fork latest dist.zip](https://github.com/whoerau/zashboard/releases/latest/download/dist.zip) – No-fonts build promoted only after its immutable release is complete.
- [dist.zip (7.81 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip) – Includes better font-loading experience.
- [dist-no-fonts.zip (1.44 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist-no-fonts.zip) – No fonts included, uses system fonts only.
- [dist-cdn-fonts.zip (1.44 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip) – Fonts loaded from unpkg.com, If you have trouble connecting to unpkg.com, **you may experience slow page loading**.
- [dist-firasans-only.zip (1.67 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist-firasans-only.zip) – Only with FiraSans Font
- [dist-misans-only.zip (3.54 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist-misans-only.zip) – Only with MiSans Font
- [dist-pingfang-only.zip (3.25 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist-pingfang-only.zip) – Only with PingFang Font
- [dist-sarasa-only.zip (3.67 MB)](https://github.com/Zephyruso/zashboard/releases/latest/download/dist-sarasa-only.zip) – Only with Sarasa Font

dev:

- [gh-pages.zip (7.81 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages.zip)
- [gh-pages-no-fonts.zip (1.44 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-no-fonts.zip)
- [gh-pages-cdn-fonts.zip (1.44 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-cdn-fonts.zip)
- [gh-pages-firasans-only.zip (1.67 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-firasans-only.zip)
- [gh-pages-misans-only.zip (3.54 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-misans-only.zip)
- [gh-pages-pingfang-only.zip (3.25 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-pingfang-only.zip)
- [gh-pages-sarasa-only.zip (3.67 MB)](https://github.com/Zephyruso/zashboard/archive/refs/heads/gh-pages-sarasa-only.zip)

## **Docker Setup**

To run zashboard via Docker, use the following command:

```
docker run -d -p 80:80 ghcr.io/zephyruso/zashboard:latest
```

## Tips

1. The connection table can be dragged with the left mouse button, and right-clicking can copy cell content.
2. Right-clicking on a node / node group card will perform a speedtest for the node / node group.
3. The proxy group sorting is based on the node order in the GLOBAL group, which follows the configuration file order. If you need custom ordering, you can specify the order by overriding the GLOBAL group.
4. The dashboard supports PWA (Progressive Web App), which can provide a native app-like experience on mobile devices through "Add to Home Screen".
5. After confirming that `lan-rules.json` is absent, the dashboard update button and auto-upgrade may call the core's `/upgrade/ui` endpoint. Configure Mihomo's `external-ui-url` as `https://github.com/whoerau/zashboard/releases/latest/download/dist.zip`; otherwise the core may install its default dashboard instead of this fork. When managed LAN rules are active or cannot be verified, built-in updates are disabled because Mihomo replaces the whole UI directory; use `whoerctl zashboard update`, which preserves the sidecar.

## 提示

1. 连接表格可被鼠标左键拖动，右键可复制单元格内容。
2. 右键点击节点/节点组卡片可对节点/节点组进行测速。
3. 面板的节点组排序是根据GLOBAL组中的节点顺序排序的，即按配置文件的顺序，如果你需要自定义顺序，可通过覆盖GLOBAL组指定顺序
4. 面板支持PWA（Progressive Web App），可以在移动设备上通过"添加到主屏幕"获得类原生app的体验
5. 确认 `lan-rules.json` 不存在后，面板更新按钮及自动更新才可调用核心的 `/upgrade/ui`。请把 Mihomo 的 `external-ui-url` 配置为 `https://github.com/whoerau/zashboard/releases/latest/download/dist.zip`；否则核心可能安装其默认面板，而不是本 fork。受管 LAN 规则生效或无法验证时，内置更新会被禁用，因为 Mihomo 会替换整个 UI 目录；请使用会保留 sidecar 的 `whoerctl zashboard update`。

## LAN rules sidecar

Rules device scoping requires a configuration-specific `lan-rules.json` beside `index.html`. It is intentionally not bundled in `dist.zip`: a generic release cannot safely contain one gateway's device mapping. `whoerctl mihomo gateway` generates schema version 2 automatically without device CIDRs or raw rule payloads. The browser accepts it only when the active backend has the same origin as the UI and its live rule count, digest, sub-rules, source indexes, and original policies all match. A confirmed missing sidecar leaves normal Rules visible and permits the configured core updater, which reconfirms that absence immediately before each update. A present but empty, stale, invalid, unreadable, or unverifiable sidecar leaves normal Rules visible but blocks the core updater so it cannot delete managed data. Use `whoerctl zashboard update` for those deployments; it preserves or repairs the generated sidecar.

规则设备作用域依赖与 `index.html` 同目录、按网关配置生成的 `lan-rules.json`。通用 `dist.zip` 不会打包某台网关的设备映射；`whoerctl mihomo gateway` 会自动生成不含设备 CIDR 和原始规则 payload 的 v2 清单。浏览器仅在当前后端与 UI 同源，且实时规则数量、摘要、子规则、索引及原策略全部匹配时采用它。确认不存在清单时，仍显示普通规则并允许已配置的核心更新器；每次更新前都会立即重新确认清单仍不存在。清单存在但为空、过期、无效、不可读或无法验证时，仍显示普通规则，但会阻止核心更新器删除受管数据。这类部署请使用 `whoerctl zashboard update`，它会保留或修复生成的 sidecar。

## URL params format

#### basic example

http://host:port/#/setup?hostname=ipordomain&port=9090&secret=123456

1. **`protocol`**
   - Determines the protocol, `http` or `https`.
   - Default: current page protocol
   - The legacy `http` / `https` flag params (e.g. `?http=1`) are still supported for backward compatibility, but `protocol` takes precedence when both are present.

2. **`hostname`**
   - The Clash API's IP or domain.

3. **`port`**
   - The Clash API port.

4. **`secondaryPath`**
   - Optional path appended to the base URL.
   - Default: An empty string.

5. **`secret`**
   - Password for authentication.

6. **`disableUpgradeCore`**
   - Set '1' to hide upgrade core button

7. **`disableTunMode`**
   - Set '1' to hide tun switch

### I code just for fun, not for money. If you really want to donate, please consider donating to [UNICEF](https://www.unicef.org/) to help hungry children.
