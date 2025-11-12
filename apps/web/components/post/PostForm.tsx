'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Form, Input, Button, Select, message, InputNumber, DatePicker } from 'antd';
import { gql, useMutation } from "@apollo/client";
import AttachFileField from '@/components/AttachFileField';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import _ from "lodash";
import dayjs from 'dayjs';

const UPSERT = gql`
  mutation Upsert($id: ID, $data: PostInput!, $images:[Upload!], $image_ids_delete:[ID!]) {
    upsertPost(id: $id, data: $data, images: $images, image_ids_delete: $image_ids_delete) {
      id
      title
      images { id url }
    }
  }
`;

export type ExistingImage = { id: number|string; url: string };
export type PostRecord = {
  id?: number|string;
  title: string;
  body?: string;
  phone?: string;
  status: 'public' | 'unpublic';
  images?: ExistingImage[];

  // ฟิลด์ใหม่ (เผื่ออ่านจาก initialData)
  first_last_name?: string;
  id_card?: string;
  transfer_amount?: number;
  transfer_date?: string;
  website?: string;
  province_id?: string;
  detail?: string;
  tel_numbers?: Array<{ id?: string|number; tel: string }>;
  seller_accounts?: Array<{ id?: string|number; bank_id: string; bank_name: string; seller_account?: string }>;
};

type ExistingFile = { _id: string|number; url: string; delete?: boolean };
type FileValue   = ExistingFile | File;

type Props = {
  apiBase?: string;
  initialData?: PostRecord | null;
  onSaved?: (savedId: string | number) => void;
  title?: string;
};

enum TelNumberMode {
  New = 'new',
  Edited = 'edited',
  Deleted = 'deleted',
}

enum SellerAccountMode {
  New = 'new',
  Edited = 'edited',
  Deleted = 'deleted',
}

interface BankItem{
  id: string;
  name_th: string;
  name_en: string;
  description: string;
}

interface ProvinceItem {
  id: string;
  name_th: string;
  name_en: string;
}

type ITelNumber = {
  id: number;
  tel: string;
  mode: TelNumberMode; 
};

type ISellerAccount = {
  id: number;
  bank_id: string;
  bank_name: string;
  mode: SellerAccountMode; 
};

type ITelNumberDTO = { id?: string|number; tel: string };
type ISellerAccountDTO = { id?: string|number; bank_id: string; bank_name: string; seller_account?: string };

