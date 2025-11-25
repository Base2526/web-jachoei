// apps/web/app/post/new/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import PostForm from '@/components/post/PostForm';

export default function Page(){
  const router = useRouter();
  return (
    <PostForm
      apiBase=""  // main
      initialData={null}
      onSaved={(id: any)=>{

        // router.push(`/post/${id}`)

        // console.log("[onSaved] :", id)
      } }
      title="New Post"
    />
  );
}
