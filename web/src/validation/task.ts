import { z } from "zod";

export const taskUpsertSchema = z.object({
  taskId: z.string().optional(),
  projectName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  assigneeName: z.string().min(1),
  assigneeEmail: z.string().email(),
  slackUserId: z.string().optional(),
  category: z.string().optional(),
  taskType: z.string().optional(),
  status: z.enum(["未着手", "進行中", "レビュー待ち", "完了", "保留", "棄却"]),
  progressPercent: z.number().int().min(0).max(100),
  priority: z.enum(["高", "中", "低"]),
  importance: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  doneDate: z.string().optional(),
  links: z
    .array(
      z.object({
        label: z.string().optional(),
        url: z.string().url(),
      }),
    )
    .default([]),
  notes: z.string().optional(),
  createdBy: z.string().min(1),
  watchers: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type TaskUpsertSchema = z.infer<typeof taskUpsertSchema>;
