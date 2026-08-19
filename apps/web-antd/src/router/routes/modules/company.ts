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
      title: 'Security',
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
          title: 'Policy',
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
      title: 'Agents',
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
          title: 'List & provisioning',
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
      title: 'System',
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
          title: 'Health',
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
      title: 'Conversations',
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
          title: 'Active & assignment',
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
          title: 'Connection & groups',
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
      title: 'Customers',
    },
    name: 'Customers',
    path: '/customers',
    children: [
      {
        name: 'CustomerIdentity',
        path: 'identity',
        component: () => import('#/views/company/customers/identity.vue'),
        meta: {
          icon: 'lucide:id-card',
          title: 'Identity access',
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
      title: 'Audit',
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
          title: 'Security events',
          authority: ['SUPERVISOR', 'ADMINISTRATOR', 'SECURITY_ADMIN'],
        },
      },
    ],
  },
];

export default routes;
