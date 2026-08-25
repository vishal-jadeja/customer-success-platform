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
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-600" htmlFor="name">
            Name
          </label>
          <input id="name" className="mt-1 w-full rounded border px-3 py-2" {...register("name")} />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-sm text-gray-600" htmlFor="company">
            Company
          </label>
          <input
            id="company"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("company")}
          />
          {errors.company && <p className="mt-1 text-sm text-red-600">{errors.company.message}</p>}
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-600" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mt-1 w-full rounded border px-3 py-2"
          {...register("email")}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-600" htmlFor="phone">
            Phone
          </label>
          <input id="phone" className="mt-1 w-full rounded border px-3 py-2" {...register("phone")} />
        </div>
        <div>
          <label className="text-sm text-gray-600" htmlFor="industry">
            Industry
          </label>
          <input
            id="industry"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("industry")}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-600" htmlFor="status">
            Status
          </label>
          <select id="status" className="mt-1 w-full rounded border px-3 py-2" {...register("status")}>
            {customerStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600" htmlFor="health_score">
            Health score (0-100)
          </label>
          <input
            id="health_score"
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("health_score")}
          />
          {errors.health_score && (
            <p className="mt-1 text-sm text-red-600">{errors.health_score.message}</p>
          )}
        </div>
        <div>
          <label className="text-sm text-gray-600" htmlFor="arr">
            ARR
          </label>
          <input id="arr" className="mt-1 w-full rounded border px-3 py-2" {...register("arr")} />
          {errors.arr && <p className="mt-1 text-sm text-red-600">{errors.arr.message}</p>}
        </div>
      </div>

      {canAssignOwner && (
        <div>
          <label className="text-sm text-gray-600" htmlFor="owner_id">
            Owner
          </label>
          <select
            id="owner_id"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("owner_id")}
          >
            <option value="">(unchanged / self)</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <button
        type="submit"
        className="mt-2 rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
