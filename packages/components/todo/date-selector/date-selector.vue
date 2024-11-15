<template>
    <nue-div class="date-selector">
        <nue-div v-if="dateMoment" class="date-selector__input-wrapper">
            <nue-input
                theme="small,noshape"
                type="datetime-local"
                v-model="dateMoment"
                :debounce-time="1000"
            ></nue-input>
            <nue-button theme="small,pure" icon="clear" @click="dateMoment = null"></nue-button>
        </nue-div>
        <nue-button v-else theme="small" @click="handleSetDate"> 设置结束时间 </nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import moment from 'moment'
import { computed } from 'vue'
import type { TodoDateSelectorEmits, TodoDateSelectorProps } from './types'

defineOptions({ name: 'TodoDateSelector' })
const props = defineProps<TodoDateSelectorProps>()
const emit = defineEmits<TodoDateSelectorEmits>()

const dateMoment = computed<string | null>({
    get() {
        const { modelValue, date } = props
        if (modelValue && moment(modelValue).isValid()) {
            // console.log(modelValue)
            return modelValue
        }
        if (date) {
            const _m = moment(date).utcOffset(8)
            // console.log(date, _m, _m.isValid(), _m.format('YYYY-MM-DDTHH:mm'))
            return _m.isValid() ? _m.format('YYYY-MM-DDTHH:mm') : null
        }
        return null
    },
    set(value) {
        // console.log(value)
        emit('update:modelValue', value)
        emit('change', value)
    }
})

const handleSetDate = () => {
    const now = moment().utcOffset(8).toISOString(true)
    dateMoment.value = now
}
</script>

<style scoped>
@import url('./date-selector.css');
</style>
