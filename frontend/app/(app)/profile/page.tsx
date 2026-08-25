"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { extractApiError } from "@/lib/errors";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/schemas/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateMe, type ProfileUpdate } from "@/store/slices/authSlice";

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
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">Profile</h1>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-500">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-gray-500">Role</dt>
        <dd className="capitalize">{user.role}</dd>
      </dl>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-3">
        <div>
          <label className="text-sm text-gray-600" htmlFor="full_name">
            Full name
          </label>
          <input
            id="full_name"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("full_name")}
          />
          {errors.full_name && (
            <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
          )}
        </div>

        <hr className="my-2" />
        <p className="text-sm text-gray-600">Change password (optional)</p>

        <div>
          <input
            className="w-full rounded border px-3 py-2"
            type="password"
            placeholder="Current password"
            {...register("current_password")}
          />
          {errors.current_password && (
            <p className="mt-1 text-sm text-red-600">{errors.current_password.message}</p>
          )}
        </div>
        <div>
          <input
            className="w-full rounded border px-3 py-2"
            type="password"
            placeholder="New password (min 8 characters)"
            {...register("new_password")}
          />
          {errors.new_password && (
            <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
          )}
        </div>

        {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
        {saved && <p className="text-sm text-green-600">Saved.</p>}

        <button
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
