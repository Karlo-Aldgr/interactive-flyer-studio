import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAutomation,
  activateAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  listAutomations,
  listAutomationFlyers,
  listAutomationSteps,
  listAutomationVersions,
  publishAutomation,
  pauseAutomation,
  updateAutomation,
} from "@/lib/automations/service";
import type { CreateAutomationInput, UpdateAutomationInput } from "@/lib/automations/types";

const automationKeys = {
  all: ["automations"] as const,
  list: (flyerId?: string) => ["automations", "list", flyerId ?? "all"] as const,
  detail: (id: string) => ["automations", "detail", id] as const,
  versions: (id: string) => ["automations", "versions", id] as const,
  steps: (versionId: string) => ["automations", "steps", versionId] as const,
  flyers: ["automations", "flyers"] as const,
};

export function useAutomations(flyerId?: string) {
  return useQuery({ queryKey: automationKeys.list(flyerId), queryFn: () => listAutomations(flyerId) });
}
export function useAutomationFlyers() {
  return useQuery({ queryKey: automationKeys.flyers, queryFn: listAutomationFlyers });
}
export function useAutomation(id?: string) {
  return useQuery({
    queryKey: automationKeys.detail(id ?? ""),
    queryFn: () => getAutomation(id!),
    enabled: !!id,
  });
}

export function useAutomationVersions(automationId?: string) {
  return useQuery({
    queryKey: automationKeys.versions(automationId ?? ""),
    queryFn: () => listAutomationVersions(automationId!),
    enabled: !!automationId,
  });
}

export function useAutomationSteps(versionId?: string) {
  return useQuery({
    queryKey: automationKeys.steps(versionId ?? ""),
    queryFn: () => listAutomationSteps(versionId!),
    enabled: !!versionId,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAutomationInput) => createAutomation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAutomationInput }) => updateAutomation(id, input),
    onSuccess: (automation) => {
      queryClient.setQueryData(automationKeys.detail(automation.id), automation);
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useDuplicateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: duplicateAutomation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: automationKeys.all }),
  });
}

export function useActivateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateAutomation,
    onSuccess: (automation) => {
      queryClient.setQueryData(automationKeys.detail(automation.id), automation);
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
      void queryClient.invalidateQueries({ queryKey: automationKeys.versions(automation.id) });
    },
  });
}

export function usePauseAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pauseAutomation,
    onSuccess: (automation) => {
      queryClient.setQueryData(automationKeys.detail(automation.id), automation);
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function usePublishAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishAutomation,
    onSuccess: (_versionId, automationId) => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.detail(automationId) });
      void queryClient.invalidateQueries({ queryKey: automationKeys.versions(automationId) });
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}
