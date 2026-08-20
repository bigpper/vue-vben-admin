<script lang="ts" setup>
/**
 * Telegram → Connection, account, groups (brief §21).
 *
 * Everything here is read through the bridge's read-only role (ADR-0007). The
 * bridge's provisioning API was rejected as a data source precisely because it also
 * carries create_dm / search_users / create_group — see that ADR.
 *
 * The account name shown is the COMPANY account's own Telegram name. That is the
 * company's identity, not a customer's, which is why it appears in full.
 */
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  DescriptionsItem,
  Row,
  Statistic,
  Tag,
} from 'ant-design-vue';

import { telegramStatus } from '#/api/company';

const loading = ref(false);
const data = ref<Awaited<ReturnType<typeof telegramStatus>> | null>(null);

async function load() {
  loading.value = true;
  try {
    data.value = await telegramStatus();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page title="Telegram" description="桥的连接状态与已桥接的会话。">
    <Alert
      v-if="data && !data.schema.ok"
      class="mb-4"
      type="error"
      show-icon
      message="Bridge schema drift detected"
      :description="`This console reads the bridge database directly, and a column it depends on has changed: ${data.schema.detail}. The figures below may be incomplete. This is expected to happen on a bridge upgrade and needs a code change, not a config change.`"
    />
    <Alert
      v-else-if="data && data.logins.length === 0"
      class="mb-4"
      type="warning"
      show-icon
      message="No Telegram account is logged in"
      description="Nothing is bridged until the company account signs in. That is done from the bridge administration room by an integration administrator, never by an agent (brief §16)."
    />

    <Row :gutter="16" class="mb-4">
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="已桥接会话" :value="data?.portals.total ?? 0" />
        </Card>
      </Col>
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="服务群组" :value="data?.portals.group ?? 0" />
        </Card>
      </Col>
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="私聊" :value="data?.portals.dm ?? 0" />
        </Card>
      </Col>
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="已桥接身份" :value="data?.bridgedIdentities ?? 0" />
        </Card>
      </Col>
    </Row>

    <Card :loading="loading">
      <template #title>连接</template>
      <template #extra>
        <Button size="small" @click="load">刷新</Button>
      </template>

      <Descriptions bordered size="small" :column="1">
        <DescriptionsItem label="Status">
          <Tag :color="data?.logins.length ? 'green' : 'red'">
            {{ data?.logins.length ? 'connected' : 'not connected' }}
          </Tag>
        </DescriptionsItem>
        <DescriptionsItem label="Company account">
          <template v-if="data?.logins.length">
            <Tag v-for="l in data.logins" :key="l.id">{{ l.name ?? l.id }}</Tag>
          </template>
          <span v-else class="text-muted-foreground">—</span>
        </DescriptionsItem>
        <DescriptionsItem label="Bridge schema">
          <Tag :color="data?.schema.ok ? 'green' : 'red'">
            {{ data?.schema.ok ? 'as expected' : 'drifted' }}
          </Tag>
        </DescriptionsItem>
      </Descriptions>

      <Alert
        class="mt-4"
        type="info"
        show-icon
        message="这里为什么没有「重启桥」按钮"
        description="按设计，这个服务无法访问桥（§25、ADR-0005）——正是这层隔离，使得坐席无法请求桥反查身份映射。桥的运维操作由集成管理员在桥管理房间中执行。"
      />
    </Card>
  </Page>
</template>
