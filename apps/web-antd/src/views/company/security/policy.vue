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
  'features.pressBotButtons': {
    note: "Draws bot buttons as pressable. The press itself is refused by the bridge unless that bot is in pressable_bot_ids — turning this on does not make any button work.",
    where: 'client',
  },
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
  { title: '分组', dataIndex: 'section', width: 110 },
  { title: '设置项', dataIndex: 'name', width: 230 },
  { title: '取值', key: 'value', width: 220 },
  { title: '强制点', key: 'enforcement' },
];
</script>

<template>
  <Page
    title="安全策略"
    description="策略带版本。发布会生成新版本，旧版本保留可查。"
  >
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="不是每个开关都是边界"
      description="标记为「客户端」的控制只由坐席的浏览器执行：它们起威慑作用并留下审计记录，但能控制自己机器的坐席可以绕过。标记为「服务端」的控制由 Synapse 或桥拒绝，与客户端行为无关。"
    />

    <Card :loading="loading">
      <template #title>
        当前策略
        <Tag v-if="version" color="blue">v{{ version }}</Tag>
      </template>
      <template #extra>
        <Button type="primary" :loading="publishing" @click="save">
          发布新版本
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
