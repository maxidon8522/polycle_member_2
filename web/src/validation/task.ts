import { z } from "zod";

export const taskUpsertSchema = z.object({
  taskId: z.string().optional(),
  projectName: z.string().min(1),
  title: z.string().min(1),
  assigneeName: z.string().min(1),
  status: z.enum(["未着手", "進行中", "レビュー待ち", "完了", "保留", "棄却"]),
  priority: z.enum(["高", "中", "低"]),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  doneDate: z.string().optional(),
  detailUrl: z.union([z.string().url(), z.literal("")]).optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  sheetTitle: z.string().min(1).optional(),
});

export type TaskUpsertSchema = z.infer<typeof taskUpsertSchema>;
