import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clearCsrfToken } from "../../shared/api/csrf";
import { getErrorMessage } from "../../shared/api/errors";
import { logout } from "./authApi";

export function LogoutButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: logout,
    onMutate: () => setErrorMessage(null),
    onSuccess: () => {
      clearCsrfToken();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  return (
    <div className="logout-control">
      <button
        className="button button--quiet"
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Signing out…" : "Sign out"}
      </button>
      {errorMessage ? <span className="control-error" role="alert">{errorMessage}</span> : null}
    </div>
  );
}
