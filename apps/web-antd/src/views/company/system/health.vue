<script lang="ts" setup>
/**
 * System → Health (brief §21).
 *
 * Reports only what this service can actually observe. The bridge is deliberately
 * unreachable from the Management API (ADR-0005, brief §25), so it is shown as
 * "unknown" with the reason — a green tick there would be a guess, and a red cross
 * would be wrong.
 */
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Table, Tag } from 'ant-design-vue';

import { systemHealth } from '#/api/company';

const loading = ref(false);
const rows = ref<{ detail?: string; name: string; status: string }[]>([]);
const checkedAt = ref('');

async function load() {
  loading.value = true;
  try {
    const res = await systemHealth();
    rows.value = res.components;
    checkedAt.value = res.checkedAt;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const columns = [
  { title: '组件', dataIndex: 'name', width: 220 },
  { title: '状态', key: 'status', width: 130 },
  { title: '说明', dataIndex: 'detail' },
];
</script>

<template>
  <Page title="运行状态" description="实测所得，而非假定。">
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="部分组件按设计无法从这里观测"
      description="Telegram 桥位于隔离网络，本服务没有到它的路由——这层隔离是安全控制，不是缺口。因此它显示为「未知」，而不是猜一个状态。"
    />
    <Card :loading="loading">
      <template #title>组件</template>
      <template #extra>
        <span class="text-muted-foreground mr-3 text-xs">{{ checkedAt }}</span>
        <Button size="small" @click="load">刷新</Button>
      </template>
      <Table
        :columns="columns"
        :data-source="rows"
        :pagination="false"
        size="small"
        row-key="name"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag
              :color="
                record.status === 'up'
                  ? 'green'
                  : record.status === 'down'
                    ? 'red'
                    : 'default'
              "
            >
              {{ record.status }}
            </Tag>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
