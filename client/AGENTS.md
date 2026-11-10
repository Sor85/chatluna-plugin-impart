# client 说明

适用范围：`client/`。同时遵守根 `AGENTS.md`；数据契约见 `src/AGENTS.md`。

- 使用 `@chatluna/ui-kit` 与宿主 state/action/locale，不引入另一套控件库、主题或认证。
- 只通过宿主 `dashboard.card` 插槽提供统计卡片，不注册独立路由页面；是否加载由服务端 `Config.dashboard` 决定（`src/index.ts`）。
- 卡片根容器显式使用 `text-sm leading-6`，不覆盖指针、滚动条或模态行为。
- 排行数据直接显示有符号厘米值，不以颜色代替符号或榜单标签。
- 中文、英文文案分别存放 `locales/zh.yml`、`locales/en.yml`，使用宿主 locale API 注册。
- 卡片只读展示统计，不提供群开关或配置；群开关只走聊天指令，配置由宿主插件 SchemaForm 管理。
