import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chatWithExtraction,
  createExtraction,
  deleteExtraction,
  exportExtractionCsv,
  fetchExtraction,
  fetchExtractionRecords,
  fetchExtractions,
  queryExtraction,
  reindexExtraction,
  resetExtraction,
  uploadDocuments,
} from "@/api/extractions";
import {
  createAggregation,
  deleteAggregation,
  fetchAggregationResult,
  fetchAggregations,
  regenerateAggregation,
} from "@/api/aggregations";
import type { ChatMessage, CreateAggregationPayload, CreateExtractionPayload } from "@/api/types";

export const useExtractions = () =>
  useQuery({ queryKey: ["extractions"], queryFn: fetchExtractions });

export const useExtraction = (id: string, options?: { refetchInterval?: number | false }) =>
  useQuery({
    queryKey: ["extraction", id],
    queryFn: () => fetchExtraction(id),
    refetchInterval: options?.refetchInterval,
  });

export const useExtractionRecords = (id: string) =>
  useQuery({
    queryKey: ["extraction-records", id],
    queryFn: () => fetchExtractionRecords(id),
  });

export const useCreateExtraction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExtractionPayload) => createExtraction(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extractions"] }),
  });
};

export const useDeleteExtraction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExtraction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extractions"] }),
  });
};

export const useUploadDocuments = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => uploadDocuments(extractionId, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraction", extractionId] });
      qc.invalidateQueries({ queryKey: ["extraction-records", extractionId] });
    },
  });
};

export const useReindexExtraction = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reindexExtraction(extractionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extraction", extractionId] });
      qc.invalidateQueries({ queryKey: ["extraction-records", extractionId] });
    },
  });
};

export const useResetExtraction = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetExtraction(extractionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extraction", extractionId] }),
  });
};

export const useQueryExtraction = () =>
  useMutation({
    mutationFn: ({ id, query }: { id: string; query: string }) => queryExtraction(id, query),
  });

export const useExportCsv = () =>
  useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => exportExtractionCsv(id, name),
  });

export const useExtractionChat = (extractionId: string) =>
  useMutation({
    mutationFn: ({ message, history }: { message: string; history: ChatMessage[] }) =>
      chatWithExtraction(extractionId, message, history),
  });

export const useAggregations = (extractionId: string, options?: { refetchInterval?: number | false | ((query: any) => number | false) }) =>
  useQuery({
    queryKey: ["aggregations", extractionId],
    queryFn: () => fetchAggregations(extractionId),
    refetchInterval: options?.refetchInterval,
    enabled: !!extractionId,
  });

export const useCreateAggregation = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAggregationPayload) => createAggregation(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aggregations", extractionId] }),
  });
};

export const useRunAggregation = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aggId: string) => fetchAggregationResult(aggId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aggregations", extractionId] }),
  });
};

export const useRegenerateAggregation = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aggId: string) => regenerateAggregation(aggId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aggregations", extractionId] }),
  });
};

export const useDeleteAggregation = (extractionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aggId: string) => deleteAggregation(aggId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aggregations", extractionId] }),
  });
};
