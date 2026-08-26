"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";

import { extractApiError } from "@/lib/errors";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/schemas/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateMe, type ProfileUpdate } from "@/store/slices/authSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { full_name: user?.full_name ?? "", current_password: "", new_password: "" },
  });

  async function onSubmit(data: ProfileUpdateInput) {
    setSaved(false);
    const payload: ProfileUpdate = {};
    if (data.full_name && data.full_name !== user?.full_name) {
      payload.full_name = data.full_name;
    }
    if (data.new_password) {
      payload.new_password = data.new_password;
      payload.current_password = data.current_password;
    }
    if (Object.keys(payload).length === 0) {
      setSaved(true); // form matches current state already, nothing to send
      return;
    }

    const result = await dispatch(updateMe(payload));
    if (updateMe.rejected.match(result)) {
      const apiError = result.payload ?? extractApiError(result.error);
      // A wrong current_password comes back as 401 UNAUTHORIZED -> attach it
      // to that field instead of a generic banner.
      const field = apiError.code === "UNAUTHORIZED" ? "current_password" : "root";
      setError(field, { message: apiError.message });
      return;
    }

    setSaved(true);
    reset({ full_name: result.payload.full_name, current_password: "", new_password: "" });
  }

  if (!user) return null;

  return (
    <PageContainer width="narrow">
      <PageHeader title="Profile" />

      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-muted">Email</dt>
          <dd className="text-text">{user.email}</dd>
          <dt className="text-text-muted">Role</dt>
          <dd className="text-text capitalize">{user.role}</dd>
        </dl>
      </Card>

      <Card title="Change details" className="mt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
            <Input id="full_name" {...register("full_name")} />
          </Field>

          <div className="border-t border-hairline pt-4">
            <p className="mb-3 text-sm text-text-secondary">Change password (optional)</p>
            <div className="flex flex-col gap-4">
              <Field label="Current password" error={errors.current_password?.message}>
                <Input type="password" placeholder="••••••••" {...register("current_password")} />
              </Field>
              <Field
                label="New password"
                hint="Minimum 8 characters"
                error={errors.new_password?.message}
              >
                <Input type="password" placeholder="••••••••" {...register("new_password")} />
              </Field>
            </div>
          </div>

          {errors.root && <p className="text-sm text-bad">{errors.root.message}</p>}
          {saved && (
            <p className="flex items-center gap-1.5 text-sm text-good">
              <CheckCircle2 className="h-4 w-4" />
              Saved.
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="self-start">
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
