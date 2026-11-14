# client 说明

适用范围：`client/`。同时遵守根 `AGENTS.md`；数据契约见 `src/AGENTS.md`。

- 使用 `@chatluna/ui-kit` 与宿主 state/action/locale，不引入另一套控件库、主题或认证。
- 只通过宿主 `dashboard.card` 插槽提供统计卡片，不注册独立路由页面。客户端始终加载，卡片订阅 `impart.stats`：服务端注册该 state 时挂载、注销后收到 `null` 时卸载（`client/index.ts`），由 `Config.dashboard` 间接控制。
- 设置页只注册 `impart:rates` 数组渲染器 `RateTable`，不注册通用 `array/table`，避免影响其他插件。复用 ui-kit 表格与按钮，单元格调用 `render(..., { embedded: true })` 保留宿主数字控件和校验，外层 `extensionProps` 保留恢复默认、撤销与 JSON 编辑；只通过 `onChange` 交回宿主保存，保留顺序、未知字段与空数组。结构改动递增行 key 以丢弃数字输入草稿。下限不小于上限会使插件启动失败，表格下方提示对应行。图标沿用宿主 Lucide。
- 卡片根容器显式使用 `text-sm leading-6`、表格根容器使用 `text-sm leading-5`，不覆盖指针、滚动条或模态行为。
- 每个群分别列出长度与深度榜单及各自参与人数，某一玩法无记录时显示空态。排行数据直接显示有符号厘米值，不以颜色代替符号或榜单标签。
- 中文、英文文案分别存放 `locales/zh.yml`、`locales/en.yml`，使用宿主 locale API 注册。
- 卡片只读展示统计，不提供群开关或配置；群开关只走聊天指令，配置由宿主插件 SchemaForm 管理。
