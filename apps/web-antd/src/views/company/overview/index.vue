<script lang="ts" setup>
/**
 * 概览
 *
 * 只显示计数。没有会话内容，没有客户身份——和管理后台其余部分同一条规则。
 * 特意在这里重申，是因为「顺手再加一个有用的字段」最容易发生在仪表盘上。
 */
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Card, Col, Row, Statistic, Tag } from 'ant-design-vue';

import { getOverview, type OverviewData } from '#/api/company';

const loading = ref(false);
const data = ref<null | OverviewData>(null);

async function load() {
  loading.value = true;
  try {
    data.value = await getOverview();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page title="概览" description="本项目的运行数据。">
    <Row :gutter="[16, 16]">
      <Col :xs="12" :md="6">
        <Card :loading="loading">
          <Statistic
            title="已桥接会话"
            :value="data?.conversations.total ?? 0"
          />
          <div class="text-muted-foreground mt-1 text-xs">
            群组 {{ data?.conversations.groups ?? 0 }} · 私聊
            {{ data?.conversations.direct ?? 0 }}
          </div>
        </Card>
      </Col>

      <Col :xs="12" :md="6">
        <Card :loading="loading">
          <Statistic
            title="已分配会话"
            :value="data?.conversations.assigned ?? 0"
          />
          <div class="text-muted-foreground mt-1 text-xs">
            未分配 {{ data?.conversations.unassigned ?? 0 }}
          </div>
        </Card>
      </Col>

      <Col :xs="12" :md="6">
        <Card :loading="loading">
          <Statistic title="坐席" :value="data?.agents.active ?? 0" />
          <div class="text-muted-foreground mt-1 text-xs">
            共 {{ data?.agents.total ?? 0 }} 个账号
          </div>
        </Card>
      </Col>

      <Col :xs="12" :md="6">
        <Card :loading="loading">
          <Statistic
            title="已登记客户"
            :value="data?.customers.registered ?? 0"
          />
          <div class="text-muted-foreground mt-1 text-xs">
            桥接身份 {{ data?.telegram.bridgedIdentities ?? 0 }}
          </div>
        </Card>
      </Col>
    </Row>

    <Row :gutter="[16, 16]" class="mt-4">
      <Col :xs="24" :md="12">
        <Card title="Telegram 账号" :loading="loading">
          <div
            v-for="acct in data?.telegram.accounts ?? []"
            :key="acct.id"
            class="mb-2 flex items-center gap-2"
          >
            <Tag color="blue">{{ acct.name || acct.id }}</Tag>
            <span class="text-muted-foreground text-xs">{{ acct.id }}</span>
          </div>
          <div
            v-if="(data?.telegram.accounts?.length ?? 0) === 0"
            class="text-muted-foreground text-sm"
          >
            尚未登录任何 Telegram 账号。
          </div>
        </Card>
      </Col>

      <Col :xs="24" :md="12">
        <Card title="安全" :loading="loading">
          <Row :gutter="16">
            <Col :span="8">
              <Statistic
                title="策略版本"
                :value="data?.policy?.version ?? 0"
                prefix="v"
              />
            </Col>
            <Col :span="8">
              <Statistic
                title="24h 审计"
                :value="data?.audit.last24h ?? 0"
              />
            </Col>
            <Col :span="8">
              <Statistic
                title="24h 拦截"
                :value="data?.audit.blocked24h ?? 0"
                :value-style="
                  (data?.audit.blocked24h ?? 0) > 0 ? { color: '#d48806' } : {}
                "
              />
            </Col>
          </Row>
          <div class="text-muted-foreground mt-3 text-xs">
            已配置客户面板的会话：{{ data?.widgets.configured ?? 0 }} /
            {{ data?.conversations.total ?? 0 }}
          </div>
        </Card>
      </Col>
    </Row>

    <Alert
      class="mt-4"
      type="info"
      show-icon
      message="这里只有计数"
      description="本页不显示任何会话内容或客户真实身份。桥的消息表没有授权给这个服务，客户身份只能通过留痕的查看流程获取——概览是最容易被顺手加字段的地方，所以这条在此重申。"
    />
  </Page>
</template>
