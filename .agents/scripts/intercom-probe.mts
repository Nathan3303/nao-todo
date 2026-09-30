// intercom-probe.mts — nao-fleet.sh 的 pi-intercom 名册探针（含 tmuxPane）
//
// 用法：node <tsx cli.mjs> intercom-probe.mts <pi-agent-dir>
// 输出（stdout）：{"ok":true,"sessions":[{"name","id","model","status","cwd","tmuxPane","pid"},…]}
//
// 为什么需要它（依据）：
//   pi 启动后用 OSC 0 把终端标题设为 "π - <会话名> - <cwd basename>" 并改写 argv，
//   nao-fleet 旧实现只按终端标题定位 pane ⇒ 标题一旦被改写（实测变为 "pi:c"），
//   close/status/ensure 全部失配。而 pi-intercom 在会话注册时读取 $TMUX_PANE
//   （types.ts: tmuxPane —— 进程生命周期内不可变，与窗口/标题改名无关），这是
//   标题被改写后仍能精确定位 pane 的权威依据。
//   官方 CLI（cli.ts list --json）的 sessionRow 未透出 tmuxPane，故此处直接用同一
//   包内的 IntercomClient 读取完整 SessionInfo。
//
// 兼容性：pi-intercom 内部 API 若变化 → 本探针非 0 退出，nao-fleet 回退官方 CLI
//   （无 tmuxPane）再叠加「仓库内未认领 pi pane 唯一兜底」，不静默 no-op。
//
// 类型自检：`npm run check:agents`（tsconfig.agents.json）。动态 import 使 list 结果为
//   any，下游 TS 项目（nao-todo/nue-ui 的 `vp check` 扫 `.agents/**`）会报 TS7006，
//   故此处用本地 ProbeSession 给 filter/map 显式定型（strict/noImplicitAny 下必需）。
import { join } from "node:path";

type ProbeSession = {
  id: string;
  name?: string;
  model?: string;
  status?: string;
  cwd: string;
  tmuxPane?: string;
  pid?: number;
};

const agentDir = process.argv[2];
if (!agentDir) {
  process.stderr.write("usage: intercom-probe.mts <pi-agent-dir>\n");
  process.exit(2);
}
const mod = join(agentDir, "npm/node_modules/pi-intercom");
const PROBE_NAME = "nao-fleet-probe";

try {
  const { IntercomClient } = await import(join(mod, "broker/client.ts"));
  const { spawnBrokerIfNeeded } = await import(join(mod, "broker/spawn.ts"));
  const client = new IntercomClient();
  await spawnBrokerIfNeeded();
  const now = Date.now();
  await client.connect({
    cwd: process.cwd(),
    model: "nao-fleet-probe",
    pid: process.pid,
    startedAt: now,
    lastActivity: now,
    name: PROBE_NAME,
    status: "idle",
  });
  const sessions = (await client.listSessions()) as ProbeSession[];
  const rows = sessions
    .filter((s) => s.id !== client.sessionId)
    .map((s) => ({
      name: s.name ?? "",
      id: s.id,
      model: s.model,
      status: s.status ?? "?",
      cwd: s.cwd,
      tmuxPane: s.tmuxPane ?? null,
      pid: s.pid ?? null,
    }));
  process.stdout.write(JSON.stringify({ ok: true, sessions: rows }, null, 2));
  await client.disconnect().catch(() => {});
} catch (error) {
  process.stderr.write(`intercom-probe failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
