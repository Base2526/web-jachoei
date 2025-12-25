"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { gql, useMutation } from "@apollo/client";

const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      ok
      message
    }
  }
`;

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [verifyEmail] = useMutation(VERIFY_EMAIL);
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {
    if (!token) {
      setStatus("Invalid link");
      return;
    }

    verifyEmail({ variables: { token } })
      .then(({ data }) => {
        if (data.verifyEmail.ok) {
          setStatus("✅ Email verified successfully");
        } else {
          setStatus(data.verifyEmail.message);
        }
      })
      .catch(() => {
        setStatus("Verification failed");
      });
  }, [token]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>{status}</h1>
    </div>
  );
}
