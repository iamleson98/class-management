import { z } from 'zod/v4'
import { requiredString, optionalString, optionalDateField, idField, notesField } from './common'
import { TaskPriority, TaskStatus } from './enums'

export const createTaskSchema = z.object({
  title: requiredString,
  description: optionalString,
  assigneeId: idField,
  creatorId: idField,
  deadline: optionalDateField,
  priority: TaskPriority.optional().default('MEDIUM'),
  status: TaskStatus.optional().default('TODO'),
  notes: notesField,
})

export const updateTaskSchema = z.object({
  title: requiredString.optional(),
  description: optionalString,
  assigneeId: idField.optional(),
  deadline: optionalDateField,
  priority: TaskPriority.optional(),
  status: TaskStatus.optional(),
  notes: notesField,
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
