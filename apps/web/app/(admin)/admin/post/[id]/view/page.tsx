// apps/web/app/(admin)/admin/posts/[id]/view/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PostView from '@/components/post/PostView';
import type { PostRecord } from '@/components/post/PostForm';

export default function Page(){
  const { id } = useParams<{id:string}>();
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

  return <PostView post={data} loading={loading} title="Post (Admin)" />;
}
