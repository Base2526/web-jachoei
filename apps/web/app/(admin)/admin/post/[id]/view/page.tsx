// apps/web/app/(admin)/admin/posts/[id]/view/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PostView from '@/components/post/PostView';
import type { PostRecord } from '@/components/post/PostForm';

import { gql, useQuery, useMutation } from "@apollo/client";

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
  // const [data, setData] = useState<PostRecord|null>(null);
  // const [loading, setLoading] = useState(true);

  // useEffect(()=> {
  //   (async ()=>{
  //     setLoading(true);
  //     const res = await fetch(`/admin/api/post/${id}`, { credentials:'include', cache:'no-store' });
  //     const j = await res.json();
  //     if(res.ok) setData(j);
  //     setLoading(false);
  //   })();
  // }, [id]);

  const { data, loading, error } = useQuery(Q_POST, { variables: { id } });

  if (loading) return <div>Loading...</div>;
  if (error)   return <div>Error: {String(error.message)}</div>;

  const post = data?.post;
  if (!post) return <div>Not found</div>;

  return <PostView post={data} loading={loading} title="Post (Admin)" />;
}
