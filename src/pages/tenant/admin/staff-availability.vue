<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar :title="navbarTitle" back-link="Atrás" :back-link-url="staffListUrl">
      <f7-nav-right>
        <f7-link @click="handleSave" :disabled="saving">Guardar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <template v-else>
      <f7-block strong class="availability-days-wrap">
        <f7-segmented strong class="availability-days">
          <f7-button
            v-for="day in dayKeys"
            :key="day"
            :fill="selectedDay === day"
            @click="selectedDay = day"
          >
            {{ dayLabels[day] }}
          </f7-button>
        </f7-segmented>
      </f7-block>
      <f7-block strong inset>
        <f7-list-item title="Día habilitado">
          <template #after>
            <f7-toggle :checked="dayEnabled[selectedDay]" @change="onDayEnabledChange($event)" />
          </template>
        </f7-list-item>
      </f7-block>

      <f7-block v-if="validationError" strong inset class="availability-error-block">
        <p class="availability-error">{{ validationError }}</p>
      </f7-block>
      <f7-block strong inset>
        <p class="block-title">Bloques del día</p>
        <div
          v-for="(block, blockIndex) in blocksForSelectedDay"
          :key="blockIndex"
          class="availability-block"
        >
          <f7-list>
            <f7-list-item title="Inicio">
              <template #after>
                <input
                  type="time"
                  :value="block.start"
                  @input="onBlockStartInput(blockIndex, $event)"
                />
              </template>
            </f7-list-item>
            <f7-list-item title="Fin">
              <template #after>
                <input
                  type="time"
                  :value="block.end"
                  @input="onBlockEndInput(blockIndex, $event)"
                />
              </template>
            </f7-list-item>
          </f7-list>
          <div v-if="block.breaks.length > 0" class="availability-breaks">
            <p class="availability-breaks-title">Breaks</p>
            <div
              v-for="(br, breakIndex) in block.breaks"
              :key="breakIndex"
              class="availability-break-row"
            >
              <input
                type="time"
                :value="br.start"
                @input="onBreakStartInput(blockIndex, breakIndex, $event)"
              />
              <span>–</span>
              <input
                type="time"
                :value="br.end"
                @input="onBreakEndInput(blockIndex, breakIndex, $event)"
              />
              <f7-button small outline color="red" @click="removeBreak(blockIndex, breakIndex)">
                Eliminar break
              </f7-button>
            </div>
          </div>
          <div class="availability-block-actions">
            <f7-button small fill @click="addBreak(blockIndex)">Agregar break</f7-button>
            <f7-button small outline color="red" @click="removeBlock(blockIndex)">Eliminar bloque</f7-button>
          </div>
        </div>
        <f7-button fill class="availability-add-block" @click="addBlock">Agregar bloque</f7-button>
      </f7-block>

      <f7-block strong inset>
        <p class="block-title">Excepciones (próximos 30 días)</p>
        <f7-list v-if="exceptionsList.length > 0">
          <f7-list-item v-for="ex in exceptionsList" :key="ex.id">
            <template #title>
              {{ ex.date }} — {{ ex.type === 'full_day' ? 'Día completo' : `${ex.start}–${ex.end}` }}
            </template>
            <template #after>
              <f7-button small outline color="red" @click.stop="removeException(ex.id)">Eliminar</f7-button>
            </template>
          </f7-list-item>
        </f7-list>
        <f7-button fill small class="availability-add-exception" @click="showExceptionForm = true">Agregar excepción</f7-button>
      </f7-block>

      <f7-block v-if="showExceptionForm" strong inset class="availability-exception-form">
        <p class="block-title">Nueva excepción</p>
        <f7-list form>
          <f7-list-input label="Fecha" type="date" v-model:value="newException.date" />
          <f7-list-item title="Tipo">
            <template #after>
              <select v-model="newException.type">
                <option value="full_day">Día completo</option>
                <option value="range">Rango horario</option>
              </select>
            </template>
          </f7-list-item>
          <template v-if="newException.type === 'range'">
            <f7-list-input label="Desde" type="time" v-model:value="newException.start" />
            <f7-list-input label="Hasta" type="time" v-model:value="newException.end" />
          </template>
          <f7-list-input label="Motivo (opcional)" type="text" v-model:value="newException.reason" />
        </f7-list>
        <f7-button fill small :disabled="exceptionSaving || !canSaveException" @click="saveException">Guardar excepción</f7-button>
        <f7-button small class="availability-cancel-exception" @click="showExceptionForm = false; clearExceptionForm()">Cancelar</f7-button>
      </f7-block>
    </template>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface BreakSlot {
  start: string;
  end: string;
}

interface ScheduleBlock {
  start: string;
  end: string;
  breaks: BreakSlot[];
}

type Schedule = Record<DayKey, ScheduleBlock[]>;

interface ExceptionDoc {
  id: string;
  date: string;
  type: 'full_day' | 'range';
  start?: string | null;
  end?: string | null;
  reason?: string | null;
}

const dayKeys: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const dayLabels: Record<DayKey, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

