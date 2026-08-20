import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

/**
 * Company administration (brief §21).
 *
 * `authority` here decides what is drawn. It is NOT the boundary — the Management
 * API re-checks the caller's role on every route, and the reverse proxy does not
 * expose the admin surface on the agent-facing host at all (ADR-0006). Hiding a menu
 * item is a convenience; the server refusing the call is the control.
 */
const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:shield-check',
      order: 1,
      title: '安全',
    },
    name: 'Security',
    path: '/security',
    children: [
      {
        name: 'SecurityPolicy',
        path: 'policy',
        component: () => import('#/views/company/security/policy.vue'),
        meta: {
          icon: 'lucide:sliders-horizontal',
          title: '安全策略',
          authority: ['ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:user-cog',
      order: 0,
      title: '坐席',
    },
    name: 'Agents',
    path: '/agents',
    children: [
      {
        name: 'AgentList',
        path: 'list',
        component: () => import('#/views/company/agents/list.vue'),
        meta: {
          icon: 'lucide:list',
          title: '坐席管理',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:server',
      order: 9,
      title: '系统',
    },
    name: 'System',
    path: '/system',
    children: [
      {
        name: 'SystemHealth',
        path: 'health',
        component: () => import('#/views/company/system/health.vue'),
        meta: {
          icon: 'lucide:activity',
          title: '运行状态',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:messages-square',
      order: 1,
      title: '会话',
    },
    name: 'Conversations',
    path: '/conversations',
    children: [
      {
        name: 'ConversationList',
        path: 'list',
        component: () => import('#/views/company/conversations/list.vue'),
        meta: {
          icon: 'lucide:inbox',
          title: '会话与分配',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:send',
      order: 4,
      title: 'Telegram',
    },
    name: 'Telegram',
    path: '/telegram',
    children: [
      {
        name: 'TelegramStatus',
        path: 'status',
        component: () => import('#/views/company/telegram/status.vue'),
        meta: {
          icon: 'lucide:plug',
          title: '连接与群组',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:users',
      order: 2,
      title: '客户',
    },
    name: 'Customers',
    path: '/customers',
    children: [
      {
        name: 'CustomerWidgetPanel',
        path: 'panel',
        component: () => import('#/views/company/widgets/panel.vue'),
        meta: {
          icon: 'lucide:panel-right',
          title: '客户面板',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
      {
        name: 'CustomerIdentity',
        path: 'identity',
        component: () => import('#/views/company/customers/identity.vue'),
        meta: {
          icon: 'lucide:id-card',
          title: '客户身份',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:scroll-text',
      order: 3,
      title: '审计',
    },
    name: 'Audit',
    path: '/audit',
    children: [
      {
        name: 'AuditEvents',
        path: 'events',
        component: () => import('#/views/company/audit/events.vue'),
        meta: {
          icon: 'lucide:list',
          title: '安全事件',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
];

export default routes;
