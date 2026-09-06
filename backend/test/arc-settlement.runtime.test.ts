import assert from "node:assert/strict";
import test from "node:test";

import {
  Interface,
} from "ethers";

import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  ArcNetworkMismatchError,
  type ArcProvider,
  ArcTransactionFailedError,
  ArcTransactionNotFoundError,
  ArcUsdcVerificationError,
  verifyArcEnvironment,
  verifyArcTransaction,
} from "../src/arc-settlement/runtime.js";

const USDC_INTERFACE =
  new Interface([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ]);

const TRANSACTION_HASH =
  `0x${"ab".repeat(32)}`;

type ArcReceipt =
  Awaited<
    ReturnType<
      ArcProvider[
        "getTransactionReceipt"
      ]
    >
  >;

interface ProviderOptions {
  readonly chainId?:
    bigint;

  readonly usdcCode?:
    string;

  readonly usdcDecimals?:
    bigint;

  readonly receipt?:
    ArcReceipt;
}

function createProvider(
  options:
    ProviderOptions = {},
): ArcProvider {
  const chainId =
    options.chainId ??
    ARC_TESTNET_CHAIN_ID;

  const usdcCode =
    options.usdcCode ??
    "0x6000";

  const usdcDecimals =
    options.usdcDecimals ??
    6n;

  return {
    getNetwork:
      async () =>
        ({
          chainId,
        }) as Awaited<
          ReturnType<
            ArcProvider[
              "getNetwork"
            ]
          >
        >,

    getBlockNumber:
      async () =>
        123_456,

    getCode:
      async () =>
        usdcCode,

    call:
      async (
        transaction,
      ) => {
        const data =
          String(
            transaction.data ??
            "",
          );

        if (
          data ===
          USDC_INTERFACE
            .encodeFunctionData(
              "name",
            )
        ) {
          return USDC_INTERFACE
            .encodeFunctionResult(
              "name",
              [
                "USDC",
              ],
            );
        }

        if (
          data ===
          USDC_INTERFACE
            .encodeFunctionData(
              "symbol",
            )
        ) {
          return USDC_INTERFACE
            .encodeFunctionResult(
              "symbol",
              [
                "USDC",
              ],
            );
        }

        if (
          data ===
          USDC_INTERFACE
            .encodeFunctionData(
              "decimals",
            )
        ) {
          return USDC_INTERFACE
            .encodeFunctionResult(
              "decimals",
              [
                usdcDecimals,
              ],
            );
        }

        throw new Error(
          "Unexpected contract call.",
        );
      },

    getTransactionReceipt:
      async () =>
        options.receipt ??
        null,
  };
}

function createReceipt(
  status:
    number,
): NonNullable<ArcReceipt> {
  return {
    hash:
      TRANSACTION_HASH,

    blockNumber:
      654_321,

    status,
  } as unknown as NonNullable<ArcReceipt>;
}

test(
  "verifies the expected Arc Testnet environment",
  async () => {
    const result =
      await verifyArcEnvironment(
        createProvider(),
      );

    assert.equal(
      result.chainId,
      ARC_TESTNET_CHAIN_ID,
    );

    assert.equal(
      result.latestBlock,
      123_456,
    );

    assert.equal(
      result.usdcAddress,
      ARC_TESTNET_USDC_ADDRESS,
    );

    assert.equal(
      result.usdcName,
      "USDC",
    );

    assert.equal(
      result.usdcSymbol,
      "USDC",
    );

    assert.equal(
      result.usdcDecimals,
      6,
    );
  },
);

test(
  "rejects a provider connected to the wrong chain",
  async () => {
    await assert.rejects(
      verifyArcEnvironment(
        createProvider({
          chainId:
            1n,
        }),
      ),
      ArcNetworkMismatchError,
    );
  },
);

test(
  "rejects a missing Arc USDC contract",
  async () => {
    await assert.rejects(
      verifyArcEnvironment(
        createProvider({
          usdcCode:
            "0x",
        }),
      ),
      ArcUsdcVerificationError,
    );
  },
);

test(
  "rejects unexpected Arc USDC decimals",
  async () => {
    await assert.rejects(
      verifyArcEnvironment(
        createProvider({
          usdcDecimals:
            18n,
        }),
      ),
      ArcUsdcVerificationError,
    );
  },
);

test(
  "rejects a transaction without a confirmed receipt",
  async () => {
    await assert.rejects(
      verifyArcTransaction(
        TRANSACTION_HASH,
        createProvider(),
      ),
      ArcTransactionNotFoundError,
    );
  },
);

test(
  "rejects a reverted Arc transaction",
  async () => {
    await assert.rejects(
      verifyArcTransaction(
        TRANSACTION_HASH,
        createProvider({
          receipt:
            createReceipt(
              0,
            ),
        }),
      ),
      ArcTransactionFailedError,
    );
  },
);

test(
  "normalizes a successful Arc transaction confirmation",
  async () => {
    const result =
      await verifyArcTransaction(
        TRANSACTION_HASH,
        createProvider({
          receipt:
            createReceipt(
              1,
            ),
        }),
      );

    assert.deepEqual(
      result,
      {
        transactionHash:
          TRANSACTION_HASH,

        blockNumber:
          654_321,

        status:
          "CONFIRMED",
      },
    );
  },
);
