# DeepSeek Harness 插件开发基线

日期：2026-08-25

状态：已按 DeepSeek Harness `master` 文档核对；本项目合规修复与发布验证进行中

适用范围：原生 DSH Host、Web Client、DSH Desktop 的公开插件扩展面
非目标：dsh-TUI 市场准入；未经运行验证的跨 Host 兼容声明

## 1. 规范层级

本项目把 DeepSeek Harness 官方文档视为原生插件的直接规则：

1. `basic/index.zh.md`：入口、`apply`、`inject`、`ctx` 与副作用所有权。
2. `basic/config.zh.md`：导出同名 Schemastery `Config`，部署差异必须可校验。
3. `basic/publish.zh.md`：bundle/profile 边界、`dsh.bundle.patch`、`cordis.patch.yml` 与安装验证。
4. `framework/index.zh.md`：Cordis Fiber、卸载、HMR 与资源清理。
5. `framework/service.zh.md`：必需/可选服务和插件间依赖。
6. `framework/events.zh.md`：仅在使用事件时适用的事件语义。
7. `basic/tool.zh.md`：仅在插件向 Agent 暴露 Tool 时适用。

`dsh-std` 是社区跨 Host 草案，只在实现 manifest 并通过目标 adapter 激活测试后才能声明兼容。`dsh-ecosystem-spec` 是 dsh-TUI 的实验性准入规范；本次原生 DSH/Desktop 发布不采用，也不声称通过。

## 2. 必须遵守的原生 DSH 规则

- 插件提供稳定入口；只把真正必需的服务放入 `inject`。
- 所有路径、开关、超时和其他部署差异进入配置，并由同名 Schemastery `Config` 校验；默认值写入 schema，非法配置应在加载时失败。
- 插件包声明 `dsh.bundle.patch`，发布物同时包含运行入口和 `cordis.patch.yml`。bundle 负责插件组合，不冒充完整 profile。
- `ctx` 注册的事件和服务由 Fiber 管理；自建样式、连接、timer、watcher、worker、后台循环及临时资源必须有确定 disposer。卸载、配置热更新和依赖消失后不得残留重复任务或失效引用。
- 必需服务通过 `inject` 声明；可选能力用 `ctx.get()` 探测并允许降级。
- 若未来暴露 Tool，必须使用 `defineTool()`，提供参数与输出 schema，并保证 `execute()` 与声明输出一致。
- GitHub 源码安装只有在根包具备自包含 `prepare` 且用户允许构建脚本时才可宣传。预构建 tarball 不需要在用户机器上执行远程构建脚本，是当前首选发布物。

## 3. Skill Manager 责任边界

- `packages/core`：Skill 验证、存储、市场检查、固定快照、完整性、风险与原子操作；不依赖 Electron、React 或 Cordis。
- `packages/plugin` Host：组合 Core，注册 Typert Remote 服务，解析 Host 受信任路径；浏览器不得提交本机路径、commit 或哈希作为信任证据。
- `packages/plugin` Client：只使用公开 Remote 与 `settings.section`，拥有并释放自己的样式和远程挂载；不修改 Desktop 私有 DOM 或启动器状态。
- `cordis.patch.yml`：只声明稳定插件行和默认配置；后层配置覆盖整份 `config`，不能假设深合并。
- 远程 Skill 脚本永不执行；README、Topic、市场索引和第三方清单只提供发现信息，不能替代 `SKILL.md`、固定 commit 与完整 bundle 验证。

## 4. 本次发布合规矩阵

| 检查面 | 当前要求 | 验证证据 |
|---|---|---|
| Host 入口 | 稳定服务类、无虚假 `inject` | 构建后 ESM import 与隔离 Profile 启动 |
| 配置 | 导出 Schemastery `Config`；服务类公开同一 schema | schema 单测、非法类型拒绝、`dump-config` |
| 生命周期 | Remote 与 Client CSS 可重复装载并完整释放 | Client 卸载/HMR 回归测试 |
| Bundle | `dsh.bundle.patch` 与稳定 `skill-manager` id | npm pack 内容与 Profile dump |
| 安装 | `v0.1.0` 预构建 tarball可安装；不宣传未验证的 GitHub 源码安装 | 全新隔离 rc.2 Profile 安装、启动与 RPC |
| Desktop/Web | 只用 Typert Remote、公开 settings slot | v0.5.4/rc.2 已验证基线与本次 smoke gate |
| Tool | 当前不提供 Agent Tool | 标记不适用；未来新增时重新执行 Tool 规范 |
| 跨 Host | 当前不发布 `dsh-std` conformance 声明 | 明确非目标 |
| dsh-TUI | 当前不申请市场准入 | 明确非目标 |

## 5. 发布与回滚门槛

发布前必须完成：focused tests、完整 Vitest、typecheck、workspace build、standalone bundle verification、npm pack 内容检查、隔离 DSH 安装/激活、凭据和私有路径扫描、精确 Git diff 审计。任何一项失败都不得标记发布完成。

首期 GitHub Release 提供预构建 `.tgz`。源码仓库用于审计和协作；在根级 GitHub 安装流程通过固定提交的真实测试前，README 不提供 `github:owner/repo` 一键安装命令。

## 6. 一手来源

- [插件基本结构](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.zh.md)
- [Tool 插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.zh.md)
- [配置规范](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/config.zh.md)
- [打包与发布](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)
- [Cordis Fiber 与生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/framework/index.zh.md)
- [Service 与依赖](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/framework/service.zh.md)
- [事件系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/framework/events.zh.md)
- [社区 dsh-std 草案](https://github.com/Yan-Zero/dsh-std)
- [实验性 dsh-TUI 生态规范](https://github.com/T-Auto/dsh-ecosystem-spec)
