import { z } from 'zod';

export const credentialSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  username: z.string().max(200),
  password: z.string().max(2000),
  notes: z.string().max(4000),
  category: z.string().max(100).default(''),
  twoStepLogin: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const vaultPayloadSchema = z.object({
  credentials: z.array(credentialSchema),
});

export type VaultPayload = z.infer<typeof vaultPayloadSchema>;

export const kdfParamsSchema = z.object({
  type: z.literal('argon2id'),
  salt: z.string(),
  memoryCost: z.number(),
  timeCost: z.number(),
  parallelism: z.number(),
});

export const vaultFileSchema = z.object({
  version: z.literal(1),
  kdf: kdfParamsSchema,
  cipher: z.literal('aes-256-gcm'),
  iv: z.string(),
  authTag: z.string(),
  ciphertext: z.string(),
});

export type KdfParams = z.infer<typeof kdfParamsSchema>;
export type VaultFile = z.infer<typeof vaultFileSchema>;
