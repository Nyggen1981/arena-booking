/**
 * Vipps API Client
 * Handles communication with Vipps API for payment processing
 */

interface VippsConfig {
  clientId: string
  clientSecret: string
  subscriptionKey: string
  testMode: boolean
}

interface VippsAccessToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
}

interface VippsPaymentRequest {
  amount: number // Amount in øre (e.g., 10000 = 100 NOK)
  currency: string // "NOK"
  reference: string // Unique reference for this payment
  userFlow: "WEB_REDIRECT" | "NATIVE_REDIRECT"
  returnUrl: string
  cancelUrl: string
  consentRemovalPrefix?: string
  shippingDetailsPrefix?: string
  paymentDescription: string
  userDetails?: {
    userId?: string
    phoneNumber?: string
    email?: string
  }
}

interface VippsPaymentResponse {
  orderId: string
  url: string
}

class VippsClient {
  private config: VippsConfig
  private accessToken: VippsAccessToken | null = null

  constructor(config: VippsConfig) {
    this.config = config
  }

  /**
   * Get base URL for Vipps API
   */
  private getBaseUrl(): string {
    if (this.config.testMode) {
      return "https://apitest.vipps.no"
    }
    return "https://api.vipps.no"
  }

  /**
   * Get access token from Vipps OAuth endpoint
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (
      this.accessToken &&
      Date.now() < this.accessToken.expires_at - 60000 // Refresh 1 minute before expiry
    ) {
      return this.accessToken.access_token
    }

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64")

    const response = await fetch(`${this.getBaseUrl()}/accessToken/get`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get Vipps access token: ${error}`)
    }

    const data = await response.json()
    const accessToken = {
      ...data,
      expires_at: Date.now() + data.expires_in * 1000,
    }
    this.accessToken = accessToken

    return accessToken.access_token
  }

  /**
   * Create a payment request
   */
  async createPayment(
    request: VippsPaymentRequest
  ): Promise<VippsPaymentResponse> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          merchantInfo: {
            merchantSerialNumber: this.config.clientId,
            callbackPrefix: process.env.VIPPS_CALLBACK_URL || "",
            fallBack: request.returnUrl,
            consentRemovalPrefix: request.consentRemovalPrefix,
            shippingDetailsPrefix: request.shippingDetailsPrefix,
            isApp: false,
          },
          transaction: {
            orderId: request.reference,
            amount: request.amount,
            transactionText: request.paymentDescription,
          },
          customerInfo: request.userDetails,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create Vipps payment: ${error}`)
    }

    const data = await response.json()
    return {
      orderId: data.orderId,
      url: data.url,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(orderId: string): Promise<any> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments/${orderId}/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "X-Request-Id": crypto.randomUUID(),
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get Vipps payment status: ${error}`)
    }

    return await response.json()
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(orderId: string): Promise<void> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments/${orderId}/cancel`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          merchantInfo: {
            merchantSerialNumber: this.config.clientId,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to cancel Vipps payment: ${error}`)
    }
  }

  /**
   * Capture a payment (for reserved payments)
   */
  async capturePayment(orderId: string, amount: number): Promise<void> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `${this.getBaseUrl()}/ecomm/v2/payments/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "application/json",
          "X-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({
          merchantInfo: {
            merchantSerialNumber: this.config.clientId,
          },
          transaction: {
            amount: amount,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to capture Vipps payment: ${error}`)
    }
  }
}

/**
 * Get Vipps client for an organization
 */
export async function getVippsClient(organizationId: string) {
  const { prisma } = await import("./prisma")
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      vippsClientId: true,
      vippsClientSecret: true,
      vippsSubscriptionKey: true,
      vippsTestMode: true,
    },
  })

  if (
    !org?.vippsClientId ||
    !org?.vippsClientSecret ||
    !org?.vippsSubscriptionKey
  ) {
    throw new Error("Vipps is not configured for this organization")
  }

  return new VippsClient({
    clientId: org.vippsClientId,
    clientSecret: org.vippsClientSecret,
    subscriptionKey: org.vippsSubscriptionKey,
    testMode: org.vippsTestMode ?? true,
  })
}

export type { VippsPaymentRequest, VippsPaymentResponse }


