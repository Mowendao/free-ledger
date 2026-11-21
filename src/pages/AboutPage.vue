<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { version } from '../../package.json'
</script>

<template>
  <div class="page">
    <PageHeader title="关于 Free Ledger" />

    <section class="about-hero">
      <div class="profile-hero__logo">F</div>
      <h1 class="about-hero__name">Free Ledger</h1>
      <p class="about-hero__version">v{{ version }} · MIT License</p>
      <p class="about-hero__tag">免费、自由、属于你自己的记账本</p>
    </section>

    <section class="card">
      <h2 class="card-title">隐私承诺</h2>
      <ul class="privacy-list">
        <li><AppIcon name="check" :size="16" /> 所有账目、账户、预算只保存在本机浏览器 IndexedDB 中。</li>
        <li><AppIcon name="check" :size="16" /> 不注册账号、不连接服务器、不上传任何数据。</li>
        <li><AppIcon name="check" :size="16" /> 无广告、无会员、无内购、无第三方统计。</li>
        <li><AppIcon name="check" :size="16" /> 不加载外部字体、图片或脚本，断网也能完整使用。</li>
        <li><AppIcon name="check" :size="16" /> 代码完全开源，可自行审计与自行构建。</li>
      </ul>
    </section>

    <section class="card">
      <h2 class="card-title">数据安全提示</h2>
      <p class="paragraph">
        Free Ledger 不保存你的任何数据副本。清除浏览器站点数据、卸载浏览器或更换设备都会导致本机账目丢失，
        因此建议定期在「数据备份与导出」中导出 JSON 备份，并保存到自己的网盘或移动硬盘。
      </p>
    </section>

    <section class="card">
      <h2 class="card-title">开源协议</h2>
      <p class="paragraph">
        本项目以 MIT License 发布：你可以自由使用、修改、分发，包括商业用途，但需保留版权声明。
        源码托管于 GitHub（仓库名 <code>free-ledger</code>）。
      </p>
    </section>

    <section class="card">
      <h2 class="card-title">技术栈</h2>
      <p class="paragraph">
        Vue 3 + TypeScript + Vite + Dexie（IndexedDB）+ vite-plugin-pwa。纯前端静态应用，
        可部署在任意静态托管上，也可后续用 Capacitor 打包为 Android / iOS 应用。
      </p>
    </section>

    <footer class="profile-footer">
      <p>Made with care, for privacy.</p>
    </footer>
  </div>
</template>
