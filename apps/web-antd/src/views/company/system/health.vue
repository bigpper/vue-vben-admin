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
  { title: 'Component', dataIndex: 'name', width: 220 },
  { title: 'Status', key: 'status', width: 130 },
  { title: 'Detail', dataIndex: 'detail' },
];
</script>

<template>
  <Page title="System health" description="Observed, not assumed.">
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="Some components are intentionally not observable from here"
      description="The Telegram bridge sits on an isolated network with no route from this service — that isolation is a security control, not a gap. It is reported as unknown rather than guessed at."
    />
    <Card :loading="loading">
      <template #title>Components</template>
      <template #extra>
        <span class="text-muted-foreground mr-3 text-xs">{{ checkedAt }}</span>
        <Button size="small" @click="load">Refresh</Button>
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
