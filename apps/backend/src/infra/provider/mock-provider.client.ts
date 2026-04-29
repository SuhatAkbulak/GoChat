import { Injectable } from '@nestjs/common';
import axios from 'axios';

type SendPayload = {
  channel: 'whatsapp' | 'instagram';
  to: string;
  text: string;
  clientMessageId?: string;
};

type ProviderSendResult =
  | { success: true; providerMessageId: string }
  | { success: false; retryable: boolean; error: string };

@Injectable()
export class MockProviderClient {
  private readonly baseUrl = process.env.MOCK_PROVIDER_BASE_URL || 'http://localhost:4000';

  async sendMessage(payload: SendPayload): Promise<ProviderSendResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });

      return {
        success: true,
        providerMessageId: response.data.providerMessageId,
      };
    } catch (error: any) {
      const status = error?.response?.status as number | undefined;
      const retryable = status === 429 || (status !== undefined && status >= 500) || !status;
      const message = error?.response?.data?.error || error?.message || 'Provider send failed';

      return {
        success: false,
        retryable,
        error: message,
      };
    }
  }
}
