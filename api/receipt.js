export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { patientName, amount, paymentMethod, email, description } = req.body;
  const GI_KEY    = process.env.VITE_GI_KEY;
  const GI_SECRET = process.env.VITE_GI_SECRET;

  try {
    // Step 1: Get auth token
    const authRes = await fetch("https://api.greeninvoice.co.il/api/v1/account/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: GI_KEY, secret: GI_SECRET }),
    });
    const authData = await authRes.json();
    if (!authData.token) throw new Error("Authentication failed");

    // Step 2: Search for existing client by email
    let existingClientId = null;
    if (email) {
      const searchRes = await fetch(
        "https://api.greeninvoice.co.il/api/v1/clients/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authData.token}`,
          },
          body: JSON.stringify({ search: email }),
        }
      );
      const searchData = await searchRes.json();
      // Find client whose email matches exactly
      if (searchData.items && searchData.items.length > 0) {
        const match = searchData.items.find(c =>
          c.emails && c.emails.some(e => e.toLowerCase() === email.toLowerCase())
        );
        if (match) existingClientId = match.id;
      }
    }

    // Step 3: Build client object
    const clientObj = existingClientId
      ? { id: existingClientId }
      : {
          name: patientName,
          emails: email ? [email] : [],
          add: true,
        };

    // Step 4: Payment type map
    const paymentTypeMap = {
      "מזומן": 1,
      "שיק": 2,
      "כרטיס אשראי": 3,
      "העברה בנקאית": 4,
      "ביט": 1,
      "פייבוקס": 1,
    };

    const fullAmount = parseFloat(amount);
    const priceBeforeVat = Math.round((fullAmount / 1.18) * 100) / 100;

    // Step 5: Create receipt
    const receiptRes = await fetch("https://api.greeninvoice.co.il/api/v1/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authData.token}`,
      },
      body: JSON.stringify({
        description: description || "טיפול קלינאות תקשורת",
        type: 320,
        lang: "he",
        currency: "ILS",
        vatType: 0,
        discount: 0,
        rounding: false,
        signed: true,
        sendByEmail: email ? true : false,
        client: clientObj,
        income: [
          {
            description: description || "טיפול קלינאות תקשורת",
            quantity: 1,
            price: priceBeforeVat,
            currency: "ILS",
            vatType: 0,
          },
        ],
        payment: [
          {
            type: paymentTypeMap[paymentMethod] || 1,
            price: fullAmount,
            currency: "ILS",
            date: new Date().toISOString().split("T")[0],
          },
        ],
      }),
    });

    const receiptData = await receiptRes.json();
    console.log("GI Full Response:", JSON.stringify(receiptData));
    console.log("Payment type sent:", paymentTypeMap[paymentMethod] || 1);
    console.log("Payment method string:", paymentMethod);
    if (receiptData.errorMessage) throw new Error(receiptData.errorMessage);

    return res.status(200).json({
      success: true,
      receiptNumber: receiptData.number,
      receiptUrl: receiptData.url,
      emailSent: email ? true : false,
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
