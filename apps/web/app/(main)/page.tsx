"use client";

import { gql, useQuery, useMutation } from "@apollo/client";
import {
  Table,
  Space,
  Button,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Typography,
  Badge,
  Grid,
  List,
  Card,
} from "antd";
import Link from "next/link";
import { useState } from "react";
import {
  CommentOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined,
  PhoneOutlined,
  BankOutlined,
} from "@ant-design/icons";

import ThumbGrid from "@/components/ThumbGrid";
import BookmarkButton from "@/components/BookmarkButton";
import { useSessionCtx } from "@/lib/session-context";

const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const DELETE_POST = gql`
  mutation ($id: ID!) {
    deletePost(id: $id)
  }
`;

const Q_POSTS_PAGED = gql`
  query ($q: String, $limit: Int!, $offset: Int!) {
    postsPaged(search: $q, limit: $limit, offset: $offset) {
      total
      items {
        id
        title
        detail
        status
        is_bookmarked
        created_at
        images {
          id
          url
        }
        author {
          id
          name
          avatar
        }
        tel_numbers {
          id
          tel
        }
        seller_accounts {
          id
          bank_name
          seller_account
        }
        comments_count
      }
    }
  }
`;

// map status -> tag color
const statusColor = (status?: string | null) => {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return "gold";
    case "BLOCKED":
    case "BANNED":
      return "red";
    case "VERIFIED":
    case "OK":
      return "green";
    default:
      return "default";
  }
};

// Tel list helper (ใช้ได้ทั้ง desktop + mobile)
const TelList = ({ items }: { items: Array<{ id: string; tel: string }> | undefined; }) => {
  const list = (items || []).filter(Boolean);
  if (!list.length) return <Text type="secondary">-</Text>;

  const visible = list.slice(0, 3);
  const hidden = list.slice(3);

  return (
    <>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {visible.map((t) => (
          <li key={t.id || t.tel} style={{ lineHeight: 1.3 }}>
            <Text copyable style={{ fontSize: 13 }}>
              <PhoneOutlined style={{ marginRight: 4 }} />
              {t.tel}
            </Text>
          </li>
        ))}
      </ul>

      {hidden.length > 0 && (
        <Tooltip
          placement="bottom"
          title={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {hidden.map((t) => (
                <li key={t.id || t.tel} style={{ lineHeight: 1.3 }}>
                  <Text copyable>{t.tel}</Text>
                </li>
              ))}
            </ul>
          }
        >
          <span style={{ fontSize: 12, color: "#999" }}>
            +{hidden.length} more
          </span>
        </Tooltip>
      )}
    </>
  );
};

