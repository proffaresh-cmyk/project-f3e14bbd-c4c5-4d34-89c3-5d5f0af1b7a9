import { queryOptions } from "@tanstack/react-query";
import { getDashboard, getSettingsData, getStats, listHabits, listReminders, listTasks } from "./api.functions";

export const dashboardQuery = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
export const tasksQuery = queryOptions({ queryKey: ["tasks"], queryFn: () => listTasks() });
export const remindersQuery = queryOptions({ queryKey: ["reminders"], queryFn: () => listReminders() });
export const habitsQuery = queryOptions({ queryKey: ["habits"], queryFn: () => listHabits() });
export const statsQuery = queryOptions({ queryKey: ["stats"], queryFn: () => getStats() });
export const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettingsData() });
