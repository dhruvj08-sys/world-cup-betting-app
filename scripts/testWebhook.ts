import fetch from 'node-fetch'; // if needed, we can just use native fetch if node 18+

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}/api/webhook/sports-data`;

async function testWebhook() {
  console.log("Sending mock API-Football payload to local webhook endpoint...");

  // Send payload simulating a live goal
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'dev-secret-key'
    },
    body: JSON.stringify({
      fixture: {
        id: 8655, // Slovenia vs Denmark externalId
        status: { short: '2H' } // Live second half
      },
      goals: {
        home: 1,
        away: 1
      }
    })
  });

  const data = await res.json();
  console.log("Response:", data);

  if (!res.ok) {
    console.error("Webhook failed");
    process.exit(1);
  } else {
    console.log("Webhook processed successfully!");
  }
}

testWebhook().catch(console.error);
