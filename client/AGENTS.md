# client 说明

适用范围：`client/`。同时遵守根 `AGENTS.md`；数据契约见 `src/AGENTS.md`。

- 使用 `@chatluna/ui-kit` 与宿主 state/action/locale，不引入另一套控件库、主题或认证。
- 根容器显式使用 `text-sm leading-6`；页面沿用宿主滚动容器，不覆盖指针、滚动条或模态行为。宿主 ui-kit README 明确 ScrollArea 有尺寸问题，优先遵守宿主滚动规范。
- 排行数据直接显示有符号厘米值；长度榜降序，挖矿榜升序，不以颜色代替符号或榜单标签。
- 中文、英文文案分别存放 `locales/zh.yml`、`locales/en.yml`，使用宿主 locale API 注册。
- 页面只提供当前游戏数据查看和群开关；配置仍由宿主插件 SchemaForm 管理，避免两套配置来源。
