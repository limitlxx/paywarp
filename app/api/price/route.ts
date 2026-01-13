import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient, http, parseAbi } from 'viem';
import { mantleMainnet, mantleSepolia } from '@/lib/networks';

// In-memory cache for fiat/USD rates
const fiatPriceCache: Record<
  string,
  { price: number; timestamp: number }
> = {};
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Validation schema for query parameters
const PriceFetchSchema = z.object({
  token: z.enum(["mnt", "usdc", "usdy", "musd"], {
    message: "Token must be one of mnt, usdc, usdy, musd",
  }),
  chain: z
    .enum(["mantle"], { message: "Chain must be mantle" })
    .optional()
    .default("mantle"),
  fiat_amount: z.number().positive("Fiat amount must be positive"),
  fiat_currency: z
    .string()
    .min(3, "Fiat currency code must be at least 3 characters")
    .toUpperCase(),
  network: z.enum(["mainnet", "sepolia"]).optional().default("sepolia"),
});

// Chainlink Price Feed ABI
const PRICE_FEED_ABI = parseAbi([
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
]);

// Chainlink price feed addresses on Mantle
const PRICE_FEED_ADDRESSES = {
  mainnet: {
    MNT_USD: '0xD97F20bEbeD74e8144134C4b148fE93417dd0F96', // Real Chainlink MNT/USD feed
  },
  sepolia: {
    // No feeds on Mantle Sepolia - will use CMC fallback
  }
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.toLowerCase();
    const chain = searchParams.get("chain")?.toLowerCase() || "mantle";
    const fiat_amount = parseFloat(searchParams.get("fiat_amount") || "0");
    const fiat_currency = searchParams.get("fiat_currency")?.toUpperCase();
    const network = searchParams.get("network")?.toLowerCase() || "sepolia";

    // Validate query parameters
    const validatedData = PriceFetchSchema.parse({
      token,
      chain,
      fiat_amount,
      fiat_currency,
      network,
    });
    
    // Check cache for fiat/USD rate
    const cacheKey = validatedData.fiat_currency;
    const cached = fiatPriceCache[cacheKey];
    const now = Date.now();
    let fiatPerUsd: number;

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
      fiatPerUsd = cached.price;
    } else {
      // CMC API Key from env
      const cmcApiKey = process.env.CMC_API_KEY;
      if (!cmcApiKey) {
        return NextResponse.json(
          { error: "CMC API key not configured" },
          { status: 500 }
        );
      }

      // Fetch fiat rate from CoinMarketCap
      const cmcResponse = await fetch(
        `https://pro-api.coinmarketcap.com/v1/tools/price-conversion?amount=1&symbol=USD&convert=${validatedData.fiat_currency}`,
        {
          headers: {
            "X-CMC_PRO_API_KEY": cmcApiKey,
            Accept: "application/json",
          },
        }
      );

      if (!cmcResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch from CoinMarketCap" },
          { status: 502 }
        );
      }

      const cmcData = await cmcResponse.json();
      fiatPerUsd = cmcData.data.quote[validatedData.fiat_currency].price;
      
      if (!fiatPerUsd) {
        return NextResponse.json(
          { error: "Price not available for this fiat currency" },
          { status: 404 }
        );
      }

      // Update cache
      fiatPriceCache[cacheKey] = {
        price: fiatPerUsd,
        timestamp: now,
      };
    }

    // Calculate fiat_amount in USD
    const fiatInUsd = validatedData.fiat_amount / fiatPerUsd;

    // Fetch token/USD rates
    const tokenRates: Record<string, string> = {};
    const convertedAmount: Record<string, string> = {};

    // Get MNT price
    let mntPrice: number;
    
    if (validatedData.network === "mainnet") {
      // Try Chainlink first on mainnet
      try {
        const client = createPublicClient({
          chain: mantleMainnet,
          transport: http(process.env.NEXT_PUBLIC_MANTLE_MAINNET_RPC),
        });

        const feedAddress = PRICE_FEED_ADDRESSES.mainnet.MNT_USD;
        const [roundId, answer, , updatedAt] = await client.readContract({
          address: feedAddress,
          abi: PRICE_FEED_ABI,
          functionName: 'latestRoundData'
        });

        const decimals = await client.readContract({
          address: feedAddress,
          abi: PRICE_FEED_ABI,
          functionName: 'decimals'
        });

        mntPrice = Number(answer) / Math.pow(10, decimals);
        
        // Validate price is reasonable
        if (mntPrice < 0.01 || mntPrice > 100) {
          throw new Error('Unreasonable price from Chainlink');
        }
      } catch (error) {
        console.warn('Chainlink feed failed, falling back to CMC:', error);
        // Fallback to CMC for MNT price
        const mntResponse = await fetch(
          `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=MNT&convert=USD`,
          {
            headers: {
              "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY!,
              Accept: "application/json",
            },
          }
        );

        if (mntResponse.ok) {
          const mntData = await mntResponse.json();
          mntPrice = mntData.data.MNT[0].quote.USD.price;
        } else {
          mntPrice = 1.06; // Fallback rate
        }
      }
    } else {
      // Use CMC for testnet
      try {
        const mntResponse = await fetch(
          `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=MNT&convert=USD`,
          {
            headers: {
              "X-CMC_PRO_API_KEY": process.env.CMC_API_KEY!,
              Accept: "application/json",
            },
          }
        );

        if (mntResponse.ok) {
          const mntData = await mntResponse.json();
          mntPrice = mntData.data.MNT[0].quote.USD.price;
        } else {
          mntPrice = 1.06; // Fallback rate
        }
      } catch (error) {
        mntPrice = 1.06; // Fallback rate
      }
    }

    // Set token rates and converted amounts
    tokenRates["MNT/USD"] = mntPrice.toFixed(6);
    convertedAmount["MNT"] = (fiatInUsd / mntPrice).toFixed(6);

    // For stablecoins, assume 1:1 with USD
    const stablecoinPrice = 1.0;
    tokenRates["USDC/USD"] = stablecoinPrice.toFixed(2);
    tokenRates["USDY/USD"] = stablecoinPrice.toFixed(2);
    tokenRates["MUSD/USD"] = stablecoinPrice.toFixed(2);
    
    convertedAmount["USDC"] = fiatInUsd.toFixed(2);
    convertedAmount["USDY"] = fiatInUsd.toFixed(2);
    convertedAmount["MUSD"] = fiatInUsd.toFixed(2);

    // Payment currency and final amount
    const paymentCurrency = validatedData.token.toUpperCase();
    const finalAmount = convertedAmount[paymentCurrency];

    // Structured response
    const responseData = {
      data: {
        amount_fiat: validatedData.fiat_amount.toString(),
        converted_amount: convertedAmount,
        conversion_rate: {
          source: {
            fiat: "CoinMarketCap",
            crypto: validatedData.network === "mainnet" ? "Chainlink + CMC" : "CoinMarketCap",
          },
          fiat: validatedData.fiat_currency,
          usd_rate: fiatPerUsd.toFixed(2),
          token_rates: tokenRates,
        },
        payment_currency: paymentCurrency,
        final_amount: finalAmount,
        network: validatedData.network,
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Price fetch error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}