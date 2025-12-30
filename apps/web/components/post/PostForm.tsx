'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Form, Input, Button, Select, message, InputNumber, DatePicker } from 'antd';
import { gql, useMutation } from "@apollo/client";
import AttachFileField from '@/components/AttachFileField';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import _ from "lodash";
import dayjs from 'dayjs';

import { formatDate } from "@/lib/date"
import { useI18n } from "@/lib/i18nContext";

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
  Unchanged = 'unchanged',
}

enum SellerAccountMode {
  New = 'new',
  Edited = 'edited',
  Deleted = 'deleted',
  Unchanged = 'unchanged',
}

type PaymentProviderType = "bank" | "ewallet";

type BankItem = {
  id: string;
  name_th: string;
  name_en: string;
  type: PaymentProviderType;
  description?: string;
};

interface ProvinceItem {
  id: string;
  name_th: string;
  name_en: string;
}

type ITelNumber = {
  id: string;          // เก็บเป็น string (UUID หรือ local-xxx)
  tel: string;
  mode: TelNumberMode; 
};

type ISellerAccount = {
  id: string;          // เก็บเป็น string เช่นกัน
  bank_id: string;
  bank_name: string;
  mode: SellerAccountMode; 
};

type ITelNumberDTO = { id?: string|number; tel: string };
type ISellerAccountDTO = { id?: string|number; bank_id: string; bank_name: string; seller_account?: string };