function emptySchedule(): Schedule {
  return dayKeys.reduce((acc, d) => ({ ...acc, [d]: [] }), {} as Schedule);
}

function emptyBlock(): ScheduleBlock {
  return { start: '09:00', end: '18:00', breaks: [] };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function validateBlock(block: ScheduleBlock): string | null {
  if (block.start >= block.end) return 'El inicio debe ser anterior al fin del bloque.';
  for (const br of block.breaks) {
    if (br.start >= br.end) return 'El inicio del break debe ser anterior al fin.';
    if (timeToMinutes(br.start) < timeToMinutes(block.start) || timeToMinutes(br.end) > timeToMinutes(block.end)) {
      return 'Cada break debe estar dentro del bloque.';
    }
  }
  const sorted = [...block.breaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
      return 'Los breaks no pueden superponerse.';
    }
  }
  return null;
}

function validateBlocksNoOverlap(blocks: ScheduleBlock[]): string | null {
  if (blocks.length <= 1) return null;
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
      return 'Los bloques del mismo día no pueden superponerse.';
    }
  }
  return null;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const staffId = computed(() => (route.params.staffId as string) ?? '');
const staffListUrl = computed(() => `/t/${tenantId.value}/admin/staff/`);
const loading = ref(true);
const saving = ref(false);
const staffName = ref('');
const selectedDay = ref<DayKey>('mon');
const schedule = reactive<Schedule>(emptySchedule());
const dayEnabled = reactive<Record<DayKey, boolean>>(
  dayKeys.reduce((acc, d) => ({ ...acc, [d]: true }), {} as Record<DayKey, boolean>)
);
const validationError = ref('');

const exceptionsList = ref<ExceptionDoc[]>([]);
const showExceptionForm = ref(false);
const exceptionSaving = ref(false);
const newException = reactive({
  date: '',
  type: 'full_day' as 'full_day' | 'range',
  start: '12:00',
  end: '13:00',
  reason: '',
});

const navbarTitle = computed(() => (staffName.value ? `Disponibilidad · ${staffName.value}` : 'Disponibilidad'));

const blocksForSelectedDay = computed(() => schedule[selectedDay.value]);

function setBlockStart(blockIndex: number, value: string): void {
  schedule[selectedDay.value][blockIndex].start = value;
}
function setBlockEnd(blockIndex: number, value: string): void {
  schedule[selectedDay.value][blockIndex].end = value;
}
function setBreakStart(blockIndex: number, breakIndex: number, value: string): void {
  schedule[selectedDay.value][blockIndex].breaks[breakIndex].start = value;
}
function setBreakEnd(blockIndex: number, breakIndex: number, value: string): void {
  schedule[selectedDay.value][blockIndex].breaks[breakIndex].end = value;
}
function onBlockStartInput(blockIndex: number, e: Event): void {
  setBlockStart(blockIndex, (e.target as HTMLInputElement).value);
}
function onBlockEndInput(blockIndex: number, e: Event): void {
  setBlockEnd(blockIndex, (e.target as HTMLInputElement).value);
}
function onBreakStartInput(blockIndex: number, breakIndex: number, e: Event): void {
  setBreakStart(blockIndex, breakIndex, (e.target as HTMLInputElement).value);
}
function onBreakEndInput(blockIndex: number, breakIndex: number, e: Event): void {
  setBreakEnd(blockIndex, breakIndex, (e.target as HTMLInputElement).value);
}
function addBreak(blockIndex: number): void {
  const block = schedule[selectedDay.value][blockIndex];
  block.breaks.push({ start: '12:00', end: '13:00' });
}
function removeBreak(blockIndex: number, breakIndex: number): void {
  schedule[selectedDay.value][blockIndex].breaks.splice(breakIndex, 1);
}
function addBlock(): void {
  schedule[selectedDay.value].push(emptyBlock());
}
function removeBlock(blockIndex: number): void {
  schedule[selectedDay.value].splice(blockIndex, 1);
}

function setDayEnabled(day: DayKey, value: boolean): void {
  dayEnabled[day] = value;
}

function onDayEnabledChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (target && selectedDay.value) setDayEnabled(selectedDay.value, !!target.checked);
}

function buildSchedulePayload(): Schedule {
  const out = emptySchedule();
  for (const d of dayKeys) {
    out[d] = schedule[d].map((b) => ({
      start: b.start,
      end: b.end,
      breaks: b.breaks.map((br) => ({ start: br.start, end: br.end })),
    }));
  }
  return out;
}

function validateAll(): string | null {
  for (const d of dayKeys) {
    const blocks = schedule[d];
    const overlapErr = validateBlocksNoOverlap(blocks);
    if (overlapErr) return overlapErr;
    for (const block of blocks) {
      const err = validateBlock(block);
      if (err) return err;
    }
  }
  return null;
}

const canSaveException = computed(() => {
  if (!newException.date) return false;
  if (newException.type === 'range') {
    return newException.start != null && newException.end != null && newException.start < newException.end;
  }
  return true;
});

function clearExceptionForm(): void {
  newException.date = '';
  newException.type = 'full_day';
  newException.start = '12:00';
  newException.end = '13:00';
  newException.reason = '';
}

