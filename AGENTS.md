# AGENTS.md — chatluna-plugin-impart

ChatLuna V2 群聊数值游戏插件。独立源码是唯一编辑入口，`external/impart` 是单向同步的构建与运行副本。

## 开发与验证

- 源码目录不安装依赖、不生成锁文件。`node scripts/sync-to-v2.mjs --once` 同步至宿主；`CHATLUNA_V2_ROOT` 可指定宿主，默认 `../../chatluna-v2-mirror`。
- 首次同步或依赖变化后在宿主运行 `yarn install`；构建命令为 `yarn yakumo build impart`。在宿主 `external/impart` 运行 `yarn typecheck`、`yarn test`。
- 新增 Tailwind 类后完整重启宿主 launcher/worker，确认旧端口释放和新实例使用最新产物。
- 发布在本机执行 `node scripts/publish.mjs`：`--dry-run` 只演练不发布，账号开启两步验证时加 `--otp=<验证码>`。不经 yarn 运行：源码目录没有 `yarn.lock`，Yarn 4 会在启动脚本前报错。发版前只修改 `package.json` 的 `version` 并提交推送；npm 可能先出现 `0.0.0-stage` 占位版本，确认 `latest` 指向新版本前不判定为失败。
- 不覆盖用户数据、配置或无关工作区改动。集成测试只使用独立 onebot-sandbox 空间，凭据通过环境变量传入，不写入源码、日志或报告。
- 不自行创建分支、提交或发布。
- 分发同时保留 `src`、`client`、`lib` 与 `dist`：客户端开发入口引用纯共享源码，只有构建产物不足以支持宿主开发模式。打包不得包含测试凭据、运行配置或验收产物。

## 通用约定

- 使用 Cordis 4、`@chatluna/schema`、Satori 消息与 V2 平台命令桥；不创建另一套 Koishi 实例。
- 配置通过 `Config` 传入，所有注册绑定当前插件生命周期。WebUI 可选注入，不影响游戏命令使用。
- 时间戳为毫秒，长度与深度用整数百分之一厘米持久化；玩家按平台和用户隔离，长度、深度和冷却跨群共享，群开关与参与记录独立。
- 业务决策及上游迁移边界记录在双语 `.agents/notes/`，用户文档只描述可用功能与使用限制。

## 子目录说明

- `src/AGENTS.md`：配置、游戏事务、命令权限、Takumi 渲染与 WebUI 数据边界。
- `client/AGENTS.md`：仪表盘统计卡片、设置页成功率表格、语言资源及生命周期。
- `scripts/AGENTS.md`：单向同步与 onebot-sandbox 验收安全。
- `tests/AGENTS.md`：业务、数据库、渲染与说明登记守卫测试。
