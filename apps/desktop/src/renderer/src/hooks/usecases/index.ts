// desktop 装配层：共享用例单一真源在 webapp（apps/web/src/hooks/usecases），
// 端差异经 `@/hooks/usecases/binding`（electron.vite.config.ts 的 @/hooks 别名）注入本地仓储与桌面端装饰。
export * from '@nao-todo/webapp/src/hooks/usecases'