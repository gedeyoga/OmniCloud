<script setup>
import { computed } from 'vue';

const props = defineProps({
	uploads: { type: Array, required: true },
	totalProgress: { type: Number, required: true },
});

const ringStyle = computed(() => ({
	'--progress': props.totalProgress,
}));
</script>

<template>
	<aside v-if="uploads.length" class="fixed bottom-5 right-5 z-50 w-[320px] rounded-[28px] border border-[#dbe4ef] bg-white p-5 shadow-[0_16px_40px_rgba(32,33,36,0.18)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-[0_16px_40px_rgba(15,23,42,0.45)]">
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#1a73e8]">Upload queue</p>
				<strong class="mt-1 block text-base text-[#202124] dark:text-slate-100">{{ totalProgress }}% collective progress</strong>
			</div>
			<span class="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-semibold text-[#1a73e8]">{{ uploads.length }} active</span>
		</div>

		<div class="mx-auto my-5 grid size-24 place-items-center rounded-full" :style="{ background: `conic-gradient(#1a73e8 0 ${totalProgress}%, #eaf1fb ${totalProgress}% 100%)` }">
			<div class="grid size-[68px] place-items-center rounded-full bg-white text-sm font-bold text-[#1a73e8] dark:bg-slate-800">{{ totalProgress }}%</div>
		</div>

		<div class="space-y-3">
			<div v-for="upload in uploads" :key="upload.id" class="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafd] px-4 py-3 dark:bg-slate-700/60">
				<div>
					<strong class="block text-sm text-[#202124] dark:text-slate-100">{{ upload.name }}</strong>
					<p class="text-xs text-[#5f6368] dark:text-slate-400">{{ upload.status }}</p>
				</div>
				<span class="text-sm font-semibold text-[#1a73e8]">{{ upload.progress_percentage }}%</span>
			</div>
		</div>
	</aside>
</template>
