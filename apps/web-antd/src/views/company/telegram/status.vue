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
import { computed, onMounted, ref } from 'vue';

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

/**
 * 平均等待时长。用累计总秒数除以次数，而不是保存每次的样本——
 * 这个数字服务的判断是「要不要退让」，不需要分布。
 */
const meanWaitSeconds = computed(() => {
  const fw = data.value?.floodWait;
  if (!fw || fw.count === 0) return 0;
  return Math.round(fw.totalWaitSeconds / fw.count);
});

function formatTime(iso: null | string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
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

    <!--
      Telegram 限流。放在这里而不是只留在日志里，是因为 FLOOD_WAIT 无法通过配置规避，
      而且用更用力的重试去「冲过去」会把它升级成 PEER_FLOOD——那是账号级处罚。
      值得看的是趋势，不是某一次是否出错。
    -->
    <Card :loading="loading" class="mt-4">
      <template #title>Telegram 限流</template>

      <Alert
        v-if="data && data.floodWait === null"
        type="warning"
        show-icon
        message="读不到限流计数"
        description="桥可能是较早的版本，或计数视图尚未创建。这不等于「没有发生过限流」——在恢复读取之前，这里无法给出结论。"
      />

      <template v-else-if="data?.floodWait">
        <Alert
          v-if="data.floodWait.peerFloodCount > 0"
          class="mb-4"
          type="error"
          show-icon
          message="出现 PEER_FLOOD —— 账号已被限制"
          description="这不是「等一会再试」，而是 Telegram 对账号本身的处罚。应立即停止批量操作（回填、大量同步），不要重试。"
        />

        <Row :gutter="16">
          <Col :span="6">
            <Statistic title="累计次数" :value="data.floodWait.count" />
          </Col>
          <Col :span="6">
            <Statistic
              title="PEER_FLOOD"
              :value="data.floodWait.peerFloodCount"
              :value-style="
                data.floodWait.peerFloodCount > 0 ? { color: '#cf1322' } : {}
              "
            />
          </Col>
          <Col :span="6">
            <Statistic
              title="最长等待"
              :value="data.floodWait.maxWaitSeconds"
              suffix="秒"
            />
          </Col>
          <Col :span="6">
            <Statistic title="平均等待" :value="meanWaitSeconds" suffix="秒" />
          </Col>
        </Row>

        <Descriptions class="mt-4" bordered size="small" :column="1">
          <DescriptionsItem label="首次记录">
            {{ formatTime(data.floodWait.firstAt) }}
          </DescriptionsItem>
          <DescriptionsItem label="最近一次">
            {{ formatTime(data.floodWait.lastAt) }}
          </DescriptionsItem>
        </Descriptions>

        <Alert
          v-if="!data.floodWait.everRecorded"
          class="mt-4"
          type="success"
          show-icon
          message="尚未发生过限流"
          description="计数从桥首次写入起累计，不随重启清零。"
        />
        <Alert
          v-else
          class="mt-4"
          type="info"
          show-icon
          message="怎么判读"
          description="偶发几秒的等待属正常，尤其在同步繁忙时。一小时内十次以上应开始退让；单次等待以小时计应立即停止批量操作。切勿为了「冲过去」而加大或并行重试——那正是 FLOOD_WAIT 变成 PEER_FLOOD 的方式。"
        />
      </template>
    </Card>
  </Page>
</template>
