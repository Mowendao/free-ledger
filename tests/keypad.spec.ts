// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AmountKeypad from '@/components/AmountKeypad.vue'

function key(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find((item) => item.text() === label)
  if (!button) throw new Error(`按钮不存在：${label}`)
  return button
}

describe('数字键盘', () => {
  it('避免前导零并拼接数字', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '0' } })
    await key(wrapper, '1').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['1'])

    await wrapper.setProps({ modelValue: '1' })
    await key(wrapper, '2').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['12'])
  })

  it('小数最多两位', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '1.23' } })
    await key(wrapper, '4').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('小数点、退格与清空', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '0' } })
    await key(wrapper, '.').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['0.'])

    await wrapper.setProps({ modelValue: '12' })
    await key(wrapper, '退格').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['1'])

    await key(wrapper, '清空').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[2]).toEqual(['0'])
  })

  it('整数最多七位', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '1234567' } })
    await key(wrapper, '8').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('保存事件与禁用状态', async () => {
    const wrapper = mount(AmountKeypad, { props: { modelValue: '5' } })
    await key(wrapper, '保存').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)

    const disabled = mount(AmountKeypad, { props: { modelValue: '5', disabled: true } })
    await key(disabled, '保存').trigger('click')
    expect(disabled.emitted('save')).toBeUndefined()
  })
})
