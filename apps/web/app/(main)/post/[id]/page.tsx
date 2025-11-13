'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PostView from '@/components/post/PostView';
import { gql, useQuery, useMutation } from "@apollo/client";
import { message } from 'antd';

const Q_POST = gql`
  query($id: ID!) {
    post(id: $id) {
      detail
      transfer_amount
      transfer_date
      updated_at
      website
      is_bookmarked
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

const DELETE_POST = gql`
  mutation ($id: ID!) {
    deletePost(id: $id)
  }
`;

export default function Page(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();

  const { data, loading, error } = useQuery(Q_POST, { variables: { id } });

  const [deletePost, { loading: deleting }] = useMutation(DELETE_POST);

  const handleDelete = async (id: string) => {
    try {
      const { data: res } = await deletePost({ variables: { id } });
      if (res?.deletePost) {
        message.success("Deleted successfully");
        router.push('/admin/posts'); // กลับหน้ารายการ
      } else {
        message.warning("Delete failed");
      }
    } catch (err: any) {
      message.error(err?.message || "Delete error");
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error)   return <div>Error: {String(error.message)}</div>;

  const post = data?.post;
  if (!post) return <div>Not found</div>;

  console.log("[view]" , post);
  return <PostView 
          post={post} 
          loading={loading}
          onDelete={handleDelete} 
          deleting={deleting} />;
}

