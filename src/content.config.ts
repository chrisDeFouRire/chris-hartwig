import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string().default('Chris Hartwig'),
    tags: z.array(z.string()).optional(),
    issueNumber: z.number().optional(),
  }),
});

export const collections = { blog };