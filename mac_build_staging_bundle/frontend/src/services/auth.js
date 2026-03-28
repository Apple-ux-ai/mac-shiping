import axios from 'axios'

// Configuration
const SECRET_KEY = '7530bfb1ad6c41627b0f0620078fa5ed'
const API_WEB_BASE_URL = import.meta.env.VITE_EXTERNAL_API_BASE || '/api-web'
const WEB_GATEWAY_BASE_URL = '/api/external'
const UPDATE_SERVER_URL = 'http://software.kunqiongai.com:8000'
const SOFT_NUMBER = '10030'

async function postViaGatewayOrApiWeb(gatewayPath, apiWebPath, data = {}, options = {}) {
  try {
    return await axios.post(`${WEB_GATEWAY_BASE_URL}${gatewayPath}`, data, options)
  } catch (gatewayError) {
    const status = gatewayError?.response?.status
    if (status && status !== 404 && status < 500) {
      throw gatewayError
    }
    return axios.post(`${API_WEB_BASE_URL}${apiWebPath}`, data, options)
  }
}

/**
 * Generate Signed Nonce (HMAC-SHA256)
 */
export async function generateSignedNonce() {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `${nonce}|${timestamp}`

  const encoder = new TextEncoder()
  const keyData = encoder.encode(SECRET_KEY)
  const msgData = encoder.encode(message)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, msgData)
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return { nonce, timestamp, signature }
}

/**
 * Encode nonce for URL
 */
export function encodeSignedNonce(signedNonce) {
  const jsonStr = JSON.stringify(signedNonce)
  // URL safe base64
  let urlSafe = btoa(jsonStr)
  urlSafe = urlSafe.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return urlSafe
}

/**
 * API Wrapper Class
 */
export const AuthService = {
  /**
   * Fetch the base web login URL from server
   */
  async fetchBaseWebLoginUrl() {
    try {
      const res = await postViaGatewayOrApiWeb(
        '/get-web-login-url',
        '/soft_desktop/get_web_login_url',
        {},
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      )
      if (res.data.code === 1 && res.data.data?.login_url) {
        return res.data.data.login_url
      }
      throw new Error(res.data.msg || 'Failed to fetch login URL')
    } catch (error) {
      console.error('Fetch base login URL error:', error)
      throw error
    }
  },

  async getLoginUrl() {
    const [signed, baseUrl] = await Promise.all([
      generateSignedNonce(),
      this.fetchBaseWebLoginUrl(),
    ])

    const encoded = encodeSignedNonce(signed)
    const url = `${baseUrl}?client_type=desktop&client_nonce=${encoded}`
    return { url, encodedNonce: encoded }
  },

  async pollTokenOnce(encodedNonce) {
    const pollUrl = `${API_WEB_BASE_URL}/user/desktop_get_token`
    const params = new URLSearchParams()
    params.append('client_type', 'desktop')
    params.append('client_nonce', encodedNonce)

    try {
      const res = await axios.post(pollUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      })
      if (res.data.code === 1 && res.data.data?.token) {
        return res.data.data.token
      }
      return null
    } catch (error) {
      return null
    }
  },

  async checkLogin(token) {
    const url = `${API_WEB_BASE_URL}/user/check_login`
    const params = new URLSearchParams()
    params.append('token', token)

    try {
      const res = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      return res.data.code === 1
    } catch (error) {
      return false
    }
  },

  async getUserInfo(token) {
    const url = `${API_WEB_BASE_URL}/soft_desktop/get_user_info`

    try {
      const res = await axios.post(
        url,
        {},
        {
          headers: {
            token: token,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      if (res.data.code === 1 && res.data.data?.user_info) {
        return res.data.data.user_info
      }
      return null
    } catch (error) {
      console.error('Get user info error', error)
      return null
    }
  },

  async logout(token) {
    const url = `${API_WEB_BASE_URL}/logout`

    try {
      const res = await axios.post(
        url,
        {},
        {
          headers: {
            token: token,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )
      return res.data.code === 1
    } catch (error) {
      return false
    }
  },

  async fetchCustomUrl() {
    try {
      const res = await postViaGatewayOrApiWeb(
        '/get-custom-url',
        '/soft_desktop/get_custom_url',
        {},
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      )
      return res.data.code === 1 && res.data.data?.url ? res.data.data.url : null
    } catch (e) {
      return null
    }
  },

  async fetchFeedbackUrl() {
    try {
      const res = await postViaGatewayOrApiWeb(
        '/get-feedback-url',
        '/soft_desktop/get_feedback_url',
        {},
        {
          // Content-Type: none (axios default or empty)
        }
      )

      if (res.data.code === 1 && res.data.data?.url) {
        let feedbackUrl = res.data.data.url
        // Append soft_number if needed
        if (feedbackUrl.includes('soft_number=')) {
          // If it ends with =, append directly
          if (feedbackUrl.endsWith('soft_number=')) {
            feedbackUrl += SOFT_NUMBER
          } else {
            // It might be empty value or placeholder, let's assume standard query param replacement if it was empty
            // But based on user request "soft_number参数值填入实际的软件编号"
            // If url is like "...?soft_number=", just append.
          }
        } else {
          // If soft_number param is missing, append it
          const separator = feedbackUrl.includes('?') ? '&' : '?'
          feedbackUrl += `${separator}soft_number=${SOFT_NUMBER}`
        }
        return feedbackUrl
      }
      return null
    } catch (e) {
      console.error('Fetch feedback URL error:', e)
      return null
    }
  },

  async checkUpdate(currentVersion) {
    try {
      const response = await axios.get(`${UPDATE_SERVER_URL}/api/v1/updates/check/`, {
        params: {
          software: SOFT_NUMBER,
          version: currentVersion,
        },
      })
      return response.data
    } catch (error) {
      console.error('Check update failed:', error)
      throw error
    }
  },
}
