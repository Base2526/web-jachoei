// apps/web/app/(admin)/admin/posts/[id]/edit/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PostForm, { PostRecord } from '@/components/post/PostForm';

export default function Page(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData] = useState<PostRecord|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=> {
    (async ()=>{
      setLoading(true);
      const res = await fetch(`/admin/api/post/${id}`, { credentials:'include', cache:'no-store' });
      const j = await res.json();
      if(res.ok) setData(j);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <>Empty</>
  return (
    <PostForm
      apiBase="/admin"
      initialData={data!}
      onSaved={()=> router.refresh()}
      title="Edit Post (Admin)"
    />
  );
}
