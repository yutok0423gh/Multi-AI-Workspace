import { z } from 'zod';

const platformIdSchema = z.enum([
  'chatgpt',
  'claude',
  'gemini',
  'deepseek',
  'grok',
  'kimi',
  'custom',
]);

export const promptRecordSchema = z
  .object({
    id: z.string().min(1),
    scope: z.enum(['global', 'platform', 'account']),
    platformId: platformIdSchema.nullable(),
    accountScopeId: z.string().min(1).nullable(),
    title: z.string().min(1),
    content: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    folderId: z.string().nullable(),
    usageCount: z.number().int().nonnegative(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .superRefine((record, context) => {
    if (
      record.scope === 'global' &&
      (record.platformId !== null || record.accountScopeId !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Global prompts cannot carry platform or account scope identifiers.',
      });
    }
    if (record.scope === 'platform' && record.platformId === null) {
      context.addIssue({
        code: 'custom',
        message: 'Platform prompts require a platform identifier.',
      });
    }
    if (
      record.scope === 'account' &&
      (record.platformId === null || record.accountScopeId === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Account prompts require platform and account scope identifiers.',
      });
    }
  });
