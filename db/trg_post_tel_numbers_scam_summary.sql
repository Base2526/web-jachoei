CREATE OR REPLACE FUNCTION trg_post_tel_numbers_scam_summary()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM recalc_scam_phone_from_posts(NEW.tel);

  ELSIF TG_OP = 'UPDATE' THEN
    -- ถ้าเบอร์โดนเปลี่ยน: ต้อง recalc ทั้งเบอร์เก่า + เบอร์ใหม่
    IF NEW.tel IS DISTINCT FROM OLD.tel THEN
      PERFORM recalc_scam_phone_from_posts(OLD.tel);
      PERFORM recalc_scam_phone_from_posts(NEW.tel);
    ELSE
      PERFORM recalc_scam_phone_from_posts(NEW.tel);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recalc_scam_phone_from_posts(OLD.tel);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_tel_numbers_scam_summary_trg ON post_tel_numbers;

CREATE TRIGGER post_tel_numbers_scam_summary_trg
AFTER INSERT OR UPDATE OR DELETE ON post_tel_numbers
FOR EACH ROW
EXECUTE FUNCTION trg_post_tel_numbers_scam_summary();