--
-- PostgreSQL database dump
--

\restrict SUWRmxFgSe1ctT6fPd6bgVRN4014ISo7zpmYbNFhHtEcYif4thkp6sYv3XT1IT3

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: create_revision_trigger(text); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.create_revision_trigger(p_table text) RETURNS void
    LANGUAGE plpgsql
    AS $_$
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
$_$;


ALTER FUNCTION public.create_revision_trigger(p_table text) OWNER TO app;

--
-- Name: trg_generic_revision(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.trg_generic_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
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
$_$;


ALTER FUNCTION public.trg_generic_revision() OWNER TO app;

--
-- Name: trg_messages_after_insert__create_receipts(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.trg_messages_after_insert__create_receipts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO message_receipts (message_id, user_id)
  SELECT NEW.id, cm.user_id
  FROM chat_members cm
  WHERE cm.chat_id = NEW.chat_id
    AND cm.user_id <> NEW.sender_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_messages_after_insert__create_receipts() OWNER TO app;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.bookmarks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookmarks OWNER TO app;

--
-- Name: message_receipts; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.message_receipts (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


ALTER TABLE public.message_receipts OWNER TO app;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    chat_id uuid,
    sender_id uuid,
    text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    reply_to_id uuid
);


ALTER TABLE public.messages OWNER TO app;

--
-- Name: chat_last_read; Type: VIEW; Schema: public; Owner: app
--

CREATE VIEW public.chat_last_read AS
 SELECT r.user_id,
    m.chat_id,
    max(r.read_at) AS last_read_at
   FROM (public.message_receipts r
     JOIN public.messages m ON ((m.id = r.message_id)))
  GROUP BY r.user_id, m.chat_id;


ALTER VIEW public.chat_last_read OWNER TO app;

--
-- Name: chat_members; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.chat_members (
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL
);


ALTER TABLE public.chat_members OWNER TO app;

--
-- Name: chat_unread_counts; Type: VIEW; Schema: public; Owner: app
--

CREATE VIEW public.chat_unread_counts AS
 SELECT cm.user_id,
    m.chat_id,
    count(*) AS unread_count
   FROM ((public.messages m
     JOIN public.chat_members cm ON ((cm.chat_id = m.chat_id)))
     LEFT JOIN public.message_receipts r ON (((r.message_id = m.id) AND (r.user_id = cm.user_id))))
  WHERE ((cm.user_id <> m.sender_id) AND (r.read_at IS NULL))
  GROUP BY cm.user_id, m.chat_id;


ALTER VIEW public.chat_unread_counts OWNER TO app;

--
-- Name: chats; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.chats (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text,
    is_group boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chats OWNER TO app;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.comments (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comments OWNER TO app;

--
-- Name: files; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.files (
    id integer NOT NULL,
    filename text NOT NULL,
    original_name text,
    mimetype text,
    size bigint,
    checksum text,
    relpath text NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deleted_at timestamp without time zone
);


ALTER TABLE public.files OWNER TO app;

--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: app
--

CREATE SEQUENCE public.files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.files_id_seq OWNER TO app;

--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: app
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: message_images; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.message_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    url text NOT NULL,
    mime text,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT now(),
    file_id integer
);


ALTER TABLE public.message_images OWNER TO app;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    data jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO app;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.password_reset_tokens (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO app;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: app
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO app;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: app
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: post_images; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.post_images (
    id integer NOT NULL,
    post_id uuid NOT NULL,
    file_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.post_images OWNER TO app;

--
-- Name: post_images_id_seq; Type: SEQUENCE; Schema: public; Owner: app
--

CREATE SEQUENCE public.post_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_images_id_seq OWNER TO app;

--
-- Name: post_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: app
--

ALTER SEQUENCE public.post_images_id_seq OWNED BY public.post_images.id;


--
-- Name: post_seller_accounts; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.post_seller_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid,
    bank_id text,
    bank_name text,
    seller_account text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_seller_accounts OWNER TO app;

--
-- Name: post_tel_numbers; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.post_tel_numbers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    post_id uuid,
    tel text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.post_tel_numbers OWNER TO app;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.posts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    author_id uuid,
    status text DEFAULT 'public'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    meta text,
    fake_test boolean,
    first_last_name text,
    id_card text,
    title text,
    transfer_amount numeric(12,2) DEFAULT 0,
    transfer_date timestamp with time zone,
    website text,
    province_id uuid,
    detail text
);


ALTER TABLE public.posts OWNER TO app;

--
-- Name: posts_revisions; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.posts_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    posts_id uuid,
    editor_id uuid,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.posts_revisions OWNER TO app;

--
-- Name: provinces; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.provinces (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name_th text NOT NULL,
    name_en text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.provinces OWNER TO app;

--
-- Name: schema_version; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.schema_version (
    id integer DEFAULT 1 NOT NULL,
    version text NOT NULL,
    applied_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_version OWNER TO app;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.sessions (
    token text NOT NULL,
    user_id uuid NOT NULL,
    user_agent text,
    ip text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expired_at timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO app;

--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.system_logs (
    id bigint NOT NULL,
    level text DEFAULT 'info'::text NOT NULL,
    category text DEFAULT 'app'::text NOT NULL,
    message text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    created_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_logs OWNER TO app;

--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: app
--

CREATE SEQUENCE public.system_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_logs_id_seq OWNER TO app;

--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: app
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: user_notification_settings; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.user_notification_settings (
    user_id uuid NOT NULL,
    chat_enabled boolean DEFAULT true NOT NULL,
    post_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT false NOT NULL
);


ALTER TABLE public.user_notification_settings OWNER TO app;

--
-- Name: users; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    avatar text,
    phone text,
    email text,
    role text DEFAULT 'Subscriber'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    password_hash text NOT NULL,
    meta text,
    fake_test boolean,
    username text,
    language text DEFAULT 'en'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'password'::text NOT NULL,
    provider_id text
);


ALTER TABLE public.users OWNER TO app;

--
-- Name: users_revisions; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public.users_revisions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    users_id uuid,
    editor_id uuid,
    snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users_revisions OWNER TO app;

--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: post_images id; Type: DEFAULT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_images ALTER COLUMN id SET DEFAULT nextval('public.post_images_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: chat_members chat_members_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_pkey PRIMARY KEY (chat_id, user_id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: message_images message_images_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.message_images
    ADD CONSTRAINT message_images_pkey PRIMARY KEY (id);


--
-- Name: message_receipts message_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.message_receipts
    ADD CONSTRAINT message_receipts_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: post_images post_images_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_pkey PRIMARY KEY (id);


--
-- Name: post_seller_accounts post_seller_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_seller_accounts
    ADD CONSTRAINT post_seller_accounts_pkey PRIMARY KEY (id);


--
-- Name: post_tel_numbers post_tel_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_tel_numbers
    ADD CONSTRAINT post_tel_numbers_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts_revisions posts_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.posts_revisions
    ADD CONSTRAINT posts_revisions_pkey PRIMARY KEY (id);


--
-- Name: provinces provinces_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.provinces
    ADD CONSTRAINT provinces_pkey PRIMARY KEY (id);


--
-- Name: schema_version schema_version_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.schema_version
    ADD CONSTRAINT schema_version_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: user_notification_settings user_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.user_notification_settings
    ADD CONSTRAINT user_notification_settings_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_revisions users_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.users_revisions
    ADD CONSTRAINT users_revisions_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_comments_parent ON public.comments USING btree (parent_id);


--
-- Name: idx_comments_post; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_comments_post ON public.comments USING btree (post_id, created_at);


--
-- Name: idx_files_created_at; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_files_created_at ON public.files USING btree (created_at DESC);


--
-- Name: idx_message_images_message_id; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_message_images_message_id ON public.message_images USING btree (message_id);


--
-- Name: idx_messages_chat_deleted; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_messages_chat_deleted ON public.messages USING btree (chat_id, deleted_at);


--
-- Name: idx_messages_reply_to_id; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_messages_reply_to_id ON public.messages USING btree (reply_to_id);


--
-- Name: idx_notifications_user_created_at; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_notifications_user_created_at ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_is_read; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_notifications_user_is_read ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_prt_token; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_prt_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_prt_userid; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_prt_userid ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_receipts_message; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_receipts_message ON public.message_receipts USING btree (message_id);


--
-- Name: idx_receipts_user_read_null; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_receipts_user_read_null ON public.message_receipts USING btree (user_id) WHERE (read_at IS NULL);


--
-- Name: idx_system_logs_category; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_system_logs_category ON public.system_logs USING btree (category);


--
-- Name: idx_system_logs_created_at; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_system_logs_created_at ON public.system_logs USING btree (created_at DESC);


--
-- Name: idx_system_logs_level; Type: INDEX; Schema: public; Owner: app
--

CREATE INDEX idx_system_logs_level ON public.system_logs USING btree (level);


--
-- Name: messages messages_after_insert__create_receipts; Type: TRIGGER; Schema: public; Owner: app
--

CREATE TRIGGER messages_after_insert__create_receipts AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trg_messages_after_insert__create_receipts();


--
-- Name: posts posts_rev_trg; Type: TRIGGER; Schema: public; Owner: app
--

CREATE TRIGGER posts_rev_trg BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.trg_generic_revision();


--
-- Name: users users_rev_trg; Type: TRIGGER; Schema: public; Owner: app
--

CREATE TRIGGER users_rev_trg BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trg_generic_revision();


--
-- Name: bookmarks bookmarks_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: chat_members chat_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.chat_members
    ADD CONSTRAINT chat_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chats chats_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_images message_images_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.message_images
    ADD CONSTRAINT message_images_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id);


--
-- Name: message_images message_images_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.message_images
    ADD CONSTRAINT message_images_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_receipts message_receipts_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.message_receipts
    ADD CONSTRAINT message_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_receipts message_receipts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.message_receipts
    ADD CONSTRAINT message_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE CASCADE;


--
-- Name: messages messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_images post_images_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- Name: post_images post_images_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_seller_accounts post_seller_accounts_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_seller_accounts
    ADD CONSTRAINT post_seller_accounts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_tel_numbers post_tel_numbers_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.post_tel_numbers
    ADD CONSTRAINT post_tel_numbers_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: posts_revisions posts_revisions_posts_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.posts_revisions
    ADD CONSTRAINT posts_revisions_posts_id_fkey FOREIGN KEY (posts_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users_revisions users_revisions_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public.users_revisions
    ADD CONSTRAINT users_revisions_users_id_fkey FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict SUWRmxFgSe1ctT6fPd6bgVRN4014ISo7zpmYbNFhHtEcYif4thkp6sYv3XT1IT3

