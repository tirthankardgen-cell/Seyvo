import { z } from 'zod';

// Only non-typing function/OEM events may be calibrated as firmware Fn.
export const fnBindingSchema = z
  .object({
    vk: z
      .number()
      .int()
      .refine((vk) => (vk >= 0x7c && vk <= 0x87) || [0xe3, 0xe4, 0xe8, 0xff].includes(vk)),
    scan: z.number().int().min(0).max(511),
    extended: z.boolean(),
  })
  .strict();
export type FnBinding = z.infer<typeof fnBindingSchema>;