async function loadExceptions(): Promise<void> {
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) return;
  const db = getDbInstance();
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const q = query(
    collection(db, 'tenants', tid, 'staff', sid, 'exceptions'),
    where('date', '>=', fromStr),
    where('date', '<=', toStr)
  );
  const snap = await getDocs(q);
  exceptionsList.value = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      date: data.date ?? '',
      type: (data.type ?? 'full_day') as 'full_day' | 'range',
      start: data.start ?? null,
      end: data.end ?? null,
      reason: data.reason ?? null,
    };
  });
}

async function saveException(): Promise<void> {
  if (!canSaveException.value || exceptionSaving.value) return;
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) return;
  exceptionSaving.value = true;
  try {
    const db = getDbInstance();
    const payload: Record<string, unknown> = {
      date: newException.date,
      type: newException.type,
      reason: newException.reason.trim() || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (newException.type === 'range') {
      payload.start = newException.start;
      payload.end = newException.end;
    } else {
      payload.start = null;
      payload.end = null;
    }
    await addDoc(collection(db, 'tenants', tid, 'staff', sid, 'exceptions'), payload);
    showExceptionForm.value = false;
    clearExceptionForm();
    await loadExceptions();
  } catch (e) {
    console.error('Error saving exception:', e);
  } finally {
    exceptionSaving.value = false;
  }
}

async function removeException(exceptionId: string): Promise<void> {
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) return;
  try {
    const db = getDbInstance();
    await deleteDoc(doc(db, 'tenants', tid, 'staff', sid, 'exceptions', exceptionId));
    await loadExceptions();
  } catch (e) {
    console.error('Error removing exception:', e);
  }
}

async function handleSave(): Promise<void> {
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) return;
  const err = validateAll();
  if (err) {
    validationError.value = err;
    return;
  }
  validationError.value = '';
  saving.value = true;
  try {
    const db = getDbInstance();
    const staffRef = doc(db, 'tenants', tid, 'staff', sid);
    const dayEnabledPayload: Record<string, boolean> = {};
    dayKeys.forEach((d) => {
      dayEnabledPayload[d] = dayEnabled[d];
    });
    await updateDoc(staffRef, {
      timezone: 'America/Argentina/Buenos_Aires',
      schedule: buildSchedulePayload(),
      dayEnabled: dayEnabledPayload,
      updatedAt: serverTimestamp(),
    });
    router.push(staffListUrl.value);
  } catch (e) {
    console.error('Error saving availability:', e);
    saving.value = false;
  }
}

onMounted(async () => {
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) {
    loading.value = false;
    return;
  }
  try {
    const db = getDbInstance();
    const staffSnap = await getDoc(doc(db, 'tenants', tid, 'staff', sid));
    if (!staffSnap.exists()) {
      router.push(staffListUrl.value);
      return;
    }
    const d = staffSnap.data();
    staffName.value = [d.firstName, d.lastName].filter(Boolean).join(' ') || 'Staff';
    const existingDayEnabled = d.dayEnabled;
    if (existingDayEnabled && typeof existingDayEnabled === 'object') {
      dayKeys.forEach((day) => {
        if (typeof existingDayEnabled[day] === 'boolean') dayEnabled[day] = existingDayEnabled[day];
      });
    }
    const existing = d.schedule;
    if (existing && typeof existing === 'object') {
      for (const day of dayKeys) {
        const arr = existing[day];
        if (Array.isArray(arr)) {
          schedule[day] = arr.map((b: { start?: string; end?: string; breaks?: BreakSlot[] }) => ({
            start: b.start ?? '09:00',
            end: b.end ?? '18:00',
            breaks: Array.isArray(b.breaks) ? b.breaks.map((br) => ({ start: br.start ?? '12:00', end: br.end ?? '13:00' })) : [],
          }));
        }
      }
    }
    await loadExceptions();
  } catch (e) {
    console.error('Error loading staff:', e);
    router.push(staffListUrl.value);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.availability-block {
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background: var(--f7-block-strong-bg-color, #fff);
  border-radius: 8px;
}
.availability-block .list {
  margin: 0;
}
.availability-block input[type="time"] {
  font-size: 1rem;
  padding: 4px 8px;
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  border-radius: 6px;
}
.availability-breaks {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--f7-list-item-border-color, #e5e5ea);
}
.availability-breaks-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.85rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.availability-break-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.availability-break-row input[type="time"] {
  font-size: 0.9rem;
  padding: 4px 6px;
}
.availability-block-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}
.availability-add-block {
  margin-top: 0.5rem;
}
.block-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.availability-error-block {
  margin-bottom: 0;
}
.availability-error {
  margin: 0;
  color: var(--f7-color-red);
  font-size: 0.9rem;
}
.availability-days-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.availability-days {
  flex-wrap: nowrap;
  min-width: min-content;
}
.availability-add-exception {
  margin-top: 0.5rem;
}
.availability-exception-form .block-title {
  margin-bottom: 0.75rem;
}
.availability-cancel-exception {
  margin-top: 0.5rem;
  margin-left: 0.5rem;
}
</style>
