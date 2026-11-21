<script setup lang="ts">
const props = withDefaults(
  defineProps<{ modelValue: string; saveLabel?: string; disabled?: boolean }>(),
  { saveLabel: '保存', disabled: false }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
}>()

function update(next: string): void {
  emit('update:modelValue', next)
}

function inputDigit(digit: string): void {
  let value = props.modelValue
  const hasDot = value.includes('.')
  const [intPart, decimalPart = ''] = value.split('.')
  if (hasDot) {
    if (decimalPart.length >= 2) return
  } else if (intPart.length >= 7) {
    return
  }
  if (value === '0') value = digit
  else value = value + digit
  update(value)
}

function inputDot(): void {
  if (props.modelValue.includes('.')) return
  if (props.modelValue === '' || props.modelValue === '0') update('0.')
  else update(`${props.modelValue}.`)
}

function inputDoubleZero(): void {
  const value = props.modelValue
  if (value.includes('.') || value === '0') return
  if (value.length > 5) return
  update(`${value}00`)
}

function backspace(): void {
  const value = props.modelValue
  update(value.length <= 1 ? '0' : value.slice(0, -1))
}

function clearAll(): void {
  update('0')
}

function onSave(): void {
  if (props.disabled) return
  emit('save')
}
</script>

<template>
  <div class="keypad">
    <button class="key" style="grid-area: k1" @click="inputDigit('1')">1</button>
    <button class="key" style="grid-area: k2" @click="inputDigit('2')">2</button>
    <button class="key" style="grid-area: k3" @click="inputDigit('3')">3</button>
    <button class="key key--fn" style="grid-area: del" aria-label="退格" @click="backspace">退格</button>

    <button class="key" style="grid-area: k4" @click="inputDigit('4')">4</button>
    <button class="key" style="grid-area: k5" @click="inputDigit('5')">5</button>
    <button class="key" style="grid-area: k6" @click="inputDigit('6')">6</button>
    <button class="key key--fn" style="grid-area: clr" @click="clearAll">清空</button>

    <button class="key" style="grid-area: k7" @click="inputDigit('7')">7</button>
    <button class="key" style="grid-area: k8" @click="inputDigit('8')">8</button>
    <button class="key" style="grid-area: k9" @click="inputDigit('9')">9</button>
    <button class="key key--save" style="grid-area: save" :disabled="disabled" @click="onSave">
      {{ saveLabel }}
    </button>

    <button class="key" style="grid-area: dot" @click="inputDot">.</button>
    <button class="key" style="grid-area: k0" @click="inputDigit('0')">0</button>
    <button class="key" style="grid-area: k00" @click="inputDoubleZero">00</button>
  </div>
</template>
