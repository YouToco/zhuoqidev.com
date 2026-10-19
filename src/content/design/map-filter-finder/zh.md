---
title: "地图 + 筛选侧栏"
summary: "左侧多段筛选、右侧 Leaflet 地图：结果列表和标记实时同步，点聚合只数符合条件的点，点列表飞到地图并弹详情。"
category: layout
origin: original
stack: [html, css, javascript, leaflet]
tags: [地图, 筛选面板, 点聚合, 列表联动, 工具页]
order: 160
files: [index.html, data.js]
demoHeight: 640
added: 2026-10-14
---

演示数据是虚构的 44 家咖啡馆，店名、位置、评分都是编的；底图来自 OpenStreetMap。

## 看点

- **一个 state、一次 render**：类型、评分、营业时间、设施、搜索都只改 `state`，然后 `render()` 用同一个 `pass()` 同时算出列表和地图标记，两边永远对得上。
- **不符合的变灰或隐藏**：可选「在地图上变灰」（保留空间感，知道哪里还有店）或「从地图上隐藏」。
- **点聚合只数符合的**：`leaflet.markercluster` 的 `iconCreateFunction` 里只数通过筛选的子标记，气泡上的数字和列表条数一致；全都不符合的聚合点变灰。
- **列表 ↔ 地图联动**：悬停列表行，对应标记（或它所在的聚合点）放大描边；点列表行用 `zoomToShowLayer` 展开聚合、再弹出详情；点地图标记，列表滚到那一行并高亮。
- **点地图设起点**：点任意位置放一个「起」标记，排序自动切到「离起点最近」，列表和弹窗都显示距离（`map.distance`）。
- **深色地图不用第二套瓦片**：瓦片层加 `filter: invert(1) hue-rotate(180deg)` 再降饱和；浅色模式也压一点灰，让彩色标记更跳。
- **窄屏变抽屉**：760px 以下筛选面板变成左侧抽屉，地图上浮一个「筛选 · 29」按钮，数字跟着结果变。

## 怎么用

1. 引入 Leaflet 和 markercluster 的 CSS / JS（`leaflet@1.9.4`、`leaflet.markercluster@1.5.3`），拷页面结构和样式。
2. 把 `data.js` 换成你的数据，每条至少有 `id`、`name`、`lat`、`lng`；在 `KINDS`、`FEATS` 里改分类和设施名，`pass()` 里改筛选规则。
3. 改 `setView` 的中心和缩放；`popupHtml()` 决定详情里显示什么。
4. 数据从接口来时，拿到后赋给 `cafes` 再调一次 `render()` 即可。

## 坑

- 示例直连 `tile.openstreetmap.org`，只适合低流量演示。OSM 瓦片使用政策要求标注「© OpenStreetMap contributors」、禁止批量下载和离线缓存，流量大了要换商业瓦片服务或自建。
- 国内一些地图服务用 GCJ-02 坐标，OSM 用 WGS-84，两套直接混用会偏几百米。数据和底图要用同一套坐标系。
- `markerClusterGroup` 每次 `clearLayers()` 再 `addLayers()` 比逐个增删快很多；几十个点无所谓，上千个点一定要批量加。
- 标记在聚合里时 `marker.getElement()` 是 `null`，高亮要先 `getVisibleParent()` 找到实际显示的那个聚合点。
- 抽屉、侧栏里的地图在容器尺寸变化后要调 `map.invalidateSize()`；本例地图区域尺寸固定，所以没用到。
