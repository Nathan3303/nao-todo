import { defineConfig } from '@lynx-js/rspeedy'

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginTypeCheck } from '@rsbuild/plugin-type-check'

export default defineConfig({
    plugins: [
        pluginQRCode({
            schema(url) {
                // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
                return `${url}?fullscreen=true`
            }
        }),
        pluginReactLynx({
            // lynx-ui 全库兼容要求：启用新手势系统（Button 等组件的按压态依赖）
            enableNewGesture: true
        }),
        pluginTypeCheck({
            // workspace 包（packages/*）源码的类型检查由各包自身 tsc 与 web 侧 vue-tsc 负责
            // （其代码面向 Vue/web 生态，含 .vue 与宽松 import 风格，mobile 严格 tsconfig 不适用）；
            // 本插件仅检查 apps/mobile 自身代码。
            tsCheckerOptions: {
                issue: {
                    exclude: [{ file: '../../packages/**/*' }]
                }
            }
        })
    ],
    resolve: {
        alias: {
            // presentation-react 的 hooks 层 import 自 'react'，
            // Lynx 端映射到 ReactLynx 的 React 兼容层（@lynx-js/react/compat）
            react: '@lynx-js/react/compat'
        }
    }
})