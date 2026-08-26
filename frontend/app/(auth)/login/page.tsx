"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { extractApiError } from "@/lib/errors";
import { loginSchema, type LoginInput } from "@/schemas/auth";
import { useAppDispatch } from "@/store/hooks";
import { login } from "@/store/slices/authSlice";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    const result = await dispatch(login(data));
    if (login.rejected.match(result)) {
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
        <h1 className="text-lg font-semibold text-text">Welcome back</h1>
        <p className="mt-1 text-sm text-text-muted">Log in to your account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 flex flex-col gap-4">
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" placeholder="you@company.com" {...register("email")} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <Input type="password" placeholder="••••••••" {...register("password")} />
          </Field>
          {errors.root && <p className="text-sm text-bad">{errors.root.message}</p>}
          <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
            {isSubmitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>

      <p className="mt-5 text-sm text-text-muted">
        No account?{" "}
        <Link href="/register" className="text-accent hover:underline">
          Register
        </Link>
      </p>
    </main>
  );
}
