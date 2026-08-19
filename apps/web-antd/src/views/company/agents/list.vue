<script lang="ts" setup>
/**
 * Agents → List and provisioning (brief §21, §19, §20).
 *
 * The "Pending" tab is the SSO joiner queue. When someone the IdP vouches for signs
 * in for the first time, Synapse creates their Matrix account and the Management API
 * records them here — inactive, with no working policy — and refuses them until an
 * administrator assigns a role.
 *
 * That refusal is deliberate. Auto-assigning a default role would mean anyone the
 * IdP authenticates silently becomes an agent. Until approved, such an account gets
 * the locked-down policy, which is the safe direction.
 */
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccess } from '@vben/access';

import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tabs,
  TabPane,
  Tag,
} from 'ant-design-vue';

import {
  listAgents,
  listRoles,
  setAgentActive,
  upsertAgent,
  type AgentRow,
  type RoleRow,
} from '#/api/company';

const { hasAccessByCodes } = useAccess();
const canWrite = hasAccessByCodes(['agent:write']);

const tab = ref('active');
const loading = ref(false);
const agents = ref<AgentRow[]>([]);
const pending = ref<AgentRow[]>([]);
const pendingCount = ref(0);
const roles = ref<RoleRow[]>([]);

const editOpen = ref(false);
const saving = ref(false);
const form = ref({ agentCode: '', displayName: '', mxid: '', roleId: 'AGENT' });

const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: `${r.name} (${r.rank})`, value: r.id })),
);

async function load() {
  loading.value = true;
  try {
    const [a, p, r] = await Promise.all([
      listAgents(false),
      listAgents(true),
      listRoles(),
    ]);
    agents.value = a.agents;
    pending.value = p.agents;
    pendingCount.value = p.pendingCount;
    roles.value = r.roles;
  } finally {
    loading.value = false;
  }
}

function openApprove(row: AgentRow) {
  const localpart = row.mxid.slice(1).split(':')[0] ?? '';
  form.value = {
    agentCode: row.agentCode.startsWith('PENDING-') ? '' : row.agentCode,
    displayName: row.displayName ?? localpart,
    mxid: row.mxid,
    roleId: row.roleId || 'AGENT',
  };
  editOpen.value = true;
}

async function save() {
  if (!form.value.agentCode.trim()) {
    message.warning('An agent code is required — it appears in audit records and the watermark.');
    return;
  }
  saving.value = true;
  try {
    await upsertAgent({
      agentCode: form.value.agentCode.trim(),
      displayName: form.value.displayName.trim() || undefined,
      mxid: form.value.mxid,
      roleId: form.value.roleId,
    });
    message.success('Provisioned');
    editOpen.value = false;
    await load();
  } catch (error: any) {
    message.error(error?.message ?? 'Failed');
  } finally {
    saving.value = false;
  }
}

async function toggle(row: AgentRow) {
  try {
    await setAgentActive(row.mxid, !row.active);
    await load();
  } catch (error: any) {
    message.error(error?.message ?? 'Failed');
  }
}

onMounted(load);

const columns = [
  { title: 'Agent code', dataIndex: 'agentCode', width: 150 },
  { title: 'Name', dataIndex: 'displayName', width: 190 },
  { title: 'Matrix ID', dataIndex: 'mxid', ellipsis: true },
  { title: 'Role', dataIndex: 'roleId', width: 170 },
  { title: 'Status', key: 'status', width: 110 },
  { title: '', key: 'actions', width: 170 },
];
</script>

<template>
  <Page title="Agents" description="Provisioning, roles and access.">
    <Alert
      v-if="pendingCount > 0"
      class="mb-4"
      type="warning"
      show-icon
      :message="`${pendingCount} account(s) awaiting provisioning`"
      description="These signed in through SSO and have no role yet. They cannot use the platform — the client falls back to the locked-down policy — until a role is assigned here."
    />

    <Card :loading="loading">
      <Tabs v-model:activeKey="tab">
        <TabPane key="active" tab="Provisioned" />
        <TabPane key="pending">
          <template #tab>
            Pending
            <Badge v-if="pendingCount" :count="pendingCount" class="ml-1" />
          </template>
        </TabPane>
      </Tabs>

      <Table
        :columns="columns"
        :data-source="tab === 'pending' ? pending : agents"
        :pagination="false"
        size="small"
        row-key="mxid"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="record.active ? 'green' : 'default'">
              {{ record.active ? 'active' : 'inactive' }}
            </Tag>
          </template>
          <template v-if="column.key === 'actions'">
            <template v-if="canWrite">
              <Button size="small" type="link" @click="openApprove(record)">
                {{ tab === 'pending' ? 'Provision' : 'Edit' }}
              </Button>
              <Button
                v-if="tab !== 'pending'"
                size="small"
                type="link"
                :danger="record.active"
                @click="toggle(record)"
              >
                {{ record.active ? 'Deactivate' : 'Activate' }}
              </Button>
            </template>
            <Tag v-else color="default">Read only</Tag>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="editOpen"
      title="Provision agent"
      :confirm-loading="saving"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="Matrix ID">
          <Input :value="form.mxid" disabled />
        </FormItem>
        <FormItem label="Agent code">
          <Input
            v-model:value="form.agentCode"
            placeholder="CS002"
          />
          <span class="text-muted-foreground text-xs">
            Appears in audit records and in the on-screen watermark.
          </span>
        </FormItem>
        <FormItem label="Display name">
          <Input v-model:value="form.displayName" />
        </FormItem>
        <FormItem label="Role">
          <Select v-model:value="form.roleId" :options="roleOptions" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
