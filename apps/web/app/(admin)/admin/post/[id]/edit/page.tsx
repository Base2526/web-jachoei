// apps/web/app/(admin)/admin/posts/[id]/edit/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PostForm, { PostRecord } from '@/components/post/PostForm';

import { gql, useQuery } from "@apollo/client";

const Q_POST = gql`
  query($id:ID!){
    post(id:$id){
      id title body phone status created_at updated_at
      images { id url }           # << ใช้ url ตรงจาก resolver
      author { id name email }    # ถ้าต้องใช้
    }
  }
`;

export default function Page(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();

  const { data, loading, error } = useQuery(Q_POST, { variables: { id } });

  if (loading) return <div>Loading...</div>;
  if (error)   return <div>Error: {String(error.message)}</div>;

  const post = data?.post;
  if (!post) return <div>Not found</div>

  return (
    <PostForm
      apiBase="/admin"
      initialData={post!}
      onSaved={()=> router.refresh()}
      title="Edit Post (Admin)"
    />
  );
}
