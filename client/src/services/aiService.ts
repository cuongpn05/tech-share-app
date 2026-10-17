import axios from "axios";
import { apiClient } from "../config/api";
import { AIComparison } from "../types/ai";

interface AIComparisonResponse {
  success: boolean;
  message: string;
  data: AIComparison;
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
