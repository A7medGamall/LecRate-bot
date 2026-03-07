// Simple script to test the handler export locally as if we were Netlify
import { handler } from './netlify/functions/bot.js';

async function test() {
    const mockEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
            update_id: 12345,
            message: {
                message_id: 1,
                from: { id: 111, is_bot: false, first_name: "Mock" },
                chat: { id: 111, type: "private" },
                date: Math.floor(Date.now() / 1000),
                text: "/start"
            }
        })
    };

    try {
        console.log("Calling handler...");
        const result = await handler(mockEvent);
        console.log("Result:", result);
    } catch (err) {
        console.error("Handler threw an unhandled error:", err);
    }
}

test();
