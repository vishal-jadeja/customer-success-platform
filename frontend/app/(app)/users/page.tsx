"use client";

import { useEffect } from "react";

import Pagination from "@/components/common/Pagination";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { Role } from "@/store/slices/authSlice";
import { deactivateUser, fetchUsers, updateUser } from "@/store/slices/usersSlice";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { Table, TBody, TCell, TH, THead, TRow } from "@/components/ui/Table";

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
    <PageContainer width="wide">
      <PageHeader title="Users" />

      {status === "loading" && <Skeleton className="h-64 w-full" />}
      {status === "failed" && (
        <div className="rounded-2xl border border-warn/20 bg-warn-soft p-6 text-center text-sm text-warn">
          {error?.message ?? "Failed to load users."}{" "}
          <button className="hover:underline" onClick={() => load({})} type="button">
            Retry
          </button>
        </div>
      )}
      {status === "succeeded" && (
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>Created</TH>
            {isAdmin && <TH />}
          </THead>
          <TBody>
            {users.map((u) => {
              const isMutating = mutatingIds.includes(u.id);
              const mutationError = mutationErrors[u.id];
              return (
                <TRow key={u.id} className={u.is_active ? undefined : "opacity-50"}>
                  <TCell className="font-medium">{u.full_name}</TCell>
                  <TCell className="text-text-secondary">{u.email}</TCell>
                  <TCell>
                    {isAdmin ? (
                      <Select
                        value={u.role}
                        disabled={isMutating}
                        onChange={(e) =>
                          dispatch(updateUser({ id: u.id, data: { role: e.target.value as Role } }))
                        }
                        className="w-auto"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-text-secondary capitalize">{u.role}</span>
                    )}
                  </TCell>
                  <TCell>
                    <Badge tone={u.is_active ? "good" : "neutral"}>
                      {u.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </TCell>
                  <TCell className="text-text-secondary">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TCell>
                  {isAdmin && (
                    <TCell>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isMutating || !u.is_active}
                        onClick={() => dispatch(deactivateUser(u.id))}
                      >
                        Deactivate
                      </Button>
                      {mutationError && <p className="mt-1 text-xs text-bad">{mutationError.message}</p>}
                    </TCell>
                  )}
                </TRow>
              );
            })}
          </TBody>
        </Table>
      )}

      {status === "succeeded" && (
        <Pagination
          page={page}
          pageSize={page_size}
          total={total}
          onPageChange={(p) => load({ page: p })}
        />
      )}
    </PageContainer>
  );
}
