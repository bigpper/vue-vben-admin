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
  <Page title="Telegram" description="Bridge connection and bridged chats.">
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
          <Statistic title="Bridged conversations" :value="data?.portals.total ?? 0" />
        </Card>
      </Col>
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="Service groups" :value="data?.portals.group ?? 0" />
        </Card>
      </Col>
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="Direct chats" :value="data?.portals.dm ?? 0" />
        </Card>
      </Col>
      <Col :span="6">
        <Card :loading="loading">
          <Statistic title="Bridged identities" :value="data?.bridgedIdentities ?? 0" />
        </Card>
      </Col>
    </Row>

    <Card :loading="loading">
      <template #title>Connection</template>
      <template #extra>
        <Button size="small" @click="load">Refresh</Button>
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
        message="Why there is no 'restart bridge' button here"
        description="The bridge is not reachable from this service by design (brief §25, ADR-0005) — that isolation is what stops an agent asking it to reverse the identity mapping. Bridge operations are performed from the bridge administration room by an integration administrator."
      />
    </Card>
  </Page>
</template>
