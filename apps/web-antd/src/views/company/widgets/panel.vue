<script lang="ts" setup>
/**
 * 客户面板配置（docs/widget-integration.md）
 *
 * 为每个会话指定坐席在右侧面板中打开的客户页面。未配置的会话不是错误状态——
 * 面板会明确显示「此房间未配置对应的客户信息。」，而不是留一个空白页。
 *
 * 这里配置的是「房间 → 页面」的映射，不是 widget 本身。widget 由管理员用
 * scripts/provision-widget.sh 装进房间，URL 固定且只带 $matrix_room_id；
 * 映射存在管理库里。这样分工的原因是：往会话房间写状态需要权限等级 50，
 * 只有桥的 bot 有——为了一条 URL 映射而把 appservice 令牌交给这个服务，
 * 等于让它能冒充homeserver 上的每一个 ghost。
 */
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccess } from '@vben/access';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Modal,
  Popconfirm,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  listConversations,
  listRoomWidgets,
  setRoomWidget,
  type ConversationRow,
  type RoomWidgetConfig,
} from '#/api/company';

const { hasAccessByCodes } = useAccess();
const canEdit = hasAccessByCodes(['policy:write']);

const loading = ref(false);
const configs = ref<RoomWidgetConfig[]>([]);
const conversations = ref<ConversationRow[]>([]);
const search = ref('');

const editOpen = ref(false);
const editRoomId = ref('');
const editRoomName = ref('');
const editUrl = ref('');
const editLabel = ref('');
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    const [cfg, convs] = await Promise.all([
      listRoomWidgets(),
      listConversations(),
    ]);
    configs.value = cfg.configs;
    conversations.value = convs.conversations;
  } finally {
    loading.value = false;
  }
}

const byRoom = computed(
  () => new Map(configs.value.map((c) => [c.roomId, c])),
);

/**
 * 以会话为主体列出，而不是以已有配置为主体。
 * 管理员要找的是「哪些会话还没配」，那份名单只有从会话侧看才看得见。
 */
const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return conversations.value
    .filter((c) => {
      if (!q) return true;
      return (
        (c.name ?? '').toLowerCase().includes(q) ||
        c.roomId.toLowerCase().includes(q)
      );
    })
    .map((c) => {
      const cfg = byRoom.value.get(c.roomId);
      return {
        roomId: c.roomId,
        name: c.name || '(未命名会话)',
        type: c.type,
        targetUrl: cfg?.targetUrl ?? null,
        label: cfg?.label ?? null,
        updatedBy: cfg?.updatedBy ?? null,
      };
    });
});

const configuredCount = computed(
  () => rows.value.filter((r) => r.targetUrl).length,
);

function openEdit(row: (typeof rows.value)[number]) {
  editRoomId.value = row.roomId;
  editRoomName.value = row.name;
  editUrl.value = row.targetUrl ?? '';
  editLabel.value = row.label ?? '';
  editOpen.value = true;
}

async function save() {
  const url = editUrl.value.trim();
  if (!url) {
    message.warning('请填写页面地址，或直接点「清除配置」。');
    return;
  }
  saving.value = true;
  try {
    await setRoomWidget({
      roomId: editRoomId.value,
      targetUrl: url,
      label: editLabel.value.trim() || undefined,
    });
    message.success('已保存');
    editOpen.value = false;
    await load();
  } catch (error: any) {
    message.error(error?.message ?? '保存失败');
  } finally {
    saving.value = false;
  }
}

async function clearConfig(roomId: string) {
  try {
    await setRoomWidget({ roomId, targetUrl: null });
    message.success('已清除');
    await load();
  } catch (error: any) {
    message.error(error?.message ?? '清除失败');
  }
}

onMounted(load);

const columns = [
  { title: '会话', dataIndex: 'name', width: 220, ellipsis: true },
  { title: '类型', key: 'type', width: 80 },
  { title: '客户页面', key: 'target' },
  { title: '', key: 'actions', fixed: 'right', width: 150 },
];
</script>

<template>
  <Page
    title="客户面板"
    description="为每个会话指定坐席在右侧面板中打开的客户页面。"
  >
    <Alert
      class="mb-4"
      type="info"
      show-icon
      message="未配置的会话会明确提示，而不是显示空白"
      description="坐席打开未配置的会话时，面板显示「此房间未配置对应的客户信息。」。页面地址会随请求带上房间 ID，由你的系统据此判断显示哪个客户；坐席身份由 OpenID 令牌验证后返回，不能由页面自称。"
    />

    <Card>
      <div class="mb-4 flex items-center gap-2">
        <Input
          v-model:value="search"
          placeholder="搜索会话名称或房间 ID"
          style="width: 280px"
          allow-clear
        />
        <Button type="primary" :loading="loading" @click="load">刷新</Button>
        <span class="text-muted-foreground ml-auto text-sm">
          已配置 {{ configuredCount }} / {{ rows.length }}
        </span>
      </div>

      <Table
        :scroll="{ x: 1000 }"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        size="small"
        row-key="roomId"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <Tag :color="record.type === 'dm' ? 'blue' : 'default'">
              {{ record.type === 'dm' ? '私聊' : '群组' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'target'">
            <template v-if="record.targetUrl">
              <div class="text-sm">{{ record.label || '—' }}</div>
              <div class="text-muted-foreground break-all text-xs">
                {{ record.targetUrl }}
              </div>
            </template>
            <Tag v-else color="warning">未配置</Tag>
          </template>

          <template v-else-if="column.key === 'actions'">
            <template v-if="canEdit">
              <Button size="small" type="link" @click="openEdit(record)">
                {{ record.targetUrl ? '修改' : '配置' }}
              </Button>
              <Popconfirm
                v-if="record.targetUrl"
                title="清除该会话的客户页面配置？"
                ok-text="清除"
                cancel-text="取消"
                @confirm="clearConfig(record.roomId)"
              >
                <Button size="small" type="link" danger>清除</Button>
              </Popconfirm>
            </template>
            <Tag v-else color="default">无权限</Tag>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="editOpen"
      title="配置客户页面"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="save"
    >
      <p class="mb-2">
        会话：<strong>{{ editRoomName }}</strong>
      </p>
      <p class="text-muted-foreground mb-3 break-all text-xs">
        {{ editRoomId }}
      </p>

      <div class="mb-2">
        <div class="mb-1 text-sm">页面地址</div>
        <Input
          v-model:value="editUrl"
          placeholder="https://your-system.example.com/customer/12345"
        />
      </div>
      <div>
        <div class="mb-1 text-sm">备注（可选）</div>
        <Input v-model:value="editLabel" placeholder="例如：客户 A 的资料页" />
      </div>

      <Alert
        class="mt-3"
        type="warning"
        show-icon
        message="地址中不要放任何凭据"
        description="坐席的浏览器会直接加载这个地址。页面应当用 OpenID 令牌向你自己的后端验证身份，而不是依赖地址里带的密钥。"
      />
    </Modal>
  </Page>
</template>
