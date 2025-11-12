// apps/web/app/post/[id]/view/page.tsx
// 'use client';
// import React, { useEffect, useState } from 'react';
// import { useParams } from 'next/navigation';
// import PostView from '@/components/post/PostView';
// import type { PostRecord } from '@/components/post/PostForm';

// export default function Page(){
//   const { id } = useParams<{id:string}>();
//   const [data, setData] = useState<PostRecord|null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(()=> {
//     (async ()=>{
//       setLoading(true);
//       const res = await fetch(`/api/posts/${id}`, { credentials:'include', cache:'no-store' });
//       const j = await res.json();
//       if(res.ok) setData(j);
//       setLoading(false);
//     })();
//   }, [id]);

//   return <PostView post={data} loading={loading} title="Post" />;
// }

'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PostView from '@/components/post/PostView';
import { gql, useQuery } from "@apollo/client";

// const Q_POST = gql`
//   query($id:ID!){
//     post(id:$id){
//       id title body phone status
//       first_last_name id_card product transfer_amount transfer_date
//       website province_id additional_info
//       tel_numbers { id tel }
//       seller_accounts { id bank_id bank_name seller_account }
//       images { id url }
//     }
//   }
// `;

const Q_POST = gql`
  query($id: ID!) {
    post(id: $id) {
      detail
      transfer_amount
      transfer_date
      updated_at
      website
      tel_numbers {
        id
        tel
      }
      status
      seller_accounts {
        bank_id
        bank_name
        id
        seller_account
      }
      province_name
      province_id
      title
      images {
        id
        url
      }
      id_card
      id
      first_last_name
      created_at
      author {
        avatar
        created_at
        email
        id
        name
        phone
        role
      }
    }
  }
`;

export default function Page(){
  const { id } = useParams<{id:string}>();

  const { data, loading, error } = useQuery(Q_POST, { variables: { id } });

  if (loading) return <div>Loading...</div>;
  if (error)   return <div>Error: {String(error.message)}</div>;

  const post = data?.post;
  if (!post) return <div>Not found</div>;

  console.log("[view]" , post);
  return <PostView post={post} loading={loading} title="Post" />;
}

