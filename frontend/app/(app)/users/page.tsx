"use client";

import { useEffect } from "react";

import Pagination from "@/components/common/Pagination";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { Role } from "@/store/slices/authSlice";
import { deactivateUser, fetchUsers, updateUser } from "@/store/slices/usersSlice";

const ROLES: Role[] = ["admin", "manager", "csm"];

export default function UsersPage() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const { ids, entities, total, page, page_size, status, error, mutatingIds, mutationErrors } =
    useAppSelector((state) => state.users);

  function load(params: { page?: number }) {
    dispatch(fetchUsers(params));
  }

  useEffect(() => {
    load({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const users = ids.map((id) => entities[id]);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-4 text-xl font-semibold">Users</h1>

      <div className="rounded border">
        {status === "loading" && <p className="p-6 text-center text-sm text-gray-500">Loading…</p>}
        {status === "failed" && (
          <div className="p-6 text-center text-sm text-red-600">
            {error?.message ?? "Failed to load users."}{" "}
            <button className="underline" onClick={() => load({})} type="button">
              Retry
            </button>
          </div>
        )}
        {status === "succeeded" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Created</th>
                {isAdmin && <th className="py-2 pr-4" />}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMutating = mutatingIds.includes(u.id);
                const mutationError = mutationErrors[u.id];
                return (
                  <tr key={u.id} className={`border-b ${u.is_active ? "" : "opacity-50"}`}>
                    <td className="py-2 pr-4 font-medium">{u.full_name}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">
                      {isAdmin ? (
                        <select
                          value={u.role}
                          disabled={isMutating}
                          onChange={(e) =>
                            dispatch(
                              updateUser({ id: u.id, data: { role: e.target.value as Role } }),
                            )
                          }
                          className="rounded border px-2 py-1"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize">{u.role}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{u.is_active ? "Active" : "Deactivated"}</td>
                    <td className="py-2 pr-4">{new Date(u.created_at).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          disabled={isMutating || !u.is_active}
                          onClick={() => dispatch(deactivateUser(u.id))}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          Deactivate
                        </button>
                        {mutationError && (
                          <p className="mt-1 text-xs text-red-600">{mutationError.message}</p>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {status === "succeeded" && (
        <Pagination
          page={page}
          pageSize={page_size}
          total={total}
          onPageChange={(p) => load({ page: p })}
        />
      )}
    </div>
  );
}
