import type { IndexHtmlTransformHook } from 'vite'

const firstLoadingScreenElement = `<div id="firstLoadingScreen"> <svg t="1741753056341" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4041" width="64" height="64" > <path d="M95.34672892 26.08981324h833.27649576c35.3946458 0 64.08894694 28.69430114 64.08894695 64.08894694v833.27649576a64.08894694 64.08894694 0 0 1-64.08894695 64.08894695H95.34672892A64.08894694 64.08894694 0 0 1 31.25778198 923.45525595V90.17876018C31.25778198 54.78411438 59.95208312 26.08981324 95.34672892 26.08981324z" fill="#212121" p-id="4042" ></path> <path d="M792.34163281 263.87548438c49.42645313 31.62796875 65.05439062 97.67460937 35.50394531 148.80649218l-0.89922656 1.55039063-188.65153125 314.63627344a99.03895313 99.03895313 0 0 1-34.4806875 34.32564843c-46.29466406 27.31788281-105.36454688 11.53490625-132.74444531-35.13185156l-151.81425-268.68269531c-9.51939844-16.71321094-30.35664844-22.29461719-46.57373437-12.6511875s-21.79849219 30.75975-12.74421094 47.44195312l0.34108594 0.58914844 162.32589843 283.16334375-85.70559375 0.15503906-140.86849218-245.14776562c-29.86052344-52.46521875-12.96126562-119.566125 37.64348437-150.85300782l1.55039063-0.93023437c51.65901563-30.79075781 117.98472656-12.96126562 148.12432031 39.84503906l0.15503906 0.27907031 0.06201563 0.12403125 151.00804687 267.25633594a23.19384375 23.19384375 0 0 0 39.90705469 1.20930469l0.43410937-0.68217188 188.65153125-314.63627343a34.232625 34.232625 0 0 0-10.6666875-46.32567188 30.97680469 30.97680469 0 0 0-43.22489062 10.1705625l-0.12403125 0.21705469-67.03889063 113.17851562-99.19399218 168.77552344-41.51946094-76.77534375 15.31785937-26.07757031a36.58921875 36.58921875 0 0 1 2.17054688-4.43411719l0.34108593-0.62015625 126.23280469-213.14770312 0.83721094-1.39535157c30.97680469-50.54273438 96.18623437-65.86059375 145.64369531-34.232625z" fill="#eca50f" p-id="4043" ></path> </svg> <span class="fls__title">NaoTodo</span> <div class="fls__desc-wrapper"> <span class="fls__desc">应用加载中</span> <div class="loader"> <div class="bar"></div> </div> </div> </div> `
const firstLoadingScreenStyle = `<style> @keyframes slide { 0% { left: -50%; } 100% { left: 100%; } } #firstLoadingScreen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 1rem; z-index: 9999; .fls__title { color: #212121; line-height: 1; font-size: 1.75rem; font-weight: 600; } .fls__desc-wrapper { position: absolute; bottom: 2rem; display: flex; flex-direction: column; gap: 0.75rem; align-items: center; } .fls__desc { color: #212121; line-height: 1; font-size: 1rem; } .loader { width: 10rem; height: 0.425rem; background-color: #e0e0e0; border-radius: 5px; overflow: hidden; position: relative; .bar { width: 50%; height: 100%; background-color: #212121; border-radius: 5px; position: absolute; animation: slide 2s linear infinite; } } } </style> `
const htmlTransformer = () => {
    const pluginStructure: { name: string; transformIndexHtml: IndexHtmlTransformHook } = {
        name: 'html-transform',
        transformIndexHtml: (html) => {
            html = html.replace('${flsStyle}', firstLoadingScreenStyle)
            html = html.replace('${flsElement}', firstLoadingScreenElement)
            // console.log(html)
            return html
        }
    }
    return pluginStructure
}

export default htmlTransformer