export default function PostForm({ apiBase = '', initialData, onSaved, title }: Props){
  const [form] = Form.useForm();
  const [files, setFiles] = useState<FileValue[]>([]);
  const isEdit = !!initialData?.id;

  const [onPost, { loading }] = useMutation(UPSERT);

  // data ตัวอย่าง dropdown
  const [provinces] = useState<ProvinceItem[]>([
    { id: "a0f9a3b6-3a42-4c61-924d-14e3a9e4c2d1", name_th: "กรุงเทพมหานคร", name_en: "Bangkok" },
    { id: "b27f6c4a-7f53-4a77-bb12-83211d9e62a3", name_th: "เชียงใหม่", name_en: "Chiang Mai" },
    { id: "c913aef8-4581-4b40-90d8-5c3efde0b61a", name_th: "ขอนแก่น", name_en: "Khon Kaen" },
    { id: "d57a89e3-f2e4-4fa4-a38a-14cc6bcbf879", name_th: "ภูเก็ต", name_en: "Phuket" },
    { id: "e89db1cf-9a12-4e7f-b354-67a8e1b58a50", name_th: "ชลบุรี", name_en: "Chonburi" },
  ]);
  const [banks] = useState<BankItem[]>([
    { id: "bbl",  name_th: "ธนาคารกรุงเทพ",     name_en: "Bangkok Bank",        description: "" },
    { id: "kbank",name_th: "ธนาคารกสิกรไทย",   name_en: "Kasikorn Bank",        description: "" },
    { id: "scb",  name_th: "ธนาคารไทยพาณิชย์", name_en: "Siam Commercial Bank", description: "" },
    { id: "bay",  name_th: "ธนาคารกรุงศรีอยุธยา", name_en: "Bank of Ayudhya",  description: "" },
    { id: "ktb",  name_th: "ธนาคารกรุงไทย",    name_en: "Krung Thai Bank",      description: "" },
  ]);
  const [telNumbers, setTelNumbers] = useState<ITelNumber[]>([{ id: Date.now(), tel: '', mode: TelNumberMode.New }]);
  const [sellerAccounts, setSellerAccounts] = useState<ISellerAccount[]>([{ id: Date.now(), bank_id: "", bank_name: "", mode: SellerAccountMode.New }]);

  // ------------------- DIRTY CHECK -------------------
  const initialSnapshotRef = useRef<any>(null);
  const [dirty, setDirty] = useState<boolean>(false);

  // normalize สร้าง object ที่พร้อมสำหรับเทียบ deep-equal
  const normalizeComparable = (values: any, f: FileValue[], tels: ITelNumber[], sellers: ISellerAccount[]) => {
    // ไฟล์: แยก existing และ new
    const existing = f.filter((x:any)=> 'url' in x) as ExistingFile[];
    const keepExistingIds = existing.filter(x=> !x.delete).map(x=> String(x._id)).sort();
    const deleteExistingIds = existing.filter(x=> !!x.delete).map(x=> String(x._id)).sort();
    const newFilesCount = f.filter((x)=> x instanceof File).length;

    // ฟิลด์วันที่ normalize เป็น ISO (หรือ null)
    const transferDateIso = values.transfer_date
      ? (values.transfer_date?.toISOString?.() ?? dayjs(values.transfer_date).toISOString())
      : null;

    return {
      form: {
        first_last_name: values.first_last_name?.trim() ?? "",
        id_card: values.id_card?.trim() ?? "",
        title: values.title?.trim() ?? "",
        transfer_amount: typeof values.transfer_amount === 'number'
          ? values.transfer_amount
          : Number(values.transfer_amount || 0),
        transfer_date: transferDateIso,
        website: values.website?.trim() ?? "",
        province_id: values.province_id ?? null,
        detail: values.detail ?? "",
        status: values.status || "public",
      },
      tel_numbers: (tels||[]).filter(t=> t.mode !== TelNumberMode.Deleted).map(t=> ({ tel: t.tel.trim() })).sort((a,b)=>a.tel.localeCompare(b.tel)),
      seller_accounts: (sellers||[]).filter(s=> s.mode !== SellerAccountMode.Deleted)
        .map(s=>{
          // ค่าจริงอยู่ใน form
          const sfList = values.seller_accounts || [];
          const idx = sellers.findIndex(x=> x.id===s.id);
          const row = sfList[idx] || {};
          return {
            bank_id: String(row.bank_id ?? s.bank_id ?? ''),
            bank_name: (row.bank_name ?? s.bank_name ?? '').trim(),
            seller_account: (row.seller_account ?? '').trim(),
          };
        })
        .sort((a,b)=> (a.bank_name+a.seller_account).localeCompare(b.bank_name+b.seller_account)),
      files: {
        keepExistingIds,
        deleteExistingIds,
        newFilesCount, // ถ้ามีไฟล์ใหม่เพิ่ม ถือว่าเปลี่ยน
      }
    };
  };

  // สร้างสแน็ปช็อตเริ่มต้นเมื่อ initialData พร้อม
  useEffect(() => {
    if (!initialData) return;

    form.setFieldsValue({
      first_last_name: initialData.first_last_name ?? "",
      id_card: initialData.id_card ?? "",
      title: initialData.title ?? "",
      transfer_amount: initialData.transfer_amount ?? undefined,
      transfer_date: initialData.transfer_date ? dayjs(initialData.transfer_date) : undefined,
      website: initialData.website ?? "",
      province_id: initialData.province_id ?? undefined,
      detail: (initialData as any).detail ?? "",
      tel_numbers: (initialData.tel_numbers ?? []).map((t: ITelNumberDTO) => ({ tel: t.tel })),
      seller_accounts: (initialData.seller_accounts ?? []).map((s: ISellerAccountDTO) => ({
        bank_name: s.bank_name,
        seller_account: s.seller_account ?? "",
        bank_id: s.bank_id
      })),
      status: initialData.status,
    });

    const telInit: ITelNumber[] = (initialData.tel_numbers ?? []).map((t: ITelNumberDTO, idx: number) => ({
      id: (typeof t.id !== 'undefined' ? Number(t.id) : Date.now() + idx),
      tel: t.tel,
      mode: TelNumberMode.Edited,
    }));
    setTelNumbers(telInit.length ? telInit : [{ id: Date.now(), tel: '', mode: TelNumberMode.New }]);

    const sellerInit: ISellerAccount[] = (initialData.seller_accounts ?? []).map((s: ISellerAccountDTO, idx: number) => ({
      id: (typeof s.id !== 'undefined' ? Number(s.id) : Date.now() + idx),
      bank_id: s.bank_id,
      bank_name: s.bank_name,
      mode: SellerAccountMode.Edited,
    }));
    setSellerAccounts(sellerInit.length ? sellerInit : [{ id: Date.now(), bank_id: "", bank_name: "", mode: SellerAccountMode.New }]);

    const ex: ExistingFile[] = (initialData.images || []).map(img => ({ _id: img.id, url: img.url }));
    setFiles(ex);

    // ตั้ง snapshot เริ่มต้น
    const initValues = form.getFieldsValue(true);
    initialSnapshotRef.current = normalizeComparable(initValues, ex, telInit, sellerInit);
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, form]);

  // ฟัง Form change เพื่อตรวจ dirty
  useEffect(() => {
    const unSub = form.subscribe?.(({ values }: any) => {
      // บางเวอร์ชัน antd ไม่มี subscribe → เราจะใช้ onValuesChange ด้านล่างแทน
    });
    return () => { if (typeof unSub === 'function') unSub(); };
  }, [form]);

  const recomputeDirty = React.useCallback(() => {
    const snap = initialSnapshotRef.current;
    if (!snap) { setDirty(true); return; }

    const currentValues = form.getFieldsValue(true);
    const current = normalizeComparable(currentValues, files, telNumbers, sellerAccounts);

    // ไฟล์ใหม่เพิ่ม → ถือว่าเปลี่ยน
    const newFilesChanged = current.files.newFilesCount > 0;
    // ลบ/คงไฟล์เดิมเปลี่ยน?
    const filesChanged = newFilesChanged
      || !_.isEqual(snap.files.keepExistingIds, current.files.keepExistingIds)
      || !_.isEqual(snap.files.deleteExistingIds, current.files.deleteExistingIds);

    const formChanged = !_.isEqual(snap.form, current.form);
    const telChanged  = !_.isEqual(snap.tel_numbers, current.tel_numbers);
    const sellerChanged = !_.isEqual(snap.seller_accounts, current.seller_accounts);

    setDirty(formChanged || telChanged || sellerChanged || filesChanged);
  }, [form, files, telNumbers, sellerAccounts]);

  // onValuesChange → recalculates dirty
  const handleValuesChange = () => { recomputeDirty(); };

  // เมื่อ files/tel/seller เปลี่ยน → recalculates dirty
  useEffect(() => { if (initialSnapshotRef.current) recomputeDirty(); }, [files, telNumbers, sellerAccounts, recomputeDirty]);

  // ------------------- SUBMIT -------------------
  async function onFinish(values: any){
    const existingDeleteIds = (files.filter((f:any)=> 'url' in f && f.delete) as ExistingFile[])
      .map((f:any)=> String(f._id));

    const newFiles = files.filter((f): f is File => f instanceof File);

    const tel_numbers_payload = telNumbers
      .filter(t => t.mode !== TelNumberMode.Deleted)
      .map(t => ({ id: t.id, tel: t.tel, mode: t.mode }));

    const seller_accounts_form = (form.getFieldValue('seller_accounts') || []) as Array<any>;
    const seller_accounts_payload = sellerAccounts
      .map((s, idx) => {
        const row = seller_accounts_form[idx] || {};
        return {
          id: s.id,
          bank_id: row.bank_id ?? s.bank_id,
          bank_name: row.bank_name ?? s.bank_name,
          seller_account: row.seller_account ?? '',
          mode: s.mode,
        };
      })
      .filter(s => s.mode !== SellerAccountMode.Deleted);

    const variables: any = {
      id: isEdit ? String(initialData!.id) : null,
      data: {
        first_last_name: values.first_last_name?.trim() ?? "",
        id_card: values.id_card?.trim() ?? "",
        title: values.title?.trim() ?? "",
        transfer_amount: typeof values.transfer_amount === 'number' ? values.transfer_amount : Number(values.transfer_amount || 0),
        transfer_date: values.transfer_date
          ? (values.transfer_date.toISOString?.() ?? dayjs(values.transfer_date).toISOString())
          : null,
        website: values.website?.trim() ?? "",
        province_id: values.province_id ?? null,
        detail: values.detail ?? "",
        tel_numbers: tel_numbers_payload,
        seller_accounts: seller_accounts_payload,
        status: values.status || "public",
      },
      image_ids_delete: existingDeleteIds,
    };

    if (newFiles.length > 0) variables.images = newFiles;

    const { data } = await onPost({ variables });

    if (data?.upsertPost?.id) {
      message.success(isEdit ? 'Saved' : 'Created');

      // sync รูปภาพหลังบันทึก
      const savedImgs = (data.upsertPost.images || []).map((img: any) => ({ _id: img.id, url: img.url }));
      setFiles(savedImgs);

      // อัปเดต snapshot ใหม่เป็นค่าปัจจุบัน (เพื่อ reset dirty)
      const newInitValues = form.getFieldsValue(true);
      initialSnapshotRef.current = normalizeComparable(newInitValues, savedImgs, telNumbers.filter(t=>t.mode!==TelNumberMode.Deleted).map(t=>({...t, mode: TelNumberMode.Edited})), sellerAccounts.filter(s=>s.mode!==SellerAccountMode.Deleted).map(s=>({...s, mode: SellerAccountMode.Edited})));
      setDirty(false);

      onSaved?.(data.upsertPost.id);
    } else {
      message.error(isEdit ? 'Save failed' : 'Create failed');
    }
  }

  const handleTelChange = (index: number, value: string) => {
    const currentValues = form.getFieldValue('tel_numbers') || [];
    const updatedFormValues = [...currentValues];
    updatedFormValues[index] = { ...(updatedFormValues[index] || {}), tel: value };
    form.setFieldsValue({ tel_numbers: updatedFormValues });

    setTelNumbers(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const clone = { ...updated[index], tel: value };
      if (clone.mode !== TelNumberMode.New) clone.mode = TelNumberMode.Edited;
      updated[index] = clone;
      return updated;
    });
  };

  const addTelNumber = () => {
    setTelNumbers([...telNumbers, { id: Date.now(), tel: '', mode: TelNumberMode.New }]);
  };

  const removeTelNumber = (index: number) => {
    setTelNumbers(prev => prev.map((item, i) => i === index ? { ...item, mode: TelNumberMode.Deleted } : item ) );
  };

  const removeSellerAccount = (index: number) => {
    setSellerAccounts(prev => prev.map((item, i) => i === index ? { ...item, mode: SellerAccountMode.Deleted } : item ) );
  };

  const addSellerAccount = () => {
    setSellerAccounts([...sellerAccounts, { id: Date.now(),  bank_id: "", bank_name: "", mode: SellerAccountMode.New }]);
  };

  const handleSellerAccountChange = (
    index: number,
    field: 'bank_name' | 'seller_account' | 'bank_id',
    value: string
  ) => {
    const currentValues = form.getFieldValue('seller_accounts') || [];
    const updatedFormValues = [...currentValues];
    updatedFormValues[index] = { ...(updatedFormValues[index] || {}), [field]: value };
    form.setFieldsValue({ seller_accounts: updatedFormValues });

    setSellerAccounts(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const clone = { ...updated[index], [field]: value };
      if (clone.mode !== SellerAccountMode.New) clone.mode = SellerAccountMode.Edited;
      updated[index] = clone;
      return updated;
    });
  };

  return (
    <Card title={title ?? (isEdit ? 'Edit Post' : 'New Post')} >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={handleValuesChange}
        initialValues={{ status: 'public' }}
      >
        {/* ชื่อคนขาย */}
        <Form.Item
          label="ชื่อ-นามสกุล คนขาย"
          name="first_last_name"
          rules={[{ required: true, message: 'กรุณากรอกชื่อ-นามสกุล คนขาย' }]}
        >
          <Input placeholder="กรุณากรอกชื่อ-นามสกุล คนขาย" />
        </Form.Item>

        <Form.Item
          label="เลขบัตรประชาชนคนขาย (13 หลัก) หรือ พาสปอร์ต (passport)"
          name="id_card"
          rules={[{ required: true, message: 'กรุณากรอกเลขบัตรประชาชน หรือ พาสปอร์ต (passport)' }]}
        >
          <Input placeholder="กรุณากรอกเลขบัตรประชาชน หรือ พาสปอร์ต (passport)" maxLength={13} />
        </Form.Item>

        {/* Tel Numbers */}
        <div style={{ borderColor: '#d9d9d9', padding: '10px', borderStyle: 'dashed', marginTop: '10px', marginBottom: '10px' }}>
          {telNumbers.map((number, index) => (
            <div key={number.id} style={{ marginBottom: 20, borderColor: '#d9d9d9', padding: '10px', borderStyle: 'dashed', marginTop: '10px' }}>
              <Form.Item
                label={`เบอร์โทรศัพท์ หรือ ไอดีไลน์ ${index + 1}`}
                name={['tel_numbers', index, 'tel']}
                rules={[{ required: true, message: 'กรุณากรอกเบอร์โทรศัพท์ หรือ ไอดีไลน์' }]}
              >
                <Input placeholder="กรุณากรอกเบอร์โทรศัพท์ หรือ ไอดีไลน์" onChange={(e) => handleTelChange(index, e.target.value)}/>
              </Form.Item>

              {telNumbers.length > 1 && (
                <Button type="dashed" onClick={() => removeTelNumber(index)}>
                  <MinusCircleOutlined /> ลบ
                </Button>
              )}
            </div>
          ))}

          <Form.Item>
            <Button type="dashed" onClick={addTelNumber} >
              <PlusOutlined /> เพิ่มเบอร์โทรศัพท์ใหม่ หรือ ไอดีไลน์
            </Button>
          </Form.Item>
        </div>

        {/* Seller Accounts */}
        <div style={{ borderColor: '#d9d9d9', padding: '10px', borderStyle: 'dashed', marginTop: '10px', marginBottom: '10px' }}>
          {sellerAccounts.map((account, index) => (
            <div key={account.id} style={{ marginBottom: 20, borderColor: '#d9d9d9', padding: '10px', borderStyle: 'dashed', marginTop: '10px' }}>
              <Form.Item
                label={`ชื่อบัญชีคนขาย ${index + 1}`}
                name={['seller_accounts', index, 'bank_name']}
                rules={[{ required: true, message: 'กรุณากรอกบัญชีคนขาย' }]}
              >
                <Input placeholder="กรุณากรอกบัญชีคนขาย" onChange={(e) => handleSellerAccountChange(index, 'bank_name', e.target.value)}/>
              </Form.Item>

              <Form.Item
                label={`เลขที่บัญชีคนขาย ${index + 1}`}
                name={['seller_accounts', index, 'seller_account']}
                rules={[{ required: true, message: 'กรุณากรอกบัญชีคนขาย' }]}
              >
                <Input placeholder="กรุณากรอกบัญชีคนขาย" onChange={(e) => handleSellerAccountChange(index, 'seller_account', e.target.value)}/>
              </Form.Item>

              <Form.Item
                label="เลือกธนาคาร"
                name={['seller_accounts', index, 'bank_id']}
                rules={[{ required: true, message: 'กรุณาเลือกธนาคาร' }]}
              >
                <Select placeholder="กรุณาเลือกธนาคาร" onChange={(value) => handleSellerAccountChange(index, 'bank_id', value)}>
                  {banks.map((bank) => (
                    <Select.Option key={bank.id} value={bank.id}>
                      {bank.name_th}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {sellerAccounts.length > 1 && (
                <Button type="dashed" onClick={() => removeSellerAccount(index)}>
                  <MinusCircleOutlined /> ลบ
                </Button>
              )}
            </div>
          ))}

          <Form.Item>
            <Button type="dashed" onClick={addSellerAccount} >
              <PlusOutlined /> เพิ่มบัญชีคนขายใหม่
            </Button>
          </Form.Item>
        </div>

        {/* สินค้า/บริการ ที่สั่งซื้อ */}
        <Form.Item
          label="สินค้า/บริการ ที่สั่งซื้อ"
          name="title"
          rules={[{ required: true, message: 'กรุณากรอกสินค้า/บริการ ที่สั่งซื้อ' }]}
        >
          <Input placeholder="กรุณากรอกสินค้า/บริการ ที่สั่งซื้อ" />
        </Form.Item>

        {/* ยอดโอน */}
        <Form.Item
          label="ยอดโอน"
          name="transfer_amount"
          rules={[{ required: true, message: 'กรุณากรอกยอดโอน' }]}
        >
          <InputNumber placeholder="กรุณากรอกยอดโอน" style={{ width: '100%' }} />
        </Form.Item>

        {/* วันโอนเงิน */}
        <Form.Item
          label="วันโอนเงิน"
          name="transfer_date"
          rules={[{ required: true, message: 'กรุณาเลือกวันโอนเงิน' }]}
        >
          <DatePicker placeholder="กรุณาเลือกวันโอนเงิน" style={{ width: '100%' }} />
        </Form.Item>

        {/* เว็บประกาศขายของ */}
        <Form.Item
          label="เว็บประกาศขายของ"
          name="website"
          rules={[{ required: true, message: 'กรุณากรอกเว็บประกาศขายของ' }]}
        >
          <Input placeholder="กรุณากรอกเว็บประกาศขายของ" />
        </Form.Item>

        {/* จังหวัดของคนสร้างรายงาน */}
        <Form.Item
          label="จังหวัดของคนสร้างรายงาน"
          name="province_id"
          rules={[{ required: true, message: 'กรุณาเลือกจังหวัด' }]}
        >
          <Select
            placeholder="กรุณาเลือกจังหวัด"
            showSearch
            optionFilterProp="label"
            options={provinces.map((p) => ({ label: p.name_th, value: p.id }))}
          />
        </Form.Item>

        {/* รายละเอียดเพิ่มเติม */}
        <Form.Item label="รายละเอียดเพิ่มเติม" name="detail">
          <Input.TextArea rows={4} placeholder="กรุณากรอกรายละเอียดเพิ่มเติม" />
        </Form.Item>

        <AttachFileField
          label="ไฟล์แนบ"
          values={files}
          multiple
          accept="image/*"
          onChange={setFiles}
          onSnackbar={(s)=> s.open && message.info(s.message)}
        />

        <Form.Item name="status" label="Status">
          <Select options={[{value:'public',label:'public'},{value:'unpublic',label:'unpublic'}]} />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          style={{ marginTop: 16 }}
          loading={loading}
          disabled={!dirty}  >
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </Form>
    </Card>
  )
}
