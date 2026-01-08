import type { Metadata } from "next";
import AdminLayoutClient from "@/components/AdminLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main style={{ padding: 24 }}>
         <AdminLayoutClient>{children}</AdminLayoutClient>
      </main>
    </>
  );
}
