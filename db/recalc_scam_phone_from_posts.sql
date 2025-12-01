CREATE OR REPLACE FUNCTION recalc_scam_phone_from_posts(p_phone text)
RETURNS void AS $$
DECLARE
  agg_phone text;
  agg_count int;
  agg_last  timestamptz;
  agg_posts uuid[];
  agg_risk  int;
BEGIN
  -- รวมข้อมูลจาก post_tel_numbers ของเบอร์นี้
  SELECT
    tel AS phone,
    COUNT(*)::int AS report_count,
    MAX(created_at) AS last_report_at,
    ARRAY_AGG(DISTINCT post_id)::uuid[] AS post_ids
  INTO
    agg_phone, agg_count, agg_last, agg_posts
  FROM post_tel_numbers
  WHERE tel = p_phone
  GROUP BY tel;

  -- ถ้าไม่มี row ใน post_tel_numbers แล้ว
  IF agg_phone IS NULL THEN
    -- mark ว่า deleted (ยังเก็บ row ไว้เพื่อให้ client sync ลบ)
    UPDATE scam_phones_summary
    SET
      report_count   = 0,
      last_report_at = NULL,
      post_ids       = '{}',
      risk_level     = 0,
      is_deleted     = true,
      updated_at     = now()
    WHERE phone = p_phone;

    -- ถ้าอยากลบ row ทิ้งจริง ๆ ก็ใช้ DELETE แทน UPDATE ด้านบน
    RETURN;
  END IF;

  -- คำนวณ risk จาก count (จะใช้สูตรอะไรก็ได้)
  IF agg_count >= 20 THEN
    agg_risk := 90;
  ELSIF agg_count >= 10 THEN
    agg_risk := 60;
  ELSIF agg_count >= 5 THEN
    agg_risk := 40;
  ELSE
    agg_risk := 10;
  END IF;

  -- upsert summary row
  INSERT INTO scam_phones_summary
    (phone, report_count, last_report_at, post_ids, risk_level, is_deleted, updated_at)
  VALUES
    (agg_phone, agg_count, agg_last, agg_posts, agg_risk, false, now())
  ON CONFLICT (phone) DO UPDATE
  SET
    report_count   = EXCLUDED.report_count,
    last_report_at = EXCLUDED.last_report_at,
    post_ids       = EXCLUDED.post_ids,
    risk_level     = EXCLUDED.risk_level,
    is_deleted     = false,
    updated_at     = now();
END;
$$ LANGUAGE plpgsql;
