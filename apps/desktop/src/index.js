const appIframe = document.getElementById('appIframe')
const appLoadError = document.getElementById('appLoadError')
const appLoadErrorRefreshButton = document.getElementById('appLoadErrorRefreshButton')
appIframe.addEventListener('error', () => {
    appLoadError.dataset.visible = '1'
})
const refreshWindow = () => window.location.reload()
appLoadErrorRefreshButton.addEventListener('click', refreshWindow)