function PostsList() {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // md ขึ้นไปถือว่า desktop, ต่ำกว่านั้น = mobile

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { user } = useSessionCtx();

  const { data, loading, refetch } = useQuery(Q_POSTS_PAGED, {
    variables: { q: null, limit: pageSize, offset: (page - 1) * pageSize },
    fetchPolicy: "cache-and-network",
  });

  const [deletePost, { loading: deleting }] = useMutation(DELETE_POST);

  const handleDelete = async (id: string) => {
    try {
      const { data: res } = await deletePost({ variables: { id } });
      if (res?.deletePost) {
        message.success("Deleted successfully");
        refetch();
      } else {
        message.warning("Delete failed");
      }
    } catch (err: any) {
      message.error(err?.message || "Delete error");
    }
  };

  const items = data?.postsPaged?.items || [];
  const total = data?.postsPaged?.total || 0;

  // ===== Desktop columns (Table) =====
  const columns = [
    {
      title: "Images",
      dataIndex: "images",
      width: 190,
      render: (imgs: any) => (
        <ThumbGrid images={imgs} width={170} height={120} />
      ),
    },
    {
      title: "Title",
      onCell: () => ({ style: { verticalAlign: "top" } }),
      render: (_: any, r: any) => {
        const ts = String(r.created_at).trim();
        return  <div style={{ paddingRight: 12 }}>
                  <Link href={`/post/${r.id}`} prefetch={false}>
                    <Text strong style={{ fontSize: 14 }}>
                      {r.title || "-"}
                    </Text>
                  </Link>

                  <div style={{ marginTop: 4 }}>
                    {r.status && (
                      <Tag color={statusColor(r.status)} style={{ marginRight: 6 }}>
                        {r.status}
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}> {ts ? new Date(Number(ts)).toLocaleString() : ""} </Text>
                  </div>
                  {r.author && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        by{" "}
                        <Link href={`/profile/${r.author.id}`} prefetch={false}>
                          {r.author.name}
                        </Link>
                      </Text>
                    </div>
                  )}
                </div>
        },
    },
    {
      title: "Detail",
      dataIndex: "detail",
      onCell: () => ({ style: { verticalAlign: "top" } }),
      render: (detail: string) => (
        <Paragraph
          style={{ marginBottom: 0, maxWidth: 420 }}
          ellipsis={{ rows: 4, expandable: false }}
        >
          {detail}
        </Paragraph>
      ),
    },
    {
      title: "Tel",
      width: 220,
      dataIndex: "tel_numbers",
      onCell: () => ({ style: { verticalAlign: "top" } }),
      render: (tels: any) => <TelList items={tels} />,
    },
    {
      title: "Seller Accounts",
      dataIndex: "seller_accounts",
      onCell: () => ({ style: { verticalAlign: "top" } }),
      render: (
        list: Array<{
          id: string;
          bank_name?: string;
          seller_account?: string;
        }> = []
      ) => {
        if (!Array.isArray(list) || list.length === 0)
          return <Text type="secondary">-</Text>;

        const visible = list.slice(0, 3);
        const hidden = list.slice(3);

        const renderList = (data: typeof list) => (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.map((acc) => (
              <li key={acc.id} style={{ lineHeight: 1.3 }}>
                <Text style={{ fontSize: 13 }}>
                  <BankOutlined style={{ marginRight: 4 }} />
                  {acc.bank_name || "-"} :{" "}
                  <Text copyable>{acc.seller_account || "-"}</Text>
                </Text>
              </li>
            ))}
          </ul>
        );

        return (
          <>
            {renderList(visible)}
            {hidden.length > 0 && (
              <Tooltip placement="bottom" title={renderList(hidden)}>
                <span style={{ fontSize: 12, color: "#999" }}>
                  +{hidden.length} more
                </span>
              </Tooltip>
            )}
          </>
        );
      },
    },
    {
      title: "Action",
      fixed: "right" as const,
      width: 160,
      render: (_: any, r: any) => (
        <Space size={4}>
          {user?.id !== r.author?.id && (
            <BookmarkButton
              postId={r.id}
              defaultBookmarked={r?.is_bookmarked ?? false}
            />
          )}

          {user?.id === r.author?.id && (
            <>
              <Tooltip title="Edit">
                <Link href={`/post/${r.id}/edit`} prefetch={false}>
                  <Button type="text" size="small" icon={<EditOutlined />} />
                </Link>
              </Tooltip>

              <Popconfirm
                title="Confirm delete?"
                okText="Yes"
                cancelText="No"
                onConfirm={() => handleDelete(r.id)}
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    loading={deleting}
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}

          {user?.id !== r.author?.id && (
            <Tooltip title="Chat with author">
              <Link href={`/chat?to=${r.author.id}`} prefetch={false}>
                <Button
                  type="text"
                  size="small"
                  icon={<MessageOutlined />}
                />
              </Link>
            </Tooltip>
          )}

          <Tooltip title={`Comments (${r.comments_count || 0})`}>
            <Link href={`/post/${r.id}`} prefetch={false}>
              <Badge
                count={r.comments_count || 0}
                size="small"
                showZero={false}
                offset={[0, 4]}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<CommentOutlined />}
                />
              </Badge>
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ===== Mobile view: ใช้ List + Card แทน Table =====
  if (isMobile) {
    return (
      <div style={{ padding: 8 }}>
        <List
          loading={loading}
          dataSource={items}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              refetch({ q: null, limit: ps, offset: (p - 1) * ps });
            },
          }}
          renderItem={(r: any) => (
            <List.Item style={{ padding: 8 }}>
              <Card
                style={{ width: "100%" }}
                bodyStyle={{ padding: 8 }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  {/* รูปด้านซ้ายบน mobile */}
                  <div style={{ flexShrink: 0 }}>
                    <ThumbGrid images={r.images} width={120} height={90} />
                  </div>

                  {/* ข้อความด้านขวา */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/post/${r.id}`} prefetch={false}>
                      <Text strong style={{ fontSize: 14 }} ellipsis>
                        {r.title || "-"}
                      </Text>
                    </Link>

                    <div style={{ marginTop: 4 }}>
                      {r.status && (
                        <Tag
                          color={statusColor(r.status)}
                          style={{ marginRight: 6 }}
                        >
                          {r.status}
                        </Tag>
                      )}
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString()
                          : ""}
                      </Text>
                    </div>

                    {r.author && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          by{" "}
                          <Link
                            href={`/profile/${r.author.id}`}
                            prefetch={false}
                          >
                            {r.author.name}
                          </Link>
                        </Text>
                      </div>
                    )}

                    {/* detail ย่อ ๆ */}
                    {r.detail && (
                      <Paragraph
                        style={{ marginTop: 4, marginBottom: 4, fontSize: 12 }}
                        ellipsis={{ rows: 2 }}
                      >
                        {r.detail}
                      </Paragraph>
                    )}

                    {/* Tel + Bank แบบแถวเล็ก ๆ */}
                    <div style={{ marginTop: 4 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        Tel:
                      </Text>{" "}
                      <span style={{ fontSize: 12 }}>
                        {r.tel_numbers?.[0]?.tel || "-"}
                        {r.tel_numbers && r.tel_numbers.length > 1 && (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {" "}
                            (+{r.tel_numbers.length - 1} more)
                          </Text>
                        )}
                      </span>
                    </div>

                    <div style={{ marginTop: 2 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        Bank:
                      </Text>{" "}
                      <span style={{ fontSize: 12 }}>
                        {r.seller_accounts?.[0]
                          ? `${r.seller_accounts[0].bank_name || "-"}: ${
                              r.seller_accounts[0].seller_account || "-"
                            }`
                          : "-"}
                        {r.seller_accounts &&
                          r.seller_accounts.length > 1 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {" "}
                              (+{r.seller_accounts.length - 1} more)
                            </Text>
                          )}
                      </span>
                    </div>

                    {/* Action row */}
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 4,
                      }}
                    >
                      <Space size={4}>
                        {user?.id !== r.author?.id && (
                          <BookmarkButton
                            postId={r.id}
                            defaultBookmarked={r?.is_bookmarked ?? false}
                          />
                        )}

                        {user?.id === r.author?.id && (
                          <>
                            <Tooltip title="Edit">
                              <Link
                                href={`/post/${r.id}/edit`}
                                prefetch={false}
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined />}
                                />
                              </Link>
                            </Tooltip>

                            <Popconfirm
                              title="Confirm delete?"
                              okText="Yes"
                              cancelText="No"
                              onConfirm={() => handleDelete(r.id)}
                            >
                              <Tooltip title="Delete">
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  loading={deleting}
                                  icon={<DeleteOutlined />}
                                />
                              </Tooltip>
                            </Popconfirm>
                          </>
                        )}

                        {user?.id !== r.author?.id && (
                          <Tooltip title="Chat with author">
                            <Link
                              href={`/chat?to=${r.author.id}`}
                              prefetch={false}
                            >
                              <Button
                                type="text"
                                size="small"
                                icon={<MessageOutlined />}
                              />
                            </Link>
                          </Tooltip>
                        )}
                      </Space>

                      <Tooltip title={`Comments (${r.comments_count || 0})`}>
                        <Link href={`/post/${r.id}`} prefetch={false}>
                          <Badge
                            count={r.comments_count || 0}
                            size="small"
                            showZero={false}
                            offset={[0, 4]}
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<CommentOutlined />}
                            />
                          </Badge>
                        </Link>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </Card>
            </List.Item>
          )}
        />
      </div>
    );
  }

  // ===== Desktop view: Table =====
  return (
    <div style={{ padding: 5 }}>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns as any}
        size="middle"
        tableLayout="fixed"
        scroll={{ x: 1100 }}
        rowClassName={(_, index) =>
          index % 2 === 0 ? "row-even" : "row-odd"
        }
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (tot, range) =>
            `${range[0]}-${range[1]} of ${tot} items`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            refetch({ q: null, limit: ps, offset: (p - 1) * ps });
          },
        }}
      />
    </div>
  );
}

export default function Page() {
  return <PostsList />;
}
