# AC Energy Card

Home Assistant Lovelace 自定义卡片，从累计耗电量 sensor 计算并显示时段消耗电量，支持小时/日切换。

![预览](https://img.shields.io/badge/HA-Lovelace-blue)

## 功能

- 📊 柱状图显示每小时或每日耗电量
- 🎨 冷暖渐变色：低耗→冷蓝，高耗→暖橙
- 🔢 汇总显示时段总耗电量
- 💬 Hover / Tap 显示精确数值
- 📱 iOS / Android app 完全兼容

## 安装（通过 HACS）

1. HACS → 右上角菜单 → **自定义存储库**
2. 填入本仓库地址，类别选 **Dashboard**，点击添加
3. 在 HACS Frontend 列表找到 **AC Energy Card** → 下载
4. 刷新浏览器

## 使用

在仪表板添加手动卡片：

```yaml
type: custom:ac-energy-card
entity: sensor.你的累计耗电量sensor
```

### 完整配置项

```yaml
type: custom:ac-energy-card
entity: sensor.ac_energy_total   # 必填：累计耗电量 sensor（单位 kWh，持续递增）
title: 空调耗电                   # 可选，默认"空调耗电"
icon: ❄️                         # 可选，默认 ❄️
```

## 如何找到正确的 entity

**开发者工具 → 状态** 中搜索 `energy`，找到：
- 单位为 `kWh`
- 数值持续递增（累计值，不是瞬时功率）

的 sensor，复制其 entity_id。
