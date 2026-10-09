<template>
  <router-view v-slot="{ Component }">
    <KeepAlive include="TrainList">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
</template>
