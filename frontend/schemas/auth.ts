import { z } from "zod";

// Mirrors backend/app/schemas/auth.py::LoginIn
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Mirrors backend/app/schemas/auth.py::RegisterIn (PasswordStr: min 8, bcrypt's 72-byte cap)
export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  full_name: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Mirrors backend/app/schemas/auth.py::MeUpdateIn, including its
// model_validator(_password_pair): new_password requires current_password,
// and at least one of full_name/new_password must be present.
export const profileUpdateSchema = z
  .object({
    full_name: z.string().min(1).max(120).optional().or(z.literal("")),
    current_password: z.string().max(72).optional().or(z.literal("")),
    new_password: z.string().min(8).max(72).optional().or(z.literal("")),
  })
  .refine((v) => !(v.new_password && !v.current_password), {
    message: "Current password is required to set a new password",
    path: ["current_password"],
  })
  .refine((v) => Boolean(v.full_name) || Boolean(v.new_password), {
    message: "Nothing to update",
    path: ["full_name"],
  });
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
