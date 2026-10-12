<template>
  <router-view v-slot="{ Component }">
    <KeepAlive include="TrainList,TrainQuery">
      <component :is="Component" />
    </KeepAlive>
  </router-view>
</template>
