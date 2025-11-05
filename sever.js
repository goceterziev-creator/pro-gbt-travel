// ✅ server.js – PRO-GBT AI Travel Backend

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Amadeus API настройки
const AMADEUS_ENV = (process.env.AMADEUS_ENV || "production").toLowerCase();
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;

if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
    console.error("❌ ERROR: AMADEUS_CLIENT_ID или AMADEUS_CLIENT_SECRET липсват в .env файла");
    process.exit(1);
}

// ✅ Amadeus URLs
const TOKEN_URL =
    AMADEUS_ENV === "production"
        ? "https://api.amadeus.com/v1/security/oauth2/token"
        : "https://test.api.amadeus.com/v1/security/oauth2/token";

const FLIGHT_OFFERS_URL =
    AMADEUS_ENV === "production"
        ? "https://api.amadeus.com/v2/shopping/flight-offers"
        : "https://test.api.amadeus.com/v2/shopping/flight-offers";

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // за index.html

// ✅ Cache за токен
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
    const now = Date.now();
    if (tokenCache.token && tokenCache.expiresAt - 5000 > now) {
        return tokenCache.token;
    }

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", AMADEUS_CLIENT_ID);
    params.append("client_secret", AMADEUS_CLIENT_SECRET);

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
    });

    if (!res.ok) {
        console.error("❌ Token Error:", await res.text());
        throw new Error("Неуспешно генериране на токен");
    }

    const data = await res.json();
    tokenCache.token = data.access_token;
    tokenCache.expiresAt = Date.now() + (data.expires_in || 1799) * 1000;
    console.log("✅ Нов токен е получен!");
    return tokenCache.token;
}

// ✅ Основен endpoint: Търсене на полети
app.post("/api/search-flights", async (req, res) => {
    try {
        const {
            origin, destination, departureDate,
            returnDate = "", adults = 1,
            travelClass = "ECONOMY", currency = "EUR", nonStop = false, max = 10
        } = req.body;

        if (!origin || !destination || !departureDate) {
            return res.status(400).json({ error: "origin, destination и departureDate са задължителни" });
        }

        const token = await getAccessToken();

        const params = new URLSearchParams({
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate,
            adults: String(adults),
            travelClass,
            currencyCode: currency,
            nonStop: String(nonStop),
            max: String(max)
        });

        if (returnDate) params.append("returnDate", returnDate);

        const apiRes = await fetch(`${FLIGHT_OFFERS_URL}?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const text = await apiRes.text();
        let data;

        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }

        if (!apiRes.ok) {
            console.error("❌ Amadeus API Error:", text);
            return res.status(apiRes.status).json({ error: "amadeus_error", details: data });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error("❌ Server Error:", err);
        res.status(500).json({ error: "server_error", details: err.message });
    }
});

// ✅ Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "✅ Server OK", environment: AMADEUS_ENV });
});

// ✅ Start server
app.listen(PORT, () => {
    console.log(`🚀 PRO-GBT backend listening at http://localhost:${PORT} | Env: ${AMADEUS_ENV}`);
});