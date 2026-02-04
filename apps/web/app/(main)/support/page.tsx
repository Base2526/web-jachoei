"use client";

import { useMemo, useState } from "react";
import { Card, Col, Form, Input, Row, Select, Typography, Button, message, Collapse } from "antd";
import { gql, useMutation } from "@apollo/client";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CREATE_SUPPORT_TICKET = gql`
  mutation CreateSupportTicket($input: SupportTicketInput!) {
    createSupportTicket(input: $input) {
      ok
      message
      ticketId
    }
  }
`;

type SupportFormValues = {
  name: string;
  email: string;
  topic: string;
  subject: string;
  message: string;
  phone?: string;
  ref?: string;
};

export default function SupportPage() {
  const [form] = Form.useForm<SupportFormValues>();
  const [mutate] = useMutation(CREATE_SUPPORT_TICKET);
  const [loading, setLoading] = useState(false);

  const faqItems = useMemo(
    () => [
      {
        key: "1",
        label: "I didn’t receive the verification email",
        children: (
          <div>
            <div>1) Check spam/junk folder</div>
            <div>2) Wait 1–2 minutes and try resend</div>
            <div>3) Make sure the email address is correct</div>
          </div>
        ),
      },
      {
        key: "2",
        label: "Password reset link is expired",
        children: (
          <div>
            <div>Reset links expire for security.</div>
            <div>Go to Forgot Password and request a new link.</div>
          </div>
        ),
      },
      {
        key: "3",
        label: "I want to delete my account",
        children: (
          <div>
            <div>Send a request via the form below (Topic: Account).</div>
            <div>We will verify ownership and proceed.</div>
          </div>
        ),
      },
    ],
    []
  );

  const onSubmit = async (values: SupportFormValues) => {
    try {
      setLoading(true);

      const input = {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        topic: values.topic,
        subject: values.subject,
        message: values.message,
        ref: values.ref || null,
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      };

      const { data } = await mutate({ variables: { input } });

      if (!data?.createSupportTicket?.ok) {
        message.error(data?.createSupportTicket?.message || "Failed to send");
        return;
      }

      message.success(
        data.createSupportTicket.ticketId
          ? `Sent! Ticket: ${data.createSupportTicket.ticketId}`
          : "Sent!"
      );
      form.resetFields();
    } catch (err: any) {
      message.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 14px" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card style={{ borderRadius: 14 }}>
            <Title level={3} style={{ marginTop: 0 }}>
              Support
            </Title>
            <Text type="secondary">
              Tell us what you need help with. We usually reply within 24 hours.
            </Text>

            <div style={{ height: 16 }} />

            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
              initialValues={{ topic: "general" }}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: "Please enter your name" }]}
                  >
                    <Input placeholder="Your name" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                      { required: true, message: "Please enter your email" },
                      { type: "email", message: "Invalid email" },
                    ]}
                  >
                    <Input placeholder="you@example.com" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Phone (optional)" name="phone">
                    <Input placeholder="+66..." />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Topic"
                    name="topic"
                    rules={[{ required: true, message: "Please choose a topic" }]}
                  >
                    <Select
                      options={[
                        { value: "general", label: "General" },
                        { value: "account", label: "Account" },
                        { value: "billing", label: "Billing" },
                        { value: "bug", label: "Bug report" },
                        { value: "feature", label: "Feature request" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Subject"
                name="subject"
                rules={[{ required: true, message: "Please enter a subject" }]}
              >
                <Input placeholder="Short summary" />
              </Form.Item>

              <Form.Item label="Reference (optional)" name="ref">
                <Input placeholder="e.g. order id, phone number, screenshot id" />
              </Form.Item>

              <Form.Item
                label="Message"
                name="message"
                rules={[{ required: true, message: "Please describe your issue" }]}
              >
                <TextArea rows={6} placeholder="Explain the problem, steps to reproduce, etc." />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={loading} block>
                Send to Support
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card style={{ borderRadius: 14, marginBottom: 16 }}>
            <Title level={5} style={{ marginTop: 0 }}>
              Contact
            </Title>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">Email:</Text> <Text>support@yourdomain.com</Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">Hours:</Text> <Text>Mon–Fri (9:00–18:00)</Text>
            </div>
            <div>
              <Text type="secondary">Tip:</Text>{" "}
              <Text>Include screenshot / reference id for faster help.</Text>
            </div>
          </Card>

          <Card style={{ borderRadius: 14 }}>
            <Title level={5} style={{ marginTop: 0 }}>
              FAQ
            </Title>
            <Collapse items={faqItems as any} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
