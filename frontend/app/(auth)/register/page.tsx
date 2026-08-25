"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { extractApiError } from "@/lib/errors";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { useAppDispatch } from "@/store/hooks";
import { register as registerThunk } from "@/store/slices/authSlice";

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    const result = await dispatch(registerThunk(data));
    if (registerThunk.rejected.match(result)) {
      const apiError = result.payload ?? extractApiError(result.error);
      setError("root", { message: apiError.message });
      return;
    }
    router.push("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="text-sm text-gray-600">
        New accounts are created as CSM &mdash; ask an admin to change your role later.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Full name"
            {...register("full_name")}
          />
          {errors.full_name && (
            <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
          )}
        </div>
        <div>
          <input
            className="w-full rounded border px-3 py-2"
            type="email"
            placeholder="Email"
            {...register("email")}
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <input
            className="w-full rounded border px-3 py-2"
            type="password"
            placeholder="Password (min 8 characters)"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>
        {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <button
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