// helper สำหรับ gen id ฝั่ง client
const makeLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function PostForm({ apiBase = '', initialData, onSaved, title }: Props){
  const [form] = Form.useForm();
  const [files, setFiles] = useState<FileValue[]>([]);
  const isEdit = !!initialData?.id;

  const { t } = useI18n();

  // console.log("[PostForm]", initialData);

  const [onPost, { loading }] = useMutation(UPSERT);

  // data ตัวอย่าง dropdown
  const [provinces] = useState<ProvinceItem[]>([
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00001", name_th: "กรุงเทพมหานคร", name_en: "Bangkok" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00002", name_th: "กระบี่", name_en: "Krabi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00003", name_th: "กาญจนบุรี", name_en: "Kanchanaburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00004", name_th: "กาฬสินธุ์", name_en: "Kalasin" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00005", name_th: "กำแพงเพชร", name_en: "Kamphaeng Phet" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00006", name_th: "ขอนแก่น", name_en: "Khon Kaen" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00007", name_th: "จันทบุรี", name_en: "Chanthaburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00008", name_th: "ฉะเชิงเทรา", name_en: "Chachoengsao" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00009", name_th: "ชลบุรี", name_en: "Chonburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00010", name_th: "ชัยนาท", name_en: "Chai Nat" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00011", name_th: "ชัยภูมิ", name_en: "Chaiyaphum" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00012", name_th: "ชุมพร", name_en: "Chumphon" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00013", name_th: "เชียงราย", name_en: "Chiang Rai" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00014", name_th: "เชียงใหม่", name_en: "Chiang Mai" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00015", name_th: "ตรัง", name_en: "Trang" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00016", name_th: "ตราด", name_en: "Trat" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00017", name_th: "ตาก", name_en: "Tak" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00018", name_th: "นครนายก", name_en: "Nakhon Nayok" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00019", name_th: "นครปฐม", name_en: "Nakhon Pathom" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00020", name_th: "นครพนม", name_en: "Nakhon Phanom" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00021", name_th: "นครราชสีมา", name_en: "Nakhon Ratchasima" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00022", name_th: "นครศรีธรรมราช", name_en: "Nakhon Si Thammarat" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00023", name_th: "นครสวรรค์", name_en: "Nakhon Sawan" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00024", name_th: "นนทบุรี", name_en: "Nonthaburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00025", name_th: "นราธิวาส", name_en: "Narathiwat" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00026", name_th: "น่าน", name_en: "Nan" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00027", name_th: "บึงกาฬ", name_en: "Bueng Kan" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00028", name_th: "บุรีรัมย์", name_en: "Buriram" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00029", name_th: "ปทุมธานี", name_en: "Pathum Thani" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00030", name_th: "ประจวบคีรีขันธ์", name_en: "Prachuap Khiri Khan" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00031", name_th: "ปราจีนบุรี", name_en: "Prachinburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00032", name_th: "ปัตตานี", name_en: "Pattani" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00033", name_th: "พระนครศรีอยุธยา", name_en: "Phra Nakhon Si Ayutthaya" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00034", name_th: "พะเยา", name_en: "Phayao" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00035", name_th: "พังงา", name_en: "Phang Nga" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00036", name_th: "พัทลุง", name_en: "Phatthalung" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00037", name_th: "พิจิตร", name_en: "Phichit" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00038", name_th: "พิษณุโลก", name_en: "Phitsanulok" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00039", name_th: "เพชรบุรี", name_en: "Phetchaburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00040", name_th: "เพชรบูรณ์", name_en: "Phetchabun" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00041", name_th: "แพร่", name_en: "Phrae" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00042", name_th: "ภูเก็ต", name_en: "Phuket" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00043", name_th: "มหาสารคาม", name_en: "Maha Sarakham" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00044", name_th: "มุกดาหาร", name_en: "Mukdahan" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00045", name_th: "แม่ฮ่องสอน", name_en: "Mae Hong Son" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00046", name_th: "ยโสธร", name_en: "Yasothon" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00047", name_th: "ยะลา", name_en: "Yala" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00048", name_th: "ร้อยเอ็ด", name_en: "Roi Et" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00049", name_th: "ระนอง", name_en: "Ranong" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00050", name_th: "ระยอง", name_en: "Rayong" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00051", name_th: "ราชบุรี", name_en: "Ratchaburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00052", name_th: "ลพบุรี", name_en: "Lopburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00053", name_th: "ลำปาง", name_en: "Lampang" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00054", name_th: "ลำพูน", name_en: "Lamphun" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00055", name_th: "เลย", name_en: "Loei" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00056", name_th: "ศรีสะเกษ", name_en: "Si Sa Ket" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00057", name_th: "สกลนคร", name_en: "Sakon Nakhon" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00058", name_th: "สงขลา", name_en: "Songkhla" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00059", name_th: "สตูล", name_en: "Satun" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00060", name_th: "สมุทรปราการ", name_en: "Samut Prakan" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00061", name_th: "สมุทรสงคราม", name_en: "Samut Songkhram" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00062", name_th: "สมุทรสาคร", name_en: "Samut Sakhon" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00063", name_th: "สระแก้ว", name_en: "Sa Kaeo" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00064", name_th: "สระบุรี", name_en: "Saraburi" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00065", name_th: "สิงห์บุรี", name_en: "Sing Buri" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00066", name_th: "สุโขทัย", name_en: "Sukhothai" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00067", name_th: "สุพรรณบุรี", name_en: "Suphan Buri" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00068", name_th: "สุราษฎร์ธานี", name_en: "Surat Thani" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00069", name_th: "สุรินทร์", name_en: "Surin" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00070", name_th: "หนองคาย", name_en: "Nong Khai" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00071", name_th: "หนองบัวลำภู", name_en: "Nong Bua Lam Phu" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00072", name_th: "อ่างทอง", name_en: "Ang Thong" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00073", name_th: "อำนาจเจริญ", name_en: "Amnat Charoen" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00074", name_th: "อุดรธานี", name_en: "Udon Thani" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00075", name_th: "อุตรดิตถ์", name_en: "Uttaradit" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00076", name_th: "อุทัยธานี", name_en: "Uthai Thani" },
  { id: "1a6c1a5a-1f01-4f3a-9a45-001a01a00077", name_th: "อุบลราชธานี", name_en: "Ubon Ratchathani" },
]);

  const [banks] = useState<BankItem[]>([
    // ===== ธนาคารพาณิชย์ =====
    { id: "bbl",   name_th: "ธนาคารกรุงเทพ",            name_en: "Bangkok Bank",                    type: "bank" },
    { id: "kbank", name_th: "ธนาคารกสิกรไทย",          name_en: "Kasikorn Bank",                   type: "bank" },
    { id: "scb",   name_th: "ธนาคารไทยพาณิชย์",        name_en: "Siam Commercial Bank",            type: "bank" },
    { id: "bay",   name_th: "ธนาคารกรุงศรีอยุธยา",     name_en: "Bank of Ayudhya",                 type: "bank" },
    { id: "ktb",   name_th: "ธนาคารกรุงไทย",           name_en: "Krung Thai Bank",                type: "bank" },
    { id: "tmb",   name_th: "ธนาคารทหารไทยธนชาต",     name_en: "TTB Bank",                        type: "bank" },
    { id: "uob",   name_th: "ธนาคารยูโอบี",             name_en: "United Overseas Bank (Thai)",   type: "bank" },
    { id: "cimb",  name_th: "ธนาคารซีไอเอ็มบีไทย",     name_en: "CIMB Thai Bank",                 type: "bank" },
    { id: "lhb",   name_th: "ธนาคารแลนด์ แอนด์ เฮ้าส์", name_en: "Land and Houses Bank",           type: "bank" },
    { id: "tisco", name_th: "ธนาคารทิสโก้",            name_en: "TISCO Bank",                     type: "bank" },
    { id: "kkp",   name_th: "ธนาคารเกียรตินาคินภัทร",  name_en: "Kiatnakin Phatra Bank",          type: "bank" },
    { id: "ibank", name_th: "ธนาคารอิสลามแห่งประเทศไทย",name_en: "Islamic Bank of Thailand",      type: "bank" },

    // ===== ธนาคารของรัฐ =====
    { id: "gsb",   name_th: "ธนาคารออมสิน",             name_en: "Government Savings Bank",        type: "bank" },
    { id: "baac",  name_th: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร", name_en: "Bank for Agriculture and Agricultural Cooperatives", type: "bank" },
    { id: "ghb",   name_th: "ธนาคารอาคารสงเคราะห์",   name_en: "Government Housing Bank",         type: "bank" },
    { id: "exim",  name_th: "ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย", name_en: "Export-Import Bank of Thailand", type: "bank" },
    { id: "sme",   name_th: "ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย", name_en: "SME Development Bank of Thailand", type: "bank" },

    // ===== e-Wallet / non-bank =====
    { id: "truemoney", name_th: "ทรูมันนี่ วอลเล็ท",     name_en: "TrueMoney Wallet",   type: "ewallet" },
    { id: "shopeepay", name_th: "ช้อปปี้เพย์",          name_en: "ShopeePay",          type: "ewallet" },
    { id: "linepay",   name_th: "ไลน์เพย์",              name_en: "LINE Pay",           type: "ewallet" },
    { id: "rabbit",    name_th: "แรบบิท ไลน์ เพย์",      name_en: "Rabbit LINE Pay",    type: "ewallet" },
    { id: "paotang",   name_th: "เป๋าตัง / ถุงเงิน",     name_en: "Pao Tang / Tung Ngern", type: "ewallet" },
    { id: "grabpay",   name_th: "แกร็บเพย์",             name_en: "GrabPay",            type: "ewallet" },
    { id: "airpay",    name_th: "แอร์เพย์",              name_en: "AirPay",             type: "ewallet" },
  ]);

  // const [telNumbers, setTelNumbers] = useState<ITelNumber[]>([
  //   { id: makeLocalId("tel"), tel: '', mode: TelNumberMode.New }
  // ]);
  const [telNumbers, setTelNumbers] = useState<ITelNumber[]>([]);
  // const [sellerAccounts, setSellerAccounts] = useState<ISellerAccount[]>(
  //   [
  //   { id: makeLocalId("seller"), bank_id: "", bank_name: "", mode: SellerAccountMode.New }
  //   ]
  // );
  const [sellerAccounts, setSellerAccounts] = useState<ISellerAccount[]>([]);

  // ------------------- DIRTY CHECK -------------------
  const initialSnapshotRef = useRef<any>(null);
  const [dirty, setDirty] = useState<boolean>(false);

  // normalize สำหรับเทียบ deep-equal
  const normalizeComparable = (values: any, f: FileValue[], tels: ITelNumber[], sellers: ISellerAccount[]) => {
    const existing = f.filter((x:any)=> 'url' in x) as ExistingFile[];
    const keepExistingIds = existing.filter(x=> !x.delete).map(x=> String(x._id)).sort();
    const deleteExistingIds = existing.filter(x=> !!x.delete).map(x=> String(x._id)).sort();
    const newFilesCount = f.filter((x)=> x instanceof File).length;

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
      // เปรียบเทียบเฉพาะเบอร์ (ไม่ต้องสน id/mode)
      tel_numbers: (tels||[])
        .filter(t=> t.mode !== TelNumberMode.Deleted)
        .map(t=> ({ tel: t.tel.trim() }))
        .sort((a,b)=>a.tel.localeCompare(b.tel)),
      seller_accounts: (sellers||[])
        .filter(s=> s.mode !== SellerAccountMode.Deleted)
        .map(s=>{
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
        newFilesCount,
      }
    };
  };

  // สร้างสแน็ปช็อตเริ่มต้นเมื่อ initialData พร้อม
  useEffect(() => {
    if (!initialData) return;

    let parsedTransferDate: dayjs.Dayjs | undefined;
    if (initialData.transfer_date) {
      if (!isNaN(Number(initialData.transfer_date))) {
        const formatted = formatDate(Number(initialData.transfer_date));
        // console.log("Parsed transfer_date (timestamp):", formatted);
        parsedTransferDate = dayjs(Number(initialData.transfer_date));
      } else {
        parsedTransferDate = dayjs(initialData.transfer_date);
      }
    }

    form.setFieldsValue({
      first_last_name: initialData.first_last_name ?? "",
      id_card: initialData.id_card ?? "",
      title: initialData.title ?? "",
      transfer_amount: initialData.transfer_amount ?? undefined,
      transfer_date: parsedTransferDate,
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

    // ใช้ id เดิมจาก server (UUID string) ถ้ามี, ถ้าไม่มี gen local-*
    const telInit: ITelNumber[] = (initialData.tel_numbers ?? []).map(
      (t: ITelNumberDTO, idx: number) => ({
        id: typeof t.id !== 'undefined'
          ? String(t.id)
          : makeLocalId(`tel-${idx}`),
        tel: t.tel,
        mode: TelNumberMode.Unchanged,   // ⭐ เริ่มต้นเป็น unchanged
      })
    );

    // console.log("[useEffect telInit] =", initialData.tel_numbers, telInit);
    setTelNumbers(
      telInit.length
        ? telInit
        : []//[{ id: makeLocalId("tel"), tel: '', mode: TelNumberMode.New }]
    );

    const sellerInit: ISellerAccount[] = (initialData.seller_accounts ?? []).map(
      (s: ISellerAccountDTO, idx: number) => ({
        id: typeof s.id !== 'undefined'
          ? String(s.id)
          : makeLocalId(`seller-${idx}`),
        bank_id: s.bank_id,
        bank_name: s.bank_name,
        mode: SellerAccountMode.Unchanged,  // ⭐ เริ่มต้นเป็น unchanged
      })
    );

    setSellerAccounts(
      sellerInit.length
        ? sellerInit
        : []//[{ id: makeLocalId("seller"), bank_id: "", bank_name: "", mode: SellerAccountMode.New }]
    );

    const ex: ExistingFile[] = (initialData.images || []).map(img => ({ _id: img.id, url: img.url }));
    setFiles(ex);

    const initValues = form.getFieldsValue(true);
    initialSnapshotRef.current = normalizeComparable(initValues, ex, telInit, sellerInit);
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, form]);

  // ฟัง Form change เพื่อตรวจ dirty (fallback ใช้ onValuesChange อยู่แล้ว)
  useEffect(() => {
    const unSub = (form as any).subscribe?.(({ values }: any) => {
      // noop
    });
    return () => { if (typeof unSub === 'function') unSub(); };
  }, [form]);

  const recomputeDirty = React.useCallback(() => {
    const snap = initialSnapshotRef.current;
    if (!snap) { setDirty(true); return; }

    const currentValues = form.getFieldsValue(true);
    const current = normalizeComparable(currentValues, files, telNumbers, sellerAccounts);

    const newFilesChanged = current.files.newFilesCount > 0;
    const filesChanged = newFilesChanged
      || !_.isEqual(snap.files.keepExistingIds, current.files.keepExistingIds)
      || !_.isEqual(snap.files.deleteExistingIds, current.files.deleteExistingIds);

    const formChanged = !_.isEqual(snap.form, current.form);
    const telChanged  = !_.isEqual(snap.tel_numbers, current.tel_numbers);
    const sellerChanged = !_.isEqual(snap.seller_accounts, current.seller_accounts);

    setDirty(formChanged || telChanged || sellerChanged || filesChanged);
  }, [form, files, telNumbers, sellerAccounts]);

  const handleValuesChange = () => { recomputeDirty(); };

  useEffect(() => {
    if (initialSnapshotRef.current) recomputeDirty();
  }, [files, telNumbers, sellerAccounts, recomputeDirty]);

  // ------------------- SUBMIT -------------------
  async function onFinish(values: any){
    const existingDeleteIds = (files.filter((f:any)=> 'url' in f && f.delete) as ExistingFile[])
      .map((f:any)=> String(f._id));

    const newFiles = files.filter((f): f is File => f instanceof File);

    const tel_numbers_payload = telNumbers
      // ส่งเฉพาะที่มีการเปลี่ยนแปลง (new/edited/deleted) ไม่ส่ง unchanged
      .filter(t => t.mode !== TelNumberMode.Unchanged)
      .map(t => ({
        id: t.id,
        tel: t.tel,
        mode: t.mode
      }));

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
      // เช่นเดียวกัน: ไม่ส่ง unchanged ไป
      .filter(s => s.mode !== SellerAccountMode.Unchanged);

    const variables: any = {
      id: isEdit ? String(initialData!.id) : null,
      data: {
        first_last_name: values.first_last_name?.trim() ?? "",
        id_card: values.id_card?.trim() ?? "",
        title: values.title?.trim() ?? "",
        transfer_amount: typeof values.transfer_amount === 'number'
          ? values.transfer_amount
          : Number(values.transfer_amount || 0),
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

    console.log("[variables] =", variables, telNumbers);

    const { data } = await onPost({ variables });

    if (data?.upsertPost?.id) {
      message.success(isEdit ? 'Saved' : 'Created');

      const savedImgs = (data.upsertPost.images || []).map((img: any) => ({ _id: img.id, url: img.url }));
      setFiles(savedImgs);

      // หลัง save สำเร็จ:
      // 1) เคลียร์รายการที่ถูก mark Deleted ออกจาก state
      // 2) reset mode ที่เหลือให้เป็น Unchanged
      const nextTel = telNumbers
        .filter(t => t.mode !== TelNumberMode.Deleted)
        .map(t => ({ ...t, mode: TelNumberMode.Unchanged }));
      const nextSeller = sellerAccounts
        .filter(s => s.mode !== SellerAccountMode.Deleted)
        .map(s => ({ ...s, mode: SellerAccountMode.Unchanged }));

      setTelNumbers(nextTel.length
        ? nextTel
        : [{ id: makeLocalId("tel"), tel: '', mode: TelNumberMode.New }]
      );

      setSellerAccounts(nextSeller.length
        ? nextSeller
        : [{ id: makeLocalId("seller"), bank_id: "", bank_name: "", mode: SellerAccountMode.New }]
      );

      const newInitValues = form.getFieldsValue(true);
      initialSnapshotRef.current = normalizeComparable(
        newInitValues,
        savedImgs,
        nextTel,
        nextSeller
      );
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
      const current = updated[index];
      if (!current) return prev;

      let mode = current.mode;
      if (mode === TelNumberMode.Unchanged) {
        mode = TelNumberMode.Edited;   // เปลี่ยนจาก unchanged → edited เมื่อมีการแก้ไข
      }
      // ถ้าเป็น New ก็ยังเป็น New, Deleted จะไม่โผล่มาใน UI อยู่แล้ว

      updated[index] = { ...current, tel: value, mode };
      return updated;
    });
  };

  const addTelNumber = () => {
    setTelNumbers(prev => [
      ...prev,
      { id: makeLocalId("tel"), tel: '', mode: TelNumberMode.New }
    ]);
  };

  const removeTelNumber = (index: number) => {
    setTelNumbers(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, mode: TelNumberMode.Deleted } : item
      )
    );
  };

  const removeSellerAccount = (index: number) => {
    setSellerAccounts(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, mode: SellerAccountMode.Deleted } : item
      )
    );
  };

  const addSellerAccount = () => {
    setSellerAccounts(prev => [
      ...prev,
      { id: makeLocalId("seller"), bank_id: "", bank_name: "", mode: SellerAccountMode.New }
    ]);
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
      const current = updated[index];
      if (!current) return prev;

      let mode = current.mode;
      if (mode === SellerAccountMode.Unchanged) {
        mode = SellerAccountMode.Edited;   // เปลี่ยนจาก unchanged → edited เมื่อมีการแก้ไข
      }

      updated[index] = { ...current, [field]: value, mode };
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
          rules={[{ message: 'กรุณากรอกเลขบัตรประชาชน หรือ พาสปอร์ต (passport)' }]}
        >
          <Input placeholder="กรุณากรอกเลขบัตรประชาชน หรือ พาสปอร์ต (passport)" maxLength={13} />
        </Form.Item>

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
          <DatePicker placeholder="กรุณาเลือกวันโอนเงิน" style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>

        {/* เว็บประกาศขายของ */}
        <Form.Item
          label="เว็บประกาศขายของ"
          name="website"
          rules={[{ message: 'กรุณากรอกเว็บประกาศขายของ' }]}
        >
          <Input placeholder="กรุณากรอกเว็บประกาศขายของ" />
        </Form.Item>

        {/* รายละเอียดเพิ่มเติม */}
        <Form.Item label="รายละเอียดเพิ่มเติม" name="detail">
          <Input.TextArea rows={4} placeholder="กรุณากรอกรายละเอียดเพิ่มเติม" />
        </Form.Item>

        {/* Tel Numbers */}
        <div style={{ borderColor: '#d9d9d9', padding: '10px', borderStyle: 'dashed', marginTop: '10px', marginBottom: '10px' }}>
          {telNumbers.map((number, index) => (
            number.mode !== TelNumberMode.Deleted && (
              <div
                key={`${number.id}-${index}`}
                style={{
                  marginBottom: 20,
                  padding: '10px',
                  marginTop: '10px',
                  border: "1px solid #d9d9d9",
                  borderRadius: 6
                }}
              >
                <Form.Item
                  label={`เบอร์โทรศัพท์ หรือ ไอดีไลน์ ${index + 1}`}
                  name={['tel_numbers', index, 'tel']}
                  rules={[{ required: true, message: 'กรุณากรอกเบอร์โทรศัพท์ หรือ ไอดีไลน์' }]}
                >
                  <Input
                    placeholder="กรุณากรอกเบอร์โทรศัพท์ หรือ ไอดีไลน์"
                    onChange={(e) => handleTelChange(index, e.target.value)}
                  />
                </Form.Item>

                {/* {telNumbers.filter(t => t.mode !== TelNumberMode.Deleted).length > 1 && ( */}
                  <Button type="dashed" onClick={() => removeTelNumber(index)}>
                    <MinusCircleOutlined /> ลบ
                  </Button>
                {/* )} */}
              </div>
            )
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
            account.mode !== SellerAccountMode.Deleted && (
              <div
                key={`${account.id}-${index}`}
                style={{
                  marginBottom: 20,
                  padding: '10px',
                  marginTop: '10px',
                  border: "1px solid #d9d9d9",
                  borderRadius: 6
                }}
              >
                <Form.Item
                  label={`ชื่อบัญชีคนขาย ${index + 1}`}
                  name={['seller_accounts', index, 'bank_name']}
                  rules={[{ required: true, message: 'กรุณากรอกบัญชีคนขาย' }]}
                >
                  <Input
                    placeholder="กรุณากรอกบัญชีคนขาย"
                    onChange={(e) => handleSellerAccountChange(index, 'bank_name', e.target.value)}
                  />
                </Form.Item>

                <Form.Item
                  label={`เลขที่บัญชีคนขาย ${index + 1}`}
                  name={['seller_accounts', index, 'seller_account']}
                  rules={[{ required: true, message: 'กรุณากรอกบัญชีคนขาย' }]}
                >
                  <Input
                    placeholder="กรุณากรอกบัญชีคนขาย"
                    onChange={(e) => handleSellerAccountChange(index, 'seller_account', e.target.value)}
                  />
                </Form.Item>

                <Form.Item
                  label="เลือกธนาคาร"
                  name={['seller_accounts', index, 'bank_id']}
                  rules={[{ required: true, message: 'กรุณาเลือกธนาคาร' }]}
                >
                  <Select
                    placeholder="กรุณาเลือกธนาคาร"
                    onChange={(value) => handleSellerAccountChange(index, 'bank_id', value)}
                  >
                    {banks.map((bank, index2) => (
                      <Select.Option key={`${bank.id}-${index2}`} value={bank.id}>
                        {bank.name_th}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* {sellerAccounts.filter(s => s.mode !== SellerAccountMode.Deleted).length > 1 && ( */}
                  <Button type="dashed" onClick={() => removeSellerAccount(index)}>
                    <MinusCircleOutlined /> ลบ
                  </Button>
                {/* )} */}
              </div>
            )
          ))}

          <Form.Item>
            <Button type="dashed" onClick={addSellerAccount} >
              <PlusOutlined /> เพิ่มบัญชีคนขายใหม่
            </Button>
          </Form.Item>
        </div>

        <AttachFileField
          label="ไฟล์แนบ"
          values={files}
          multiple
          accept="image/*"
          onChange={setFiles}
          onSnackbar={(s)=> s.open && message.info(s.message)}
        />

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

        {/* <Form.Item name="status" label="Status">
          <Select options={[{value:'public',label:'public'},{value:'unpublic',label:'unpublic'}]} />
        </Form.Item> */}

        <Button
          type="primary"
          htmlType="submit"
          style={{ marginTop: 16 }}
          loading={loading}
          disabled={!dirty}
        >
          {/* .  */}
          {isEdit ? t("postPage.save") : t("postPage.create") }
        </Button>
      </Form>
    </Card>
  );
}
