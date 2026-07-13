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

> All builds include sing-box native API support.

release:

- [LAN-device fork rolling dist.zip](https://github.com/whoerau/zashboard/releases/download/lan-device-filter-latest/dist.zip) – No-fonts build for this branch.
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
3. The proxy group sorting is based on the node order in the GLOBAL group. In Mihomo, it follows the configuration file order, while in sing-box, route.final is placed first, with the rest following the configuration file order. If you need custom ordering, you can specify the order by overriding the GLOBAL group.
4. The dashboard supports PWA (Progressive Web App), which can provide a native app-like experience on mobile devices through "Add to Home Screen".
5. Mihomo's `/upgrade/ui` always uses the core-configured `external-ui-url`. For this fork, set it to `https://github.com/whoerau/zashboard/releases/download/lan-device-filter-latest/dist.zip` before using the manual update button. Unattended UI updates are disabled because Mihomo does not expose that URL through `/configs` for verification.

## 提示

1. 连接表格可被鼠标左键拖动，右键可复制单元格内容。
2. 右键点击节点/节点组卡片可对节点/节点组进行测速。
3. 面板的节点组排序是根据GLOBAL组中的节点顺序排序的，在Mihomo中会是按配置文件的顺序，在sing-box中会把route.final放到第一位，其余按照配置文件顺序，如果你需要自定义顺序，可通过覆盖GLOBAL组指定顺序
4. 面板支持PWA（Progressive Web App），可以在移动设备上通过"添加到主屏幕"获得类原生app的体验
5. Mihomo 的 `/upgrade/ui` 始终使用核心配置的 `external-ui-url`。此 fork 必须先将其设为 `https://github.com/whoerau/zashboard/releases/download/lan-device-filter-latest/dist.zip`，再使用手动更新按钮。由于 Mihomo 的 `/configs` 不暴露该 URL 供校验，面板已禁用无人值守 UI 更新。

## URL params format

#### basic example

http://host:port/#/setup?hostname=ipordomain&port=9090&secret=123456

1. **`http` / `https`**
   - Determines the protocol (`http` or `https`).
   - Default: current page protocol

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

8. **`type`**
   - Selects the backend API: `clash` (Clash REST/WS) or `singbox` (sing-box native).
   - Default: `clash`

### I code just for fun, not for money. If you really want to donate, please consider donating to [UNICEF](https://www.unicef.org/) to help hungry children.
