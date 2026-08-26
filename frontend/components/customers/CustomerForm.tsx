"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { api } from "@/lib/axios";
import { fieldErrorsFromDetails, type ApiError } from "@/lib/errors";
import {
  customerFormSchema,
  customerStatuses,
  type CustomerFormInput,
  type CustomerFormRawInput,
} from "@/schemas/customer";
import { useAppSelector } from "@/store/hooks";
import type { User } from "@/store/slices/authSlice";
import type { CustomerFormPayload } from "@/store/slices/customersSlice";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface UsersPage {
  items: User[];
}

export default function CustomerForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<CustomerFormRawInput>;
  onSubmit: (data: CustomerFormPayload) => Promise<ApiError | null>;
  submitLabel: string;
}) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const canAssignOwner = currentUser?.role === "admin" || currentUser?.role === "manager";
  const [owners, setOwners] = useState<User[]>([]);

  // Owner selector data source: a plain GET, not a Redux slice — the
  // dropdown is the only consumer this phase (Phase 09 has no usersSlice in
  // its file list; the admin Users page is an optional Phase 10 item).
  useEffect(() => {
    if (!canAssignOwner) return;
    let cancelled = false;
    api
      .get<UsersPage>("/users", { params: { page_size: 100 } })
      .then(({ data }) => {
        if (!cancelled) setOwners(data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canAssignOwner]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormRawInput, unknown, CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      industry: "",
      status: "onboarding",
      health_score: 50,
      arr: "",
      owner_id: "",
      ...defaultValues,
    },
  });

  async function submit(data: CustomerFormInput) {
    const payload: CustomerFormPayload = {
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone || null,
      industry: data.industry || null,
      status: data.status,
      health_score: data.health_score,
      arr: data.arr || null,
    };
    if (canAssignOwner && data.owner_id) {
      payload.owner_id = data.owner_id;
    }

    const apiError = await onSubmit(payload);
    if (!apiError) return;

    if (apiError.code === "CONFLICT") {
      setError("email", { message: "A customer with this email already exists" });
      return;
    }
    if (apiError.code === "VALIDATION_ERROR") {
      const fieldErrors = fieldErrorsFromDetails(apiError.details);
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (field in data) setError(field as keyof CustomerFormInput, { message });
      }
      if (Object.keys(fieldErrors).length === 0) {
        setError("root", { message: apiError.message });
      }
      return;
    }
    if (apiError.code === "PERMISSION_DENIED") {
      setError("root", { message: "You don't have access to do that." });
      return;
    }
    setError("root", { message: apiError.message });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" {...register("name")} />
        </Field>
        <Field label="Company" htmlFor="company" error={errors.company?.message}>
          <Input id="company" {...register("company")} />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" {...register("email")} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" {...register("phone")} />
        </Field>
        <Field label="Industry" htmlFor="industry">
          <Input id="industry" {...register("industry")} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Status" htmlFor="status">
          <Select id="status" {...register("status")}>
            {customerStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Health score (0-100)" htmlFor="health_score" error={errors.health_score?.message}>
          <Input id="health_score" type="number" min={0} max={100} {...register("health_score")} />
        </Field>
        <Field label="ARR" htmlFor="arr" error={errors.arr?.message}>
          <Input id="arr" {...register("arr")} />
        </Field>
      </div>

      {canAssignOwner && (
        <Field label="Owner" htmlFor="owner_id">
          <Select id="owner_id" {...register("owner_id")}>
            <option value="">(unchanged / self)</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </Select>
        </Field>
      )}

      {errors.root && <p className="text-sm text-bad">{errors.root.message}</p>}

      <Button type="submit" loading={isSubmitting} className="mt-1 self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
