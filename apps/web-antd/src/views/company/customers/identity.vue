<script lang="ts" setup>
/**
 * Customers → Identity access (brief §8, §20).
 *
 * The list shows only what an agent could safely see: the internal customer ID, the
 * opaque bridge token, and the display alias. The Telegram columns are not fetched
 * by the list endpoint at all — not fetched and hidden, not fetched.
 *
 * Revealing the real identity is a separate, deliberate act: it needs the
 * `identity:reveal` code (Security Administrator), it requires a written reason, and
 * it writes an audit record naming the caller. The reason field is mandatory
 * server-side, so this dialog cannot be bypassed by calling the API directly.
 */
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Table,
  Tag,
  Textarea,
} from 'ant-design-vue';

import {
  listCustomers,
  reconcileCustomers,
  revealCustomer,
  type CompanyApi,
} from '#/api/company';

const { hasAccessByCodes } = useAccess();
const canReveal = hasAccessByCodes(['identity:reveal']);

const loading = ref(false);
const rows = ref<CompanyApi.Customer[]>([]);
const search = ref('');

const revealOpen = ref(false);
const revealTarget = ref<CompanyApi.Customer | null>(null);
const reason = ref('');
const revealed = ref<null | Record<string, any>>(null);
const revealing = ref(false);
const reconciling = ref(false);

/**
 * Pull in customers the bridge has seen that we have not registered yet.
 *
 * Also runs hourly on the server; this button is for when an administrator does not
 * want to wait. It only ever adds rows — an alias or Telegram identity already on a
 * record is left alone.
 */
async function reconcile() {
  reconciling.value = true;
  try {
    const r = await reconcileCustomers();
    message.success(
      r.registered > 0
        ? `Registered ${r.registered} new customer(s). ${r.total} total.`
        : `Nothing new — all ${r.total} bridge identities are already registered.`,
    );
    await load();
  } catch (error: any) {
    message.error(error?.message ?? 'Reconcile failed');
  } finally {
    reconciling.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await listCustomers({ limit: 100, q: search.value || undefined });
    rows.value = res.customers;
  } finally {
    loading.value = false;
  }
}

function openReveal(row: CompanyApi.Customer) {
  revealTarget.value = row;
  reason.value = '';
  revealed.value = null;
  revealOpen.value = true;
}

async function confirmReveal() {
  if (!revealTarget.value) return;
  if (reason.value.trim().length < 3) {
    message.warning('A reason is required — it is written to the audit record.');
    return;
  }
  revealing.value = true;
  try {
    revealed.value = await revealCustomer(
      revealTarget.value.internalCustomerId,
      reason.value.trim(),
    );
  } catch (error: any) {
    message.error(error?.message ?? 'Reveal refused');
  } finally {
    revealing.value = false;
  }
}

onMounted(load);

const columns = [
  { title: '内部编号', dataIndex: 'internalCustomerId', width: 190 },
  { title: '显示名称', dataIndex: 'displayAlias', width: 220 },
  { title: '桥令牌', dataIndex: 'bridgeToken', ellipsis: true },
  { title: '', key: 'actions', fixed: 'right', width: 130 },
];
</script>

<template>
  <Page
    title="客户身份"
    description="仅内部标识。真实 Telegram 身份只能通过留痕的申请才能查看。"
  >
    <Alert
      class="mb-4"
      type="warning"
      show-icon
      message="每次查看身份都会被记录"
      description="每次查看都会写入审计记录，包含你的账号、客户、你填写的理由和时间。理由是接口强制要求的，不只是这个表单的校验。"
    />

    <Card>
      <div class="mb-4 flex gap-2">
        <Input
          v-model:value="search"
          placeholder="搜索名称或内部编号"
          style="width: 280px"
          allow-clear
          @press-enter="load"
        />
        <Button type="primary" @click="load">搜索</Button>
        <Button :loading="reconciling" class="ml-auto" @click="reconcile">
          Reconcile with bridge
        </Button>
      </div>

      <Table
        :scroll="{ x: 900 }"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        size="small"
        row-key="internalCustomerId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'actions'">
            <Button
              v-if="canReveal"
              danger
              size="small"
              @click="openReveal(record)"
            >
              查看真实身份
            </Button>
            <Tag v-else color="default">无权限</Tag>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="revealOpen"
      title="查看 Telegram 真实身份"
      :confirm-loading="revealing"
      :ok-text="revealed ? 'Close' : 'Reveal'"
      @ok="revealed ? (revealOpen = false) : confirmReveal()"
    >
      <template v-if="!revealed">
        <p class="mb-2">
          Customer <strong>{{ revealTarget?.displayAlias }}</strong>
        </p>
        <p class="text-muted-foreground mb-2 text-sm">
          State why this is necessary. It is stored in the audit trail.
        </p>
        <Textarea v-model:value="reason" :rows="3" placeholder="填写理由" />
      </template>
      <template v-else>
        <Alert
          v-if="!revealed.identityOnFile"
          class="mb-3"
          type="info"
          show-icon
          message="No Telegram identity on file"
          description="This record was registered automatically from the bridge, which stores only the opaque token — the real identity is not recoverable from that side. It has to be attached by an administrator who already knows it. The reveal itself was permitted and has been audited."
        />
        <Descriptions bordered size="small" :column="1">
          <DescriptionsItem label="Internal ID">
            {{ revealed.internalCustomerId }}
          </DescriptionsItem>
          <DescriptionsItem label="Telegram user ID">
            {{ revealed.telegramUserId ?? '—' }}
          </DescriptionsItem>
          <DescriptionsItem label="Telegram username">
            {{ revealed.telegramUsername ?? '—' }}
          </DescriptionsItem>
          <DescriptionsItem label="Telegram phone">
            {{ revealed.telegramPhone ?? '—' }}
          </DescriptionsItem>
        </Descriptions>
      </template>
    </Modal>
  </Page>
</template>
