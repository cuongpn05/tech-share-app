import axios from "axios";
import { apiClient } from "../config/api";
import { AIComparison } from "../types/ai";

interface AIComparisonResponse {
  success: boolean;
  message: string;
  data: AIComparison;
}

export interface AIConsultRecommendation {
  device: {
    _id: string;
    name: string;
    pricePerDay: number;
    images?: string[];
  };
  reason: string;
}

export interface AIConsultResponse {
  success: boolean;
  reply: string;
  message?: string;
  recommendations: AIConsultRecommendation[];
}

export interface GenerateDescriptionPayload {
  name: string;
  brand: string;
  category: string;
  pricePerDay: number;
  depositAmount: number;
  specs: Record<string, string>;
}

export interface GenerateDescriptionResponse {
  success: boolean;
  message: string;
  description: string;
}

export class AIServiceError extends Error {
  constructor(public readonly status: number) {
    super(`AI request failed with status ${status}`);
    this.name = "AIServiceError";
  }
}

export async function compareDevices(
  deviceId1: string,
  deviceId2: string,
): Promise<AIComparison> {
  try {
    const response = await apiClient.post<AIComparisonResponse>("/ai/compare", {
      deviceId1,
      deviceId2,
    });

    if (response.data?.success !== true || !response.data.data) {
      throw new Error(
        response.data?.message || "Invalid AI comparison response",
      );
    }

    return response.data.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw new AIServiceError(error.response?.status ?? 0);
    }
    throw error;
  }
}

export async function consultRentalAssistant(
  message: string,
): Promise<AIConsultResponse> {
  const response = await apiClient.post<AIConsultResponse>(
    "/ai/consultant",
    { message },
    { timeout: 60000 },
  );

  if (
    response.data.success !== true ||
    typeof response.data.reply !== "string" ||
    !Array.isArray(response.data.recommendations)
  ) {
    throw new Error(response.data.message || "Invalid AI consultation response");
  }

  return response.data;
}

export async function generateDescription(
  data: GenerateDescriptionPayload,
): Promise<GenerateDescriptionResponse> {
  const response = await apiClient.post<GenerateDescriptionResponse>(
    "/ai/generate-description",
    data,
    { timeout: 60000 },
  );

  if (
    response.data.success !== true ||
    typeof response.data.description !== "string" ||
    !response.data.description.trim()
  ) {
    throw new Error(
      response.data.message || "The server did not return a device description.",
    );
  }

  return response.data;
}
