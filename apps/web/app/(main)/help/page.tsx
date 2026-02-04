'use client';
import { Card, Typography, Anchor, Divider, Alert, Collapse, Timeline, Tag } from 'antd';
import { BookOutlined, QuestionCircleOutlined, ToolOutlined, InfoCircleOutlined } from '@ant-design/icons';
import React from 'react';

const { Title, Paragraph, Text, Link } = Typography;
const { Panel } = Collapse;

export default function HelpPage(){
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:24, padding:'24px 16px',  margin:'0 auto' }}>
      <main>
        <Card>
          <Title level={2}><BookOutlined /> Help & Guide</Title>
          <Paragraph type="secondary">
            หน้านี้เป็นเอกสารช่วยเหลือแบบสแตติก (ไม่พึ่งฐานข้อมูล) ครอบคลุมหัวข้อพื้นฐานของระบบฝั่ง Web + Admin
          </Paragraph>
          <Alert
            type="info"
            showIcon
            message="Tip"
            description="กดลิงก์สารบัญด้านขวาเพื่อเลื่อนไปยังหัวข้อที่ต้องการอย่างรวดเร็ว"
            style={{ marginBottom: 16 }}
          />

          <Divider />

          <section id="getting-started">
            <Title level={3}>เริ่มต้นใช้งาน (Getting Started)</Title>
            <Paragraph>
              1) สมัครสมาชิก / ล็อกอินที่ <Text code>/login</Text> <br/>
              2) ถ้าเป็นผู้ดูแลระบบ ให้เข้า <Text code>/admin/login</Text> เพื่อเข้าสู่หลังบ้าน <br/>
              3) โครงสร้างเมนูหลักในหลังบ้านอยู่ที่ <Text code>/admin/settings</Text> โดยมีแท็บ <Tag>Users</Tag> <Tag>My Posts</Tag> <Tag>Files</Tag> <Tag>Logs</Tag>
            </Paragraph>
            <Paragraph>
              ระบบใช้ Cookie-based JWT แยกสำหรับผู้ใช้ทั่วไป (<Text code>user_token</Text>) และผู้ดูแลระบบ (<Text code>admin_token</Text>)
            </Paragraph>
          </section>

          <Divider />

          <section id="account">
            <Title level={3}>บัญชีผู้ใช้ (Account)</Title>
            <Paragraph>
              - เปลี่ยนรหัสผ่านได้ที่ <Text code>Settings &gt; Security</Text><br/>
              - เปลี่ยนข้อมูลส่วนตัว (ชื่อ, เบอร์, รูปโปรไฟล์) ที่ <Text code>Settings &gt; Profile</Text><br/>
              - หากลืมรหัสผ่าน ใช้หน้า <Text code>/forgot</Text> เพื่อตั้งรหัสใหม่ผ่านอีเมลยืนยัน
            </Paragraph>
          </section>

          <Divider />

          <section id="posts">
            <Title level={3}>โพสต์ (Posts)</Title>
            <Paragraph>
              - สร้างโพสต์ใหม่ที่ <Text code>/post/new</Text> หรือผ่านแท็บ <Text code>Settings &gt; My Posts</Text><br/>
              - สถานะโพสต์มี <Tag color="green">public</Tag> / <Tag color="red">unpublic</Tag><br/>
              - ค้นหาจากชื่อเรื่องหรือเบอร์โทรได้ในหน้า My Posts
            </Paragraph>
          </section>

          <Divider />

          <section id="files">
            <Title level={3}>ไฟล์ (Files)</Title>
            <Paragraph>
              - อัปโหลด/ดาวน์โหลด/เปลี่ยนชื่อ/ลบไฟล์ได้ที่ <Text code>Settings &gt; Files</Text><br/>
              - รองรับแสดงรูปตัวอย่างไฟล์ภาพอัตโนมัติ
            </Paragraph>
          </section>

          <Divider />

          <section id="logs">
            <Title level={3}>ระบบบันทึกเหตุการณ์ (System Logs)</Title>
            <Paragraph>
              - ดูบันทึกเหตุการณ์ได้ที่ <Text code>Settings &gt; Logs</Text> พร้อมตัวกรองระดับ <Tag color="blue">info</Tag> <Tag color="orange">warn</Tag> <Tag color="red">error</Tag><br/>
              - นักพัฒนาสามารถเรียก <Text code>syslog(message, options)</Text> เพื่อเก็บเหตุการณ์สำคัญลงฐานข้อมูล
            </Paragraph>
          </section>

          <Divider />

          <section id="users">
            <Title level={3}>ผู้ใช้งาน (Users)</Title>
            <Paragraph>
              - ผู้ดูแลระบบจัดการผู้ใช้ได้ใน <Text code>Settings &gt; Users</Text><br/>
              - สร้างผู้ใช้, แก้ไขบทบาท (Role), รีเซ็ตรหัสผ่าน (ตั้งรหัสใหม่) ได้จากฟอร์มภายในแท็บดังกล่าว
            </Paragraph>
          </section>

          <Divider />

          <section id="faq">
            <Title level={3}><QuestionCircleOutlined /> คำถามที่พบบ่อย (FAQ)</Title>
            <Collapse bordered={false}>
              <Panel header="ลืมรหัสผ่านทำอย่างไร?" key="1">
                <Paragraph>ไปที่หน้า <Text code>/forgot</Text> กรอกอีเมล ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่</Paragraph>
              </Panel>
              <Panel header="เข้าหลังบ้านไม่เจอเมนู Users?" key="2">
                <Paragraph>ตรวจสอบสิทธิ์ผู้ใช้ของคุณ ต้องเป็น <Text code>Administrator</Text> เท่านั้น</Paragraph>
              </Panel>
              <Panel header="ไฟล์อัปโหลดแล้วไม่ขึ้นในรายการ?" key="3">
                <Paragraph>ลองรีเฟรชหน้าหรืออัปโหลดใหม่ หากยังไม่ขึ้นให้ตรวจสอบสิทธิ์หรือขนาดไฟล์สูงสุดที่อนุญาต</Paragraph>
              </Panel>
              <Panel header="ต้องการ export logs ทำอย่างไร?" key="4">
                <Paragraph>ปัจจุบันสามารถกรองแล้วคัดลอกข้อมูลได้จากหน้า Logs (ถ้าต้องการ CSV แจ้งทีมพัฒนาเพื่อเปิดฟีเจอร์)</Paragraph>
              </Panel>
            </Collapse>
          </section>

          <Divider />

          <section id="troubleshooting">
            <Title level={3}><ToolOutlined /> การแก้ปัญหาเบื้องต้น (Troubleshooting)</Title>
            <Timeline
              items={[
                { color: 'blue', children: 'ตรวจสอบอินเทอร์เน็ตและลองรีเฟรชหน้า' },
                { color: 'blue', children: 'ลองออกจากระบบและเข้าสู่ระบบใหม่' },
                { color: 'blue', children: 'ล้าง cache/คุกกี้ของเบราว์เซอร์แล้วลองใหม่' },
                { color: 'red',  children: 'หากยังมีปัญหา ให้ติดต่อผู้ดูแลระบบพร้อมแนบภาพหน้าจอ/เวลาที่เกิดเหตุ' },
              ]}
            />
          </section>

          <Divider />

          <section id="about">
            <Title level={3}><InfoCircleOutlined /> ข้อมูลระบบ & ติดต่อ</Title>
            <Paragraph>
              เวอร์ชัน UI: <Text code>v1.0</Text> • เอกสารนี้เป็นไฟล์สแตติก สามารถปรับแก้เนื้อหาได้ที่ <Text code>apps/web/app/help/page.tsx</Text>
            </Paragraph>
            <Paragraph>
              ติดต่อผู้ดูแลระบบ: <Link href="mailto:support@example.com">support@example.com</Link>
            </Paragraph>
          </section>
        </Card>
      </main>

      <aside>
        <Card title="สารบัญ">
          <Anchor
            items={[
              { key: 'toc-start', href: '#getting-started', title: 'เริ่มต้นใช้งาน' },
              { key: 'toc-account', href: '#account', title: 'บัญชีผู้ใช้' },
              { key: 'toc-posts', href: '#posts', title: 'โพสต์' },
              { key: 'toc-files', href: '#files', title: 'ไฟล์' },
              { key: 'toc-logs', href: '#logs', title: 'System Logs' },
              { key: 'toc-users', href: '#users', title: 'ผู้ใช้งาน' },
              { key: 'toc-faq', href: '#faq', title: 'FAQ' },
              { key: 'toc-trouble', href: '#troubleshooting', title: 'Troubleshooting' },
              { key: 'toc-about', href: '#about', title: 'เกี่ยวกับระบบ' },
            ]}
            affix
          />
        </Card>
      </aside>
    </div>
  );
}
