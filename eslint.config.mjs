import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default [
    {
        files: ['{packages,apps}/*.{js,mjs,cjs,ts,vue}']
    },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/essential'],
    {
        languageOptions: { parserOptions: { parser: tseslint.parser } },
        rules: {
            'vue/multi-word-component-names': 'off',
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            'packages/core/dist/*',
            'apps/document/.vitepress/cache/*',
            'apps/**/dist/*',
            '*.test.js',
            'src/legacy/**/*.js'
        ]
    }
]
