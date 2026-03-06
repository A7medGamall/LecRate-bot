import { bot } from '../../index.js';

export const handler = async (event) => {
    // Only respond to POST requests from Telegram
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 200,
            body: 'LecRate Telegram Bot Webhook is awake and listening!'
        };
    }

    try {
        // Parse incoming update from Telegram
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        
        // Pass the update to the telegraf bot instance
        await bot.handleUpdate(body);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Success" })
        };
    } catch (error) {
        console.error('Webhook Error:', error);
        // We still return 200 to Telegram so it doesn't retry and block the queue
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Error handled" })
        };
    }
};
