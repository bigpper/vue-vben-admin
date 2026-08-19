<script lang="ts" setup>
/**
 * Security → Policy (brief §7, §10, §21).
 *
 * Edits the versioned security policy document. Publishing writes a NEW version and
 * deactivates the previous one — nothing is mutated in place, so "what was in force
 * last Tuesday" stays answerable.
 *
 * Note the "enforced where" column. Brief §20 warns that a role name is not a
 * boundary, and the same is true of a policy toggle: some of these are refused by
 * Synapse, and some are only honoured by the Element client. An admin UI that
 * renders both identically would be actively misleading, so it does not.
 */
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  message,
  Select,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { listPolicies, publishPolicy } from '#/api/company';

const loading = ref(false);
const publishing = ref(false);
const version = ref<null | number>(null);
const doc = ref<Record<string, any>>({});

/**
 * Where each control is actually enforced. This is the honest bit of the page.
 */
const ENFORCEMENT: Record<string, { note: string; where: 'both' | 'client' | 'server' }> = {
  'clipboard.mode': { note: 'Browser only — deterrence and audit, not prevention.', where: 'client' },
  'features.createRoom': { note: 'Refused by Synapse; the button is also hidden.', where: 'both' },
  'features.invite': { note: 'Refused by Synapse; the button is also hidden.', where: 'both' },
  'features.userSearch': { note: 'Directory disabled server-side and blocked at the proxy.', where: 'both' },
  'features.directMessage': { note: 'Client-side only today.', where: 'client' },
  'features.bridgeCommands': { note: 'Bridge permissions refuse agents outright.', where: 'server' },
  'media.allowImageDownload': { note: 'Browser only — the file is already delivered.', where: 'client' },
  'media.allowFileDownload': { note: 'Browser only — the file is already delivered.', where: 'client' },
  'watermark.enabled': { note: 'Browser only — attribution, not prevention.', where: 'client' },
  'identity.showTelegramUserId': { note: 'Bridge never mints one (ADR-0001); this only affects reveal.', where: 'server' },
};

const rows = computed(() => {
  const out: any[] = [];
  for (const [section, values] of Object.entries(doc.value)) {
    if (typeof values !== 'object' || values === null) continue;
    for (const [key, value] of Object.entries(values as Record<string, any>)) {
      const path = `${section}.${key}`;
      out.push({
        key: path,
        section,
        name: key,
        value,
        type: typeof value,
        enforcement: ENFORCEMENT[path],
      });
    }
  }
  return out;
});

async function load() {
  loading.value = true;
  try {
    const { policies } = await listPolicies();
    const active = policies.find((p) => p.active && p.roleId === null);
    if (active) {
      doc.value = structuredClone(active.document);
      version.value = active.version;
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  publishing.value = true;
  try {
    const res = await publishPolicy({ document: doc.value, roleId: null });
    version.value = res.version;
    message.success(`Published policy version ${res.version}`);
  } catch (error: any) {
    message.error(error?.message ?? 'Failed to publish');
  } finally {
    publishing.value = false;
  }
}

function setValue(path: string, value: any) {
  const [section, key] = path.split('.');
  if (section && key) doc.value[section][key] = value;
}

onMounted(load);

const columns = [
  { title: 'Section', dataIndex: 'section', width: 110 },
  { title: 'Setting', dataIndex: 'name', width: 230 },
  { title: 'Value', key: 'value', width: 220 },
  { title: 'Enforced where', key: 'enforcement' },
];
</script>

<template>
  <Page
    title="Security policy"
    description="Versioned. Publishing creates a new version; the previous one is retained."
  >
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="Not every switch is a boundary"
      description="Controls marked 'client' are honoured by the agent's browser only. They deter and they produce an audit trail, but an agent who controls their machine can defeat them. Controls marked 'server' are refused by Synapse or the bridge regardless of what the client does."
    />

    <Card :loading="loading">
      <template #title>
        Active policy
        <Tag v-if="version" color="blue">v{{ version }}</Tag>
      </template>
      <template #extra>
        <Button type="primary" :loading="publishing" @click="save">
          Publish new version
        </Button>
      </template>

      <Table
        :columns="columns"
        :data-source="rows"
        :pagination="false"
        size="small"
        row-key="key"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'value'">
            <Switch
              v-if="record.type === 'boolean'"
              :checked="record.value"
              @change="(v: any) => setValue(record.key, v)"
            />
            <Select
              v-else-if="record.name === 'mode'"
              style="width: 190px"
              :value="record.value"
              :options="[
                { label: 'ALLOW', value: 'ALLOW' },
                { label: 'ALLOW_AND_AUDIT', value: 'ALLOW_AND_AUDIT' },
                { label: 'BLOCK_AND_AUDIT', value: 'BLOCK_AND_AUDIT' },
              ]"
              @change="(v: any) => setValue(record.key, v)"
            />
            <span v-else class="text-muted-foreground">{{ record.value }}</span>
          </template>

          <template v-if="column.key === 'enforcement'">
            <template v-if="record.enforcement">
              <Tag :color="record.enforcement.where === 'client' ? 'orange' : 'green'">
                {{ record.enforcement.where }}
              </Tag>
              <span class="text-muted-foreground text-xs">
                {{ record.enforcement.note }}
              </span>
            </template>
            <span v-else class="text-muted-foreground text-xs">—</span>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
