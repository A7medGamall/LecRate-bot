import bot from '../../index.js';

export const handler = async (event) => {
    try {
        // Only respond to POST requests from Telegram
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 200,
                body: 'LecRate Telegram Bot Webhook is awake and listening!'
            };
        }

        // Parse incoming update from Telegram
        const body = JSON.parse(event.body);
        
        // Pass the update to the telegraf bot instance
        await bot.handleUpdate(body);

        return {
            statusCode: 200,
            body: ''
        };
    } catch (error) {
        console.error('Webhook Error:', error);
        return {
            statusCode: 500,
            body: 'Internal Server Error'
        };
    }
};
