# scripts 说明

适用范围：`scripts/`。同时遵守根 `AGENTS.md`；验证见 `tests/AGENTS.md`。

- 脚本只用 Node.js 内置模块，直接通过 `node` 运行。同步仅写 `external/impart`，不写宿主业务源码。
- 不复制秘密、依赖、构建产物、数据、工具临时文件；目标存在未知包或符号链接时拒绝同步。
- 沙箱测试凭据通过环境变量传入，不打印鉴权头或配置；测试使用随机命名的独立空间，不操作已有用户群组。
- 沙箱产物保留在系统临时目录或忽略目录，报告只输出测试断言、空间标识和非秘密预览地址。
- `sandbox-test.mjs` 通过 `IMPART_HOST_URL`、`IMPART_TEST_URL` 和 `CHATLUNA_TOKEN` 连接独立测试实例。该实例的初始/成功/失败浮动设为 0、所有成功率设为 100%，其他数值与 5 秒冷却保持默认，以得到可重复的方向断言；禁止为此修改真实实例配置。
- 沙箱脚本创建临时测试凭据和独立空间；结束时停止空间机器人并撤销凭据，保留消息和 PNG 证据。网络鉴权及非法参数仍通过真实接口验证。
- `publish.mjs` 在本机构建并发布到 npm（V2 私有，CI 无法解析 `@chatluna/*`）：要求工作区干净、提交已推送、npm 已登录且 `v<版本>` tag 不存在；同步后清空副本 `lib`、`dist`、`tsconfig.tsbuildinfo` 再执行 `yarn yakumo build impart` 与 vitest，用 `yarn pack` 改写 `workspace:*`，解压后从目录 `npm publish`（直接发布 tgz 时元数据缺少 `readme`），最后打 `v<版本>` tag 并推送。预发布版本按 alpha/beta/rc/next 设置 dist-tag。
