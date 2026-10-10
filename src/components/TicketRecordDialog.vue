<template>
  <el-dialog
    v-model="visible"
    :title="isEditMode ? '编辑记录' : '补登记录'"
    class="ticket-record-dialog"
    width="min(880px, calc(100vw - 32px))"
    top="16px"
  >
    <el-form
        :model="ticket"
        :rules="rules"
        class="ticket-record-form"
        label-position="top"
    >
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12">
          <el-form-item label="票号" :required="true">
            <el-input v-model="ticket.number" placeholder="例如：E351822734"></el-input>
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="车次" prop="trainNo" :required="true">
            <el-input v-model="ticket.trainNo" placeholder="例如：G25 或 1461" />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="起点" :required="true">
            <el-autocomplete
                v-model="ticket.from"
                :fetch-suggestions="querySearch"
                placeholder="输入站名或拼音"
                clearable
                @select="handleSelect('from', $event)"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="终点" :required="true">
            <el-autocomplete
                v-model="ticket.to"
                :fetch-suggestions="querySearch"
                placeholder="输入站名或拼音"
                clearable
                @select="handleSelect('to', $event)"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="开车日期" :required="true">
            <el-date-picker
                v-model="ticket.date"
                type="date"
                placeholder="请选择乘车日期"
                format="YYYY/MM/DD"
                value-format="YYYY年MM月DD日"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="开车时间" :required="true">
            <el-time-picker
                v-model="ticket.time"
                placeholder="选择开车时间"
                format="HH:mm"
                value-format="HH:mm"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="票价" :required="true">
            <el-input-number
              v-model="ticket.price"
              placeholder="请输入数字"
              :min="0"
              :step="0.5"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="12" :sm="6">
          <el-form-item label="使用积分">
            <el-switch
                v-model="credit"
                inline-prompt
                :active-icon="Check"
                :inactive-icon="Close"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="12" :sm="6">
          <el-form-item label="空调选择">
            <el-switch
                v-model="conditioner"
                :disabled="airSwitchDisabled"
                inline-prompt
                :active-icon="Check"
                :inactive-icon="Close"
            />
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="席位名称" :required="true">
            <el-select v-model="ticket.seatType" placeholder="请选择席位">
              <el-option
                  v-for="item in options"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="座位号" :required="true">
            <el-input v-model="ticket.seatNo" placeholder="03车12A号"></el-input>
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="售票地点" :required="true">
            <el-input v-model="ticket.sellPlace" placeholder="XX站"></el-input>
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="检票/候车">
            <el-input v-model="ticket.gate" placeholder="检票：1A / 候车：一候"></el-input>
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="选择背景" :required="true">
            <el-select v-model="ticket.theme" placeholder="请选择主题">
              <el-option
                  v-for="item in themeOptions"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                  :disabled="item.disabled"
              />
            </el-select>
          </el-form-item>
        </el-col>

        <el-col :xs="24" :sm="12">
          <el-form-item label="里程">
            <el-input-number
              v-model="ticket.distance"
              placeholder="请输入数字"
              :min="0"
            />
          </el-form-item>
        </el-col>

        <!-- 提示语单独占一行 -->
        <el-col :span="24">
          <el-form-item label="提示语" :required="true">
            <el-input
                v-model="ticket.message"
                :rows="3"
                type="textarea"
                placeholder="输入提示语"
            />
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <div class="ticket-record-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="$emit('save')">
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { Check, Close } from '@element-plus/icons-vue'
import {
  seatOptions as options,
  themeOptions,
  ticketRules as rules,
} from '@/utils/ticketShared.js'
import {
  handleStationSelect,
  queryStationSearch as querySearch,
} from '@/composables/useTicketShared.js'

const props = defineProps({
  ticket: { type: Object, required: true },
  isEditMode: { type: Boolean, default: false },
  airSwitchDisabled: { type: Boolean, default: false },
})

const visible = defineModel({ type: Boolean, default: false })
const credit = defineModel('credit', { type: Boolean, default: false })
const conditioner = defineModel('conditioner', { type: Boolean, default: false })

defineEmits(['save'])

const handleSelect = (field, item) => handleStationSelect(props.ticket, field, item)
</script>

<style src="@/assets/styles/TicketRecordDialog.css"></style>
