"use client";

import { Breadcrumb } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function Breadcrumbs() {
  const pathname = usePathname() || "/";
  // ตัด query/hash แล้ว split เป็น segment
  const segments = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);

  // สร้าง items เป็น [{title, href?}]
  const items = [
    { title: <Link href="/">Home</Link> },
    ...segments.map((seg, idx) => {
      const href = "/" + segments.slice(0, idx + 1).join("/");
      // ทำให้สวยขึ้นนิดหน่อย (เช่น [id] => id, เปลี่ยน - เป็น space, ตัวแรกใหญ่)
      const label = decodeURIComponent(seg)
        .replace(/^\[|\]$/g, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const isLast = idx === segments.length - 1;
      return {
        title: isLast ? <span>{label}</span> : <Link href={href}>{label}</Link>,
      };
    }),
  ];

  return <Breadcrumb items={items} style={{ marginBottom: 16 }} />;
}
