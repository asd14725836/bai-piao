# 📺 IPTV 直播源资源整理

> 免费看电视直播，全是 GitHub 上别人整理好的，来这里找省得自己搜。

---

## 快速上车

如果你只想**立刻能看**，挑以下任一方案：

### 🥇 方案一：Guovin/iptv-api（推荐，自动更新）

自动采集+测速+生成直播源，半小时更新一次，部署后就不用管了。

```bash
# Docker 一键部署
docker run -d --restart=always --name iptv-api -p 8000:8000 guovern/iptv-api:latest
```

或直接订阅别人部署好的结果地址，导入播放器就能看。

- ⭐ 2.4万星
- 🔗 [github.com/Guovin/iptv-api](https://github.com/Guovin/iptv-api)
- ✅ 支持自定义频道、IPv4/IPv6、多端部署（Docker/命令行/GUI）

### 🥈 方案二：joevess/IPTV（即开即用）

直接提供整理好的 m3u8 直播源链接，复制到播放器就看。

```
央视台+卫视台：https://raw.githubusercontent.com/joevess/IPTV/main/home.m3u8
全集（含地方台）：https://raw.githubusercontent.com/joevess/IPTV/main/iptv.m3u8
含备用源版：https://raw.githubusercontent.com/joevess/IPTV/main/sources/home_sources.m3u8
```

- ⭐ 1万星
- 🔗 [github.com/joevess/IPTV](https://github.com/joevess/IPTV)
- ✅ 即拿即用，定期更新

---

## 📋 全部仓库总表

### 🔧 自动更新类（推荐）

| 仓库 | ⭐ | 说明 | 链接 |
|------|---|------|------|
| Guovin/iptv-api | 2.4万 | 全自动采集+测速+生成，Docker/工作流/命令行均支持 | [→](https://github.com/Guovin/iptv-api) |
| HerbertHe/iptv-sources | 8.8k | 自动更新 IPTV 源，支持自定义 | [→](https://github.com/HerbertHe/iptv-sources) |
| fanmingming/live | 2.8万 | 可直连访问的电视图标库+工具，IPv4/IPv6 | [→](https://github.com/fanmingming/live) |

### 📦 直播源合集类

| 仓库 | ⭐ | 说明 | 链接 |
|------|---|------|------|
| iptv-org/iptv | 12万 | 全球最大 IPTV 合集，190+国家 | [→](https://github.com/iptv-org/iptv) |
| Free-TV/IPTV | 1.7万 | 免费电视频道 M3U 播放列表 | [→](https://github.com/Free-TV/IPTV) |
| joevess/IPTV | 1万 | 自动整合多源，央视+卫视+地方台 | [→](https://github.com/joevess/IPTV) |
| vbskycn/iptv | 6.5k | 最新可用直播源，支持IPv4/IPv6 | [→](https://github.com/vbskycn/iptv) |
| ngo5/IPTV | 5.5k | TVBox直播点播源收集 | [→](https://github.com/ngo5/IPTV) |
| suxuang/myIPTV | 4.9k | 高清直播源，内置台标+节目预告 | [→](https://github.com/suxuang/myIPTV) |
| Meroser/IPTV | 4.1k | 深度定制直播源列表，EPG节目预告 | [→](https://github.com/Meroser/IPTV) |

### 📱 播放器/工具类

| 仓库 | ⭐ | 说明 | 链接 |
|------|---|------|------|
| lizongying/my-tv | 3.2万 | 电视直播软件，安装即可用 | [→](https://github.com/lizongying/my-tv) |
| 4gray/iptvnator | 6.2k | 跨平台 IPTV 播放器（Electron） | [→](https://github.com/4gray/iptvnator) |
| imDazui/Tvlist-awesome-m3u-m3u8 | 2.9万 | 直播源资源汇总 | [→](https://github.com/imDazui/Tvlist-awesome-m3u-m3u8) |

---

## 🎬 怎么用

### 电视盒子（Android TV）
- **TiviMate** — 最好的 IPTV 播放器（付费，值得）
- **Kodi** — 装 PVR IPTV Simple Client 插件

### 手机
- **Televizo**（Android）— 轻量好用
- **GSE IPTV**（iOS/Android）— 功能全面

### 电脑
- **VLC** — 打开→网络串流→粘贴 m3u8 链接
- **PotPlayer**（Windows）— 直接拖入 m3u8 地址

### 智能电视 App
- **my-tv**（lizongying）— 安装即用，无需配置
- **DIYP** — 自定义接口

---

## 💡 小贴士

1. **源会挂** — 直播源有时效性，用自动更新的方案（Guovin/iptv-api）省心
2. **速度慢** — 尝试 IPv6 源，很多地方 IPv6 比 IPv4 快
3. **看不了** — 可能是运营商限制，换个网络试试
4. **EPG（节目预告）** — fanmingming/live 提供了 `e.xml` 节目表，配合播放器使用

---

> ⚠️ 本仓库只做资源整理和指引，不存储任何直播流内容。具体源的有效性请自行测试。
