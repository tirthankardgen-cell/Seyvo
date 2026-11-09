import { expect, it } from 'vitest';
import { fnBindingSchema } from '../../src/main/fn-key';

it('accepts only bounded non-typing Fn event mappings', () => {
  for (const vk of [0x41, 0x0d, 0x20, 0xa3, 0xe7, 0, 256])
    expect(fnBindingSchema.safeParse({ vk, scan: 1, extended: false }).success).toBe(false);
  expect(fnBindingSchema.safeParse({ vk: 0x7c, scan: 0x64, extended: false }).success).toBe(true);
  expect(fnBindingSchema.safeParse({ vk: 0x7c, scan: 512, extended: false }).success).toBe(false);
  expect(
    fnBindingSchema.safeParse({ vk: 0x7c, scan: 1, extended: false, command: 'anything' }).success,
  ).toBe(false);
});
