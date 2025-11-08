// apps/web/app/components/post/PostForm.tsx

'use client';
import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Select, message } from 'antd';
import { gql, useQuery, useMutation } from "@apollo/client";
import AttachFileField from '@/components/AttachFileField';

const UPSERT = gql`
  mutation Upsert($id: ID, $data: PostInput!, $images:[Upload!], $image_ids_delete:[ID!]) {
    upsertPost(id: $id, data: $data, images: $images, image_ids_delete: $image_ids_delete) {
      id
      title
      images { id url }
    }
  }
`;


export type ExistingImage = { id: number|string; url: string };
export type PostRecord = {
  id?: number|string;
  title: string;
  body?:string;
  phone?: string;
  status: 'public' | 'unpublic';
  images?: ExistingImage[];
};

type ExistingFile = { _id: string|number; url: string; delete?: boolean };
type FileValue   = ExistingFile | File;

type Props = {
  apiBase?: string;                  // '' (main) หรือ '/admin' (หลังบ้าน)
  initialData?: PostRecord | null;   // ถ้ามี = edit, ถ้า null/undefined = new
  onSaved?: (savedId: string | number) => void;
  title?: string;                    // ชื่อ Card
};

export default function PostForm({ apiBase = '', initialData, onSaved, title }: Props){
  const [form] = Form.useForm();
  const [files, setFiles] = useState<FileValue[]>([]);
  const isEdit = !!initialData?.id;

  const [onPost, { loading }] = useMutation(UPSERT);

  useEffect(() => {
    if (!initialData) return;
    form.setFieldsValue({
      title: initialData.title,
      phone: initialData.phone,
      status: initialData.status,
    });
    const ex: ExistingFile[] = (initialData.images || []).map(img => ({
      _id: img.id, url: img.url,
    }));
    setFiles(ex);
  }, [initialData, form]);

  // ⬇️ CHANGE: ภายใน onFinish
  async function onFinish(values: any){
    const existingKeepIds = files
      .filter((f:any)=> 'url' in f && !f.delete)
      .map((f:any)=> String(f._id));                  // แปลงเป็น string ให้ตรง [ID!]

    const existingDeleteIds = files
      .filter((f:any)=> 'url' in f && f.delete)
      .map((f:any)=> String(f._id));                  // ✅ ส่งให้ image_ids_delete

    const newFiles = files.filter((f): f is File => f instanceof File); // ✅ เฉพาะไฟล์ใหม่

    const variables: any = {
      id: isEdit ? String(initialData!.id) : null,
      data: {
        title: values.title,
        body: values.body ?? "",
        phone: values.phone || "",
        status: values.status || "public",
      },
      image_ids_delete: existingDeleteIds,            // ⬅️ ✅ สำคัญ
    };

    if (newFiles.length > 0) {
      variables.images = newFiles;                    // ⬅️ ✅ เฉพาะไฟล์ใหม่เท่านั้น
    }

    console.log("[variables]", variables);

    const { data } = await onPost({ variables });

    // ⬇️ CHANGE: แจ้งผล + อัปเดทสถานะ/รูปใหม่หลังบันทึก
    if (data?.upsertPost?.id) {
      message.success(isEdit ? 'Saved' : 'Created');

      // อัปเดตไฟล์ฝั่งฟอร์มให้ตรงกับของจริงที่เซิร์ฟเวอร์คำนวณแล้ว
      const savedImgs = (data.upsertPost.images || []).map((img: any) => ({
        _id: img.id,
        url: img.url,
      }));
      setFiles(savedImgs);

      onSaved?.(data.upsertPost.id);
    } else {
      message.error(isEdit ? 'Save failed' : 'Create failed');
    }
  }

  return (
    <Card title={title ?? (isEdit ? 'Edit Post' : 'New Post')} style={{ maxWidth: 720 }}>
      <Form form={form} layout="vertical" onFinish={onFinish}
        initialValues={{ status: 'public' }}>
        <Form.Item name="title" label="Title" rules={[{ required:true }]}><Input /></Form.Item>
        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="status" label="Status">
          <Select options={[{value:'public',label:'public'},{value:'unpublic',label:'unpublic'}]} />
        </Form.Item>

        <AttachFileField
          label="Images"
          values={files}
          multiple
          accept="image/*"
          onChange={setFiles}
          onSnackbar={(s)=> s.open && message.info(s.message)}
        />

        <Button type="primary" htmlType="submit" style={{ marginTop: 16 }} loading={loading}>
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </Form>
    </Card>
  )
}
