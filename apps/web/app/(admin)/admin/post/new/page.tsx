// apps/web/app/(admin)/admin/posts/new/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import PostForm from '@/components/post/PostForm';

export default function Page(){
  const router = useRouter();
  return (
    <PostForm
      apiBase="/admin"
      initialData={null}
      onSaved={(id)=> router.push(`/admin/post/${id}`)}
      title="New Post (Admin)"
    />
  );
}
