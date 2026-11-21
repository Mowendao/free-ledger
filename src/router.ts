import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/record' },
    { path: '/record', name: 'record', component: () => import('@/pages/RecordPage.vue') },
    {
      path: '/record/:id',
      name: 'record-edit',
      component: () => import('@/pages/RecordPage.vue'),
      props: true
    },
    { path: '/ledger', name: 'ledger', component: () => import('@/pages/LedgerPage.vue') },
    { path: '/stats', name: 'stats', component: () => import('@/pages/StatsPage.vue') },
    { path: '/me', name: 'me', component: () => import('@/pages/ProfilePage.vue') },
    { path: '/me/accounts', name: 'accounts', component: () => import('@/pages/AccountsPage.vue') },
    {
      path: '/me/categories',
      name: 'categories',
      component: () => import('@/pages/CategoriesPage.vue')
    },
    { path: '/me/budget', name: 'budget', component: () => import('@/pages/BudgetPage.vue') },
    { path: '/me/data', name: 'data', component: () => import('@/pages/DataPage.vue') },
    { path: '/me/about', name: 'about', component: () => import('@/pages/AboutPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/record' }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
