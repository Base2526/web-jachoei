CREATE TABLE public.roles (
    id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    key text UNIQUE NOT NULL,          -- admin, staff, subscriber
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.permissions (
    id uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    key text UNIQUE NOT NULL,          -- user.read, report.export
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.role_permissions (
    role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.user_roles (
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES public.users(id),
    assigned_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (key, name, description, is_system) VALUES
('admin', 'Administrator', 'Full access', true),
('staff', 'Staff', 'Backoffice staff', true),
('subscriber', 'Subscriber', 'Normal user', true);

INSERT INTO permissions (key, description) VALUES
('user.read', 'Read users'),
('user.update', 'Update users'),
('user.delete', 'Delete users'),

('role.manage', 'Manage roles'),
('content.read', 'Read content'),
('content.create', 'Create content'),
('content.update', 'Update content');

/*
-- admin = everything
INSERT INTO role_permissions
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.key = 'admin';

-- staff
INSERT INTO role_permissions
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'user.read',
  'content.read',
  'content.create',
  'content.update'
)
WHERE r.key = 'staff';

-- subscriber
INSERT INTO role_permissions
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key = 'content.read'
WHERE r.key = 'subscriber';

*/

/*
Migration จาก users.role เดิม (ครั้งเดียวจบ)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.key = lower(u.role);


หลังจาก verify เสร็จ:
ALTER TABLE users DROP COLUMN role;


เช็ค permission
SELECT EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = $1
    AND p.key = $2
);
*/
