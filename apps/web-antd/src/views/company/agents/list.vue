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
  getOverview,
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
const creating = ref(false);
const saving = ref(false);
const form = ref({
  agentCode: '',
  displayName: '',
  mxid: '',
  roleId: 'AGENT',
  telegramAccounts: [] as string[],
});

/** Telegram accounts available to bind, from the overview endpoint. */
const accountOptions = ref<{ label: string; value: string }[]>([]);

const roleOptions = computed(() =>
  roles.value.map((r) => ({ label: `${r.name} (${r.rank})`, value: r.id })),
);

async function load() {
  loading.value = true;
  try {
    // Accounts come from the overview endpoint rather than a dedicated one; it
    // already lists every login and this page needs nothing else from it.
    getOverview()
      .then((o) => {
        accountOptions.value = o.telegram.accounts.map((a) => ({
          label: a.name || a.id,
          value: a.id,
        }));
      })
      .catch(() => {
        // A missing account list must not stop the page loading — the binding
        // control simply has no options, which is visible and recoverable.
      });
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

/**
 * Provision an agent whose Matrix account already exists but who has never signed
 * in here.
 *
 * The normal path is SSO: the IdP creates the account on first login and this
 * console shows them under 待处理. This is the manual entry for accounts created
 * some other way — the server checks the account actually exists, because a record
 * for a mistyped MXID matches nobody while still looking provisioned.
 */
function openCreate() {
  creating.value = true;
  form.value = {
    agentCode: '',
    displayName: '',
    mxid: '',
    roleId: 'AGENT',
    telegramAccounts: [],
  };
  editOpen.value = true;
}

function openApprove(row: AgentRow) {
  creating.value = false;
  const localpart = row.mxid.slice(1).split(':')[0] ?? '';
  form.value = {
    agentCode: row.agentCode.startsWith('PENDING-') ? '' : row.agentCode,
    displayName: row.displayName ?? localpart,
    mxid: row.mxid,
    roleId: row.roleId || 'AGENT',
    telegramAccounts: row.telegramAccounts ?? [],
  };
  editOpen.value = true;
}

async function save() {
  if (creating.value && !/^@[^:]+:.+/.test(form.value.mxid.trim())) {
    message.warning('请填写完整的 Matrix ID，例如 @someone:matrix.company.internal');
    return;
  }
  if (!form.value.agentCode.trim()) {
    message.warning('必须填写工号——它会出现在审计记录和水印中。');
    return;
  }
  saving.value = true;
  try {
    await upsertAgent({
      telegramAccounts: form.value.telegramAccounts,
      mxid: form.value.mxid.trim(),
      agentCode: form.value.agentCode.trim(),
      displayName: form.value.displayName.trim() || undefined,
      mxid: form.value.mxid,
      roleId: form.value.roleId,
    });
    message.success('已开通');
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
  { title: '工号', dataIndex: 'agentCode', width: 150 },
  { title: '姓名', dataIndex: 'displayName', width: 190 },
  { title: 'Matrix ID', dataIndex: 'mxid', ellipsis: true },
  { title: '角色', dataIndex: 'roleId', width: 170 },
  { title: 'Telegram 账号', key: 'accounts', width: 160 },
  { title: '状态', key: 'status', width: 110 },
  { title: '', key: 'actions', fixed: 'right', width: 170 },
];
</script>

<template>
  <Page title="坐席" description="开通、角色与访问权限。">
    <Alert
      v-if="pendingCount > 0"
      class="mb-4"
      type="warning"
      show-icon
      :message="`${pendingCount} account(s) awaiting provisioning`"
      description="These signed in through SSO and have no role yet. They cannot use the platform — the client falls back to the locked-down policy — until a role is assigned here."
    />

    <Card :loading="loading">
      <div class="mb-3 flex">
        <Button v-if="canWrite" type="primary" @click="openCreate">
          新增坐席
        </Button>
      </div>
      <Tabs v-model:activeKey="tab">
        <TabPane key="active" tab="已开通" />
        <TabPane key="pending">
          <template #tab>
            待处理
            <Badge v-if="pendingCount" :count="pendingCount" class="ml-1" />
          </template>
        </TabPane>
      </Tabs>

      <Table
        :scroll="{ x: 1180 }"
        :columns="columns"
        :data-source="tab === 'pending' ? pending : agents"
        :pagination="false"
        size="small"
        row-key="mxid"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <Tag :color="record.active ? 'green' : 'default'">
              {{ record.active ? '已启用' : '已停用' }}
            </Tag>
          </template>
          <template v-if="column.key === 'accounts'">
            <template v-if="record.telegramAccounts?.length">
              <Tag v-for="a in record.telegramAccounts" :key="a" color="blue">
                {{ accountOptions.find((o) => o.value === a)?.label ?? a }}
              </Tag>
            </template>
            <span v-else class="text-muted-foreground text-xs">不限制</span>
          </template>
          <template v-if="column.key === 'actions'">
            <template v-if="canWrite">
              <Button size="small" type="link" @click="openApprove(record)">
                {{ tab === 'pending' ? '开通' : '编辑' }}
              </Button>
              <Button
                v-if="tab !== 'pending'"
                size="small"
                type="link"
                :danger="record.active"
                @click="toggle(record)"
              >
                {{ record.active ? '停用' : '启用' }}
              </Button>
            </template>
            <Tag v-else color="default">只读</Tag>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="editOpen"
      :title="creating ? '新增坐席' : tab === 'pending' ? '开通坐席' : '编辑坐席'"
      :confirm-loading="saving"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="Matrix ID">
          <Input
            v-if="creating"
            v-model:value="form.mxid"
            placeholder="@someone:matrix.company.internal"
          />
          <Input v-else :value="form.mxid" disabled />
          <span v-if="creating" class="text-muted-foreground text-xs">
            账号必须已存在于本 homeserver。管理后台不能创建 Matrix 账号——
            账号由身份提供方在首次 SSO 登录时创建。
          </span>
        </FormItem>
        <FormItem label="工号">
          <Input
            v-model:value="form.agentCode"
            placeholder="CS002"
          />
          <span class="text-muted-foreground text-xs">
            显示在审计记录和屏幕水印中。
          </span>
        </FormItem>
        <FormItem label="姓名">
          <Input v-model:value="form.displayName" />
        </FormItem>
        <FormItem label="角色">
          <Select v-model:value="form.roleId" :options="roleOptions" />
        </FormItem>
        <FormItem label="可分配的 Telegram 账号">
          <Select
            v-model:value="form.telegramAccounts"
            mode="multiple"
            :options="accountOptions"
            placeholder="留空 = 不限制"
            allow-clear
          />
          <span class="text-muted-foreground text-xs">
            限制这个坐席可以被分配哪些账号下的会话。留空表示不限制。<br />
            这是分配层面的约束，不是访问控制——真正决定坐席能读什么的是房间成员关系，
            清除绑定不会把任何人移出房间。
          </span>
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
