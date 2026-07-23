"use client"

import * as React from "react"
import type { Label as LabelPrimitive } from "radix-ui"
import { Slot } from "radix-ui"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form"
import { z } from "zod/v4"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

type FormSchemaContextValue = {
  schema?: z.ZodTypeAny
}

const FormSchemaContext = React.createContext<FormSchemaContextValue>({})

type FormProps<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues extends FieldValues | undefined = undefined,
> = UseFormReturn<TFieldValues, TContext, TTransformedValues> & {
  children: React.ReactNode
  schema?: z.ZodTypeAny
}

function Form<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  schema,
  ...props
}: FormProps<TFieldValues, TContext, TTransformedValues>) {
  return (
    <FormSchemaContext.Provider value={{ schema }}>
      <FormProvider {...props} />
    </FormSchemaContext.Provider>
  )
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { required?: boolean }) {
  const { error, formItemId, name } = useFormField()
  const { schema } = React.useContext(FormSchemaContext)

  const inferredRequired = React.useMemo(
    () => inferIsRequiredFromSchema(schema, String(name)),
    [schema, name]
  )

  const showRequired = required ?? inferredRequired

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    >
      {showRequired ? <span className="ml-0.5 text-destructive">*</span> : null}
      {children}
    </Label>
  )
}

function inferIsRequiredFromSchema(
  schema: z.ZodTypeAny | undefined,
  fieldPath: string
): boolean {
  if (!schema || !fieldPath) return false

  const segments = fieldPath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) return false

  let current: any = schema
  let optionalSeen = false

  for (const segment of segments) {
    if (!current) return false

    optionalSeen ||= isOptionalInput(current)
    current = unwrapSchema(current)

    if (isNumericSegment(segment)) {
      if (current instanceof z.ZodArray) {
        current = current.element
      }
      continue
    }

    if (current instanceof z.ZodArray) {
      current = current.element
    }

    optionalSeen ||= isOptionalInput(current)
    current = unwrapSchema(current)

    if (current instanceof z.ZodObject) {
      const shape = current.shape
      const next = shape?.[segment]
      if (!next) return false
      current = next
      continue
    }

    return false
  }

  if (!current) return false
  optionalSeen ||= isOptionalInput(current)
  current = unwrapSchema(current)

  return isFieldRequired(current, optionalSeen)
}

function isOptionalInput(schema: z.ZodTypeAny | undefined): boolean {
  if (!schema) return false
  return typeof schema.isOptional === "function" ? schema.isOptional() : false
}

function isNumericSegment(segment: string): boolean {
  return /^\d+$/.test(segment)
}

function isFieldRequired(schema: any, optionalSeen: boolean): boolean {
  if (!schema || optionalSeen) return false

  // If undefined is accepted by the schema input, field is not required.
  if (acceptsValue(schema, undefined)) return false

  // For text-like inputs, empty string acceptance means not required in UX terms.
  if (isTextLikeSchema(schema) && acceptsValue(schema, "")) return false

  // Nullable fields are not required in UX terms.
  if (acceptsValue(schema, null)) return false

  return true
}

function isTextLikeSchema(schema: any): boolean {
  if (!schema) return false

  if (
    schema instanceof z.ZodString ||
    schema instanceof z.ZodEnum ||
    schema instanceof z.ZodLiteral
  ) {
    return true
  }

  if (schema instanceof z.ZodUnion) {
    const options = (schema as any)?.options
    if (Array.isArray(options)) {
      return options.some((option) => isTextLikeSchema(option))
    }
  }

  return false
}

function acceptsValue(schema: any, value: unknown): boolean {
  try {
    const result = schema.safeParse(value)
    return !!result?.success
  } catch {
    return false
  }
}

function unwrapSchema(schema: any): any {
  let current: any = schema

  while (true) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable
    ) {
      current = current.unwrap()
      continue
    }

    if (current instanceof z.ZodDefault) {
      current = current.removeDefault()
      continue
    }

    if (current instanceof z.ZodArray) {
      return current
    }

    if (current instanceof z.ZodObject) {
      return current
    }

    const def = (current as any)?._def

    if (def?.schema && typeof def.schema === "object") {
      current = def.schema as z.ZodTypeAny
      continue
    }

    if (def?.innerType && typeof def.innerType === "object") {
      current = def.innerType as z.ZodTypeAny
      continue
    }

    return current
  }
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error
    ? translateFormErrorMessage(String(error?.message ?? ""))
    : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

function translateFormErrorMessage(message: string): string {
  const normalized = message.trim()
  if (!normalized) return normalized

  const lower = normalized.toLowerCase()

  // Zod type mismatch: "Invalid input: expected number, received null"
  const expectedReceivedMatch = lower.match(
    /^invalid input:\s*expected\s+([^,]+),\s*received\s+(.+)$/
  )
  if (expectedReceivedMatch) {
    const expected = expectedReceivedMatch[1]
    const received = expectedReceivedMatch[2]
    return `Dữ liệu không hợp lệ: cần ${translateTypeToken(expected)}, nhưng nhận ${translateTypeToken(received)}`
  }

  if (lower === "required") return "Trường này là bắt buộc"
  if (lower.includes("expected number")) return "Giá trị phải là số"
  if (lower.includes("expected string")) return "Giá trị phải là chuỗi"
  if (lower.includes("expected boolean")) return "Giá trị phải là đúng/sai"

  return normalized
}

function translateTypeToken(token: string): string {
  const clean = token.replace(/[.]/g, "").trim().toLowerCase()
  const map: Record<string, string> = {
    string: "chuỗi",
    number: "số",
    boolean: "đúng/sai",
    object: "đối tượng",
    array: "mảng",
    null: "null",
    undefined: "rỗng",
    nan: "không phải số",
  }

  return map[clean] ?? token.trim()
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
