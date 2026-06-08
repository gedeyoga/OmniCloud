import { defineStore } from 'pinia';
import { api } from '../services/api';

export const useAccountManagementStore = defineStore('accountManagement', {
	state: () => ({
		accounts: [],
		isLoading: false,
		error: null,
	}),
	actions: {
		async loadAccounts() {
			this.isLoading = true;
			this.error = null;
			try {
				const { data } = await api.listAccounts();
				this.accounts = data;
			} catch (error) {
				this.error = error.message;
			} finally {
				this.isLoading = false;
			}
		},
	},
});
