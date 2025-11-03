'use client';
import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Select, message } from 'antd';
import { gql, useQuery, useMutation } from "@apollo/client";

import AttachFileField from '@/components/AttachFileField';

// upsertPost(id: ID, data: PostInput!, images: [Upload!]): Post!
const UPSERT = gql`
  mutation Upsert($id: ID, $data: PostInput!, $images:[Upload!]) {
    upsertPost(id: $id, data: $data, images: $images) { id title images { id url } }
  }
`;


export type ExistingImage = { id: number|string; url: string };
export type PostRecord = {
  id?: number|string;
  title: string;
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

  // const [onProduct] = useMutation(mutation_product, {
  //   context: { headers: getHeaders(location) },
  //   update: (cache, { data: { product } }, params: any) => {
  //     // console.log("product:", product);
  //     // let { status } = product
  //     // if(status){
  //     //   let { input } = params?.variables;
  //     //   switch(input.mode){
  //     //     case 'added':{
  //     //       message.success('เพิ่มสินค้าใหม่ เรียบร้อย!');
  //     //     }
  //     //     case 'edited':{
  //     //       message.success('แก้ไขสินค้า เรียบร้อย!');
  //     //     }
  //     //   }
  //     // }
  //   },
  //   onCompleted: (data: any) => {
  //     // setLoading(false);  // Set loading to false when mutation completes
  //     // navigate(-1);
  //   },
  //   onError: (error: any) => {
  //     // setLoading(false);  // Set loading to false when an error occurs
  //     // console.log("product onError:", error);
  //     // handlerError(props, error);
  //   }
  // });

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

  async function onFinish(values: any){
    const existingKeepIds = files
      .filter((f:any)=> 'url' in f && !f.delete)
      .map((f:any)=> f._id);
    const existingDeleteIds = files
      .filter((f:any)=> 'url' in f && f.delete)
      .map((f:any)=> f._id);
    // const newFiles = files.filter(f => f instanceof File) as File[];
    const newFiles = files.filter((f): f is File => f instanceof File);

    const fd = new FormData();
    fd.append('title', values.title);
    fd.append('phone', values.phone || '');
    fd.append('status', values.status || 'public');
    fd.append('existing_keep', JSON.stringify(existingKeepIds));
    fd.append('existing_delete', JSON.stringify(existingDeleteIds));
    // newFiles.forEach((f,i)=> fd.append('uploads', f, f.name || `file_${i}`));

    // const url = isEdit
    //   ? `${apiBase}/api/posts/${initialData!.id}`
    //   : `${apiBase}/api/posts`;

    // const res = await fetch(url, {
    //   method: isEdit ? 'PATCH' : 'POST',
    //   body: fd,
    //   credentials: 'include'
    // });
    // const j = await res.json().catch(()=> ({}));
    // if (res.ok) {
    //   message.success(isEdit ? 'Saved' : 'Created');
    //   onSaved?.(j.id ?? initialData?.id!);
    // } else {
    //   message.error(j.error || (isEdit ? 'Save failed' : 'Create failed'));
    // }

    // product(input: JSON): JSON
    // upsertPost(id: ID, data: PostInput!): Post!
    // onPost({ variables: { input: { ...input, mode, images } } });

    // const { data } = await onPost({
    //   variables: {
    //     id: null,
    //     data: { title: "SSS", body: "xx", status: 'public' },
    //     images: newFiles, // << ส่ง array ของ File objects
    //   },
    // });

    const variables: any = {
      id: isEdit ? String(initialData!.id) : null,
      data: {
        title: values.title,
        body: values.body ?? "",        // เพิ่ม field body ให้ตรง schema
        phone: values.phone || "",
        status: values.status || "public",
        // ถ้าคุณมีระบบ keep/delete ฝั่ง GQL ให้ส่งเพิ่มใน data หรือ args อื่น
        // existing_keep: existingKeepIds,
        // existing_delete: existingDeleteIds,
      },
    };

    // ✅ ส่ง images เฉพาะเมื่อมีไฟล์จริง
    if (newFiles.length > 0) {
      variables.images = newFiles; // ต้องเป็น File[] เท่านั้น
    }

    const { data } = await onPost({ variables });

    console.log("[onFinish]", newFiles);


    if(isEdit){

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
  );
}
