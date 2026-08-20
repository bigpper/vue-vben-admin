<script lang="ts" setup>
/**
 * Conversations → Active / Closed / Assignment (brief §21).
 *
 * Rows come from the bridge's portal table through a read-only role (ADR-0007);
 * assignment is our own data, because neither the bridge nor Synapse has a concept
 * of which agent handles which customer.
 *
 * What is deliberately absent: message content and any Telegram identifier. The
 * read-only role cannot read the bridge's `message` table at all, so that is a
 * property of the database grant rather than of this page remembering to omit it.
 *
 * For direct chats the customer column shows the mapped alias. A blank there means
 * the customer has no identity mapping yet — not that the identity is hidden from
 * this screen specifically.
 */
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Select,
  Table,
  Tabs,
  TabPane,
  Tag,
} from 'ant-design-vue';

import {
  assignConversation,
  listAgents,
  listConversations,
  type AgentRow,
  type ConversationRow,
} from '#/api/company';

const { hasAccessByCodes } = useAccess();
const canAssign = hasAccessByCodes(['agent:write', 'audit:read']);

const loading = ref(false);
const rows = ref<ConversationRow[]>([]);
const agents = ref<AgentRow[]>([]);
const tab = ref('all');
const search = ref('');

const agentOptions = computed(() => [
  { label: 'Unassigned', value: '' },
  ...agents.value
    .filter((a) => a.active)
    .map((a) => ({ label: `${a.agentCode} — ${a.displayName ?? a.mxid}`, value: a.mxid })),
]);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => {
    if (tab.value === 'active' && r.status !== 'active') return false;
    if (tab.value === 'closed' && r.status !== 'closed') return false;
    if (tab.value === 'unassigned' && r.assignedTo) return false;
    if (!q) return true;
    return (
      (r.name ?? '').toLowerCase().includes(q) ||
      (r.customerAlias ?? '').toLowerCase().includes(q)
    );
  });
});

const counts = computed(() => ({
  active: rows.value.filter((r) => r.status === 'active').length,
  closed: rows.value.filter((r) => r.status === 'closed').length,
  unassigned: rows.value.filter((r) => !r.assignedTo).length,
}));

async function load() {
  loading.value = true;
  try {
    const [c, a] = await Promise.all([listConversations(), listAgents(false)]);
    rows.value = c.conversations;
    agents.value = a.agents;
  } finally {
    loading.value = false;
  }
}

async function assign(row: ConversationRow, agentMxid: string) {
  if (!row.roomId) return;
  try {
    await assignConversation({
      agentMxid: agentMxid || null,
      roomId: row.roomId,
      status: agentMxid ? 'active' : 'unassigned',
    });
    await load();
  } catch (error: any) {
    message.error(error?.message ?? 'Assignment failed');
  }
}

async function setStatus(row: ConversationRow, status: string) {
  if (!row.roomId) return;
  try {
    await assignConversation({ agentMxid: row.assignedTo, roomId: row.roomId, status });
    await load();
  } catch (error: any) {
    message.error(error?.message ?? 'Failed');
  }
}

onMounted(load);

const columns = [
  { title: '会话', dataIndex: 'name', ellipsis: true },
  { title: '类型', key: 'type', width: 100 },
  { title: 'Telegram 账号', key: 'account', width: 150 },
  { title: '客户', dataIndex: 'customerAlias', width: 180 },
  { title: '分配给', key: 'assigned', width: 280 },
  { title: '状态', key: 'status', width: 130 },
];
</script>

<template>
  <Page
    title="会话"
    description="每个客户一个 Telegram 服务群，桥接为一个房间。"
  >
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="此处不含任何消息内容"
      description="本页读取的是桥数据库的只读视图，且仅限房间元数据。桥的消息表根本没有授权给这个服务，因此管理后台即使出错也无法显示会话内容。"
    />

    <Card :loading="loading">
      <Tabs v-model:activeKey="tab">
        <TabPane key="all" :tab="`All (${rows.length})`" />
        <TabPane key="active" :tab="`Active (${counts.active})`" />
        <TabPane key="unassigned" :tab="`Unassigned (${counts.unassigned})`" />
        <TabPane key="closed" :tab="`Closed (${counts.closed})`" />
      </Tabs>

      <div class="mb-3 flex gap-2">
        <Input
          v-model:value="search"
          placeholder="Search name or customer"
          style="width: 280px"
          allow-clear
        />
        <Button @click="load">刷新</Button>
      </div>

      <Table
        :columns="columns"
        :data-source="filtered"
        :pagination="{ pageSize: 20 }"
        size="small"
        row-key="roomId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'account'">
            <Tag v-if="record.account" color="blue">{{ record.account }}</Tag>
            <!--
              空账号不是缺数据：桥只按登录账号隔离私聊（portal.receiver），
              群组由所有在其中的账号共享，因此没有单一归属。
            -->
            <span v-else class="text-muted-foreground text-xs">群组共享</span>
          </template>

          <template v-if="column.key === 'type'">
            <Tag :color="record.type === 'direct' ? 'blue' : 'purple'">
              {{ record.type }}
            </Tag>
          </template>

          <template v-if="column.key === 'assigned'">
            <Select
              v-if="canAssign"
              :value="record.assignedTo ?? ''"
              :options="agentOptions"
              style="width: 100%"
              size="small"
              show-search
              option-filter-prop="label"
              @change="(v: any) => assign(record, v)"
            />
            <span v-else class="text-muted-foreground">
              {{ record.assignedTo ?? '—' }}
            </span>
          </template>

          <template v-if="column.key === 'status'">
            <Tag
              :color="
                record.status === 'active'
                  ? 'green'
                  : record.status === 'closed'
                    ? 'default'
                    : 'orange'
              "
            >
              {{ record.status }}
            </Tag>
            <Button
              v-if="canAssign && record.status === 'active'"
              type="link"
              size="small"
              @click="setStatus(record, 'closed')"
            >
              Close
            </Button>
            <Button
              v-else-if="canAssign && record.status === 'closed'"
              type="link"
              size="small"
              @click="setStatus(record, 'active')"
            >
              Reopen
            </Button>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
