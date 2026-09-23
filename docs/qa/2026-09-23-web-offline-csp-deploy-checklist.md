# WEB-OFFLINE 阶段一 · CSP 部署侧上线检查单（人工核验）

- **关联任务**：T109（AC12 / C-58 / DEF-8）
- **依据**：`docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-58）· `docs/prds/2026-09-23-web-offline-stage1.md`（AC12）
- **性质**：**人工核验清单（out-of-repo）**。web SPA **不由 `nao-todo-server` 托管**（服务端无 Static/NoRoute）⇒ CSP 由**静态托管侧**下发 ⇒ **本仓不可断言/不可验收**，只能由运维在托管侧配置后人工核验。
- **⚠️ 本仓未改** `apps/web/index.html`（不假装达成）；desktop 侧 `<meta>` CSP 见 `apps/desktop/src/renderer/index.html` + `csp-policy.ts`（本仓可断言）。

---

## 1. 运维需在托管侧下发的响应头（web）

web 由 HTTP 托管 ⇒ **优先用响应头**（比 `<meta>` 能力更全：可含 `frame-ancestors` / `report-uri` / `sandbox`）。

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://todobe.nathanao.space; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

### 逐项必要性（**不要照抄宽泛 `unsafe-*` 组合**）

| 指令                        | 值                                     | 必要性                                                                                                        |
| :-------------------------- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `default-src`               | `'self'`                               | 兜底；未显式覆盖的取数类一律限本站源。                                                                        |
| `script-src`                | `'self'`                               | 仅允许本站打包产物；**不含 `'unsafe-inline'`/`'unsafe-eval'`**（构建产物为外链 ESM），封死注入执行面。        |
| `style-src`                 | `'self' 'unsafe-inline'`               | `index.html` 含内联 `<style>`；Vue `:style` 绑定与组件运行时注入样式需属性级内联。**仅样式放宽**。            |
| `img-src`                   | `'self' data: blob: https:`            | 头像允许外链（`getAvatarSrc` 原样返回 `https://` 外链）、裁剪预览用 `blob:`、占位/图标用 `data:`。            |
| `font-src`                  | `'self' data:`                         | 本地字体（`/fonts/**`）与可能的 `data:` 内嵌字体。                                                            |
| `connect-src`               | `'self' https://todobe.nathanao.space` | 应用 API（XHR/fetch）与 **SSE**（`EventSource`：`/sse/reminders`）生产源；如部署域名/API 源变更须同步改此处。 |
| `object-src`                | `'none'`                               | 无 `<object>/<embed>` 需求，直接封死。                                                                        |
| `base-uri`                  | `'none'`                               | 禁止注入 `<base>` 劫持相对路径。                                                                              |
| `form-action`               | `'self'`                               | SPA 表单均 `preventDefault`；禁止跨源提交。                                                                   |
| `frame-ancestors`           | `'none'`                               | **仅响应头有效**（`<meta>` 会忽略）；禁止被 iframe 嵌套（防点击劫持）。                                       |
| `upgrade-insecure-requests` | —                                      | 主站为 https，强制子资源升级，避免混合内容。                                                                  |

> 若实际部署的 API 源不是 `https://todobe.nathanao.space`（如自建域名），**必须**把 `connect-src` 改为实际源；`img-src` 的 `https:` 为通配，无需逐域列举。

---

## 2. 配置位置（按托管方式二选一）

- **Nginx**：在站点 `server {}` 内加

    ```nginx
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://todobe.nathanao.space; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" always;
    ```

    `always` 保证错误响应（如 404）也带该头。

- **CDN / 对象存储 / 云托管**：在「响应头 / HTTP Response Headers」配置项添加同名头，**作用于 `index.html` 的响应**（SPA 的 fallback 路由也应带该头）。

---

## 3. 上线前人工核验（勾选）

- [ ] **响应头已下发**：`curl -sI https://<web-host>/ | grep -i content-security-policy` 输出与 §1 一致。
- [ ] **SPA fallback 亦带该头**：`curl -sI https://<web-host>/some/route | grep -i content-security-policy` 非空。
- [ ] **控制台零 CSP 违规**：打开站点，DevTools Console 无 `Refused to ... because it violates the following Content Security Policy directive`。
- [ ] **静态资源加载正常**：Network 中 JS/CSS/字体均 200（无被 `script-src`/`style-src`/`font-src` 拦截）。
- [ ] **登录链路正常**：signIn → checkin → 主界面可进入（`connect-src` 命中 API 源）。
- [ ] **SSE 正常**（若启用）：`connect-src` 未拦截 `/sse/reminders` 连接。
- [ ] **外链头像/裁剪正常**：外链 `https` 头像与本地头像裁剪预览（`blob:`）均可见。
- [ ] **无 `unsafe-eval`**：`script-src` 不含 `'unsafe-eval'`（如出现运行时 eval 需求 ⇒ 回架构评审，**不得**直接放宽）。

---

## 4. 备注

- **web CSP = 阶段一准入条件**（明文姿态下）⇒ 未完成本清单不得视 AC12 闭环。
- 本仓 **desktop** 侧 AC12 已由 `<meta>` CSP + 单测/实机探针覆盖（见 T109 回执），与 web 侧为**两条独立验收线**。
- 若托管侧不支持下发响应头（极端情况），退化为在 `apps/web/index.html` 注入 `<meta http-equiv="Content-Security-Policy">`（须放弃 `frame-ancestors`）—— 属**降级方案**，需回评审并更新本清单。