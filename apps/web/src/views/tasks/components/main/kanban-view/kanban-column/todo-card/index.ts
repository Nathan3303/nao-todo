// import Card from './card.vue'
//
// export const TodoCard = Card

import { defineAsyncComponent } from 'vue'

export const TodoCard = defineAsyncComponent(async () => {
    return await import('./card.vue')
})