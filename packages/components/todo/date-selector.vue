<script lang="ts" setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import moment from 'moment'

type TodoDateSelectorProps = {
    colored?: boolean
    modelValue?: string | null
    date?: Date | string | null
}
type TodoDateSelectorEmits = {
    (event: 'update:modelValue', value: string | null): void
    (event: 'change', value: string | null): void
}

defineOptions({ name: 'TodoDateSelector', inheritAttrs: false })
const props = defineProps<TodoDateSelectorProps>()
const emit = defineEmits<TodoDateSelectorEmits>()

const dateMoment = computed<string | null>({
    get() {
        const { modelValue, date } = props
        if (modelValue) return dayjs(modelValue).format('YYYY-MM-DDTHH:mm')
        if (date) return dayjs(date).format('YYYY-MM-DDTHH:mm')
        return null
    },
    set(value) {
        if (value === 'NOW') {
            value = moment().toISOString()
        } else {
            value = value ? moment(value).toISOString() : null
        }
        emit('update:modelValue', value)
        emit('change', value)
    }
})

const isExpired = computed(() => {
    if (!props.modelValue) return false
    return moment(props.modelValue).isBefore(moment())
})

const handleAddDateByNow = () => {
    dateMoment.value = 'NOW'
}
</script>

<template>
    <nue-div theme="date-selector" :data-expired="colored ? isExpired : void 0">
        <nue-div v-if="dateMoment" class="date-selector__input-wrapper" auto-fit>
            <nue-div align="center" gap="0.25rem">
                <nue-input
                    v-model="dateMoment"
                    :debounce-time="256"
                    theme="small,pure"
                    :type="'datetime-local' as never"
                />
            </nue-div>
            <nue-divider vertical />
            <nue-button icon="clear" theme="small,icon,pure" @click="dateMoment = null" />
        </nue-div>
        <nue-button v-else theme="small" @click="handleAddDateByNow">设置截止时间</nue-button>
    </nue-div>
</template>

<style scoped>
.nue-div.nue-div--date-selector {
    width: fit-content;
    align-items: center;

    .date-selector__input-wrapper {
        gap: 0.5rem;
        padding: 0 0.5rem;
        height: var(--nue-box-size-sm);
        border-radius: var(--nue-primary-radius);
        border: 1px solid var(--nue-divider-color);
        box-shadow: var(--nue-secondary-shadow);
        align-items: center;

        .nue-input {
            padding: 0;
            margin: 0;

            &:deep(.nue-input__input) {
                width: fit-content;
            }
        }
    }

    .nue-divider {
        height: calc(100% - 0.5rem);
    }

    &:hover {
        background-color: #f5f5f5;
    }

    &[data-expired='false'] .nue-input {
        --nue-input-color: rgb(112, 112, 255);
    }

    &[data-expired='true'] .nue-input {
        --nue-input-color: rgb(255, 74, 74);
    }
}
</style>

