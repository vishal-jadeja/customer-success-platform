"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { extractApiError } from "@/lib/errors";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { useAppDispatch } from "@/store/hooks";
import { register as registerThunk } from "@/store/slices/authSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";

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
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-white">
          C
        </span>
        <span className="text-sm font-semibold tracking-tight text-text">
          Customer Success Platform
        </span>
      </div>

      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-text">Create account</h1>
        <p className="mt-1 text-sm text-text-muted">
          New accounts are created as CSM — ask an admin to change your role later.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 flex flex-col gap-4">
          <Field label="Full name" error={errors.full_name?.message}>
            <Input placeholder="Jane Doe" {...register("full_name")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" placeholder="you@company.com" {...register("email")} />
          </Field>
          <Field label="Password" hint="Minimum 8 characters" error={errors.password?.message}>
            <Input type="password" placeholder="••••••••" {...register("password")} />
          </Field>
          {errors.root && <p className="text-sm text-bad">{errors.root.message}</p>}
          <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
