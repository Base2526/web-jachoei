-- ต้องเปิด uuid extension ถ้ายังไม่มี
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- 1. ฟังก์ชัน generic สำหรับบันทึก revision
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_generic_revision()
RETURNS trigger AS $$
DECLARE
  v_editor uuid;
  v_rev_table text := TG_TABLE_NAME || '_revisions';
  v_exists bool;
BEGIN
  -- หา editor_id จาก session variable (GUC)
  BEGIN
    v_editor := NULLIF(current_setting('app.editor_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_editor := NULL;
  END;

  -- ตรวจว่าตาราง revision มีจริงไหม
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_name = v_rev_table
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE 'Revision table % does not exist, skip insert', v_rev_table;
    RETURN NEW;
  END IF;

  -- บันทึก snapshot เก่า (ใช้ BEFORE UPDATE เพื่อเก็บค่า OLD)
  IF TG_OP = 'UPDATE' THEN
    EXECUTE format(
      'INSERT INTO %I (id, %I_id, editor_id, snapshot, created_at)
       VALUES (uuid_generate_v4(), $1, $2, row_to_json($3), now())',
      v_rev_table, TG_TABLE_NAME
    )
    USING OLD.id, v_editor, OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 2. ฟังก์ชันสำหรับสร้าง revision table + trigger อัตโนมัติ
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_revision_trigger(p_table text)
RETURNS void AS $$
DECLARE
  rev_table text := p_table || '_revisions';
  trg_name text := p_table || '_rev_trg';
BEGIN
  -- 2.1 สร้าง revision table ถ้ายังไม่มี
  EXECUTE format($fmt$
    CREATE TABLE IF NOT EXISTS %I (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      %I_id uuid REFERENCES %I(id) ON DELETE CASCADE,
      editor_id uuid,
      snapshot jsonb NOT NULL,
      created_at timestamptz DEFAULT now()
    )$fmt$, rev_table, p_table, p_table);

  -- 2.2 ลบ trigger เก่า (ถ้ามี) แล้วสร้างใหม่
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trg_name, p_table);
  EXECUTE format($fmt$
    CREATE TRIGGER %I
    BEFORE UPDATE ON %I
    FOR EACH ROW
    EXECUTE FUNCTION trg_generic_revision()
  $fmt$, trg_name, p_table);

  RAISE NOTICE '✅ Trigger created for table %', p_table;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 3. เรียกใช้ครั้งเดียวสำหรับ tables ที่ต้องการ
--------------------------------------------------------------------------------
SELECT create_revision_trigger('posts');
SELECT create_revision_trigger('users');

-- ✅ เพิ่มตารางอื่นได้ในอนาคต
-- SELECT create_revision_trigger('products');
-- SELECT create_revision_trigger('drivers');
--------------------------------------------------------------------------------