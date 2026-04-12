export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { instanceId, token, phone, message } = req.body;

  if (!instanceId || !token || !phone || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Format phone number - remove leading 0, add 972
  const formattedPhone = phone.replace(/\D/g, "").replace(/^0/, "972") + "@c.us";

  try {
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: formattedPhone,
          message: message,
        }),
      }
    );

    const data = await response.json();

    if (data.idMessage) {
      return res.status(200).json({ success: true, messageId: data.idMessage });
    } else {
      return res.status(400).json({ success: false, error: data.description || "Failed to send" });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

