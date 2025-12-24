import { ref } from 'vue'

export type RouterLinkVO = {
    name: string
    icon: string
    route: string
    routeName?: string
    routePath?: string
    params?: Record<string, any>
    query?: Record<string, any>
}

export default () => {
    const routerLinks = ref<RouterLinkVO[]>([])

    const addRouterLink = (routerLink: RouterLinkVO) => {
        if (routerLinks.value.some((link) => link.name === routerLink.name)) {
            return
        }
        routerLinks.value.push(routerLink)
    }

    const removeRouterLink = (routerLink: RouterLinkVO) => {
        const index = routerLinks.value.indexOf(routerLink)
        if (index > -1) {
            routerLinks.value.splice(index, 1)
        }
    }

    return {
        routerLinks,
        addRouterLink,
        removeRouterLink
    }
}
