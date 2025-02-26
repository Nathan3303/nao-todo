import pkg from '@fullhuman/postcss-purgecss'
const postcssPurgecss = pkg.default || pkg

const purgecss = postcssPurgecss({
    content: ['./index.html', './src/**/*.{vue,js,jsx,ts,tsx}'],
    defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
    safelist: []
})

export default {
    plugins: [
        purgecss
    ]
}