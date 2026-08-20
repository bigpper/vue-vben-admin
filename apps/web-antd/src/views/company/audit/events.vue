<script lang="ts" setup>
/**
 * Audit → Security events (brief §14, §15).
 *
 * Deliberately shows identifiers and metadata only. Brief §11 and §14 both say not
 * to duplicate customer message plaintext into the audit trail, so there is no
 * message-content column here — not hidden, not truncated: the API never stores it.
 *
 * Export is gated on `audit:export` and the export itself is audited (§15).
 */
import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  message,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { exportAudit, queryAudit, type CompanyApi } from '#/api/company';

const { hasAccessByCodes } = useAccess();
const canExport = hasAccessByCodes(['audit:export']);

const loading = ref(false);
const rows = ref<CompanyApi.AuditRow[]>([]);
const total = ref(0);

const filters = reactive<CompanyApi.AuditQuery>({
  limit: 50,
  offset: 0,
});

const EVENT_TYPES = [
  'LOGIN', 'LOGOUT', 'ADMIN_LOGIN_DENIED', 'ADMIN_ACCESS_DENIED',
  'CONVERSATION_OPEN', 'MESSAGE_SEND', 'MESSAGE_COPY', 'COPY_BLOCKED',
  'IMAGE_COPY', 'IMAGE_VIEW', 'FILE_VIEW', 'FILE_DOWNLOAD',
  'FILE_DOWNLOAD_BLOCKED', 'SEARCH', 'PROFILE_VIEW', 'EXPORT_ATTEMPT',
  'IDENTITY_REVEAL', 'SECURITY_POLICY_CHANGE', 'ROLE_CHANGE',
].map((v) => ({ label: v, value: v }));

async function load() {
  loading.value = true;
  try {
    const res = await queryAudit(filters);
    rows.value = res.events;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

async function doExport() {
  try {
    const res = await exportAudit(filters);
    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`Exported ${res.rows} rows`);
  } catch (error: any) {
    message.error(error?.message ?? 'Export failed');
  }
}

function reset() {
  filters.agentCode = undefined;
  filters.eventType = undefined;
  filters.result = undefined;
  filters.conversationId = undefined;
  filters.offset = 0;
  void load();
}

onMounted(load);

const columns = [
  { title: '时间', dataIndex: 'createdAt', width: 180 },
  { title: '事件', dataIndex: 'eventType', width: 210 },
  { title: '坐席', dataIndex: 'agentCode', width: 110 },
  { title: '角色', dataIndex: 'roleId', width: 150 },
  { title: '结果', key: 'result', width: 110 },
  { title: '会话', dataIndex: 'conversationId', ellipsis: true },
  { title: 'IP', dataIndex: 'ipAddress', width: 130 },
];
</script>

<template>
  <Page title="安全事件" description="只记录标识与元数据。">
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="不记录任何消息内容"
      description="审计记录只通过 ID 引用会话和消息。坐席复制的文本从不存储——记录它等于重新制造了复制策略本来要限制的那份暴露。"
    />

    <Card>
      <div class="mb-4 flex flex-wrap gap-2">
        <Input
          v-model:value="filters.agentCode"
          placeholder="Agent code"
          style="width: 150px"
          allow-clear
        />
        <Select
          v-model:value="filters.eventType"
          placeholder="Event type"
          style="width: 230px"
          :options="EVENT_TYPES"
          allow-clear
          show-search
        />
        <Select
          v-model:value="filters.result"
          placeholder="Result"
          style="width: 140px"
          :options="[
            { label: 'ALLOWED', value: 'ALLOWED' },
            { label: 'BLOCKED', value: 'BLOCKED' },
            { label: 'FAILED', value: 'FAILED' },
          ]"
          allow-clear
        />
        <Input
          v-model:value="filters.conversationId"
          placeholder="Conversation ID"
          style="width: 240px"
          allow-clear
        />
        <Button type="primary" @click="load">搜索</Button>
        <Button @click="reset">重置</Button>
        <Button v-if="canExport" @click="doExport">导出 CSV</Button>
      </div>

      <Table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="{
          total,
          pageSize: filters.limit,
          onChange: (p: number) => {
            filters.offset = (p - 1) * (filters.limit ?? 50);
            load();
          },
        }"
        size="small"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'result'">
            <Tag :color="record.result === 'BLOCKED' ? 'red' : record.result === 'FAILED' ? 'orange' : 'green'">
              {{ record.result }}
            </Tag>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
