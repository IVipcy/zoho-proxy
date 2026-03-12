const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/deals", async (req, res) => {
  const { access_token, payload } = req.body;

  if (!access_token || !payload) {
    return res.status(400).json({ error: "access_token and payload are required" });
  }

  try {
    const response = await fetch("https://www.zohoapis.jp/crm/v2/Deals", {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
