import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

/**
 * 概览。
 *
 * 上游这里是两个演示仪表盘（分析页 / 工作台），显示的是造出来的数据。
 * 在一个用于判断真实系统状态的后台里，假数据比没有数据更糟——所以换成
 * 本项目自己的计数。
 */
const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: '概览',
    },
    name: 'Dashboard',
    path: '/dashboard',
    children: [
      {
        name: 'Overview',
        path: 'overview',
        component: () => import('#/views/company/overview/index.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:layout-dashboard',
          title: '概览',
        },
      },
    ],
  },
];

export default routes;
