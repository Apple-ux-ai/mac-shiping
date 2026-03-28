import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_EXTERNAL_API_BASE || '/api-web';
const WEB_GATEWAY_BASE_URL = '/api/external';
const SOFT_NUMBER = '10030';

const normalizeAds = (payload) => {
    const list = Array.isArray(payload?.data?.data)
        ? payload.data.data
        : (Array.isArray(payload?.data) ? payload.data : []);

    return list.filter((item) => typeof item?.adv_url === 'string' && item.adv_url.trim() !== '');
};

export const AdService = {
    /**
     * Fetch advertisements for a specific position
     * @param {string} position Advertisement position ID (e.g., 'adv_position_01')
     * @returns {Promise<Array>} List of ads
     */
    async fetchAd(position) {
        try {
            const payload = {
                soft_number: SOFT_NUMBER,
                adv_position: position,
            };

            try {
                const gatewayResponse = await axios.post(
                    `${WEB_GATEWAY_BASE_URL}/get-ads`,
                    payload,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        timeout: 10000,
                    }
                );

                const normalizedGatewayAds = normalizeAds(gatewayResponse);
                if (normalizedGatewayAds.length > 0) {
                    return normalizedGatewayAds;
                }
            } catch (gatewayError) {
                const status = gatewayError?.response?.status;
                if (status && status !== 404 && status < 500) {
                    throw gatewayError;
                }
            }

            const params = new URLSearchParams();
            params.append('soft_number', SOFT_NUMBER);
            params.append('adv_position', position);

            const response = await axios.post(
                `${API_BASE_URL}/soft_desktop/get_adv`,
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000,
                }
            );

            return normalizeAds(response);
        } catch (error) {
            console.error(`Fetch ad failed for position ${position}:`, error);
            return [];
        }
    }
};
