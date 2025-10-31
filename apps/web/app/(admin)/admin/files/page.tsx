"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Input, Upload, Button, Table, Space, Modal, message, Popconfirm } from "antd";
import { UploadOutlined } from "@ant-design/icons";

type FileRow = {
  id: number;
  filename: string;
  original_name: string;
  mimetype: string | null;
  size: number;
  checksum: string;
  relpath: string;
  created_at: string;
  updated_at: string;
};

async function fetchList(q:string, page:number, pageSize:number){
  const url = `/api/files?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, { cache:"no-store" });
  if(!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function FilesPage(){
  const [q,setQ] = useState("");
  const [data,setData] = useState<FileRow[]>([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(20);
  const [loading,setLoading] = useState(false);

  const columns = useMemo(()=>[
    { title:"Name", dataIndex:"original_name", key:"original_name", render:(v: string, r:FileRow)=> v || r.filename },
    { title:"Type", dataIndex:"mimetype", key:"mimetype" },
    { title:"Size", dataIndex:"size", key:"size", render:(v:number)=> (v/1024).toFixed(1)+" KB" },
    { title:"Created", dataIndex:"created_at", key:"created_at" },
    { title:"Actions", key:"actions", render:(_:any, r:FileRow)=> (
      <Space>
        <a href={`/api/files/${r.id}`}>Download</a>
        <a onClick={()=> renameFile(r)}>Rename</a>
        <Popconfirm title="Delete this file?" onConfirm={()=> delFile(r)}>
          <a>Delete</a>
        </Popconfirm>
      </Space>
    )},
  ],[]);

  async function load(){
    setLoading(true);
    try{
      const res = await fetchList(q, page, pageSize);
      setData(res.items); setTotal(res.total);
    }catch(e:any){
      message.error(e.message||"Load failed");
    }finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [q, page, pageSize]);

  function onUploaded(info:any){
    if(info.file.status === "done"){
      message.success("Uploaded");
      load();
    }else if(info.file.status === "error"){
      message.error("Upload failed");
    }
  }

  async function delFile(r:FileRow){
    const res = await fetch(`/api/files/${r.id}`, { method:"DELETE" });
    if(res.ok){ message.success("Deleted"); load(); } else { message.error("Delete failed"); }
  }

  async function renameFile(r:FileRow){
    let name = prompt("Rename to:", r.filename);
    if(!name) return;
    const res = await fetch(`/api/files/${r.id}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ name }) });
    if(res.ok){ message.success("Renamed"); load(); } else { message.error("Rename failed"); }
  }

  return (
    <div className="p-6">
      {/* <h1 className="text-2xl font-semibold mb-4">File Manager</h1> */}
      <Space className="mb-4" wrap>
        <Input.Search placeholder="Search by name" onSearch={setQ} allowClear enterButton />
        <Upload name="file" action="/api/files" onChange={onUploaded} showUploadList={false}>
          <Button icon={<UploadOutlined/>}>Upload</Button>
        </Upload>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        dataSource={data}
        pagination={{ current: page, pageSize, total, onChange:(p,ps)=>{setPage(p); setPageSize(ps);} }}
      />
    </div>
  );
}
