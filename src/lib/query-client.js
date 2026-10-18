import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Read volume control: a screen re-uses data fetched in the last minute
			// instead of re-reading the whole table on every navigation. Every save
			// still invalidates its keys, so edits appear immediately.
			staleTime: 60000,
		},
	},
});